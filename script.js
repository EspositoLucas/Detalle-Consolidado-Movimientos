const STORAGE_KEY = 'detallesConsolidados'; // Clave para localStorage

// --- Inicialización ---
document.addEventListener('DOMContentLoaded', () => {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('fecha').value = today;
    // No establecer ID por defecto aquí, createNewDetalle lo hará
    createNewDetalle(false); // Inicializa con un detalle vacío sin mensaje
    updateDateHeaders();
    calculateTotals();
});

// --- Funciones de Utilidad ---
function formatCurrency(value) {
    // Asegura que el valor sea numérico antes de formatear
    const numberValue = parseFloat(value || 0);
    // Usa 'es-AR' para formato argentino (punto como separador de miles, coma para decimales)
    return numberValue.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseCurrency(value) {
    if (typeof value !== 'string') return parseFloat(value || 0);
    // Manejar ambos formatos: "1.234,50" (AR) y "1234.50" (input number)
    // Primero quitar puntos (separadores de miles), luego reemplazar coma por punto decimal
    const cleanedValue = value.replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(cleanedValue);
    return isNaN(parsed) ? 0 : parsed; // Devolver 0 si no es un número válido
}

function showStatusMessage(message, type = 'success') {
    const msgElement = document.getElementById('status-message');
    if (!msgElement) return; // Salir si el elemento no existe
    msgElement.textContent = message;
    // Clases base + clase específica del tipo
    msgElement.className = `mt-3 text-sm font-medium ${type === 'success' ? 'text-green-600' : type === 'error' ? 'text-red-600' : 'text-blue-600'}`; // Añadido 'info' azul
    // Ocultar mensaje después de 3 segundos
    setTimeout(() => { msgElement.textContent = ''; }, 3000);
}

// --- Actualización de Fechas ---
function updateDateHeaders() {
    const fechaInput = document.getElementById('fecha').value;
    // Crear objeto Date asegurando que se interprete como hora local (añadiendo T00:00:00)
    const fecha = fechaInput ? new Date(fechaInput + 'T00:00:00') : new Date();
    // Opciones para formato DD/MM/YYYY
    const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
    const fechaFormateada = fecha.toLocaleDateString('es-AR', options); // Formato AR

    // Actualizar el placeholder del concepto de gasto
    const gastoConceptoInput = document.querySelector('#gastos-list .concept-input');
    if (gastoConceptoInput) {
        gastoConceptoInput.value = `Gastos hasta el ${fechaFormateada}`;
    }

    // Actualizar ID por defecto si el campo está vacío o es un detalle nuevo no cargado/guardado
     const idInput = document.getElementById('detalle-id');
     // Usamos un atributo data-* para saber si el detalle fue cargado/guardado previamente
     if (!idInput.dataset.loadedId && !idInput.value.startsWith('Detalle ')) { // Evita sobreescribir IDs ya modificados por el usuario
         idInput.value = `Detalle ${fechaFormateada}`;
     }
}

// --- Gestión de Filas ---
let rowCounters = { compras: 0, ventas: 0, cobranzas: 0, articulos: 0, aportes: 0 };

function addRow(type, data = { concept: '', amount: '' }) {
    const list = document.getElementById(`${type}-list`);
    if (!list) return; // Salir si el contenedor de la lista no existe

    const rowId = `${type}-row-${rowCounters[type]++}`;
    const newRow = document.createElement('div');
    newRow.id = rowId;
    // Clases de Tailwind para el layout y estilo
    newRow.classList.add('input-row', 'flex', 'flex-col', 'md:flex-row', 'gap-4', 'mb-3', 'items-start', 'border-b', 'pb-3', 'border-gray-200');

    // Configuración específica por tipo de fila
    let conceptLabel = 'Concepto';
    let amountLabel = 'Importe';
    let amountPlaceholder = '0,00'; // Formato AR para placeholder
    let amountType = 'text'; // Usar 'text' para permitir comas y puntos, parsear luego
    let amountInputMode = 'decimal'; // Sugerir teclado numérico en móviles
    let conceptPlaceholder = 'Descripción o Persona';
    let amountValue = (data.amount !== undefined && data.amount !== null) ? formatCurrency(data.amount) : ''; // Formatear valor inicial
    let conceptValue = data.concept || '';

    if (type === 'articulos') {
        conceptLabel = 'Descripción Artículo';
        amountLabel = 'Cantidad';
        amountPlaceholder = '0';
        amountType = 'number'; // Cantidad es entero
        amountInputMode = 'numeric';
        conceptPlaceholder = 'Nombre del artículo';
        amountValue = parseInt(data.amount || 0); // Cantidad es entero
    } else if (type === 'aportes') {
        conceptLabel = 'Persona que Aporta';
        conceptPlaceholder = 'Nombre de la persona';
    } else if (type !== 'gastos') { // Para compras, ventas, cobranzas
         conceptPlaceholder = `${type.charAt(0).toUpperCase() + type.slice(1)} realizadas por...`;
    }

    // HTML interno de la nueva fila
    newRow.innerHTML = `
        <div class="flex-grow">
            <label class="input-label" for="${rowId}-concept">${conceptLabel}</label>
            <input type="text" id="${rowId}-concept" placeholder="${conceptPlaceholder}" class="input-field concept-input" value="${conceptValue}" oninput="calculateTotals()">
        </div>
        <div class="w-full md:w-1/3">
            <label class="input-label" for="${rowId}-amount">${amountLabel}</label>
            <input type="${amountType}" ${amountType === 'number' ? 'step="1"' : 'step="0.01"'} inputmode="${amountInputMode}" id="${rowId}-amount" placeholder="${amountPlaceholder}" class="input-field amount-input text-right" value="${amountValue}" oninput="formatInputCurrency(this); calculateTotals();">
        </div>
        <div class="w-full md:w-auto pt-4 md:pt-5 remove-button-container">
            <button onclick="removeRow('${rowId}')" class="button remove-button button-danger" title="Eliminar fila">
                <i class="fas fa-trash-alt"></i>
            </button>
        </div>
    `;
    list.appendChild(newRow);

    // Si es un input de moneda (tipo texto), aplicar formato inicial
    if (amountType === 'text') {
        const amountInput = newRow.querySelector('.amount-input');
        // formatInputCurrency(amountInput); // Comentado para evitar doble formato inicial
    }
}
// Formatear input de moneda mientras se escribe (simplificado)
function formatInputCurrency(input) {
     // Permitir solo números, comas y puntos temporalmente para parseo
     // Esta función es básica, se podría mejorar para formatear en tiempo real con separadores
     calculateTotals(); // Recalcular en cada input
}


function removeRow(rowId) {
    const row = document.getElementById(rowId);
    if (row) {
        row.remove();
        calculateTotals(); // Recalcular totales después de eliminar
    }
}

// --- Cálculos ---
function calculateTotals() {
    let totalCompras = 0, totalVentas = 0, totalCobranzas = 0, totalGastos = 0, totalArticulos = 0, totalAportes = 0;
    const aportesDetallados = [];

    // Sumar totales de cada sección parseando los valores de los inputs
    document.querySelectorAll('#compras-list .input-row').forEach(row => totalCompras += parseCurrency(row.querySelector('.amount-input').value));
    document.querySelectorAll('#ventas-list .input-row').forEach(row => totalVentas += parseCurrency(row.querySelector('.amount-input').value));
    document.querySelectorAll('#cobranzas-list .input-row').forEach(row => totalCobranzas += parseCurrency(row.querySelector('.amount-input').value));

    // Gasto es un solo input (no en loop)
    const gastoInput = document.querySelector('#gastos-list .amount-input');
    if (gastoInput) totalGastos = parseCurrency(gastoInput.value);

    document.querySelectorAll('#articulos-list .input-row').forEach(row => totalArticulos += parseInt(row.querySelector('.amount-input').value || 0)); // Artículos son cantidad (entero)

    // Recoger aportes detallados
    document.querySelectorAll('#aportes-list .input-row').forEach(row => {
         const amount = parseCurrency(row.querySelector('.amount-input').value);
         const concept = row.querySelector('.concept-input').value.trim() || 'Aportante Anónimo';
         totalAportes += amount;
         if (amount > 0) { // Solo incluir aportes positivos en el detalle
            aportesDetallados.push({ persona: concept, monto: amount });
         }
    });

    // Actualizar UI Totales de cada sección
    document.getElementById('total-compras').textContent = formatCurrency(totalCompras);
    document.getElementById('total-ventas').textContent = formatCurrency(totalVentas);
    document.getElementById('total-cobranzas').textContent = formatCurrency(totalCobranzas);
    document.getElementById('total-gastos').textContent = formatCurrency(totalGastos);
    document.getElementById('total-articulos').textContent = totalArticulos; // Sin formato de moneda
    document.getElementById('total-aportes').textContent = formatCurrency(totalAportes);

    // Actualizar Resultados Consolidados
    document.getElementById('res-ventas').textContent = formatCurrency(totalVentas);
    document.getElementById('res-compras').textContent = formatCurrency(totalCompras);
    document.getElementById('res-gastos').textContent = formatCurrency(totalGastos);
    document.getElementById('res-cobranzas').textContent = formatCurrency(totalCobranzas);
    document.getElementById('res-aportes').textContent = formatCurrency(totalAportes);

    // Calcular Rentabilidad y Análisis de Aportes
    calculateProfitability(totalVentas, totalCompras, totalGastos, totalAportes, aportesDetallados);
}

// --- Cálculo de Rentabilidad y Análisis de Aportes ---
function calculateProfitability(ventas, compras, gastos, aportes, aportesDetallados) {
    const rentabilidad = ventas - (compras + gastos);
    const rentabilidadElement = document.getElementById('rentabilidad-total');
    const rentabilidadDistribuidaElement = document.getElementById('rentabilidad-distribuida');

    // Mostrar rentabilidad y aplicar estilo (positivo/negativo)
    rentabilidadElement.innerHTML = `<span class="currency">${formatCurrency(rentabilidad)}</span>`;
    rentabilidadElement.classList.toggle('profit-positive', rentabilidad >= 0);
    rentabilidadElement.classList.toggle('profit-negative', rentabilidad < 0);

    // Limpiar análisis de aportes anterior
    rentabilidadDistribuidaElement.innerHTML = '';

    // Mostrar análisis si hay aportes y detalles válidos
    if (aportes > 0 && aportesDetallados.length > 0) {
         let distribucionHtml = '<h4 class="font-semibold mt-2 text-blue-800">Análisis de Aportes a Gastos:</h4><ul class="list-none pl-0">'; // Usar list-none para controlar estilo
         let gastosCubiertosPorAportes = Math.min(gastos, aportes); // Cuánto de los gastos se cubre

         distribucionHtml += `<li class="text-gray-700 text-sm">- Total Aportes: <span class="currency font-medium">${formatCurrency(aportes)}</span></li>`;
         distribucionHtml += `<li class="text-gray-700 text-sm">- Gastos cubiertos por aportes: <span class="currency font-medium">${formatCurrency(gastosCubiertosPorAportes)}</span></li>`;

         // Calcular y mostrar diferencias si hay más de un aportante y gastos cubiertos
         if (aportesDetallados.length > 1 && gastosCubiertosPorAportes > 0) {
             const aporteEquitativo = gastosCubiertosPorAportes / aportesDetallados.length; // Cuánto debería poner cada uno para cubrir gastos
             distribucionHtml += `<li class="text-gray-700 text-sm">- Aporte equitativo p/persona (s/gastos cubiertos): <span class="currency font-medium">${formatCurrency(aporteEquitativo)}</span></li>`;
             distribucionHtml += '<ul class="list-disc list-inside ml-4 mt-1 text-sm">'; // Sublista para detalles
             aportesDetallados.forEach(aporte => {
                 const diferencia = aporte.monto - aporteEquitativo;
                 let diffClass = diferencia === 0 ? 'text-gray-600' : (diferencia > 0 ? 'text-green-600' : 'text-red-600');
                 let diffText = '';
                 if (diferencia !== 0) {
                     diffText = diferencia > 0 ? `(aportó ${formatCurrency(diferencia)} más)` : `(aportó ${formatCurrency(Math.abs(diferencia))} menos)`;
                 } else {
                     diffText = '(Equitativo)';
                 }
                 distribucionHtml += `<li class="${diffClass}">${aporte.persona}: <span class="currency">${formatCurrency(aporte.monto)}</span> ${diffText}</li>`;
             });
             distribucionHtml += '</ul>';
             distribucionHtml += `<li class="text-xs text-gray-500 mt-2">Nota: Las diferencias podrían requerir compensación según acuerdos.</li>`;

         } else if (aportesDetallados.length === 1) {
             // Caso de un solo aportante
              distribucionHtml += `<li class="text-gray-700 text-sm">- Aporte realizado únicamente por: ${aportesDetallados[0].persona}.</li>`;
         }

         distribucionHtml += '</ul>';
         rentabilidadDistribuidaElement.innerHTML = distribucionHtml;

    } else if (aportesDetallados.length > 0 && aportes <= 0) {
         // Caso donde hay nombres pero el total es 0 o negativo
         rentabilidadDistribuidaElement.innerHTML = '<p class="text-orange-600 text-xs">Se han añadido aportantes pero el total de aportes es cero o negativo.</p>';
    }
    // Si no hay aportes > 0, no se muestra nada.
}

// --- Funciones CRUD (Create, Read, Update, Delete) para localStorage ---

function getSavedDetalles() {
    const data = localStorage.getItem(STORAGE_KEY);
    try {
        // Parsea los datos guardados o devuelve un array vacío si no hay nada o hay error
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.error("Error parsing saved data from localStorage:", e);
        showStatusMessage("Error al leer datos guardados. Podrían estar corruptos.", "error");
        return []; // Devuelve array vacío en caso de error de parseo
    }
}

function saveAllDetalles(detalles) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(detalles));
    } catch (e) {
        console.error("Error saving data to localStorage:", e);
        // Informar al usuario si falla el guardado (posiblemente por límite de espacio)
        showStatusMessage("Error al guardar los datos. El almacenamiento podría estar lleno.", "error");
    }
}

