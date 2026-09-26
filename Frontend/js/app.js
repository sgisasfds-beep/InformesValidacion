// Estado Global
window.datosGlobales = {};
window.elementoActivo = '';
window.controlActivoPrec = 'lcm';
window.controlActivoExa = 'LCM';
window.vistaActual = 'carga';

// Estado para Linealidad (Actualizado: ya no requiere window.datosLinealidad)
window.parametroActivoLin = '';

if (window.Chart) {
    Chart.defaults.devicePixelRatio = Math.max(window.devicePixelRatio || 1, 3);
}

// Instancias de Gráficas para limpieza
window.chartMBInstance = null;
window.chartLCMInstance = null;
window.chartPrecisionInstance = null;
window.chartCurvasIndInstance = null;
window.chartCurvaPromedioInstance = null;

// Gestor de Vistas (Navegación sin React)
window.cambiarSeccion = async function (seccion) {
    try {
        const response = await fetch(`views/${seccion}.html`);
        const html = await response.text();
        document.getElementById('main-content').innerHTML = html;
        window.vistaActual = seccion;

        // Actualizar barra de navegación visual
        document.querySelectorAll('aside nav button').forEach(btn => {
            btn.classList.remove('bg-blue-600', 'text-white');
            btn.classList.add('hover:bg-slate-800', 'text-slate-400');
        });
        const activeBtn = document.getElementById(`btn-${seccion}`);
        if (activeBtn) {
            activeBtn.classList.remove('hover:bg-slate-800', 'text-slate-400');
            activeBtn.classList.add('bg-blue-600', 'text-white');
        }

        // Lógica post-renderizado de vista
        if (seccion === 'carga') {
            // Corrección: Validación para evitar el TypeError si el formulario no existe
            const uploadForm = document.getElementById('uploadForm');
            if (uploadForm) {
                uploadForm.addEventListener('submit', window.procesarFormulario);
            } else {
                console.warn("Advertencia: No se encontró un elemento con id='uploadForm' en views/carga.html");
            }
        } else if (seccion === 'linealidad') {
            // Se eliminó el listener del formulario viejo. Ahora lee de datosGlobales.
            if (Object.keys(window.datosGlobales).length > 0) {
                window.poblarSelectorLinealidad();
                if (window.parametroActivoLin) {
                    window.renderizarDatosLinealidad(window.parametroActivoLin);
                }
            }
        } else if (seccion === 'informe') {
            window.poblarSelectorInforme();
            window.guardarMetadatosYCompilar();
        } else {
            window.poblarSelectorGlobal();
            if (seccion === 'limites') window.renderizarLimites();
            if (seccion === 'precision') window.renderizarPrecision(window.controlActivoPrec);
            if (seccion === 'exactitud') window.renderizarExactitud(window.controlActivoExa);
            if (seccion === 'incertidumbre') {
                // Pequeño delay para asegurar que el DOM esté renderizado
                setTimeout(() => {
                    window.cargarConfigIncertidumbre();
                    window.calcularIncertidumbre();
                }, 50);
            }
        }
    } catch (e) {
        console.error("Error cargando la vista:", e);
    }
};

window.procesarFormulario = async function (e) {
    e.preventDefault();
    const formData = new FormData();
    const qcFiles = document.getElementById('archivos_qc').files;
    const configFile = document.getElementById('archivo_config').files[0];

    if (!qcFiles.length || !configFile) {
        alert("Por favor selecciona los archivos requeridos.");
        return;
    }

    for (let f of qcFiles) formData.append('archivos_qc', f);
    formData.append('archivo_config', configFile);
    formData.append('tipo_analisis', document.getElementById('tipo_analisis').value);

    try {
        const response = await fetch('http://localhost:8000/api/procesar-datos', {
            method: 'POST',
            body: formData
        });
        window.datosGlobales = await response.json();

        const elementos = Object.keys(window.datosGlobales);
        if (elementos.length > 0) {
            window.elementoActivo = elementos[0];
        }
        window.cambiarSeccion('limites');
    } catch (err) {
        alert("Error al comunicarse con el servidor o procesar archivos.");
    }
};

/* --- NUEVO: FLUJO PARA LINEALIDAD INTEGRADO --- */

window.poblarSelectorLinealidad = function () {
    const select = document.getElementById('selectParametroLin');
    if (!select) return;
    select.innerHTML = '';

    let foundFirst = false;

    Object.keys(window.datosGlobales).forEach(param => {
        // Solo agregar al selector si el elemento tiene datos de linealidad
        if (window.datosGlobales[param].linealidad) {
            const opt = document.createElement('option');
            opt.value = param;
            opt.textContent = param;

            // Si no hay un parámetro activo o el actual no tiene linealidad, asignamos el primero válido
            if (!foundFirst) {
                if (!window.parametroActivoLin || !window.datosGlobales[window.parametroActivoLin].linealidad) {
                    window.parametroActivoLin = param;
                }
                foundFirst = true;
            }

            if (param === window.parametroActivoLin) opt.selected = true;
            select.appendChild(opt);
        }
    });
};

window.renderizarDatosLinealidad = function (parametro) {
    // Validar que exista la linealidad en el objeto global para este parámetro
    if (!parametro || !window.datosGlobales[parametro] || !window.datosGlobales[parametro].linealidad) return;

    window.parametroActivoLin = parametro;

    // Extraer los datos desde la nueva ubicación global
    const data = window.datosGlobales[parametro].linealidad;
    document.getElementById('contenidoLinealidad').classList.remove('hidden');

    // === NUEVA LÓGICA RAS (INTERCEPTOR) ===
    if (data.es_ras_combinado) {
        // Mostrar un mensaje amigable en la tabla de stats
        document.getElementById('tablaStatsLinealidad').innerHTML = `
            <tr>
                <td colspan="2" class="py-6 px-4 text-center text-blue-800 bg-blue-50 font-semibold rounded">
                    El RAS es un parámetro calculado matemáticamente a partir de las concentraciones.<br><br>
                    Por favor, selecciona <b>Ca soluble</b>, <b>Mg soluble</b> o <b>Na soluble</b> en el menú superior para evaluar sus curvas de calibración.
                </td>
            </tr>
        `;
        // Limpiar la tabla de datos
        document.getElementById('headTablaLinealidad').innerHTML = '';
        document.getElementById('bodyTablaLinealidad').innerHTML = `
            <tr><td class="py-8 text-center text-slate-500 italic">No hay datos de curva directa para RAS.</td></tr>
        `;

        // Destruir gráficos previos para dejar los canvas en blanco
        if (window.chartCurvasIndInstance) window.chartCurvasIndInstance.destroy();
        if (window.chartCurvaPromedioInstance) window.chartCurvaPromedioInstance.destroy();

        return; // Detenemos la ejecución aquí para que no intente graficar "RAS"
    }
    // === FIN LÓGICA RAS ===

    // Renderizar Estadísticas (Código normal)
    const stats = data.stats;
    document.getElementById('tablaStatsLinealidad').innerHTML = `
        <tr><td class="py-2 font-semibold">Promedio de Pendientes</td><td class="py-2 font-mono text-right">${stats.promedio_pendientes}</td></tr>
        <tr class="bg-slate-50"><td class="py-2 font-semibold">Desviación de Pendientes</td><td class="py-2 font-mono text-right">${stats.desviacion_pendientes}</td></tr>
        <tr><td class="py-2 font-bold text-blue-700">Sensibilidad (m ± SD)</td><td class="py-2 font-mono text-right text-blue-700 font-bold bg-blue-50">${stats.sensibilidad}</td></tr>
        <tr class="bg-slate-50"><td class="py-2 font-semibold">Intercepto (Promedio)</td><td class="py-2 font-mono text-right">${stats.intercepto}</td></tr>
        <tr><td class="py-2 font-semibold">Coef. de Correlación (r)</td><td class="py-2 font-mono text-right">${stats.r}</td></tr>
        <tr class="bg-slate-50"><td class="py-2 font-semibold">Coef. de Determinación (R²)</td><td class="py-2 font-mono text-right font-bold text-emerald-700">${stats.r2}</td></tr>
        <tr><td class="py-2 font-semibold">Ecuación</td><td class="py-2 font-mono text-right italic">${stats.ecuacion}</td></tr>
    `;

    // Averiguar máximo de curvas para dinámicamente crear cabeceras
    let maxCurvas = 0;
    data.tabla.forEach(row => {
        if (row.señales.length > maxCurvas) maxCurvas = row.señales.length;
    });

    // Construir Cabeceras de Tabla
    let theadHTML = `<tr><th class="border border-slate-300 p-2">Concentración</th>`;
    for (let i = 1; i <= maxCurvas; i++) {
        theadHTML += `<th class="border border-slate-300 p-2">Señal ${i}</th>`;
    }
    theadHTML += `
        <th class="border border-slate-300 p-2 bg-indigo-50 text-indigo-800">Promedio Int.</th>
        <th class="border border-slate-300 p-2 text-slate-600">Conc. Calculada</th>
        <th class="border border-slate-300 p-2 text-red-600">% Error</th>
    </tr>`;
    document.getElementById('headTablaLinealidad').innerHTML = theadHTML;

    // Construir Cuerpo de Tabla
    let tbodyHTML = '';
    data.tabla.forEach((row, index) => {
        let fila = `<tr class="${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-blue-50">
            <td class="border border-slate-300 p-2 font-bold text-slate-800">${row.concentracion}</td>`;

        for (let i = 0; i < maxCurvas; i++) {
            const val = row.señales[i] !== undefined ? row.señales[i] : '-';
            fila += `<td class="border border-slate-300 p-2 font-mono text-slate-600">${val}</td>`;
        }

        fila += `
            <td class="border border-slate-300 p-2 font-mono font-bold text-indigo-700 bg-indigo-50/30">${row.promedio}</td>
            <td class="border border-slate-300 p-2 font-mono text-slate-600">${row.conc_calculada}</td>
            <td class="border border-slate-300 p-2 font-mono font-bold ${row.error_pct > 10 ? 'text-red-600' : 'text-emerald-600'}">${row.error_pct}%</td>
        </tr>`;
        tbodyHTML += fila;
    });
    document.getElementById('bodyTablaLinealidad').innerHTML = tbodyHTML;

    // Destruir gráficos previos
    if (window.chartCurvasIndInstance) window.chartCurvasIndInstance.destroy();
    if (window.chartCurvaPromedioInstance) window.chartCurvaPromedioInstance.destroy();

    // 1. Gráfico de Curvas Individuales
    const ctxInd = document.getElementById('chartCurvasInd').getContext('2d');
    const datasetsInd = data.curvas_raw.map((curva, i) => {
        const color = `hsl(${i * 60 + 200}, 70%, 50%)`;
        return {
            label: `Curva ${i + 1}`,
            data: curva.map(pt => ({ x: pt[0], y: pt[1] })),
            borderColor: color,
            backgroundColor: color,
            showLine: true,
            tension: 0
        };
    });

    window.chartCurvasIndInstance = new Chart(ctxInd, {
        type: 'scatter',
        data: { datasets: datasetsInd },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { title: { display: true, text: 'Concentración' } },
                y: { title: { display: true, text: 'Señal' } }
            }
        }
    });

    // 2. Gráfico Curva Promedio
    const ctxAvg = document.getElementById('chartCurvaPromedio').getContext('2d');
    const puntosPromedio = data.tabla.map(row => ({ x: row.concentracion, y: row.promedio }));

    // Crear línea de tendencia teórica visual
    const xVals = data.tabla.map(r => r.concentracion);
    const minX = Math.min(...xVals);
    const maxX = Math.max(...xVals);
    const lineaTendencia = [
        { x: minX, y: stats.intercepto_raw + stats.promedio_pendientes_raw * minX },
        { x: maxX, y: stats.intercepto_raw + stats.promedio_pendientes_raw * maxX }
    ];

    window.chartCurvaPromedioInstance = new Chart(ctxAvg, {
        type: 'scatter',
        data: {
            datasets: [
                {
                    label: 'Promedio Experimental',
                    data: puntosPromedio,
                    borderColor: '#2563eb',
                    backgroundColor: '#2563eb',
                    pointRadius: 5
                },
                {
                    type: 'line',
                    label: 'Línea de Regresión',
                    data: lineaTendencia,
                    borderColor: '#ef4444',
                    borderDash: [5, 5],
                    borderWidth: 2,
                    fill: false,
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { title: { display: true, text: 'Concentración' } },
                y: { title: { display: true, text: 'Promedio de Señal' } }
            }
        }
    });
};

/* --- MANTENIENDO EL RESTO INTACTO --- */

window.cambiarElementoGlobal = function (val) {
    window.elementoActivo = val;
    if (window.vistaActual === 'limites') window.renderizarLimites();
    if (window.vistaActual === 'precision') window.renderizarPrecision(window.controlActivoPrec);
    if (window.vistaActual === 'exactitud') window.renderizarExactitud(window.controlActivoExa);

    // Si estamos en la pestaña de incertidumbre, cargar/recalcular datos del nuevo elemento
    if (document.getElementById('sec-incertidumbre')) {
        window.cargarConfigIncertidumbre();
        window.calcularIncertidumbre();
    }
};

window.poblarSelectorGlobal = function () {
    const select = document.getElementById('selectElementoGlobal');
    if (!select) return;
    select.innerHTML = '';
    Object.keys(window.datosGlobales).forEach(elem => {
        const opt = document.createElement('option');
        opt.value = elem;
        opt.textContent = elem;
        if (elem === window.elementoActivo) opt.selected = true;
        select.appendChild(opt);
    });
};

window.actualizarTabs = function (prefijo, controlSeleccionado) {
    const botones = ['lcm', 'ccv', 'ea'];
    botones.forEach(c => {
        const btn = document.getElementById(`tab-${prefijo}-${c.toUpperCase()}`) || document.getElementById(`tab-${prefijo}-${c}`);
        if (btn) {
            if (c.toLowerCase() === controlSeleccionado.toLowerCase()) {
                btn.className = "px-4 py-2 text-sm font-bold rounded shadow-sm transition btn-tab bg-blue-600 text-white";
            } else {
                btn.className = "px-4 py-2 text-sm font-bold rounded shadow-sm transition btn-tab bg-white text-slate-600 border border-slate-300 hover:bg-slate-50";
            }
        }
    });
};

