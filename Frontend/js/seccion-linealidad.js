/**
 * SECCIÓN 5 - LINEALIDAD Y SENSIBILIDAD
 * -----------------------------------------------------------------------
 * Poblar selector de parámetro (poblarSelectorLinealidad) y renderizar
 * tabla/gráficas de curvas de calibración (renderizarDatosLinealidad).
 * Depende de core-estado.js y core-navegacion.js.
 * -----------------------------------------------------------------------
 */

/* --- NUEVO: FLUJO PARA LINEALIDAD INTEGRADO --- */

window.poblarSelectorLinealidad = function () {
    const select = document.getElementById('selectParametroLin');
    if (!select) return;
    select.innerHTML = '';

    let foundFirst = false;

    Object.keys(window.datosGlobales).forEach(param => {
        // Solo agregar al selector si el elemento tiene datos de linealidad
        if (window.tieneLinealidad ? window.tieneLinealidad(param) : window.datosGlobales[param].linealidad) {
            const opt = document.createElement('option');
            opt.value = param;
            opt.textContent = param;

            // Si no hay un parámetro activo o el actual no tiene linealidad, asignamos el primero válido
            if (!foundFirst) {
                if (!window.parametroActivoLin || !window.datosGlobales[window.parametroActivoLin]?.linealidad) {
                    window.parametroActivoLin = param;
                }
                foundFirst = true;
            }

            if (param === window.parametroActivoLin) opt.selected = true;
            select.appendChild(opt);
        }
    });

    // Ningún parámetro con linealidad: no dejar tablas ni gráficas vacías
    if (!foundFirst) {
        window.parametroActivoLin = '';
        const cont = document.getElementById('contenidoLinealidad');
        if (cont) cont.classList.add('hidden');
    }
};

window.renderizarDatosLinealidad = function (parametro) {
    // Validar que exista la linealidad en el objeto global para este parámetro
    if (!parametro || !window.datosGlobales[parametro] || !(window.tieneLinealidad ? window.tieneLinealidad(parametro) : window.datosGlobales[parametro].linealidad)) {
        // Sin linealidad: no dejar visibles los datos del parámetro anterior
        const cont = document.getElementById('contenidoLinealidad');
        if (cont) cont.classList.add('hidden');
        return;
    }

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
    const stats = data.stats || {};
    const tabla = Array.isArray(data.tabla) ? data.tabla : [];
    const curvasRaw = Array.isArray(data.curvas_raw) ? data.curvas_raw : [];

    // Solo se listan los estadísticos que existen
    const filasStats = [
        ['Promedio de Pendientes', stats.promedio_pendientes, 'font-semibold', 'font-mono text-right'],
        ['Desviación de Pendientes', stats.desviacion_pendientes, 'font-semibold', 'font-mono text-right'],
        ['Sensibilidad (m ± SD)', stats.sensibilidad, 'font-bold text-blue-700', 'font-mono text-right text-blue-700 font-bold bg-blue-50'],
        ['Intercepto (Promedio)', stats.intercepto, 'font-semibold', 'font-mono text-right'],
        ['Coef. de Correlación (r)', stats.r, 'font-semibold', 'font-mono text-right'],
        ['Coef. de Determinación (R²)', stats.r2, 'font-semibold', 'font-mono text-right font-bold text-emerald-700'],
        ['Ecuación', stats.ecuacion, 'font-semibold', 'font-mono text-right italic']
    ].filter(f => f[1] !== undefined && f[1] !== null && f[1] !== '');
    document.getElementById('tablaStatsLinealidad').innerHTML = filasStats.map((f, i) =>
        `<tr class="${i % 2 === 1 ? 'bg-slate-50' : ''}"><td class="py-2 ${f[2]}">${f[0]}</td><td class="py-2 ${f[3]}">${f[1]}</td></tr>`
    ).join('');

    // Averiguar máximo de curvas para dinámicamente crear cabeceras
    let maxCurvas = 0;
    tabla.forEach(row => {
        if ((row.señales || []).length > maxCurvas) maxCurvas = row.señales.length;
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
    tabla.forEach((row, index) => {
        let fila = `<tr class="${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-blue-50">
            <td class="border border-slate-300 p-2 font-bold text-slate-800">${row.concentracion}</td>`;

        for (let i = 0; i < maxCurvas; i++) {
            const val = (row.señales && row.señales[i] !== undefined) ? row.señales[i] : '-';
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

    // Columnas calculadas que el backend no envió desaparecen de la tabla
    const hayConcCalc = tabla.some(r => r.conc_calculada !== undefined && r.conc_calculada !== null);
    const hayError = tabla.some(r => r.error_pct !== undefined && r.error_pct !== null);
    const ocultasLin = [];
    if (!hayConcCalc) ocultasLin.push(maxCurvas + 2);
    if (!hayError) ocultasLin.push(maxCurvas + 3);
    window.ocultarColumnasTabla(document.getElementById('bodyTablaLinealidad').closest('table'), ocultasLin);

    // Destruir gráficos previos
    if (window.chartCurvasIndInstance) window.chartCurvasIndInstance.destroy();
    if (window.chartCurvaPromedioInstance) window.chartCurvaPromedioInstance.destroy();

    // 1. Gráfico de Curvas Individuales (si no hay curvas, la gráfica desaparece)
    const canvasInd = document.getElementById('chartCurvasInd');
    window.mostrarSiElemento(window.tarjetaDe(canvasInd), curvasRaw.length > 0);
    const ctxInd = canvasInd.getContext('2d');
    const datasetsInd = curvasRaw.map((curva, i) => {
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
    const canvasAvg = document.getElementById('chartCurvaPromedio');
    window.mostrarSiElemento(window.tarjetaDe(canvasAvg), tabla.length > 0);
    const ctxAvg = canvasAvg.getContext('2d');
    const puntosPromedio = tabla.map(row => ({ x: row.concentracion, y: row.promedio }));

    // Crear línea de tendencia teórica visual
    const xVals = tabla.map(r => r.concentracion);
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