function createNewDetalle(showMessage = true) {
    const today = new Date().toISOString().split('T')[0];
    const idInput = document.getElementById('detalle-id');
    document.getElementById('fecha').value = today;
    idInput.value = `Detalle ${new Date(today + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`; // ID inicial con fecha formateada
    idInput.readOnly = false; // Permitir edición del ID
    // Eliminar el atributo que rastrea si fue cargado/guardado
    delete idInput.dataset.loadedId;

    // Limpiar todas las listas de elementos dinámicos
    const listIds = ['compras-list', 'ventas-list', 'cobranzas-list', 'articulos-list', 'aportes-list'];
    listIds.forEach(id => document.getElementById(id).innerHTML = '');

    // Limpiar el input de gastos (que es fijo)
    const gastoInput = document.querySelector('#gastos-list .amount-input');
    if (gastoInput) gastoInput.value = ''; // Limpiar valor

    // Añadir una fila vacía inicial a cada sección (excepto gastos)
    addRow('compras');
    addRow('ventas');
    addRow('cobranzas');
    addRow('articulos');
    addRow('aportes');

    updateDateHeaders(); // Actualizar concepto de gasto y potencialmente ID por defecto
    calculateTotals(); // Recalcular totales (deberían ser 0)
    if (showMessage) showStatusMessage('Formulario limpiado para nuevo detalle.', 'info'); // Usar 'info' para limpieza
}