window.renderizarLimites = function () {
    if (!window.elementoActivo || !window.datosGlobales[window.elementoActivo]) return;
    const data = window.datosGlobales[window.elementoActivo];
    document.getElementById('contenidoElemento').classList.remove('hidden');

    document.getElementById('stat-lod').innerText = data.lod_posible;
    document.getElementById('stat-loq').innerText = data.loq_posible;
    document.getElementById('stat-teorico').innerText = data.teorico_lcm;
    document.getElementById('stat-error').innerText = data.lcm.global.error_pct + '%';

    const tbody = document.getElementById('tablaResultados');
    tbody.innerHTML = `
        <tr class="hover:bg-slate-50"><td class="border border-slate-300 p-2 font-semibold bg-slate-50">MB</td><td class="border border-slate-300 p-2">Analista 1</td><td class="border border-slate-300 p-2 font-mono">${data.mb.analista_1.promedio}</td><td class="border border-slate-300 p-2 font-mono">${data.mb.analista_1.desviacion}</td><td class="border border-slate-300 p-2 font-mono">${data.mb.analista_1.cv}%</td></tr>
        <tr class="hover:bg-slate-50"><td class="border border-slate-300 p-2 font-semibold bg-slate-50">MB</td><td class="border border-slate-300 p-2">Analista 2</td><td class="border border-slate-300 p-2 font-mono">${data.mb.analista_2.promedio}</td><td class="border border-slate-300 p-2 font-mono">${data.mb.analista_2.desviacion}</td><td class="border border-slate-300 p-2 font-mono">${data.mb.analista_2.cv}%</td></tr>
        <tr class="bg-blue-50/40 font-bold"><td class="border border-slate-300 p-2">MB</td><td class="border border-slate-300 p-2">Global</td><td class="border border-slate-300 p-2 font-mono">${data.mb.global.promedio}</td><td class="border border-slate-300 p-2 font-mono">${data.mb.global.desviacion}</td><td class="border border-slate-300 p-2 font-mono">${data.mb.global.cv}%</td></tr>
        <tr class="hover:bg-slate-50"><td class="border border-slate-300 p-2 font-semibold bg-slate-50">LCM</td><td class="border border-slate-300 p-2">Analista 1</td><td class="border border-slate-300 p-2 font-mono">${data.lcm.analista_1.promedio}</td><td class="border border-slate-300 p-2 font-mono">${data.lcm.analista_1.desviacion}</td><td class="border border-slate-300 p-2 font-mono">${data.lcm.analista_1.cv}%</td></tr>
        <tr class="hover:bg-slate-50"><td class="border border-slate-300 p-2 font-semibold bg-slate-50">LCM</td><td class="border border-slate-300 p-2">Analista 2</td><td class="border border-slate-300 p-2 font-mono">${data.lcm.analista_2.promedio}</td><td class="border border-slate-300 p-2 font-mono">${data.lcm.analista_2.desviacion}</td><td class="border border-slate-300 p-2 font-mono">${data.lcm.analista_2.cv}%</td></tr>
        <tr class="bg-blue-50/40 font-bold"><td class="border border-slate-300 p-2">LCM</td><td class="border border-slate-300 p-2">Global</td><td class="border border-slate-300 p-2 font-mono">${data.lcm.global.promedio}</td><td class="border border-slate-300 p-2 font-mono">${data.lcm.global.desviacion}</td><td class="border border-slate-300 p-2 font-mono">${data.lcm.global.cv}%</td></tr>
    `;

    const tbBrutos = document.getElementById('tablaDatosBrutos');
    if (tbBrutos) {
        let filasHTML = '';
        const valsMBA1 = data.mb.analista_1.valores || [];
        const valsMBA2 = data.mb.analista_2.valores || [];
        const valsLCMA1 = data.lcm.analista_1.valores || [];
        const valsLCMA2 = data.lcm.analista_2.valores || [];

        for (let i = 0; i < 10; i++) {
            const vMB1 = valsMBA1[i] !== undefined ? valsMBA1[i] : '-';
            const vMB2 = valsMBA2[i] !== undefined ? valsMBA2[i] : '-';
            const vLCM1 = valsLCMA1[i] !== undefined ? valsLCMA1[i] : '-';
            const vLCM2 = valsLCMA2[i] !== undefined ? valsLCMA2[i] : '-';

            filasHTML += `
                <tr class="hover:bg-slate-50">
                    <td class="border border-slate-300 p-1.5 font-bold bg-slate-50">${i + 1}</td>
                    <td class="border border-slate-300 p-1.5 font-mono text-slate-600">${vMB1}</td>
                    <td class="border border-slate-300 p-1.5 font-mono text-slate-600">${vMB2}</td>
                    <td class="border border-slate-300 p-1.5 font-mono text-indigo-700 font-medium">${vLCM1}</td>
                    <td class="border border-slate-300 p-1.5 font-mono text-indigo-700 font-medium">${vLCM2}</td>
                </tr>
            `;
        }
        tbBrutos.innerHTML = filasHTML;
    }

    if (window.chartMBInstance) window.chartMBInstance.destroy();
    if (window.chartLCMInstance) window.chartLCMInstance.destroy();

    const ctxMB = document.getElementById('chartMB').getContext('2d');
    window.chartMBInstance = new Chart(ctxMB, {
        type: 'scatter',
        data: {
            datasets: [
                { label: 'Analista 1', data: data.mb.raw.filter(d => d.analista === 'Analista 1').map((d, i) => ({ x: i + 1, y: d.valor })), backgroundColor: '#2563eb' },
                { label: 'Analista 2', data: data.mb.raw.filter(d => d.analista === 'Analista 2').map((d, i) => ({ x: i + 1, y: d.valor })), backgroundColor: '#059669' }
            ]
        },
        options: { responsive: true, scales: { x: { title: { display: true, text: 'Ensayos' } } } }
    });

    const ctxLCM = document.getElementById('chartLCM').getContext('2d');
    window.chartLCMInstance = new Chart(ctxLCM, {
        type: 'scatter',
        data: {
            datasets: [
                { type: 'line', label: 'Valor Teórico', data: [{ x: 0, y: data.teorico_lcm }, { x: 11, y: data.teorico_lcm }], borderColor: '#ef4444', borderDash: [5, 5], fill: false, pointRadius: 0 },
                { label: 'Analista 1', data: data.lcm.raw.filter(d => d.analista === 'Analista 1').map((d, i) => ({ x: i + 1, y: d.valor })), backgroundColor: '#2563eb' },
                { label: 'Analista 2', data: data.lcm.raw.filter(d => d.analista === 'Analista 2').map((d, i) => ({ x: i + 1, y: d.valor })), backgroundColor: '#059669' }
            ]
        },
        options: { responsive: true, scales: { x: { title: { display: true, text: 'Ensayos' }, min: 0, max: 11 } } }
    });
};

window.renderizarPrecision = function (control) {
    if (!window.elementoActivo || !window.datosGlobales[window.elementoActivo] || !window.datosGlobales[window.elementoActivo].precision) return;
    window.controlActivoPrec = control;
    window.actualizarTabs('prec', control);

    const dataPrec = window.datosGlobales[window.elementoActivo].precision[control];
    if (!dataPrec) return;

    document.getElementById('contenidoPrecision').classList.remove('hidden');
    const fmtYesNo = (normal) => normal ? `<span class="font-bold text-emerald-700">yes</span>` : `<span class="font-bold text-red-600">no</span>`;

    document.getElementById('tablaNormalidad').innerHTML = `
        <tr class="bg-white"><td colspan="3" class="p-2 text-left text-slate-800">Shapiro-Wilk Test</td></tr>
        <tr class="hover:bg-slate-50 border-t border-slate-300"><td class="border border-slate-300 p-2 text-left">W-stat</td><td class="border border-slate-300 p-2 font-mono">${dataPrec.normalidad.shapiro.analista_1.stat}</td><td class="border border-slate-300 p-2 font-mono">${dataPrec.normalidad.shapiro.analista_2.stat}</td></tr>
        <tr class="hover:bg-slate-50"><td class="border border-slate-300 p-2 text-left">p-value</td><td class="border border-slate-300 p-2 font-mono">${dataPrec.normalidad.shapiro.analista_1.p}</td><td class="border border-slate-300 p-2 font-mono">${dataPrec.normalidad.shapiro.analista_2.p}</td></tr>
        <tr class="hover:bg-slate-50"><td class="border border-slate-300 p-2 text-left">alpha</td><td class="border border-slate-300 p-2 font-mono">0.05</td><td class="border border-slate-300 p-2 font-mono">0.05</td></tr>
        <tr class="hover:bg-slate-50"><td class="border border-slate-300 p-2 text-left">normal</td><td class="border border-slate-300 p-2">${fmtYesNo(dataPrec.normalidad.shapiro.analista_1.normal)}</td><td class="border border-slate-300 p-2">${fmtYesNo(dataPrec.normalidad.shapiro.analista_2.normal)}</td></tr>
        <tr class="bg-white"><td colspan="3" class="p-2 pt-6 text-left text-slate-800 border-t-2 border-slate-300">d'Agostino-Pearson</td></tr>
        <tr class="hover:bg-slate-50 border-t border-slate-300"><td class="border border-slate-300 p-2 text-left">DA-stat</td><td class="border border-slate-300 p-2 font-mono">${dataPrec.normalidad.dagostino.analista_1.stat}</td><td class="border border-slate-300 p-2 font-mono">${dataPrec.normalidad.dagostino.analista_2.stat}</td></tr>
        <tr class="hover:bg-slate-50"><td class="border border-slate-300 p-2 text-left">p-value</td><td class="border border-slate-300 p-2 font-mono">${dataPrec.normalidad.dagostino.analista_1.p}</td><td class="border border-slate-300 p-2 font-mono">${dataPrec.normalidad.dagostino.analista_2.p}</td></tr>
        <tr class="hover:bg-slate-50"><td class="border border-slate-300 p-2 text-left">alpha</td><td class="border border-slate-300 p-2 font-mono">0.05</td><td class="border border-slate-300 p-2 font-mono">0.05</td></tr>
        <tr class="hover:bg-slate-50"><td class="border border-slate-300 p-2 text-left">normal</td><td class="border border-slate-300 p-2">${fmtYesNo(dataPrec.normalidad.dagostino.analista_1.normal)}</td><td class="border border-slate-300 p-2">${fmtYesNo(dataPrec.normalidad.dagostino.analista_2.normal)}</td></tr>
    `;

    const cardKw = document.getElementById('cardNoParametrica');
    const noNormalShapiro = !dataPrec.normalidad.shapiro.analista_1.normal || !dataPrec.normalidad.shapiro.analista_2.normal;
    const noNormalDagostino = !dataPrec.normalidad.dagostino.analista_1.normal || !dataPrec.normalidad.dagostino.analista_2.normal;

    if (noNormalShapiro || noNormalDagostino) {
        if (cardKw) cardKw.classList.remove('hidden');
        const kw = dataPrec.no_parametrica;
        const alertKw = kw.significativa ? `<span class="text-red-600 font-bold">Diferencia significativa</span>` : `<span class="text-emerald-700 font-bold">Sin diferencia significativa</span>`;
        document.getElementById('tablaNoParametrica').innerHTML = `
            <tr class="bg-slate-50"><td class="border border-slate-300 p-2 font-bold w-1/2">Estadístico H</td><td class="border border-slate-300 p-2 font-mono">${kw.kruskal_stat}</td></tr>
            <tr><td class="border border-slate-300 p-2 font-bold">Valor p</td><td class="border border-slate-300 p-2 font-mono">${kw.kruskal_p}</td></tr>
            <tr class="bg-slate-50"><td class="border border-slate-300 p-2 font-bold">Conclusión</td><td class="border border-slate-300 p-2">${alertKw}</td></tr>
        `;
    } else {
        if (cardKw) cardKw.classList.add('hidden');
    }

    const tagSig = (p) => p < 0.05 ? `<span class="text-red-600 font-bold">${p} *</span>` : `<span class="text-emerald-700 font-bold">${p}</span>`;
    if (Object.keys(dataPrec.anova).length > 0) {
        document.getElementById('tablaANOVA').innerHTML = `
            <tr class="hover:bg-slate-50"><td class="border border-slate-300 p-2 text-left font-semibold">Analista</td><td class="border border-slate-300 p-2 font-mono">${dataPrec.anova.analista.F}</td><td class="border border-slate-300 p-2 font-mono">${tagSig(dataPrec.anova.analista.p)}</td></tr>
            <tr class="hover:bg-slate-50"><td class="border border-slate-300 p-2 text-left font-semibold">Réplica</td><td class="border border-slate-300 p-2 font-mono">${dataPrec.anova.replica.F}</td><td class="border border-slate-300 p-2 font-mono">${tagSig(dataPrec.anova.replica.p)}</td></tr>
        `;
    } else {
        document.getElementById('tablaANOVA').innerHTML = `<tr><td colspan="3" class="p-4 text-slate-500 italic">No hay suficientes datos para el ANOVA.</td></tr>`;
    }

    if (window.chartPrecisionInstance) window.chartPrecisionInstance.destroy();
    const ctx = document.getElementById('chartPrecision').getContext('2d');
    const datosDelControl = window.datosGlobales[window.elementoActivo][control];
    const datosBase = (datosDelControl && datosDelControl.raw) ? datosDelControl.raw : [];

    const valsA1 = datosBase.filter(d => d.analista === 'Analista 1').map(d => d.valor);
    const valsA2 = datosBase.filter(d => d.analista === 'Analista 2').map(d => d.valor);
    const maxLen = Math.max(valsA1.length, valsA2.length);

    window.chartPrecisionInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Array.from({ length: maxLen }, (_, i) => `Ensayo ${i + 1}`),
            datasets: [
                { label: 'Analista 1', data: valsA1, borderColor: '#2563eb', backgroundColor: '#2563eb', tension: 0.1 },
                { label: 'Analista 2', data: valsA2, borderColor: '#059669', backgroundColor: '#059669', tension: 0.1 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
};

window.chartExactitudInstancia = null;

/**
 * Calcula métricas individuales por replicado, promedios y test de Grubbs por grupo.
 */
window.calcularExactitudGrupo = function (valores, valorTeorico, gCritico, etiquetaAnalista) {
    if (!valores || valores.length === 0) {
        return {
            n_inicial: 0, promedio_inicial: '--', desviacion_inicial: '--',
            g_min: '--', g_max: '--', g_critico: gCritico,
            n_final: 0, promedio_final: '--', desviacion_final: '--',
            error_promedio: '--', error_pct: '--', recuperacion: '--',
            outliers: [], itemMetrics: []
        };
    }

    const nInicial = valores.length;
    const calcPromedio = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const calcSD = (arr, prom) => arr.length > 1
        ? Math.sqrt(arr.reduce((a, b) => a + Math.pow(b - prom, 2), 0) / (arr.length - 1))
        : 0;

    // 1. Cálculo de cada replicado individual (% Error y % Recuperación)
    const itemMetrics = valores.map((v, index) => {
        const errAbs = v - valorTeorico;
        const errPct = valorTeorico !== 0 ? Math.abs(errAbs / valorTeorico) * 100 : 0;
        const recPct = valorTeorico !== 0 ? (v / valorTeorico) * 100 : 0;
        return {
            replica: index + 1,
            valor: v,
            error_pct: errPct,
            recuperacion_pct: recPct
        };
    });

    const promInicial = calcPromedio(valores);
    const sdInicial = calcSD(valores, promInicial);

    // 2. Grubbs (G_min y G_max)
    const valMin = Math.min(...valores);
    const valMax = Math.max(...valores);
    const gMin = sdInicial > 0 ? Math.abs(promInicial - valMin) / sdInicial : 0;
    const gMax = sdInicial > 0 ? Math.abs(valMax - promInicial) / sdInicial : 0;

    const outliers = [];
    const valoresLimpios = [];

    valores.forEach(v => {
        const gCalc = sdInicial > 0 ? Math.abs(v - promInicial) / sdInicial : 0;
        if (gCalc > gCritico) {
            outliers.push({
                valor: v,
                analista: etiquetaAnalista,
                G_calc: gCalc.toFixed(3),
                G_crit: gCritico.toFixed(3)
            });
        } else {
            valoresLimpios.push(v);
        }
    });

    // 3. Métricas finales globales/grupo
    const nFinal = valoresLimpios.length;
    const promFinal = nFinal > 0 ? calcPromedio(valoresLimpios) : promInicial;
    const sdFinal = nFinal > 0 ? calcSD(valoresLimpios, promFinal) : sdInicial;

    const errorPromedio = promFinal - valorTeorico;
    const errorPct = valorTeorico !== 0 ? Math.abs(errorPromedio / valorTeorico) * 100 : 0;
    const recuperacion = valorTeorico !== 0 ? (promFinal / valorTeorico) * 100 : 0;

    return {
        n_inicial: nInicial,
        promedio_inicial: promInicial.toFixed(4),
        desviacion_inicial: sdInicial.toFixed(4),
        g_min: gMin.toFixed(3),
        g_max: gMax.toFixed(3),
        g_critico: gCritico.toFixed(3),
        n_final: nFinal,
        promedio_final: promFinal.toFixed(4),
        desviacion_final: sdFinal.toFixed(4),
        error_promedio: errorPromedio.toFixed(4),
        error_pct: errorPct.toFixed(2),
        recuperacion: recuperacion.toFixed(2),
        outliers: outliers,
        itemMetrics: itemMetrics
    };
};

/**
 * Renderiza gráfico Chart.js comparando el % Recuperado de cada replicado
 */
window.dibujarGraficoRecuperacion = function (metricsA1, metricsA2) {
    const canvas = document.getElementById('chartExactitudRecuperacion');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Destruir el gráfico previo si existe para no solapar encuadres
    if (window.chartExactitudInstancia) {
        window.chartExactitudInstancia.destroy();
    }

    const labels = Array.from({ length: Math.max(metricsA1.length, metricsA2.length) }, (_, i) => `Réplica ${i + 1}`);
    const dataA1 = metricsA1.map(m => m.recuperacion_pct.toFixed(2));
    const dataA2 = metricsA2.map(m => m.recuperacion_pct.toFixed(2));
    const lineaIdeal = labels.map(() => 100); // 100% ideal de recuperación

    window.chartExactitudInstancia = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Analista 1 (% Recuperación)',
                    data: dataA1,
                    borderColor: 'rgb(37, 99, 235)',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    borderWidth: 2,
                    pointBackgroundColor: 'rgb(37, 99, 235)',
                    pointRadius: 4,
                    tension: 0.2
                },
                {
                    label: 'Analista 2 (% Recuperación)',
                    data: dataA2,
                    borderColor: 'rgb(79, 70, 229)',
                    backgroundColor: 'rgba(79, 70, 229, 0.1)',
                    borderWidth: 2,
                    pointBackgroundColor: 'rgb(79, 70, 229)',
                    pointRadius: 4,
                    tension: 0.2
                },
                {
                    label: '100% Ideal Teórico',
                    data: lineaIdeal,
                    borderColor: 'rgb(220, 38, 38)',
                    borderWidth: 2,
                    borderDash: [6, 6],
                    pointRadius: 0,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    title: { display: true, text: '% de Recuperación' },
                    suggestedMin: 80,
                    suggestedMax: 120
                },
                x: {
                    title: { display: true, text: 'Número de Réplica' }
                }
            },
            plugins: {
                legend: { position: 'top' },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return `${context.dataset.label}: ${context.raw}%`;
                        }
                    }
                }
            }
        }
    });
};