function collectCurrentData() {
    const idInput = document.getElementById('detalle-id');
    const fechaValue = document.getElementById('fecha').value;
    const data = {
        id: idInput.value.trim(), // Obtener ID del input y quitar espacios extra
        fecha: fechaValue,
        compras: [], ventas: [], cobranzas: [], articulos: [], aportes: [],
        // Parsear el gasto del input fijo
        gastos: parseCurrency(document.querySelector('#gastos-list .amount-input')?.value)
    };

    // Asignar un ID por defecto si está vacío al intentar guardar
    if (!data.id) {
        const defaultDate = fechaValue || new Date().toISOString().split('T')[0];
        data.id = `Detalle ${new Date(defaultDate + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
        idInput.value = data.id; // Actualizar el campo en la UI
    }

    // Recolectar datos de las filas dinámicas
    document.querySelectorAll('#compras-list .input-row').forEach(row => {
        const concept = row.querySelector('.concept-input').value.trim();
        const amount = parseCurrency(row.querySelector('.amount-input').value);
        if (concept || amount) data.compras.push({ concept, amount }); // Guardar solo si hay datos
    });
    document.querySelectorAll('#ventas-list .input-row').forEach(row => {
        const concept = row.querySelector('.concept-input').value.trim();
        const amount = parseCurrency(row.querySelector('.amount-input').value);
        if (concept || amount) data.ventas.push({ concept, amount });
    });
    document.querySelectorAll('#cobranzas-list .input-row').forEach(row => {
        const concept = row.querySelector('.concept-input').value.trim();
        const amount = parseCurrency(row.querySelector('.amount-input').value);
        if (concept || amount) data.cobranzas.push({ concept, amount });
    });
    document.querySelectorAll('#articulos-list .input-row').forEach(row => {
        const concept = row.querySelector('.concept-input').value.trim();
        const amount = parseInt(row.querySelector('.amount-input').value || 0);
        if (concept || amount > 0) data.articulos.push({ concept, amount }); // Guardar si hay concepto o cantidad > 0
    });
    document.querySelectorAll('#aportes-list .input-row').forEach(row => {
        const concept = row.querySelector('.concept-input').value.trim();
        const amount = parseCurrency(row.querySelector('.amount-input').value);
        if (concept || amount) data.aportes.push({ concept, amount });
    });

    return data;
}

function saveDetalle() {
    const currentData = collectCurrentData(); // Recoge datos, incluyendo ID actual del input

    // Validación básica del ID (ya debería tener uno por collectCurrentData)
    if (!currentData.id) {
        showStatusMessage('Error inesperado: No se pudo determinar un ID para el detalle.', 'error');
        return;
    }

    const detalles = getSavedDetalles();
    // Obtener el ID original con el que se cargó/guardó por última vez (si existe)
    const originalId = document.getElementById('detalle-id').dataset.loadedId;
    const newId = currentData.id; // El ID actual en el campo de texto

    // Verificar si el NUEVO ID ya existe en OTRO detalle diferente al que estamos editando
    const conflictingIndex = detalles.findIndex(d => d.id === newId && d.id !== originalId);
    if (conflictingIndex > -1) {
        // Si el nuevo ID ya está en uso por otro registro, mostrar error
        showStatusMessage(`Error: El ID "${newId}" ya existe para otro detalle. Elige un ID único.`, 'error');
        return;
    }

    let message = '';
    let existingIndex = -1;

    // Buscar el detalle existente usando el ID original (si se cargó o guardó antes y es diferente del nuevo)
    if (originalId && originalId !== newId) {
         existingIndex = detalles.findIndex(d => d.id === originalId);
         if (existingIndex === -1) {
             // Si el originalId no se encuentra (raro), intentar buscar por el newId por si acaso
             existingIndex = detalles.findIndex(d => d.id === newId);
         }
    } else {
        // Si no había ID original o no cambió, buscar por el ID actual
         existingIndex = detalles.findIndex(d => d.id === newId);
    }


    if (existingIndex > -1) {
        // Si encontramos el índice, actualizamos el detalle existente
        detalles[existingIndex] = currentData; // Reemplazar con los nuevos datos (incluye el ID potencialmente cambiado)
        message = `Detalle "${newId}" actualizado correctamente.`;
        if (originalId && originalId !== newId) {
             message += ` (Renombrado desde "${originalId}")`;
        }
    } else {
        // Si no se encontró índice, es un detalle nuevo
        detalles.push(currentData);
        message = `Detalle "${newId}" guardado como nuevo.`;
    }

    saveAllDetalles(detalles); // Guardar la lista actualizada en localStorage

    // Actualizar el atributo data-loaded-id con el ID con el que se acaba de guardar
    document.getElementById('detalle-id').dataset.loadedId = newId;
    // Mantener el campo de ID editable
     document.getElementById('detalle-id').readOnly = false;
    showStatusMessage(message, 'success');
}


function loadDetalle(detalleId) {
    const detalles = getSavedDetalles();
    const detalleToLoad = detalles.find(d => d.id === detalleId);

    if (!detalleToLoad) {
        showStatusMessage(`Error: No se encontró el detalle "${detalleId}".`, 'error');
        closeLoadModal(); // Cerrar modal si hay error
        return;
    }

    // Limpiar formulario ANTES de cargar datos nuevos (sin mensaje de limpieza)
    createNewDetalle(false);

    // Cargar datos generales
    const idInput = document.getElementById('detalle-id');
    document.getElementById('fecha').value = detalleToLoad.fecha || new Date().toISOString().split('T')[0]; // Usar fecha guardada o hoy
    idInput.value = detalleToLoad.id;
    idInput.readOnly = false; // Permitir editar el ID cargado
    // Guardar el ID cargado en el atributo data para referencia al guardar/actualizar
    idInput.dataset.loadedId = detalleToLoad.id;

    // Cargar el gasto fijo
    const gastoInput = document.querySelector('#gastos-list .amount-input');
    if (gastoInput) {
        // Formatear el valor de gasto antes de ponerlo en el input de texto
        gastoInput.value = formatCurrency(detalleToLoad.gastos || 0);
    }

    // Mapeo de tipos a IDs de listas
    const listMapping = {
        compras: 'compras-list',
        ventas: 'ventas-list',
        cobranzas: 'cobranzas-list',
        articulos: 'articulos-list',
        aportes: 'aportes-list'
    };

    // Limpiar las filas vacías iniciales añadidas por createNewDetalle
     Object.values(listMapping).forEach(listId => document.getElementById(listId).innerHTML = '');

    // Cargar filas dinámicas desde los datos guardados
    for (const type in listMapping) {
        if (detalleToLoad[type] && Array.isArray(detalleToLoad[type])) {
            if (detalleToLoad[type].length > 0) {
                // Si hay datos guardados para este tipo, añadirlos
                detalleToLoad[type].forEach(item => {
                     const amountValue = (item.amount !== undefined && item.amount !== null) ? item.amount : '';
                     addRow(type, { concept: item.concept || '', amount: amountValue });
                });
            } else {
                 // Si la sección estaba guardada pero vacía, añadir una fila vacía
                 if (type !== 'gastos') addRow(type);
            }
        } else if (type !== 'gastos') {
            // Si la sección no existía en los datos guardados, añadir una fila vacía
            addRow(type);
        }
    }

    updateDateHeaders(); // Asegurar que el concepto de gasto se actualice con la fecha cargada
    calculateTotals(); // Recalcular todos los totales con los datos cargados
    closeLoadModal(); // Cerrar el modal de carga
    showStatusMessage(`Detalle "${detalleToLoad.id}" cargado. Puedes modificarlo y guardarlo.`, 'success');
}


function deleteDetalle(detalleId) {
    // Confirmación antes de eliminar
    if (!confirm(`¿Estás seguro de que quieres eliminar el detalle "${detalleId}"? Esta acción no se puede deshacer.`)) {
        return; // Detener si el usuario cancela
    }

    let detalles = getSavedDetalles();
    const initialLength = detalles.length;

    // Filtrar la lista, manteniendo todos los detalles EXCEPTO el que coincide con detalleId
    const filteredDetalles = detalles.filter(d => d.id !== detalleId);

    // Verificar si realmente se eliminó algo (la longitud debería haber disminuido)
    if (filteredDetalles.length < initialLength) {
        saveAllDetalles(filteredDetalles); // Guardar la lista filtrada
        showStatusMessage(`Detalle "${detalleId}" eliminado correctamente.`, 'success');

        // Refrescar la lista en el modal inmediatamente para reflejar el cambio
        populateLoadModal();

        // Si el detalle eliminado era el que estaba cargado en el formulario, limpiar el formulario
        const idInput = document.getElementById('detalle-id');
        if (idInput.dataset.loadedId === detalleId) {
            createNewDetalle(false); // Limpiar formulario sin mensaje estándar
             showStatusMessage(`El detalle "${detalleId}" fue eliminado. Se ha limpiado el formulario.`, 'info'); // Mensaje específico
        }

    } else {
        // Caso improbable: el ID a eliminar no se encontró en la lista
        showStatusMessage(`Error: No se pudo encontrar el detalle "${detalleId}" para eliminar.`, 'error');
        // Refrescar modal por si acaso hubo desincronización
         populateLoadModal();
    }
}


// --- Gestión del Modal ---
const modal = document.getElementById('loadModal');

function openLoadModal() {
    populateLoadModal(); // Rellenar con los datos más recientes al abrir
    modal.style.display = 'block'; // Mostrar el modal
}

function closeLoadModal() {
    modal.style.display = 'none'; // Ocultar el modal
}

function populateLoadModal() {
    const listElement = document.getElementById('saved-list');
    const noSavedMsg = document.getElementById('no-saved-message');
    if (!listElement || !noSavedMsg) return; // Salir si los elementos del modal no existen

    listElement.innerHTML = ''; // Limpiar la lista antes de poblarla

    const detalles = getSavedDetalles(); // Obtener los datos MÁS RECIENTES de localStorage

    if (detalles.length === 0) {
        // Si no hay detalles, mostrar mensaje y ocultar lista
        noSavedMsg.style.display = 'block';
        listElement.style.display = 'none'; // Ocultar contenedor de lista
        return;
    }

    // Si hay detalles, ocultar mensaje y mostrar lista
    noSavedMsg.style.display = 'none';
    listElement.style.display = 'block'; // Asegurar que el contenedor de lista sea visible

    // Ordenar detalles por fecha descendente (más recientes primero)
    // Añadir manejo por si fecha no existe o es inválida
    detalles.sort((a, b) => {
        const dateA = new Date(a.fecha + 'T00:00:00' || 0);
        const dateB = new Date(b.fecha + 'T00:00:00' || 0);
        // Tratar fechas inválidas como más antiguas
        if (isNaN(dateA)) return 1;
        if (isNaN(dateB)) return -1;
        return dateB - dateA; // Orden descendente
    });

    // Crear y añadir elementos a la lista por cada detalle guardado
    detalles.forEach(detalle => {
        const itemDiv = document.createElement('div');
        itemDiv.classList.add('saved-item'); // Clase para estilo
        // Formatear fecha para mostrarla, o 'N/A' si no es válida
        let displayDate = 'N/A';
        if (detalle.fecha) {
            try {
                displayDate = new Date(detalle.fecha + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric'});
            } catch (e) { /* Mantener N/A si la fecha es inválida */ }
        }

        // Usar textContent para el ID para evitar problemas con caracteres especiales en el HTML
        const span = document.createElement('span');
        span.textContent = `${detalle.id} (Fecha: ${displayDate})`;
        span.title = `Cargar ${detalle.id}`;
        span.onclick = () => loadDetalle(detalle.id); // Asignar función de carga

        const deleteButton = document.createElement('button');
        deleteButton.classList.add('button', 'button-danger', 'remove-button');
        deleteButton.title = `Eliminar ${detalle.id}`;
        deleteButton.innerHTML = '<i class="fas fa-trash-alt"></i>';
        deleteButton.onclick = () => deleteDetalle(detalle.id); // Asignar función de borrado

        itemDiv.appendChild(span);
        itemDiv.appendChild(deleteButton);
        listElement.appendChild(itemDiv);
    });
}

// --- Cierre del Modal ---
// Cerrar el modal si se hace clic fuera de su contenido
window.onclick = function(event) {
    if (event.target == modal) { // Si el objetivo del clic es el fondo del modal
        closeLoadModal();
    }
}

// Cerrar modal con la tecla Escape
window.addEventListener('keydown', function(event) {
    if (event.key === 'Escape' && modal.style.display === 'block') {
        closeLoadModal();
    }
});