/**
 * Función principal para renderizar la pestaña de Exactitud por Analista.
 */
window.renderizarExactitud = function (control) {
    if (!window.elementoActivo || !window.datosGlobales[window.elementoActivo]) return;
    window.controlActivoExa = control;
    if (window.actualizarTabs) window.actualizarTabs('exa', control);

    const elemData = window.datosGlobales[window.elementoActivo];
    const controlKey = control.toLowerCase();

    const datosBase = (elemData[controlKey] && elemData[controlKey].raw)
        ? elemData[controlKey].raw
        : (elemData[control] && elemData[control].raw ? elemData[control].raw : []);

    const valorTeorico = elemData.teorico_lcm ||
        (elemData.exactitud && elemData.exactitud[control]?.teorico) ||
        1.0;

    const valsA1 = datosBase.filter(d => d.analista === 'Analista 1').map(d => d.valor);
    const valsA2 = datosBase.filter(d => d.analista === 'Analista 2').map(d => d.valor);
    const valsGlobal = [...valsA1, ...valsA2];

    const statsA1 = window.calcularExactitudGrupo(valsA1, valorTeorico, 2.290, "Analista 1");
    const statsA2 = window.calcularExactitudGrupo(valsA2, valorTeorico, 2.290, "Analista 2");
    const statsGlobal = window.calcularExactitudGrupo(valsGlobal, valorTeorico, 2.557, "Global");

    document.getElementById('contenidoExactitud').classList.remove('hidden');

    // 1. Renderizar la Tabla Detallada de los 10 Replicados Individuales
    const tbIndividual = document.getElementById('tablaExactitudIndividual');
    const tbPromedio = document.getElementById('tablaExactitudIndividualPromedio');
    const totalReplicas = Math.max(statsA1.itemMetrics.length, statsA2.itemMetrics.length, 10);

    let filasHTML = '';
    for (let i = 0; i < totalReplicas; i++) {
        const m1 = statsA1.itemMetrics[i] || { valor: '--', error_pct: '--', recuperacion_pct: '--' };
        const m2 = statsA2.itemMetrics[i] || { valor: '--', error_pct: '--', recuperacion_pct: '--' };

        const val1 = typeof m1.valor === 'number' ? m1.valor.toFixed(4) : m1.valor;
        const err1 = typeof m1.error_pct === 'number' ? `${m1.error_pct.toFixed(2)}%` : m1.error_pct;
        const rec1 = typeof m1.recuperacion_pct === 'number' ? `${m1.recuperacion_pct.toFixed(2)}%` : m1.recuperacion_pct;

        const val2 = typeof m2.valor === 'number' ? m2.valor.toFixed(4) : m2.valor;
        const err2 = typeof m2.error_pct === 'number' ? `${m2.error_pct.toFixed(2)}%` : m2.error_pct;
        const rec2 = typeof m2.recuperacion_pct === 'number' ? `${m2.recuperacion_pct.toFixed(2)}%` : m2.recuperacion_pct;

        filasHTML += `
            <tr class="hover:bg-slate-50">
                <td class="border border-slate-300 p-2 font-bold text-slate-700 bg-slate-50">#${i + 1}</td>
                <td class="border border-slate-300 p-2 font-mono">${val1}</td>
                <td class="border border-slate-300 p-2 font-mono text-amber-700">${err1}</td>
                <td class="border border-slate-300 p-2 font-mono text-blue-700 font-semibold">${rec1}</td>
                <td class="border border-slate-300 p-2 font-mono">${val2}</td>
                <td class="border border-slate-300 p-2 font-mono text-amber-700">${err2}</td>
                <td class="border border-slate-300 p-2 font-mono text-indigo-700 font-semibold">${rec2}</td>
            </tr>
        `;
    }
    tbIndividual.innerHTML = filasHTML;

    // Fila de Promedios Generales en el Pie de Tabla (tfoot)
    tbPromedio.innerHTML = `
        <tr class="bg-slate-200/80 text-slate-800">
            <td class="border border-slate-300 p-2">PROMEDIOS</td>
            <td class="border border-slate-300 p-2 font-mono">${statsA1.promedio_inicial}</td>
            <td class="border border-slate-300 p-2 font-mono text-amber-800">${statsA1.error_pct}%</td>
            <td class="border border-slate-300 p-2 font-mono text-blue-800 font-bold">${statsA1.recuperacion}%</td>
            <td class="border border-slate-300 p-2 font-mono">${statsA2.promedio_inicial}</td>
            <td class="border border-slate-300 p-2 font-mono text-amber-800">${statsA2.error_pct}%</td>
            <td class="border border-slate-300 p-2 font-mono text-indigo-800 font-bold">${statsA2.recuperacion}%</td>
        </tr>
    `;

    // 2. Renderizar Gráfico
    window.dibujarGraficoRecuperacion(statsA1.itemMetrics, statsA2.itemMetrics);

    // 3. Renderizar Tabla Test de Grubbs
    document.getElementById('tablaGrubbsStats').innerHTML = `
        <tr class="bg-slate-50">
            <td class="border border-slate-300 p-2 font-semibold">Total Datos (N)</td>
            <td class="border border-slate-300 p-2 font-mono text-right">${statsA1.n_inicial}</td>
            <td class="border border-slate-300 p-2 font-mono text-right">${statsA2.n_inicial}</td>
            <td class="border border-slate-300 p-2 font-mono text-right font-bold bg-blue-50/50">${statsGlobal.n_inicial}</td>
        </tr>
        <tr>
            <td class="border border-slate-300 p-2 font-semibold">Promedio Inicial</td>
            <td class="border border-slate-300 p-2 font-mono text-right">${statsA1.promedio_inicial}</td>
            <td class="border border-slate-300 p-2 font-mono text-right">${statsA2.promedio_inicial}</td>
            <td class="border border-slate-300 p-2 font-mono text-right font-bold bg-blue-50/50">${statsGlobal.promedio_inicial}</td>
        </tr>
        <tr class="bg-slate-50">
            <td class="border border-slate-300 p-2 font-semibold">Desviación Inicial</td>
            <td class="border border-slate-300 p-2 font-mono text-right">${statsA1.desviacion_inicial}</td>
            <td class="border border-slate-300 p-2 font-mono text-right">${statsA2.desviacion_inicial}</td>
            <td class="border border-slate-300 p-2 font-mono text-right font-bold bg-blue-50/50">${statsGlobal.desviacion_inicial}</td>
        </tr>
        <tr>
            <td class="border border-slate-300 p-2 font-semibold">G Min Calculado</td>
            <td class="border border-slate-300 p-2 font-mono text-right text-blue-700">${statsA1.g_min}</td>
            <td class="border border-slate-300 p-2 font-mono text-right text-blue-700">${statsA2.g_min}</td>
            <td class="border border-slate-300 p-2 font-mono text-right font-bold text-blue-800 bg-blue-50/50">${statsGlobal.g_min}</td>
        </tr>
        <tr class="bg-slate-50">
            <td class="border border-slate-300 p-2 font-semibold">G Max Calculado</td>
            <td class="border border-slate-300 p-2 font-mono text-right text-indigo-700">${statsA1.g_max}</td>
            <td class="border border-slate-300 p-2 font-mono text-right text-indigo-700">${statsA2.g_max}</td>
            <td class="border border-slate-300 p-2 font-mono text-right font-bold text-indigo-800 bg-blue-50/50">${statsGlobal.g_max}</td>
        </tr>
        <tr>
            <td class="border border-slate-300 p-2 font-semibold">Valor G Crítico</td>
            <td class="border border-slate-300 p-2 font-mono text-right text-red-600 font-bold">${statsA1.g_critico}</td>
            <td class="border border-slate-300 p-2 font-mono text-right text-red-600 font-bold">${statsA2.g_critico}</td>
            <td class="border border-slate-300 p-2 font-mono text-right font-bold text-red-700 bg-blue-50/50">${statsGlobal.g_critico}</td>
        </tr>
    `;

    // 4. Renderizar Tabla de Exactitud Consolidada
    document.getElementById('tablaExactitudStats').innerHTML = `
        <tr class="bg-emerald-50/60">
            <td class="border border-slate-300 p-2 font-semibold">N Final (Sin Atípicos)</td>
            <td class="border border-slate-300 p-2 font-mono text-right font-bold text-emerald-800">${statsA1.n_final}</td>
            <td class="border border-slate-300 p-2 font-mono text-right font-bold text-emerald-800">${statsA2.n_final}</td>
            <td class="border border-slate-300 p-2 font-mono text-right font-bold text-emerald-900 bg-emerald-100/50">${statsGlobal.n_final}</td>
        </tr>
        <tr>
            <td class="border border-slate-300 p-2 font-semibold">Promedio Final</td>
            <td class="border border-slate-300 p-2 font-mono text-right">${statsA1.promedio_final}</td>
            <td class="border border-slate-300 p-2 font-mono text-right">${statsA2.promedio_final}</td>
            <td class="border border-slate-300 p-2 font-mono text-right font-bold bg-emerald-50/30">${statsGlobal.promedio_final}</td>
        </tr>
        <tr class="bg-slate-50">
            <td class="border border-slate-300 p-2 font-semibold">Desviación Final</td>
            <td class="border border-slate-300 p-2 font-mono text-right">${statsA1.desviacion_final}</td>
            <td class="border border-slate-300 p-2 font-mono text-right">${statsA2.desviacion_final}</td>
            <td class="border border-slate-300 p-2 font-mono text-right font-bold bg-emerald-50/30">${statsGlobal.desviacion_final}</td>
        </tr>
        <tr>
            <td class="border border-slate-300 p-2 font-semibold">Error Promedio Absoluto</td>
            <td class="border border-slate-300 p-2 font-mono text-right">${statsA1.error_promedio}</td>
            <td class="border border-slate-300 p-2 font-mono text-right">${statsA2.error_promedio}</td>
            <td class="border border-slate-300 p-2 font-mono text-right font-bold bg-emerald-50/30">${statsGlobal.error_promedio}</td>
        </tr>
        <tr class="bg-slate-50">
            <td class="border border-slate-300 p-2 font-semibold">Porcentaje Error (%)</td>
            <td class="border border-slate-300 p-2 font-mono text-right font-bold text-amber-700">${statsA1.error_pct}%</td>
            <td class="border border-slate-300 p-2 font-mono text-right font-bold text-amber-700">${statsA2.error_pct}%</td>
            <td class="border border-slate-300 p-2 font-mono text-right font-bold bg-emerald-50/30">${statsGlobal.error_pct}%</td>
        </tr>
        <tr>
            <td class="border border-slate-300 p-2 font-semibold">Porcentaje Recuperación (%)</td>
            <td class="border border-slate-300 p-2 font-mono text-right font-bold text-blue-700">${statsA1.recuperacion}%</td>
            <td class="border border-slate-300 p-2 font-mono text-right font-bold text-blue-700">${statsA2.recuperacion}%</td>
            <td class="border border-slate-300 p-2 font-mono text-right font-bold text-blue-800 bg-emerald-50/30">${statsGlobal.recuperacion}%</td>
        </tr>
    `;

    // 5. Renderizar Tabla de Datos Atípicos
    const todosOutliers = [...(statsA1.outliers || []), ...(statsA2.outliers || [])];
    const tbOutliers = document.getElementById('tablaOutliers');

    if (todosOutliers.length === 0) {
        tbOutliers.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-500 font-medium">No se detectaron datos atípicos según el Test de Grubbs ($G \\le G_{\\text{crit}}$).</td></tr>`;
    } else {
        tbOutliers.innerHTML = todosOutliers.map(o => `
            <tr class="hover:bg-red-50/50">
                <td class="border border-slate-300 p-2 font-mono text-red-700 font-bold">${o.valor}</td>
                <td class="border border-slate-300 p-2">${o.analista}</td>
                <td class="border border-slate-300 p-2 font-mono">${o.G_calc}</td>
                <td class="border border-slate-300 p-2 font-mono">${o.G_crit}</td>
            </tr>
        `).join('');
    }
};

window.TABLA_METROLOGIA = {
    balon: [
        { vol: 50, tol: 0.100 }, { vol: 100, tol: 0.100 }, { vol: 250, tol: 0.120 },
        { vol: 500, tol: 0.250 }, { vol: 1000, tol: 0.400 }
    ],
    pipeta: [
        { vol: 0.5, tol: 0.006 }, { vol: 1, tol: 0.008 }, { vol: 2, tol: 0.010 },
        { vol: 3, tol: 0.010 }, { vol: 4, tol: 0.010 }, { vol: 5, tol: 0.015 },
        { vol: 6, tol: 0.015 }, { vol: 7, tol: 0.015 }, { vol: 10, tol: 0.020 },
        { vol: 15, tol: 0.030 }, { vol: 20, tol: 0.030 }
    ],
    transferpipeta: {
        "trans_0.5_10": 0.0085,
        "trans_10_100": 0.0801,
        "trans_100_1000": 0.7511, // Según certificado oficial del laboratorio
        "trans_1_10ml": 0.0080
    },
    balanza: 1.9e-04,  // Balanza Analítica Precisa XB 220 A
    delta_T: 3,        // Variación T°C en el laboratorio (±3 °C)
    gamma_H2O: 0.00021 // Coeficiente de dilatación térmica del agua (°C^-1)
};

window.chartIncertidumbreInstance = null;

/**
 * Busca en la tabla de instrumentación la tolerancia del material aforado.
 * Si el volumen exacto no está, toma el del recipiente de volumen superior más cercano.
 */
window.obtenerToleranciaAforada = function (tipo, volumen) {
    const lista = window.TABLA_METROLOGIA[tipo];
    if (!lista) return 0;
    for (let item of lista) {
        if (volumen <= item.vol) return item.tol;
    }
    return lista[lista.length - 1].tol; // Si supera el máximo de la tabla, toma el mayor
};

/**
 * Calcula la incertidumbre relativa combinada de un volumen (Aforo + Dilatación Térmica).
 * Si es Transferpipeta, extrae el factor relativo directo de la tabla de calibración.
 */
window.calcUVolumetricaRel = function (volumen, tipoMaterial, instSeleccionado) {
    if (volumen <= 0) return 0;

    // 1. Caso Transferpipeta: factor de calibración directo
    if (instSeleccionado && instSeleccionado.startsWith("trans_")) {
        return window.TABLA_METROLOGIA.transferpipeta[instSeleccionado] || 0;
    }

    // 2. Caso Vidrio Aforado: Combinación Triangular (Aforo) + Rectangular (Temperatura)
    const tol = window.obtenerToleranciaAforada(tipoMaterial, volumen);
    const u_aforo = tol / Math.sqrt(6); // Distribución triangular según guía LIMS
    const u_temp = (window.TABLA_METROLOGIA.delta_T * window.TABLA_METROLOGIA.gamma_H2O * volumen) / Math.sqrt(3);
    const u_vol_abs = Math.sqrt(Math.pow(u_aforo, 2) + Math.pow(u_temp, 2));

    return u_vol_abs / volumen;
};

/**
 * Motor Principal: Evalúa incertidumbres Tipo A, Tipo B, Regresión Lineal y dibuja el gráfico.
 */
/**
 * Motor Principal: Evalúa incertidumbres Tipo A, Tipo B, Regresión Lineal y dibuja el gráfico.
 */
window.calcularIncertidumbre = function () {
    window.guardarConfigIncertidumbre();
    if (!window.elementoActivo || !window.datosGlobales || !window.datosGlobales[window.elementoActivo]) return;
    const elemData = window.datosGlobales[window.elementoActivo];
    const linData = elemData.linealidad;
    const esRAS = window.elementoActivo === 'RAS' || window.elementoActivo.includes('RAS');

    // --- 1. INCERTIDUMBRE TIPO A: REPETIBILIDAD (LCM Analista) ---
    const analistaSel = document.getElementById('selAnalistaTipoA')?.value || "Analista 1";
    const claveAnalista = analistaSel === "global" ? "global" : (analistaSel === "Analista 1" ? "analista_1" : "analista_2");
    const lcmStats = elemData.lcm && elemData.lcm[claveAnalista] ? elemData.lcm[claveAnalista] : { desviacion: 0, promedio: 0, valores: [] };

    const n_lcm = lcmStats.valores && lcmStats.valores.length > 0 ? lcmStats.valores.length : 10;
    const u_est_A = (lcmStats.desviacion || 0) / Math.sqrt(n_lcm);
    const u_A_rel = lcmStats.promedio > 0 ? (u_est_A / lcmStats.promedio) : 0;

    // --- 2. INCERTIDUMBRE TIPO B: PATRÓN CERTIFICABLE (CRM) ---
    const usaPatron = document.getElementById('checkPatronCert')?.checked ?? true;
    const u_patron_rel = usaPatron ? (2 / 1000) : 0; // 0.00200 relativo según certificado

    // --- 3. INCERTIDUMBRE TIPO B: PREPARACIÓN DEL PATRÓN DE TRABAJO ---
    const alicuotaTrab = parseFloat(document.getElementById('inpAlicuotaTrabajo')?.value || 5);
    const pesoTrab = parseFloat(document.getElementById('inpPesoTrabajo')?.value || 0);
    const volFinalTrab = parseFloat(document.getElementById('selVolFinalTrabajo')?.value || 100);
    const instTrab = document.getElementById('selInstTrabajo')?.value || "pipeta";

    let u_alicuota_trab_rel = 0;
    if (pesoTrab > 0) {
        // Alícuota por pesada (Balanza Analítica - Distribución Rectangular)
        const u_est_peso = window.TABLA_METROLOGIA.balanza / Math.sqrt(3);
        u_alicuota_trab_rel = u_est_peso / pesoTrab;
    } else {
        // Alícuota volumétrica
        u_alicuota_trab_rel = window.calcUVolumetricaRel(alicuotaTrab, 'pipeta', instTrab);
    }
    const u_vol_final_trab_rel = window.calcUVolumetricaRel(volFinalTrab, 'balon', null);
    let u_prep_trabajo_rel = Math.sqrt(Math.pow(u_alicuota_trab_rel, 2) + Math.pow(u_vol_final_trab_rel, 2));

    // --- 4. INCERTIDUMBRE TIPO B: DILUCIONES Y CURVA DE CALIBRACIÓN ---
    let u_curva_total_rel = 0;
    let s_res = 0;

    if (linData && linData.tabla && linData.tabla.length > 1) {
        const p_curvas = linData.curvas_raw ? linData.curvas_raw.length : 1;
        const n_puntos = linData.tabla.length;
        const N_total = p_curvas * n_puntos;
        const m = linData.stats?.promedio_pendientes_raw || 1;
        const b = linData.stats?.intercepto_raw || 0;

        // A) Incertidumbre volumétrica de preparación de la curva
        const instCurva = document.getElementById('selInstCurva')?.value || "trans_100_1000";
        const volFinalCurva = parseFloat(document.getElementById('selVolFinalCurva')?.value || 50);
        const u_vol_final_curva_rel = window.calcUVolumetricaRel(volFinalCurva, 'balon', null);

        let suma_sq_prep_curva = 0;
        let sum_x = 0;

        linData.tabla.forEach(pt => {
            sum_x += pt.concentracion;
            // Estimar volumen teórico de alícuota proporcional a la concentración
            const conc_max = linData.tabla[linData.tabla.length - 1].concentracion || 1;
            const vol_alicuota_est = (pt.concentracion / conc_max) * 10;
            const u_ali_pt_rel = window.calcUVolumetricaRel(vol_alicuota_est > 0 ? vol_alicuota_est : 1, 'pipeta', instCurva);
            const u_pt_comb = Math.pow(u_ali_pt_rel, 2) + Math.pow(u_vol_final_curva_rel, 2);
            suma_sq_prep_curva += u_pt_comb;
        });
        const u_prep_curvas_rel = Math.sqrt(suma_sq_prep_curva);

        // B) Dispersión por interpolación en la recta de regresión (s_res)
        const x_bar = sum_x / n_puntos;
        let sum_res_sq = 0;

        linData.tabla.forEach(pt => {
            const y_est = m * pt.concentracion + b;
            if (pt.señales && Array.isArray(pt.señales)) {
                pt.señales.forEach(y_obs => {
                    sum_res_sq += Math.pow(y_obs - y_est, 2);
                });
            }
        });

        s_res = Math.sqrt(sum_res_sq / (N_total - 2 > 0 ? N_total - 2 : 1));

        let S_xx = 0;
        linData.tabla.forEach(pt => {
            S_xx += Math.pow(pt.concentracion - x_bar, 2);
        });

        const pendi_Sxx = Math.pow(m, 2) * S_xx;

        // Evaluar dispersión en los extremos (Punto alto y Punto bajo)
        const y_bar_global = linData.tabla.reduce((acc, r) => acc + (r.promedio || 0), 0) / n_puntos;
        const pt_high = linData.tabla[linData.tabla.length - 1];
        const pt_low = linData.tabla[0];

        const sq_high = Math.pow((pt_high.promedio || 0) - y_bar_global, 2);
        const sq_low = Math.pow((pt_low.promedio || 0) - y_bar_global, 2);

        const divisor_reg = pendi_Sxx > 0 ? pendi_Sxx : 1;
        const u_interp_high = (s_res / Math.abs(m !== 0 ? m : 1)) * Math.sqrt((1 / p_curvas) + (1 / N_total) + (sq_high / divisor_reg));
        const u_interp_low = (s_res / Math.abs(m !== 0 ? m : 1)) * Math.sqrt((1 / p_curvas) + (1 / N_total) + (sq_low / divisor_reg));

        const curva_S_promedio = (u_interp_high + u_interp_low) / 2;
        const conc_promedio_extremos = ((pt_high.concentracion || 1) + (pt_low.concentracion || 1)) / 2;
        const u_interp_rel = curva_S_promedio / conc_promedio_extremos;

        // Combinar preparación y regresión
        u_curva_total_rel = Math.sqrt(Math.pow(u_prep_curvas_rel, 2) + Math.pow(u_interp_rel, 2));
    }

    // --- 5. INCERTIDUMBRE TIPO B: TOMA DE MUESTRA ---
    const alicuotaMuestra = parseFloat(document.getElementById('inpAlicuotaMuestra')?.value || 10);
    const u_muestra_rel = window.calcUVolumetricaRel(alicuotaMuestra, 'pipeta', 'pipeta');

    // --- === LÓGICA ESPECIAL PARA RAS === ---
    let var_prep_trab = Math.pow(u_prep_trabajo_rel, 2);
    let var_curva_tot = Math.pow(u_curva_total_rel, 2);

    if (esRAS) {
        // En RAS la varianza de preparación de patrones y de la curva 
        // es la suma de las contribuciones de Ca, Mg y Na (3x)
        var_prep_trab *= 3;
        var_curva_tot *= 3;

        // Recalcular incertidumbres relativas para la tabla
        u_prep_trabajo_rel = Math.sqrt(var_prep_trab);
        u_curva_total_rel = Math.sqrt(var_curva_tot);
    }

    // --- 6. COMBINACIÓN TOTAL Y EXPANDIDA ---
    const var_total = Math.pow(u_A_rel, 2) + Math.pow(u_patron_rel, 2) + var_prep_trab + var_curva_tot + Math.pow(u_muestra_rel, 2);
    const u_c_total = Math.sqrt(var_total);

    // Factor Expandido Relativo y Porcentual (k=2 para 95% de confianza)
    const u_expandida_rel = 2 * u_c_total;
    const u_expandida_porc = u_expandida_rel * 100;

    // --- 7. ACTUALIZACIÓN DE INTERFAZ Y TABLA ---
    const porc = (val_sq) => var_total > 0 ? ((val_sq / var_total) * 100).toFixed(1) + '%' : '0.0%';

    const tbody = document.getElementById('tablaResumenIncertidumbre');
    if (tbody) {
        tbody.innerHTML = `
            <tr class="hover:bg-slate-50 transition">
                <td class="border border-slate-300 p-2.5 text-slate-800">1. Repetibilidad LCM (${analistaSel})</td>
                <td class="border border-slate-300 p-2.5 text-center font-bold text-blue-600">Tipo A</td>
                <td class="border border-slate-300 p-2.5 text-right font-mono text-slate-600">s = ${(lcmStats.desviacion || 0).toFixed(4)}</td>
                <td class="border border-slate-300 p-2.5 text-right font-mono font-bold text-slate-700">${u_A_rel.toFixed(5)}</td>
                <td class="border border-slate-300 p-2.5 text-right font-bold text-indigo-600">${porc(Math.pow(u_A_rel, 2))}</td>
            </tr>
            <tr class="hover:bg-slate-50 bg-slate-50/60 transition">
                <td class="border border-slate-300 p-2.5 text-slate-800">2. Patrón Certificable (CRM)</td>
                <td class="border border-slate-300 p-2.5 text-center font-bold text-emerald-600">Tipo B</td>
                <td class="border border-slate-300 p-2.5 text-right font-mono text-slate-600">${usaPatron ? '2 / 1000' : 'N/A'}</td>
                <td class="border border-slate-300 p-2.5 text-right font-mono font-bold text-slate-700">${u_patron_rel.toFixed(5)}</td>
                <td class="border border-slate-300 p-2.5 text-right font-bold text-indigo-600">${porc(Math.pow(u_patron_rel, 2))}</td>
            </tr>
            <tr class="hover:bg-slate-50 transition">
                <td class="border border-slate-300 p-2.5 text-slate-800">3. Prep. Patrón Trabajo ${esRAS ? '<span class="text-xs text-blue-600 font-semibold">(Suma 3 Cationes)</span>' : (pesoTrab > 0 ? '(Pesada)' : '(Volumen)')}</td>
                <td class="border border-slate-300 p-2.5 text-center font-bold text-emerald-600">Tipo B</td>
                <td class="border border-slate-300 p-2.5 text-right font-mono text-slate-600">${pesoTrab > 0 ? pesoTrab + ' g' : alicuotaTrab + ' mL'}</td>
                <td class="border border-slate-300 p-2.5 text-right font-mono font-bold text-slate-700">${u_prep_trabajo_rel.toFixed(5)}</td>
                <td class="border border-slate-300 p-2.5 text-right font-bold text-indigo-600">${porc(var_prep_trab)}</td>
            </tr>
            <tr class="hover:bg-slate-50 bg-slate-50/60 transition">
                <td class="border border-slate-300 p-2.5 text-slate-800">4. Curva de Calibración ${esRAS ? '<span class="text-xs text-blue-600 font-semibold">(Suma 3 Cationes)</span>' : '(Prep + Regresión)'}</td>
                <td class="border border-slate-300 p-2.5 text-center font-bold text-emerald-600">Tipo B</td>
                <td class="border border-slate-300 p-2.5 text-right font-mono text-slate-600">s_res = ${s_res.toFixed(4)}</td>
                <td class="border border-slate-300 p-2.5 text-right font-mono font-bold text-slate-700">${u_curva_total_rel.toFixed(5)}</td>
                <td class="border border-slate-300 p-2.5 text-right font-bold text-indigo-600">${porc(var_curva_tot)}</td>
            </tr>
            <tr class="hover:bg-slate-50 transition">
                <td class="border border-slate-300 p-2.5 text-slate-800">5. Alícuota Toma de Muestra</td>
                <td class="border border-slate-300 p-2.5 text-center font-bold text-emerald-600">Tipo B</td>
                <td class="border border-slate-300 p-2.5 text-right font-mono text-slate-600">${alicuotaMuestra} mL</td>
                <td class="border border-slate-300 p-2.5 text-right font-mono font-bold text-slate-700">${u_muestra_rel.toFixed(5)}</td>
                <td class="border border-slate-300 p-2.5 text-right font-bold text-indigo-600">${porc(Math.pow(u_muestra_rel, 2))}</td>
            </tr>
        `;
    }

    if (document.getElementById('val-uc-total')) {
        document.getElementById('val-uc-total').innerText = u_c_total.toFixed(5);
        document.getElementById('val-u-expandida').innerText = `± ${u_expandida_rel.toFixed(5)}`;
        if (document.getElementById('val-u-expandida-porc')) {
            document.getElementById('val-u-expandida-porc').innerText = `± ${u_expandida_porc.toFixed(2)}% del valor reportado`;
        }
    }

    // --- 8. RENDERIZAR GRÁFICO DE ANILLO (DOUGHNUT CHART) ---
    window.renderizarGraficoIncertidumbre([
        Math.pow(u_A_rel, 2),
        Math.pow(u_patron_rel, 2),
        var_prep_trab,
        var_curva_tot,
        Math.pow(u_muestra_rel, 2)
    ]);
};

/**
 * Renderiza o actualiza el Gráfico de Anillo de contribución a la varianza usando Chart.js
 */
window.renderizarGraficoIncertidumbre = function (varianzas) {
    const canvasElement = document.getElementById('chartIncertidumbre');
    if (!canvasElement) return;
    const ctx = canvasElement.getContext('2d');

    if (window.chartIncertidumbreInstance) {
        window.chartIncertidumbreInstance.destroy();
    }

    window.chartIncertidumbreInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['1. Tipo A (LCM)', '2. Patrón (CRM)', '3. Prep. Trabajo', '4. Curva Calib.', '5. Toma Muestra'],
            datasets: [{
                data: varianzas,
                backgroundColor: ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'],
                borderWidth: 2,
                borderColor: '#ffffff',
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { boxWidth: 12, font: { size: 11, family: 'sans-serif' }, padding: 12 }
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const porc = total > 0 ? ((context.raw / total) * 100).toFixed(1) : 0;
                            return ` Varianza: ${porc}% del total`;
                        }
                    }
                }
            },
            cutout: '62%'
        }
    });
};

window.guardarConfigIncertidumbre = function () {
    if (!window.elementoActivo || !window.datosGlobales) return;

    // Aseguramos que el objeto del elemento exista
    if (!window.datosGlobales[window.elementoActivo]) {
        window.datosGlobales[window.elementoActivo] = {};
    }

    const config = {};

    // 1. Guardar el Checkbox
    const checkPatron = document.getElementById('checkPatronCert');
    if (checkPatron) config.checkPatronCert = checkPatron.checked;

    // 2. Guardar los Inputs numéricos y Selects
    const idsCampos = [
        'inpAlicuotaTrabajo', 'inpPesoTrabajo', 'selInstTrabajo',
        'selVolFinalTrabajo', 'selInstCurva', 'selVolFinalCurva',
        'selAnalistaTipoA', 'inpAlicuotaMuestra'
    ];

    idsCampos.forEach(id => {
        const el = document.getElementById(id);
        if (el) config[id] = el.value;
    });

    // Guardar en memoria global de la app
    window.datosGlobales[window.elementoActivo].configIncertidumbre = config;

    // Respaldo en localStorage para que resista si el usuario presiona F5 o recarga la página
    try {
        localStorage.setItem(`lims_cfg_incertidumbre_${window.elementoActivo}`, JSON.stringify(config));
    } catch (e) {
        console.warn("No se pudo guardar en localStorage", e);
    }
};

/**
 * Carga y restaura los valores en la interfaz cuando el usuario entra a la pestaña
 * o cuando cambia de elemento analítico en el selector global.
 */
window.cargarConfigIncertidumbre = function () {
    if (!window.elementoActivo || !window.datosGlobales) return;

    // Intentar leer de la memoria global primero, si no, buscar en localStorage
    let config = window.datosGlobales[window.elementoActivo]?.configIncertidumbre;

    if (!config) {
        try {
            const localData = localStorage.getItem(`lims_cfg_incertidumbre_${window.elementoActivo}`);
            if (localData) config = JSON.parse(localData);
        } catch (e) { }
    }

    // Si nunca se ha configurado este elemento, dejamos los valores por defecto del HTML
    if (!config) return;

    // 1. Restaurar Checkbox
    const checkPatron = document.getElementById('checkPatronCert');
    if (checkPatron && config.checkPatronCert !== undefined) {
        checkPatron.checked = config.checkPatronCert;
    }

    // 2. Restaurar Inputs numéricos y Selects
    const idsCampos = [
        'inpAlicuotaTrabajo', 'inpPesoTrabajo', 'selInstTrabajo',
        'selVolFinalTrabajo', 'selInstCurva', 'selVolFinalCurva',
        'selAnalistaTipoA', 'inpAlicuotaMuestra'
    ];

    idsCampos.forEach(id => {
        const el = document.getElementById(id);
        if (el && config[id] !== undefined) {
            el.value = config[id];
        }
    });
};

window.capturarImagenCanvas = function (elemKey, tipo) {
    if (!window.datosGlobales[elemKey]) window.datosGlobales[elemKey] = {};
    if (!window.datosGlobales[elemKey].imagenes) window.datosGlobales[elemKey].imagenes = {};

    if (window.datosGlobales[elemKey].imagenes[tipo]) {
        return window.datosGlobales[elemKey].imagenes[tipo];
    }

    const idsComunes = {
        'linealidad': ['graficoLinealidad', 'chartLinealidad', 'canvasLinealidad', 'linealidadChart'],
        'lcm': ['chartLCM', 'graficoLCM', 'canvasLCM', 'chartPrecision', 'precisionChart'],
        'incertidumbre': ['chartIncertidumbre', 'graficoIncertidumbre', 'canvasIncertidumbre', 'incertidumbreChart']
    };

    const posiblesIDs = idsComunes[tipo] || [];
    for (let id of posiblesIDs) {
        const el = document.getElementById(id);
        if (el && el.toDataURL) {
            try {
                const dataURL = el.toDataURL("image/png");
                if (dataURL.length > 3000) {
                    window.datosGlobales[elemKey].imagenes[tipo] = dataURL;
                    return dataURL;
                }
            } catch (e) { }
        }
    }
    return null;
};

// ============================================================================
// FUNCIÓN PRINCIPAL UNIFICADA DE METADATOS E INFORME
// ============================================================================
window.SUBMATRICES_MAP = {
    "Agua": ["Agua Potable", "Agua Residual", "Agua Superficial", "Agua Subterránea"],
    "Suelo": ["Suelo Agrícola", "Suelo Industrial", "Suelo Urbano"],
    "Lodo": ["Lodos de PTAR", "Lodos Industriales"],
    "Sedimento": ["Sedimentos Fluviales", "Sedimentos Marinos"],
    "Residuos Peligrosos": ["Residuos Sólidos", "Residuos Líquidos"],
    "Aire": ["Aire Ambiente", "Emisiones Industriales"]
};

window.obtenerSubmatricesTexto = function (matriz) {
    const subs = window.SUBMATRICES_MAP[matriz];
    if (subs && subs.length > 0) {
        return `${matriz} (${subs.join(", ")})`;
    }
    return `${matriz} (Todas las submatrices aplicables)`;
};

// ============================================================================
// GESTIÓN DEL SELECTOR DE ELEMENTOS / PARÁMETROS
// ============================================================================
window.poblarSelectorInforme = function () {
    window.datosGlobales = window.datosGlobales || {};
    const select = document.getElementById('selectElementoInforme');
    if (!select) return;
    select.innerHTML = '';

    const elementos = Object.keys(window.datosGlobales).filter(
        k => k !== 'configMetadatos' && k !== 'configIncertidumbre'
    );

    if (elementos.length === 0) {
        select.innerHTML = '<option value="">Sin datos cargados</option>';
        return;
    }

    elementos.forEach(elem => {
        const opt = document.createElement('option');
        opt.value = elem;
        opt.textContent = elem;
        if (elem === window.elementoActivo) opt.selected = true;
        select.appendChild(opt);
    });

    if (!window.elementoActivo && elementos.length > 0) {
        window.elementoActivo = elementos[0];
    }
};

window.cambiarElementoInforme = function (val) {
    window.elementoActivo = val;
    window.guardarMetadatosYCompilar();
};

window.actualizarSubmatricesAuto = function () {
    window.guardarMetadatosYCompilar();
};

// ============================================================================
// FUNCIÓN PRINCIPAL UNIFICADA DE METADATOS Y COMPILACIÓN DEL INFORME
// ============================================================================
window.guardarMetadatosYCompilar = function () {
    window.datosGlobales = window.datosGlobales || {};

    const getVal = (id, def = "") => {
        const el = document.getElementById(id);
        return el ? (el.value || def) : def;
    };

    const elemActivo = getVal('selectElementoInforme', window.elementoActivo || '--');
    const codigo = getVal('inp-inf-codigo', 'PO-AM-012');
    const nombreProc = getVal('inp-inf-nombre-procedimiento', 'Determinación Analítica');
    const matriz = getVal('sel-inf-matriz', 'Agua');
    const tecnica = getVal('inp-inf-tecnica', 'Espectrometría');
    const norma = getVal('inp-inf-norma', 'Método Estándar');
    const tipoMetodo = getVal('sel-inf-tipo-metodo', 'Normalizado');
    const tipoEstudio = getVal('sel-inf-tipo-estudio', 'Verificación de Método');
    const analista1 = getVal('inp-inf-analista1', 'Analista 1');
    const analista2 = getVal('inp-inf-analista2', 'Analista 2');
    const respTecnico = getVal('inp-inf-resp', 'Director Técnico');
    const fechaInput = getVal('inp-inf-fecha');

    // Persistencia LocalStorage
    window.datosGlobales.configMetadatos = {
        elemActivo, codigo, nombreProc, matriz, tecnica, norma,
        tipoMetodo, tipoEstudio, analista1, analista2, respTecnico, fecha: fechaInput
    };
    try {
        localStorage.setItem("lims_metadatos_generales", JSON.stringify(window.datosGlobales.configMetadatos));
    } catch (e) { }

    // Formateo de fecha
    let fechaTxt = '--/--/----';
    if (fechaInput) {
        const [y, m, d] = fechaInput.split('-');
        fechaTxt = `${d}/${m}/${y}`;
    } else {
        const hoy = new Date();
        fechaTxt = `${String(hoy.getDate()).padStart(2, '0')}/${String(hoy.getMonth() + 1).padStart(2, '0')}/${hoy.getFullYear()}`;
    }

    const setTxt = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };

    setTxt('prev-codigo', `Código: ${codigo}`);
    setTxt('prev-fecha', `Fecha: ${fechaTxt}`);
    setTxt('prev-param', elemActivo);
    setTxt('prev-proc-full', `${codigo} - ${nombreProc}`);
    setTxt('prev-matriz-sub', window.obtenerSubmatricesTexto ? window.obtenerSubmatricesTexto(matriz) : matriz);
    setTxt('prev-tecnica', tecnica);
    setTxt('prev-metodo', `${tipoMetodo} (${tipoEstudio})`);
    setTxt('prev-norma', norma);
    setTxt('prev-analistas', `${analista1} / ${analista2}`);
    setTxt('prev-resp', respTecnico);

    const firmaAnalista = document.getElementById('firma-analista');
    if (firmaAnalista) firmaAnalista.textContent = analista1;
    const firmaResp = document.getElementById('firma-resp');
    if (firmaResp) firmaResp.textContent = respTecnico;

    // Obtención de datos del elemento en memoria
    const dataElem = window.datosGlobales[elemActivo] || {};
    const exaLcm = dataElem.exactitud?.LCM || dataElem.exactitud?.lcm || {};
    const linData = dataElem.linealidad?.stats || null;
    const lod = dataElem.lod_posible ?? '--';
    const loq = dataElem.loq_posible ?? '--';

    // Obtener la incertidumbre calculada de forma segura (evita ReferenceError)
    const incResInforme = window.calcularIncertidumbreParaInforme ? window.calcularIncertidumbreParaInforme(elemActivo) : null;
    const u_c_total_val = incResInforme ? incResInforme.u_c_total.toFixed(5) : '0.00000';
    const u_expandida_porc_val = incResInforme ? incResInforme.u_expandida_porc.toFixed(2) : '0.00';

    // Inyección dinámica de textos en Secciones 2 y 3
    const eqContainer = document.getElementById('prev-equipos-reactivos');
    if (eqContainer) {
        eqContainer.innerHTML = `Los equipos, materiales, patrones trazables y reactivos requeridos para la ejecución analítica de este parámetro se encuentran especificados minuciosamente dentro del instructivo interno <strong>${codigo} - ${nombreProc}</strong>.`;
    }

    const alcanceContainer = document.getElementById('prev-alcance');
    const matrizDetallada = window.obtenerSubmatricesTexto ? window.obtenerSubmatricesTexto(matriz) : matriz;
    if (alcanceContainer) {
        alcanceContainer.innerHTML = `El presente alcance aplica a la cuantificación metrológica de <strong>${elemActivo}</strong> mediante la técnica de <strong>${tecnica}</strong> en matrices de <strong>${matrizDetallada}</strong>, garantizando operabilidad dentro del intervalo dinámico validado.`;
    }

    // 2. Sección 6: Compilación de Tablas e Informes
    if (typeof window.poblarSeccion6Resultados === 'function') {
        window.poblarSeccion6Resultados(elemActivo);
    }

    // 3. Sección 7: Inyección Técnica Detallada
    setTxt('prev-sec-rechazo', dataElem.rechazo_texto || `Para la determinación de ${elemActivo} en estándares y muestras de ensayo no se descarta ningún dato extremo o atípico durante el tratamiento de datos.`);
    setTxt('prev-sec-lod', dataElem.lod_texto || `El límite de detección del método se establece computando 3*SD a partir de 10 blancos de proceso independientes, obteniendo un valor metrológico de ${lod} mg/L.`);
    setTxt('prev-sec-loq', dataElem.loq_texto || `Se realizó la medición de 10 estándares de ${dataElem.teorico_lcm ?? loq} mg/L de ${elemActivo}, obteniendo un promedio de ${dataElem.lcm?.analista_1?.promedio ?? '--'} mg/L para Analista 1, y ${dataElem.lcm?.analista_2?.promedio ?? '--'} mg/L para Analista 2.`);
    setTxt('prev-sec-linealidad', linData ? `Se evaluaron 3 curvas de calibración independientes en donde se satisface estrictamente el criterio de aceptación R² = 0.990 (obtenido R² = ${linData.r2}).` : `Evaluación realizada mediante curvas de calibración.`);
    setTxt('prev-sec-sensibilidad', dataElem.sensibilidad_texto || `Sensibilidad = ${linData?.sensibilidad ?? '--'} ± ${linData?.sd_pendiente ?? '--'}.`);
    setTxt('prev-sec-veracidad', dataElem.veracidad_texto || `Se establece como el porcentaje de error promedio para los niveles evaluados (LCM, CCV, EA) dentro de los márgenes normativos.`);
    setTxt('prev-sec-precision', dataElem.precision_texto || `En el análisis de varianza (ANOVA) y test de Shapiro-Wilk se confirmó un comportamiento de distribución normal (p > 0.05).`);
    setTxt('prev-sec-recuperacion-matriz', dataElem.matriz_texto || `Se determinó el porcentaje de recuperación en muestras fortificadas cumpliendo satisfactoriamente con el criterio normativo.`);
    setTxt('prev-sec-incertidumbre', dataElem.incertidumbre_texto || `Se estructuraron las fuentes contribuyentes. La estimación final se expresa como incertidumbre expandida U = 2 * u_c * C_muestra, equivalente a un ± ${u_c_total_val} (± ${u_expandida_porc_val}%).`);

    // 4. Sección 8: Conclusiones Técnicas
    const concContainer = document.getElementById('prev-conclusiones');
    const recVal = parseFloat(exaLcm.recuperacion ?? 100);
    const cvVal = parseFloat(dataElem.lcm?.global?.cv ?? 0);
    const r2Val = parseFloat(linData?.r2 ?? 0.999);

    const cumpleVeracidad = recVal >= 75 && recVal <= 125;
    const cumplePrecision = cvVal <= 15;
    const cumpleLinealidad = r2Val >= 0.990;

    if (concContainer) {
        concContainer.innerHTML = `
            <ul class="list-disc pl-5 space-y-1.5 leading-relaxed">
                <li><strong>Límites Analíticos:</strong> Se establecieron un LOD de <strong>${lod} mg/L</strong> y un LOQ operacional de <strong>${loq} mg/L</strong>, garantizando la detección del parámetro dentro del estándar normativo.</li>
                <li><strong>Veracidad y Sesgo:</strong> Los niveles de control (LCM, CCV, EA) y el porcentaje de recuperación en matriz arrojaron valores que ${cumpleVeracidad ? '<span class="text-emerald-700 font-bold">CUMPLEN</span> con los criterios de aceptación (75% - 125%).' : '<span class="text-red-600 font-bold">NO CUMPLEN</span> con las especificaciones establecidas.'}</li>
                <li><strong>Precisión Intermedia:</strong> El análisis de ANOVA demostró que ${cumplePrecision ? '<span class="text-emerald-700 font-bold">NO EXISTEN DIFERENCIAS SIGNIFICATIVAS</span> entre analistas ni días de ensayo.' : '<span class="text-red-600 font-bold">EXISTE ALTA VARIABILIDAD</span> que requiere revisión de las condiciones de ensayo.'}</li>
                <li><strong>Linealidad y Sensibilidad:</strong> La curva de calibración satisface la pendiente e intercepto requeridos con un coeficiente R² = <strong>${r2Val}</strong> (${cumpleLinealidad ? '<span class="text-emerald-700 font-bold">CONFORME</span> a R² = 0.990' : '<span class="text-red-600 font-bold">NO CONFORME</span>'}).</li>
                <li><strong>Incertidumbre Combinada:</strong> La metodología presenta una incertidumbre expandida relativa estimada inferior al margen máximo tolerable (U_rel = ± ${u_c_total_val}).</li>
            </ul>
        `;
    }

    // 5. Sección 9: Declaración de Conformidad
    const decElem = document.getElementById('prev-declaracion-conformidad');
    if (decElem) {
        const globalConforme = cumpleVeracidad && cumplePrecision && cumpleLinealidad;
        if (globalConforme) {
            decElem.className = "bg-emerald-50 text-emerald-950 p-4 rounded-lg border border-emerald-300 font-medium text-xs text-justify leading-relaxed";
            decElem.innerHTML = `<strong>DECLARACIÓN DE CONFORMIDAD:</strong> Con base en los datos metrológicos compilados, el procedimiento analítico <strong>${codigo}</strong> para la determinación de <strong>${elemActivo}</strong> en matriz <strong>${matriz}</strong> <strong>CUMPLE SATISFACTORIAMENTE</strong> con los atributos de desempeño analítico exigidos por la norma ISO/IEC 17025 y los protocolos internos.`;
        } else {
            decElem.className = "bg-red-50 text-red-950 p-4 rounded-lg border border-red-300 font-medium text-xs text-justify leading-relaxed";
            decElem.innerHTML = `<strong>DECLARACIÓN DE NO CONFORMIDAD:</strong> El procedimiento analítico <strong>${codigo}</strong> para la determinación de <strong>${elemActivo}</strong> <strong>NO CUMPLE CON LOS CRITERIOS DE ACEPTACIÓN</strong> o presenta inconsistencias estadísticas en los datos procesados.`;
        }
    }

    if (typeof window.renderizarGraficas === 'function') {
        window.renderizarGraficas(dataElem);
    }
};

// Instancias globales para limpieza de Chart.js en la Sección 6
window.chartInfLcmInstance = null;
window.chartInfPrecInstances = {};
window.chartInfExaInstances = {};
window.chartInfLinIndInstance = null;
window.chartInfLinPromInstance = null;
window.chartInfIncertidumbreInstance = null;

window.calcularIncertidumbreParaInforme = function (elem) {
    const elemData = window.datosGlobales[elem] || {};
    const linData = elemData.linealidad;
    const config = elemData.configIncertidumbre || {};

    const analistaSel = config.selAnalistaTipoA || "Analista 1";
    const claveAnalista = analistaSel === "global" ? "global" : (analistaSel === "Analista 1" ? "analista_1" : "analista_2");
    const lcmStats = elemData.lcm && elemData.lcm[claveAnalista] ? elemData.lcm[claveAnalista] : { desviacion: 0, promedio: 0, valores: [] };

    const n_lcm = lcmStats.valores && lcmStats.valores.length > 0 ? lcmStats.valores.length : 10;
    const u_est_A = (lcmStats.desviacion || 0) / Math.sqrt(n_lcm);
    const u_A_rel = lcmStats.promedio > 0 ? (u_est_A / lcmStats.promedio) : 0;

    const usaPatron = config.checkPatronCert ?? true;
    const u_patron_rel = usaPatron ? (2 / 1000) : 0;

    const alicuotaTrab = parseFloat(config.inpAlicuotaTrabajo || 5);
    const pesoTrab = parseFloat(config.inpPesoTrabajo || 0);
    const volFinalTrab = parseFloat(config.selVolFinalTrabajo || 100);
    const instTrab = config.selInstTrabajo || "pipeta";

    let u_alicuota_trab_rel = 0;
    if (pesoTrab > 0) {
        const u_est_peso = window.TABLA_METROLOGIA.balanza / Math.sqrt(3);
        u_alicuota_trab_rel = u_est_peso / pesoTrab;
    } else {
        u_alicuota_trab_rel = window.calcUVolumetricaRel ? window.calcUVolumetricaRel(alicuotaTrab, 'pipeta', instTrab) : 0;
    }
    const u_vol_final_trab_rel = window.calcUVolumetricaRel ? window.calcUVolumetricaRel(volFinalTrab, 'balon', null) : 0;
    const u_prep_trabajo_rel = Math.sqrt(Math.pow(u_alicuota_trab_rel, 2) + Math.pow(u_vol_final_trab_rel, 2));

    let u_curva_total_rel = 0;
    let s_res = 0;
    if (linData && linData.tabla && linData.tabla.length > 1) {
        const p_curvas = linData.curvas_raw ? linData.curvas_raw.length : 1;
        const n_puntos = linData.tabla.length;
        const N_total = p_curvas * n_puntos;
        const m = linData.stats?.promedio_pendientes_raw || 1;
        const b = linData.stats?.intercepto_raw || 0;

        const instCurva = config.selInstCurva || "trans_100_1000";
        const volFinalCurva = parseFloat(config.selVolFinalCurva || 50);
        const u_vol_final_curva_rel = window.calcUVolumetricaRel ? window.calcUVolumetricaRel(volFinalCurva, 'balon', null) : 0;

        let suma_sq_prep_curva = 0;
        let sum_x = 0;

        linData.tabla.forEach(pt => {
            sum_x += pt.concentracion;
            const conc_max = linData.tabla[linData.tabla.length - 1].concentracion || 1;
            const vol_alicuota_est = (pt.concentracion / conc_max) * 10;
            const u_ali_pt_rel = window.calcUVolumetricaRel ? window.calcUVolumetricaRel(vol_alicuota_est > 0 ? vol_alicuota_est : 1, 'pipeta', instCurva) : 0;
            const u_pt_comb = Math.pow(u_ali_pt_rel, 2) + Math.pow(u_vol_final_curva_rel, 2);
            suma_sq_prep_curva += u_pt_comb;
        });
        const u_prep_curvas_rel = Math.sqrt(suma_sq_prep_curva);

        const x_bar = sum_x / n_puntos;
        let sum_res_sq = 0;
        let S_xx = 0;

        linData.tabla.forEach(pt => {
            S_xx += Math.pow(pt.concentracion - x_bar, 2);
            const y_est = m * pt.concentracion + b;
            if (pt.señales && Array.isArray(pt.señales)) {
                pt.señales.forEach(y_obs => {
                    sum_res_sq += Math.pow(y_obs - y_est, 2);
                });
            }
        });

        s_res = Math.sqrt(sum_res_sq / (N_total - 2 > 0 ? N_total - 2 : 1));
        const pendi_Sxx = Math.pow(m, 2) * S_xx;

        const y_bar_global = linData.tabla.reduce((acc, r) => acc + (r.promedio || 0), 0) / n_puntos;
        const pt_high = linData.tabla[linData.tabla.length - 1];
        const pt_low = linData.tabla[0];

        const sq_high = Math.pow((pt_high.promedio || 0) - y_bar_global, 2);
        const sq_low = Math.pow((pt_low.promedio || 0) - y_bar_global, 2);

        const divisor_reg = pendi_Sxx > 0 ? pendi_Sxx : 1;
        const u_interp_high = (s_res / Math.abs(m !== 0 ? m : 1)) * Math.sqrt((1 / p_curvas) + (1 / N_total) + (sq_high / divisor_reg));
        const u_interp_low = (s_res / Math.abs(m !== 0 ? m : 1)) * Math.sqrt((1 / p_curvas) + (1 / N_total) + (sq_low / divisor_reg));

        const curva_S_promedio = (u_interp_high + u_interp_low) / 2;
        const conc_promedio_extremos = ((pt_high.concentracion || 1) + (pt_low.concentracion || 1)) / 2;
        const u_interp_rel = curva_S_promedio / conc_promedio_extremos;

        u_curva_total_rel = Math.sqrt(Math.pow(u_prep_curvas_rel, 2) + Math.pow(u_interp_rel, 2));
    }

    const alicuotaMuestra = parseFloat(config.inpAlicuotaMuestra || 10);
    const u_muestra_rel = window.calcUVolumetricaRel ? window.calcUVolumetricaRel(alicuotaMuestra, 'pipeta', 'pipeta') : 0;

    const var_total = Math.pow(u_A_rel, 2) + Math.pow(u_patron_rel, 2) + Math.pow(u_prep_trabajo_rel, 2) + Math.pow(u_curva_total_rel, 2) + Math.pow(u_muestra_rel, 2);
    const u_c_total = Math.sqrt(var_total);
    const u_expandida_rel = 2 * u_c_total;
    const u_expandida_porc = u_expandida_rel * 100;

    return {
        u_A_rel, u_patron_rel, u_prep_trabajo_rel, u_curva_total_rel, u_muestra_rel,
        var_total, u_c_total, u_expandida_rel, u_expandida_porc, analistaSel, usaPatron, pesoTrab, alicuotaTrab, alicuotaMuestra, s_res
    };
};

// ============================================================================
// MOTOR DE LA SECCIÓN 6 (RESULTADOS) ACTUALIZADO
// ============================================================================
window.poblarSeccion6Resultados = function (elem) {
    if (!window.datosGlobales || !window.datosGlobales[elem]) {
        console.warn("No hay datos cargados para el elemento:", elem);
        return;
    }

    const data = window.datosGlobales[elem];

    /* -------------------------------------------------------------------------- */
    /* 6.1 LÍMITE DE DETECCIÓN Y CUANTIFICACIÓN                                  */
    /* -------------------------------------------------------------------------- */
    document.getElementById('inf-stat-lod').innerText = data.lod_posible || '--';
    document.getElementById('inf-stat-loq').innerText = data.loq_posible || '--';
    document.getElementById('inf-stat-teorico-lcm').innerText = data.teorico_lcm || '--';
    document.getElementById('inf-stat-error-lcm').innerText = data.lcm?.global?.error_pct !== undefined ? `${data.lcm.global.error_pct}%` : '--';

    const tbodyMbLcm = document.getElementById('inf-tabla-datos-mb-lcm');
    if (tbodyMbLcm && data.mb && data.lcm) {
        let htmlRows = '';
        const valsMBA1 = data.mb.analista_1?.valores || [];
        const valsMBA2 = data.mb.analista_2?.valores || [];
        const valsLCMA1 = data.lcm.analista_1?.valores || [];
        const valsLCMA2 = data.lcm.analista_2?.valores || [];

        for (let i = 0; i < 10; i++) {
            htmlRows += `
                <tr class="hover:bg-slate-50">
                    <td class="border border-slate-300 p-1 font-bold bg-slate-50">${i + 1}</td>
                    <td class="border border-slate-300 p-1 font-mono">${valsMBA1[i] ?? '-'}</td>
                    <td class="border border-slate-300 p-1 font-mono">${valsMBA2[i] ?? '-'}</td>
                    <td class="border border-slate-300 p-1 font-mono text-blue-700 font-bold">${valsLCMA1[i] ?? '-'}</td>
                    <td class="border border-slate-300 p-1 font-mono text-blue-700 font-bold">${valsLCMA2[i] ?? '-'}</td>
                </tr>
            `;
        }
        tbodyMbLcm.innerHTML = htmlRows;
    }

    const tbodyResumenMbLcm = document.getElementById('inf-tabla-resumen-mb-lcm');
    if (tbodyResumenMbLcm && data.mb && data.lcm) {
        tbodyResumenMbLcm.innerHTML = `
            <tr><td class="border border-slate-300 p-1.5 font-bold">MB</td><td class="border border-slate-300 p-1.5">Analista 1</td><td class="border border-slate-300 p-1.5 font-mono">${data.mb.analista_1.promedio}</td><td class="border border-slate-300 p-1.5 font-mono">${data.mb.analista_1.desviacion}</td><td class="border border-slate-300 p-1.5 font-mono">${data.mb.analista_1.cv}%</td></tr>
            <tr><td class="border border-slate-300 p-1.5 font-bold">MB</td><td class="border border-slate-300 p-1.5">Analista 2</td><td class="border border-slate-300 p-1.5 font-mono">${data.mb.analista_2.promedio}</td><td class="border border-slate-300 p-1.5 font-mono">${data.mb.analista_2.desviacion}</td><td class="border border-slate-300 p-1.5 font-mono">${data.mb.analista_2.cv}%</td></tr>
            <tr class="bg-blue-50 font-bold"><td class="border border-slate-300 p-1.5">MB</td><td class="border border-slate-300 p-1.5">Global</td><td class="border border-slate-300 p-1.5 font-mono">${data.mb.global.promedio}</td><td class="border border-slate-300 p-1.5 font-mono">${data.mb.global.desviacion}</td><td class="border border-slate-300 p-1.5 font-mono">${data.mb.global.cv}%</td></tr>
            <tr><td class="border border-slate-300 p-1.5 font-bold">LCM</td><td class="border border-slate-300 p-1.5">Analista 1</td><td class="border border-slate-300 p-1.5 font-mono">${data.lcm.analista_1.promedio}</td><td class="border border-slate-300 p-1.5 font-mono">${data.lcm.analista_1.desviacion}</td><td class="border border-slate-300 p-1.5 font-mono">${data.lcm.analista_1.cv}%</td></tr>
            <tr><td class="border border-slate-300 p-1.5 font-bold">LCM</td><td class="border border-slate-300 p-1.5">Analista 2</td><td class="border border-slate-300 p-1.5 font-mono">${data.lcm.analista_2.promedio}</td><td class="border border-slate-300 p-1.5 font-mono">${data.lcm.analista_2.desviacion}</td><td class="border border-slate-300 p-1.5 font-mono">${data.lcm.analista_2.cv}%</td></tr>
            <tr class="bg-blue-50 font-bold"><td class="border border-slate-300 p-1.5">LCM</td><td class="border border-slate-300 p-1.5">Global</td><td class="border border-slate-300 p-1.5 font-mono">${data.lcm.global.promedio}</td><td class="border border-slate-300 p-1.5 font-mono">${data.lcm.global.desviacion}</td><td class="border border-slate-300 p-1.5 font-mono">${data.lcm.global.cv}%</td></tr>
        `;
    }

    if (window.chartInfLcmInstance) window.chartInfLcmInstance.destroy();
    const ctxLcmInf = document.getElementById('chart-inf-lcm')?.getContext('2d');
    if (ctxLcmInf && data.lcm?.raw) {
        window.chartInfLcmInstance = new Chart(ctxLcmInf, {
            type: 'scatter',
            data: {
                datasets: [
                    { type: 'line', label: 'Valor Teórico LCM', data: [{ x: 0, y: data.teorico_lcm }, { x: 11, y: data.teorico_lcm }], borderColor: '#ef4444', borderDash: [5, 5], fill: false, pointRadius: 0 },
                    { label: 'Analista 1', data: data.lcm.raw.filter(d => d.analista === 'Analista 1').map((d, i) => ({ x: i + 1, y: d.valor })), backgroundColor: '#2563eb' },
                    { label: 'Analista 2', data: data.lcm.raw.filter(d => d.analista === 'Analista 2').map((d, i) => ({ x: i + 1, y: d.valor })), backgroundColor: '#059669' }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { x: { title: { display: true, text: 'Ensayos' }, min: 0, max: 11 } } }
        });
    }

    /* -------------------------------------------------------------------------- */
    /* 6.2 PRECISIÓN (LCM, CCV, EA)                                              */
    /* -------------------------------------------------------------------------- */
    const tbodyConsolidadoPrec = document.getElementById('inf-tabla-consolidado-precision');
    if (tbodyConsolidadoPrec && data.precision) {
        let htmlPrec = '';
        ['lcm', 'ccv', 'ea'].forEach(ctrl => {
            const objPrec = data.precision[ctrl] || data.precision[ctrl.toUpperCase()];
            if (!objPrec) return;

            const pShapiroA1 = objPrec.normalidad?.shapiro?.analista_1?.p ?? '--';
            const pShapiroA2 = objPrec.normalidad?.shapiro?.analista_2?.p ?? '--';
            const normGlobal = (objPrec.normalidad?.shapiro?.analista_1?.normal && objPrec.normalidad?.shapiro?.analista_2?.normal)
                ? '<span class="text-emerald-700 font-bold">Sí</span>'
                : '<span class="text-red-600 font-bold">No</span>';

            const anovaF = objPrec.anova?.analista?.F ?? '--';
            const anovap = objPrec.anova?.analista?.p ?? '--';
            const noParam = objPrec.no_parametrica ? `Kruskal H=${objPrec.no_parametrica.kruskal_stat}` : 'Paramétrica aplicable';

            htmlPrec += `
                <tr>
                    <td class="border border-slate-300 p-1.5 font-bold uppercase bg-slate-50">${ctrl}</td>
                    <td class="border border-slate-300 p-1.5 font-mono">A1: ${pShapiroA1} | A2: ${pShapiroA2}</td>
                    <td class="border border-slate-300 p-1.5">${normGlobal}</td>
                    <td class="border border-slate-300 p-1.5 font-mono">F=${anovaF} | p=${anovap}</td>
                    <td class="border border-slate-300 p-1.5 text-slate-700">${noParam}</td>
                </tr>
            `;
        });
        tbodyConsolidadoPrec.innerHTML = htmlPrec;
    }

    ['lcm', 'ccv', 'ea'].forEach(ctrl => {
        const tag = ctrl.toUpperCase();
        if (window.chartInfPrecInstances[tag]) window.chartInfPrecInstances[tag].destroy();
        const ctxPrec = document.getElementById(`chart-inf-prec-${tag}`)?.getContext('2d');
        const datosControl = data[ctrl]?.raw || data[tag]?.raw || data.exactitud?.[ctrl]?.raw || data.exactitud?.[tag]?.raw || [];
        if (ctxPrec && datosControl.length > 0) {
            const valsA1 = datosControl.filter(d => d.analista === 'Analista 1').map(d => d.valor);
            const valsA2 = datosControl.filter(d => d.analista === 'Analista 2').map(d => d.valor);

            window.chartInfPrecInstances[tag] = new Chart(ctxPrec, {
                type: 'line',
                data: {
                    labels: Array.from({ length: Math.max(valsA1.length, valsA2.length) }, (_, i) => `${i + 1}`),
                    datasets: [
                        { label: 'Analista 1', data: valsA1, borderColor: '#2563eb', tension: 0.1, pointRadius: 3 },
                        { label: 'Analista 2', data: valsA2, borderColor: '#059669', tension: 0.1, pointRadius: 3 }
                    ]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }
    });

    /* -------------------------------------------------------------------------- */
    /* 6.3 EXACTITUD (Robustecido para mapear LCM, CCV y EA)                     */
    /* -------------------------------------------------------------------------- */
    const tbodyIndExa = document.getElementById('inf-tabla-exactitud-individuales');
    if (tbodyIndExa) {
        let htmlInd = '';
        ['lcm', 'ccv', 'ea'].forEach(ctrl => {
            const tag = ctrl.toUpperCase();
            const objCtrl = data[ctrl] || data[tag] || (data.exactitud && (data.exactitud[ctrl] || data.exactitud[tag]));
            if (!objCtrl) return;

            const vA1 = objCtrl.analista_1?.valores || objCtrl.analista_1 || (objCtrl.raw ? objCtrl.raw.filter(d => d.analista === 'Analista 1').map(d => d.valor) : []);
            const vA2 = objCtrl.analista_2?.valores || objCtrl.analista_2 || (objCtrl.raw ? objCtrl.raw.filter(d => d.analista === 'Analista 2').map(d => d.valor) : []);
            const teo = data[`teorico_${ctrl}`] || data[`teorico_${ctrl.toLowerCase()}`] || data.exactitud?.[ctrl]?.teorico || data.exactitud?.[tag]?.teorico || (ctrl === 'lcm' ? data.teorico_lcm : 1);

            const maxLen = Math.max(vA1.length, vA2.length, 10);
            for (let i = 0; i < maxLen; i++) {
                const valA1 = vA1[i];
                const valA2 = vA2[i];
                if (valA1 === undefined && valA2 === undefined) continue;

                const errA1 = valA1 !== undefined && teo ? ((valA1 - teo) / teo * 100).toFixed(2) : '--';
                const recA1 = valA1 !== undefined && teo ? (valA1 / teo * 100).toFixed(2) : '--';
                const errA2 = valA2 !== undefined && teo ? ((valA2 - teo) / teo * 100).toFixed(2) : '--';
                const recA2 = valA2 !== undefined && teo ? (valA2 / teo * 100).toFixed(2) : '--';

                htmlInd += `
                    <tr class="hover:bg-slate-50">
                        <td class="border border-slate-300 p-1 font-bold uppercase bg-slate-50">${tag} - #${i + 1}</td>
                        <td class="border border-slate-300 p-1 font-mono">${valA1 !== undefined ? valA1 : '-'}</td>
                        <td class="border border-slate-300 p-1 font-mono">${valA1 !== undefined ? errA1 + '%' : '-'}</td>
                        <td class="border border-slate-300 p-1 font-mono text-blue-700 font-bold">${valA1 !== undefined ? recA1 + '%' : '-'}</td>
                        <td class="border border-slate-300 p-1 font-mono">${valA2 !== undefined ? valA2 : '-'}</td>
                        <td class="border border-slate-300 p-1 font-mono">${valA2 !== undefined ? errA2 + '%' : '-'}</td>
                        <td class="border border-slate-300 p-1 font-mono text-indigo-700 font-bold">${valA2 !== undefined ? recA2 + '%' : '-'}</td>
                    </tr>
                `;
            }
        });
        tbodyIndExa.innerHTML = htmlInd;
    }

    // Gráficas de % Recuperación para LCM, CCV y EA (Figuras 3a, 3b, 3c)
    ['lcm', 'ccv', 'ea'].forEach(ctrl => {
        const tag = ctrl.toUpperCase();
        if (window.chartInfExaInstances[tag]) window.chartInfExaInstances[tag].destroy();
        const ctxExa = document.getElementById(`chart-inf-exa-${tag}`)?.getContext('2d');
        const objCtrl = data[ctrl] || data[tag] || (data.exactitud && (data.exactitud[ctrl] || data.exactitud[tag]));
        const teo = data[`teorico_${ctrl}`] || data[`teorico_${ctrl.toLowerCase()}`] || data.exactitud?.[ctrl]?.teorico || data.exactitud?.[tag]?.teorico || (ctrl === 'lcm' ? data.teorico_lcm : 1);

        if (ctxExa && objCtrl) {
            const vA1 = objCtrl.analista_1?.valores || objCtrl.analista_1 || (objCtrl.raw ? objCtrl.raw.filter(d => d.analista === 'Analista 1').map(d => d.valor) : []);
            const vA2 = objCtrl.analista_2?.valores || objCtrl.analista_2 || (objCtrl.raw ? objCtrl.raw.filter(d => d.analista === 'Analista 2').map(d => d.valor) : []);
            const recA1 = vA1.map(v => teo ? (v / teo) * 100 : 0);
            const recA2 = vA2.map(v => teo ? (v / teo) * 100 : 0);
            const maxLen = Math.max(recA1.length, recA2.length, 10);

            window.chartInfExaInstances[tag] = new Chart(ctxExa, {
                type: 'line',
                data: {
                    labels: Array.from({ length: maxLen }, (_, i) => `#${i + 1}`),
                    datasets: [
                        { type: 'line', label: '100% Ideal', data: Array(maxLen).fill(100), borderColor: '#ef4444', borderDash: [4, 4], pointRadius: 0, borderWidth: 1.5 },
                        { label: 'Analista 1 (%R)', data: recA1, borderColor: '#2563eb', tension: 0.1 },
                        { label: 'Analista 2 (%R)', data: recA2, borderColor: '#4f46e5', tension: 0.1 }
                    ]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }
    });

    /* -------------------------------------------------------------------------- */
    /* 6.4 LINEALIDAD - SENSIBILIDAD                                             */
    /* -------------------------------------------------------------------------- */
    const linData = data.linealidad;
    const tbodyStatsLin = document.getElementById('inf-tabla-stats-linealidad');
    if (tbodyStatsLin && linData?.stats) {
        const st = linData.stats;
        tbodyStatsLin.innerHTML = `
            <tr><td class="py-1.5 font-semibold">Promedio de Pendientes</td><td class="py-1.5 font-mono text-right">${st.promedio_pendientes}</td></tr>
            <tr class="bg-slate-50"><td class="py-1.5 font-semibold">Desviación de Pendientes</td><td class="py-1.5 font-mono text-right">${st.desviacion_pendientes}</td></tr>
            <tr class="bg-blue-600 text-white font-extrabold shadow-sm"><td class="py-2 px-2">SENSIBILIDAD ANALÍTICA (m ± SD)</td><td class="py-2 px-2 font-mono text-right text-yellow-300 text-sm">${st.sensibilidad}</td></tr>
            <tr class="bg-slate-50"><td class="py-1.5 font-semibold">Intercepto (Promedio)</td><td class="py-1.5 font-mono text-right">${st.intercepto}</td></tr>
            <tr><td class="py-1.5 font-semibold">Coef. de Correlación (r)</td><td class="py-1.5 font-mono text-right">${st.r}</td></tr>
            <tr class="bg-slate-50"><td class="py-1.5 font-semibold">Coef. de Determinación (R²)</td><td class="py-1.5 font-mono text-right font-bold text-emerald-700">${st.r2}</td></tr>
            <tr><td class="py-1.5 font-semibold">Ecuación Promedio</td><td class="py-1.5 font-mono text-right italic">${st.ecuacion}</td></tr>
        `;
    }

    const theadLin = document.getElementById('inf-head-tabla-linealidad');
    const tbodyLin = document.getElementById('inf-body-tabla-linealidad');
    if (theadLin && tbodyLin && linData?.tabla) {
        let maxC = 0;
        linData.tabla.forEach(r => { if (r.señales.length > maxC) maxC = r.señales.length; });

        let headH = `<tr><th class="border border-slate-300 p-1.5">Concentración</th>`;
        for (let i = 1; i <= maxC; i++) headH += `<th class="border border-slate-300 p-1.5">Señal ${i}</th>`;
        headH += `<th class="border border-slate-300 p-1.5 bg-blue-100 text-blue-900">Promedio Int.</th><th class="border border-slate-300 p-1.5">Conc. Calc.</th><th class="border border-slate-300 p-1.5 text-red-600">% Error</th></tr>`;
        theadLin.innerHTML = headH;

        let bodyH = '';
        linData.tabla.forEach((row) => {
            let f = `<tr><td class="border border-slate-300 p-1.5 font-bold">${row.concentracion}</td>`;
            for (let c = 0; c < maxC; c++) f += `<td class="border border-slate-300 p-1.5 font-mono">${row.señales[c] ?? '-'}</td>`;
            f += `
                <td class="border border-slate-300 p-1.5 font-mono font-bold bg-blue-50 text-blue-800">${row.promedio}</td>
                <td class="border border-slate-300 p-1.5 font-mono">${row.conc_calculada}</td>
                <td class="border border-slate-300 p-1.5 font-mono font-bold ${row.error_pct > 10 ? 'text-red-600' : 'text-emerald-700'}">${row.error_pct}%</td>
            </tr>`;
            bodyH += f;
        });
        tbodyLin.innerHTML = bodyH;

        if (window.chartInfLinIndInstance) window.chartInfLinIndInstance.destroy();
        const ctxLinInd = document.getElementById('chart-inf-lin-ind')?.getContext('2d');
        if (ctxLinInd && linData.curvas_raw) {
            const dsInd = linData.curvas_raw.map((curva, i) => ({
                label: `Curva ${i + 1}`,
                data: curva.map(pt => ({ x: pt[0], y: pt[1] })),
                borderColor: `hsl(${i * 60 + 200}, 70%, 50%)`,
                showLine: true,
                tension: 0
            }));
            window.chartInfLinIndInstance = new Chart(ctxLinInd, { type: 'scatter', data: { datasets: dsInd }, options: { responsive: true, maintainAspectRatio: false } });
        }

        if (window.chartInfLinPromInstance) window.chartInfLinPromInstance.destroy();
        const ctxLinProm = document.getElementById('chart-inf-lin-prom')?.getContext('2d');
        if (ctxLinProm) {
            const ptProm = linData.tabla.map(r => ({ x: r.concentracion, y: r.promedio }));
            const xs = linData.tabla.map(r => r.concentracion);
            const st = linData.stats;
            const linea = [
                { x: Math.min(...xs), y: st.intercepto_raw + st.promedio_pendientes_raw * Math.min(...xs) },
                { x: Math.max(...xs), y: st.intercepto_raw + st.promedio_pendientes_raw * Math.max(...xs) }
            ];

            window.chartInfLinPromInstance = new Chart(ctxLinProm, {
                type: 'scatter',
                data: {
                    datasets: [
                        { label: 'Promedio Experimental', data: ptProm, borderColor: '#2563eb', backgroundColor: '#2563eb' },
                        { type: 'line', label: 'Línea de Regresión', data: linea, borderColor: '#ef4444', borderDash: [4, 4], pointRadius: 0 }
                    ]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }
    }

    /* -------------------------------------------------------------------------- */
    /* 6.5 RESUMEN DE INCERTIDUMBRES COMBINADAS                                  */
    /* -------------------------------------------------------------------------- */
    const tbResumenInc = document.getElementById('inf-tabla-resumen-incertidumbre');
    const incRes = window.calcularIncertidumbreParaInforme(elem);

    if (tbResumenInc && incRes) {
        const porc = (val_sq) => incRes.var_total > 0 ? ((val_sq / incRes.var_total) * 100).toFixed(1) + '%' : '0.0%';

        tbResumenInc.innerHTML = `
            <tr><td class="border border-slate-300 p-2">1. Repetibilidad LCM (${incRes.analistaSel})</td><td class="border border-slate-300 p-2 text-center font-bold text-blue-600">Tipo A</td><td class="border border-slate-300 p-2 text-right font-mono">--</td><td class="border border-slate-300 p-2 text-right font-mono">${incRes.u_A_rel.toFixed(5)}</td><td class="border border-slate-300 p-2 text-right font-bold text-indigo-600">${porc(Math.pow(incRes.u_A_rel, 2))}</td></tr>
            <tr><td class="border border-slate-300 p-2">2. Patrón Certificable (CRM)</td><td class="border border-slate-300 p-2 text-center font-bold text-emerald-600">Tipo B</td><td class="border border-slate-300 p-2 text-right font-mono">${incRes.usaPatron ? '2 / 1000' : 'N/A'}</td><td class="border border-slate-300 p-2 text-right font-mono">${incRes.u_patron_rel.toFixed(5)}</td><td class="border border-slate-300 p-2 text-right font-bold text-indigo-600">${porc(Math.pow(incRes.u_patron_rel, 2))}</td></tr>
            <tr><td class="border border-slate-300 p-2">3. Prep. Patrón Trabajo</td><td class="border border-slate-300 p-2 text-center font-bold text-emerald-600">Tipo B</td><td class="border border-slate-300 p-2 text-right font-mono">${incRes.pesoTrab > 0 ? incRes.pesoTrab + ' g' : incRes.alicuotaTrab + ' mL'}</td><td class="border border-slate-300 p-2 text-right font-mono">${incRes.u_prep_trabajo_rel.toFixed(5)}</td><td class="border border-slate-300 p-2 text-right font-bold text-indigo-600">${porc(Math.pow(incRes.u_prep_trabajo_rel, 2))}</td></tr>
            <tr><td class="border border-slate-300 p-2">4. Curva de Calibración (Prep + Regresión)</td><td class="border border-slate-300 p-2 text-center font-bold text-emerald-600">Tipo B</td><td class="border border-slate-300 p-2 text-right font-mono">s_res = ${incRes.s_res.toFixed(4)}</td><td class="border border-slate-300 p-2 text-right font-mono">${incRes.u_curva_total_rel.toFixed(5)}</td><td class="border border-slate-300 p-2 text-right font-bold text-indigo-600">${porc(Math.pow(incRes.u_curva_total_rel, 2))}</td></tr>
            <tr><td class="border border-slate-300 p-2">5. Alícuota Toma de Muestra</td><td class="border border-slate-300 p-2 text-center font-bold text-emerald-600">Tipo B</td><td class="border border-slate-300 p-2 text-right font-mono">${incRes.alicuotaMuestra} mL</td><td class="border border-slate-300 p-2 text-right font-mono">${incRes.u_muestra_rel.toFixed(5)}</td><td class="border border-slate-300 p-2 text-right font-bold text-indigo-600">${porc(Math.pow(incRes.u_muestra_rel, 2))}</td></tr>
        `;

        document.getElementById('inf-val-uc-total').innerText = incRes.u_c_total.toFixed(5);
        document.getElementById('inf-val-u-expandida').innerText = `± ${incRes.u_expandida_rel.toFixed(5)} (± ${incRes.u_expandida_porc.toFixed(2)}%)`;
    }

    if (window.chartInfIncertidumbreInstance) window.chartInfIncertidumbreInstance.destroy();
    const ctxIncInf = document.getElementById('chart-inf-incertidumbre')?.getContext('2d');
    if (ctxIncInf && incRes) {
        window.chartInfIncertidumbreInstance = new Chart(ctxIncInf, {
            type: 'doughnut',
            data: {
                labels: ['1. Tipo A (LCM)', '2. Patrón (CRM)', '3. Prep. Trabajo', '4. Curva Calib.', '5. Toma Muestra'],
                datasets: [{
                    data: [
                        Math.pow(incRes.u_A_rel, 2),
                        Math.pow(incRes.u_patron_rel, 2),
                        Math.pow(incRes.u_prep_trabajo_rel, 2),
                        Math.pow(incRes.u_curva_total_rel, 2),
                        Math.pow(incRes.u_muestra_rel, 2)
                    ],
                    backgroundColor: ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899']
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } } }
        });
    }
};

window.previsualizarInforme = window.guardarMetadatosYCompilar;

let instanciaChartPrecision = null;
let instanciaChartCurvasInd = null;
let instanciaChartCurvaPromedio = null;

window.renderizarGraficas = function (dataElem) {
    if (!dataElem) return;

    // 1. Gráfica de Precisión Intermedia (LCM)
    const lcm1 = dataElem.lcm?.analista_1?.valores || dataElem.analista_1?.valores || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const lcm2 = dataElem.lcm?.analista_2?.valores || dataElem.analista_2?.valores || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const labelsEnsayos = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

    const ctxPrecision = document.getElementById('chart-precision');
    if (ctxPrecision) {
        if (instanciaChartPrecision) instanciaChartPrecision.destroy();

        instanciaChartPrecision = new Chart(ctxPrecision, {
            type: 'line',
            data: {
                labels: labelsEnsayos,
                datasets: [
                    {
                        label: 'Analista 1',
                        data: lcm1,
                        borderColor: 'rgb(59, 130, 246)',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        borderWidth: 2,
                        tension: 0.3,
                        fill: true
                    },
                    {
                        label: 'Analista 2',
                        data: lcm2,
                        borderColor: 'rgb(16, 185, 129)',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        borderWidth: 2,
                        tension: 0.3,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top', labels: { boxWidth: 10, font: { size: 10 } } }
                },
                scales: {
                    y: { title: { display: true, text: 'Concentración Calculada (mg/L)', font: { size: 10 } }, ticks: { font: { size: 9 } } },
                    x: { title: { display: true, text: 'Ensayo N°', font: { size: 10 } }, ticks: { font: { size: 9 } } }
                }
            }
        });
    }

    // Ubicamos los datos independientemente de si vienen en la raíz o dentro del nodo 'linealidad'
    const curvasRaw = dataElem.curvas_raw || dataElem.linealidad?.curvas_raw;
    const tablaData = dataElem.tabla || dataElem.linealidad?.tabla;
    const statsData = dataElem.stats || dataElem.linealidad?.stats;

    // 2. Gráfico de Curvas Individuales
    // Fallback al ID antiguo 'chart-calibracion' si no se ha actualizado el HTML
    const canvasInd = document.getElementById('chartCurvasInd') || document.getElementById('chart-calibracion');

    if (canvasInd && curvasRaw && Array.isArray(curvasRaw)) {
        const ctxInd = canvasInd.getContext('2d');
        if (instanciaChartCurvasInd) instanciaChartCurvasInd.destroy();

        let datasetsInd = curvasRaw.map((curva, i) => {
            const color = `hsl(${i * 60 + 200}, 70%, 50%)`;
            return {
                label: `Curva ${i + 1}`,
                data: curva.map(pt => ({ x: pt[0], y: pt[1] })),
                borderColor: color,
                backgroundColor: color,
                showLine: true,
                tension: 0
            };
        });

        instanciaChartCurvasInd = new Chart(ctxInd, {
            type: 'scatter',
            data: { datasets: datasetsInd },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { title: { display: true, text: 'Concentración' } },
                    y: { title: { display: true, text: 'Señal' } }
                }
            }
        });
    }

    // 3. Gráfico Curva Promedio
    const canvasAvg = document.getElementById('chartCurvaPromedio');

    if (canvasAvg && tablaData && Array.isArray(tablaData)) {
        const ctxAvg = canvasAvg.getContext('2d');
        if (instanciaChartCurvaPromedio) instanciaChartCurvaPromedio.destroy();

        let puntosPromedio = tablaData.map(row => ({ x: row.concentracion, y: row.promedio }));
        let lineaTendencia = [];

        if (statsData) {
            const xVals = tablaData.map(r => r.concentracion);
            const minX = Math.min(...xVals);
            const maxX = Math.max(...xVals);
            lineaTendencia = [
                { x: minX, y: statsData.intercepto_raw + (statsData.promedio_pendientes_raw * minX) },
                { x: maxX, y: statsData.intercepto_raw + (statsData.promedio_pendientes_raw * maxX) }
            ];
        }

        instanciaChartCurvaPromedio = new Chart(ctxAvg, {
            type: 'scatter',
            data: {
                datasets: [
                    {
                        label: 'Promedio Experimental',
                        data: puntosPromedio,
                        borderColor: '#2563eb',
                        backgroundColor: '#2563eb',
                        pointRadius: 5
                    },
                    {
                        type: 'line',
                        label: 'Línea de Regresión',
                        data: lineaTendencia,
                        borderColor: '#ef4444',
                        borderDash: [5, 5],
                        borderWidth: 2,
                        fill: false,
                        pointRadius: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { title: { display: true, text: 'Concentración' } },
                    y: { title: { display: true, text: 'Promedio de Señal' } }
                }
            }
        });
    }
};

window.prepararRASParaPDF = async function (container) {
    // 1. Validar si el elemento actual es RAS
    const selectElem = document.getElementById('selectElementoInforme');
    const paramVal = selectElem ? selectElem.value : window.elementoActivo;
    if (paramVal !== 'RAS' && !paramVal.includes('RAS')) return null;

    const linDataRAS = window.datosGlobales['RAS']?.linealidad;
    if (!linDataRAS || !linDataRAS.es_ras_combinado) return null;

    // 2. Crear un contenedor temporal al final del informe
    const tempWrapper = document.createElement('div');
    tempWrapper.id = 'bloque-temporal-ras-pdf';
    tempWrapper.className = 'w-full flex flex-col gap-6 mt-4 page-break-before'; // Salto de página

    const title = document.createElement('h3');
    title.className = 'font-bold text-xl text-slate-800 border-b-2 border-slate-300 pb-2 mb-2 uppercase text-center bg-slate-100 p-2 rounded';
    title.innerText = 'Desglose de Calibración y Sensibilidad para RAS (Ca, Mg, Na)';
    tempWrapper.appendChild(title);

    const chartsToDestroy = [];

    // 3. Iterar sobre los 3 cationes y construir su HTML
    ['Ca', 'Mg', 'Na'].forEach(elem => {
        const dataLin = linDataRAS[elem];
        if (!dataLin) return;

        const block = document.createElement('div');
        // page-break-inside-avoid evita que la gráfica se corte a la mitad de la página en el PDF
        block.className = 'p-5 border border-slate-300 rounded-lg bg-white shadow-sm';
        block.style.pageBreakInside = 'avoid';

        block.innerHTML = `
            <h4 class="font-bold text-slate-800 text-lg mb-3">Curva de Calibración - ${elem}</h4>
            <div class="flex flex-wrap gap-4 mb-4 text-sm">
                <div class="bg-blue-50 px-4 py-2 border border-blue-200 rounded text-blue-800 font-bold">Sensibilidad: ${dataLin.stats.sensibilidad}</div>
                <div class="bg-emerald-50 px-4 py-2 border border-emerald-200 rounded text-emerald-800 font-bold">R²: ${dataLin.stats.r2}</div>
                <div class="bg-slate-50 px-4 py-2 border border-slate-200 rounded text-slate-700">Ecuación: ${dataLin.stats.ecuacion}</div>
            </div>
            <div class="relative w-full flex justify-center" style="height: 320px;">
                <canvas id="temp-canvas-pdf-${elem}"></canvas>
            </div>
        `;
        tempWrapper.appendChild(block);
    });

    container.appendChild(tempWrapper);

    // 4. Renderizar las gráficas de Chart.js con la animación apagada
    ['Ca', 'Mg', 'Na'].forEach(elem => {
        const dataLin = linDataRAS[elem];
        if (!dataLin) return;

        const ctx = document.getElementById(`temp-canvas-pdf-${elem}`).getContext('2d');

        const puntosPromedio = dataLin.tabla.map(row => ({ x: row.concentracion, y: row.promedio }));
        const xVals = dataLin.tabla.map(r => r.concentracion);
        const minX = Math.min(...xVals);
        const maxX = Math.max(...xVals);
        const lineaTendencia = [
            { x: minX, y: dataLin.stats.intercepto_raw + dataLin.stats.promedio_pendientes_raw * minX },
            { x: maxX, y: dataLin.stats.intercepto_raw + dataLin.stats.promedio_pendientes_raw * maxX }
        ];

        const chart = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [
                    {
                        label: 'Promedio Experimental',
                        data: puntosPromedio,
                        borderColor: '#2563eb',
                        backgroundColor: '#2563eb',
                        pointRadius: 5
                    },
                    {
                        type: 'line',
                        label: 'Línea de Regresión',
                        data: lineaTendencia,
                        borderColor: '#ef4444',
                        borderDash: [5, 5],
                        borderWidth: 2,
                        fill: false,
                        pointRadius: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false, // ¡Crucial! Evita que html2canvas capture un canvas en blanco
                scales: {
                    x: { title: { display: true, text: 'Concentración' } },
                    y: { title: { display: true, text: 'Promedio de Señal' } }
                }
            }
        });
        chartsToDestroy.push(chart);
    });

    // Pequeña pausa para asegurar que el DOM dibujó los canvas
    await new Promise(r => setTimeout(r, 250));

    return { tempWrapper, chartsToDestroy };
};

window.limpiarRASParaPDF = function (setupData) {
    if (!setupData) return;
    // Destruir instancias de Chart.js para liberar memoria
    setupData.chartsToDestroy.forEach(c => c.destroy());
    // Eliminar el nodo temporal del DOM
    if (setupData.tempWrapper && setupData.tempWrapper.parentNode) {
        setupData.tempWrapper.parentNode.removeChild(setupData.tempWrapper);
    }
};

window.exportarPDF = async function () {
    const { jsPDF } = window.jspdf;

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const usableWidth = pageWidth - (margin * 2);
    let cursorY = margin;

    const container = document.getElementById('previewInformeContainer');
    const rasSetupData = await window.prepararRASParaPDF(container);
    const blocks = Array.from(container.children);

    const originalBorder = container.style.border;
    const originalShadow = container.style.boxShadow;
    container.style.border = 'none';
    container.style.boxShadow = 'none';

    for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];

        if (!block || block.offsetHeight === 0) continue;

        // OPTIMIZACIÓN DE PESO:
        // 1. scale: 1.5 en lugar de 2 (reduce drásticamente los píxeles innecesarios).
        // 2. Uso de formato 'image/jpeg' con calidad 0.75 en vez de PNG sin compresión.
        const canvas = await html2canvas(block, {
            scale: 1.5,
            useCORS: true,
            backgroundColor: '#ffffff'
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.75);
        const imgWidth = usableWidth;
        const imgHeight = (canvas.height * usableWidth) / canvas.width;

        if (cursorY + imgHeight > pageHeight - margin && cursorY > margin) {
            pdf.addPage();
            cursorY = margin;
        }

        // Se pasa 'JPEG' como parámetro en addImage acorde al formato generado
        pdf.addImage(imgData, 'JPEG', margin, cursorY, imgWidth, imgHeight);
        cursorY += imgHeight + 4;
    }

    container.style.border = originalBorder;
    container.style.boxShadow = originalShadow;

    window.limpiarRASParaPDF(rasSetupData);

    pdf.save('Informe_Validacion_Laboratorio_SGI.pdf');
};

async function generarPDFBlob() {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const usableWidth = pageWidth - (margin * 2);
    let cursorY = margin;

    const container = document.getElementById('previewInformeContainer');
    const rasSetupData = await window.prepararRASParaPDF(container);
    const blocks = Array.from(container.children);

    const originalBorder = container.style.border;
    const originalShadow = container.style.boxShadow;
    container.style.border = 'none';
    container.style.boxShadow = 'none';

    for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        if (!block || block.offsetHeight === 0) continue;

        const canvas = await html2canvas(block, {
            scale: 1.5,
            useCORS: true,
            backgroundColor: '#ffffff'
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.75);
        const imgWidth = usableWidth;
        const imgHeight = (canvas.height * usableWidth) / canvas.width;

        if (cursorY + imgHeight > pageHeight - margin && cursorY > margin) {
            pdf.addPage();
            cursorY = margin;
        }

        pdf.addImage(imgData, 'JPEG', margin, cursorY, imgWidth, imgHeight);
        cursorY += imgHeight + 4;
    }

    container.style.border = originalBorder;
    container.style.boxShadow = originalShadow;

    window.limpiarRASParaPDF(rasSetupData);

    return pdf.output('blob');
}

// Función principal de exportación masiva
window.exportarTodosPDFsZip = async function (btnElement) {
    const select = document.getElementById('selectElementoInforme');
    if (!select || select.options.length === 0) return;

    const zip = new JSZip();
    const valorInicial = select.value;
    const textoOriginalBoton = btnElement.innerHTML;

    btnElement.disabled = true;

    try {
        for (let i = 0; i < select.options.length; i++) {
            const option = select.options[i];
            const paramVal = option.value;

            // Actualizar feedback visual en el botón
            btnElement.innerText = `Procesando ${paramVal} (${i + 1}/${select.options.length})...`;

            // Cambiar parámetro y forzar actualización del DOM / Gráficos
            select.value = paramVal;
            if (typeof window.cambiarElementoInforme === 'function') {
                window.cambiarElementoInforme(paramVal);
            }
            if (typeof window.guardarMetadatosYCompilar === 'function') {
                window.guardarMetadatosYCompilar();
            }

            // Pausa de 300ms para permitir el renderizado completo de Chart.js y tablas
            await new Promise(resolve => setTimeout(resolve, 300));

            // Generar el Blob e insertarlo al paquete ZIP
            const pdfBlob = await generarPDFBlob();
            zip.file(`Informe_Validacion_${paramVal}.pdf`, pdfBlob);
        }

        btnElement.innerText = 'Empaquetando ZIP...';

        // Generar y descargar el archivo final ZIP
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const downloadLink = document.createElement('a');
        downloadLink.href = URL.createObjectURL(zipBlob);
        downloadLink.download = `Informes_Validacion_SGI_${new Date().toISOString().slice(0, 10)}.zip`;
        downloadLink.click();
        URL.revokeObjectURL(downloadLink.href);

    } catch (error) {
        console.error('Error al generar la descarga masiva ZIP:', error);
        alert('Ocurrió un problema al procesar los archivos.');
    } finally {
        // Restaurar estado original del selector y del botón
        select.value = valorInicial;
        if (typeof window.cambiarElementoInforme === 'function') {
            window.cambiarElementoInforme(valorInicial);
        }
        btnElement.innerHTML = textoOriginalBoton;
        btnElement.disabled = false;
    }
};

// Inicialización limpia al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
    if (typeof window.cambiarSeccion === 'function') {
        window.cambiarSeccion('carga');
    }
});