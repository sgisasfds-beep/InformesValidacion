/**
 * SECCIÓN 3 - PRECISIÓN
 * -----------------------------------------------------------------------
 * renderizarPrecision: pruebas de normalidad, ANOVA / Kruskal-Wallis y
 * gráfico de interacción analista vs réplica.
 * Depende de core-estado.js y core-navegacion.js.
 * -----------------------------------------------------------------------
 */

// Paleta de identidad por analista, compartida visualmente con la sección de Exactitud
window.PALETA_ANALISTAS = window.PALETA_ANALISTAS || {
    analista1: { linea: '#3b5bfd', arribaClara: 'rgba(59, 91, 253, 0.55)', abajoTransp: 'rgba(59, 91, 253, 0.02)' },
    analista2: { linea: '#ff8a3d', arribaClara: 'rgba(255, 138, 61, 0.55)', abajoTransp: 'rgba(255, 138, 61, 0.02)' }
};

// Genera un degradado vertical: más saturado/oscuro arriba, transparente abajo
window.crearGradienteVertical = window.crearGradienteVertical || function (chart, colorArriba, colorAbajo) {
    const { ctx, chartArea } = chart;
    if (!chartArea) return colorAbajo;
    const gradiente = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
    gradiente.addColorStop(0, colorArriba);
    gradiente.addColorStop(1, colorAbajo);
    return gradiente;
};

window.renderizarPrecision = function (control) {
    if (!window.elementoActivo || !window.datosGlobales[window.elementoActivo]) return;
    if (!window.datosGlobales[window.elementoActivo].precision) {
        // Sin precisión para este elemento: no dejar pestañas ni tablas del elemento anterior
        (window.CONTROLES_CALIDAD || []).forEach(c => {
            const b = document.getElementById(`tab-prec-${c}`);
            if (b) b.style.display = 'none';
        });
        const cp = document.getElementById('contenidoPrecision');
        if (cp) cp.classList.add('hidden');
        return;
    }
    // Ocultar pestañas LCM/CCV/EA sin datos y redirigir al primer control disponible
    const controlValido = window.aplicarVisibilidadTabsControl
        ? window.aplicarVisibilidadTabsControl('prec', window.elementoActivo, control)
        : String(control || '').toLowerCase();
    if (!controlValido) {
        const contPrec = document.getElementById('contenidoPrecision');
        if (contPrec) contPrec.classList.add('hidden');
        return;
    }
    control = controlValido;
    window.controlActivoPrec = control;
    window.actualizarTabs('prec', control);

    const dataPrec = window.datosGlobales[window.elementoActivo].precision[control];
    if (!dataPrec) {
        const contPrec = document.getElementById('contenidoPrecision');
        if (contPrec) contPrec.classList.add('hidden');
        return;
    }

    document.getElementById('contenidoPrecision').classList.remove('hidden');
    const fmtYesNo = (normal) => normal ? `<span class="font-bold text-emerald-700">yes</span>` : `<span class="font-bold text-red-600">no</span>`;

    // Analistas con lecturas: el que no tenga datos pierde su columna (y sus pruebas)
    const rawPrec = (window.datosGlobales[window.elementoActivo][control] || {}).raw || [];
    const apPrec = window.analistasConDatos(rawPrec);
    const norm = dataPrec.normalidad || {};
    const celdaT = (t, k) => `<td class="border border-slate-300 p-2 font-mono">${(t[k] === undefined || t[k] === null) ? '--' : t[k]}</td>`;
    const celdaN = (t) => `<td class="border border-slate-300 p-2">${t.normal === undefined || t.normal === null ? '--' : fmtYesNo(t.normal)}</td>`;
    const bloqueTest = (titulo, test, claveStat, etqStat, claseTitulo) => {
        if (!test) return '';
        const t1 = test.analista_1 || {}, t2 = test.analista_2 || {};
        return `
        <tr class="bg-white"><td colspan="3" class="${claseTitulo}">${titulo}</td></tr>
        <tr class="hover:bg-slate-50 border-t border-slate-300"><td class="border border-slate-300 p-2 text-left">${etqStat}</td>${celdaT(t1, claveStat)}${celdaT(t2, claveStat)}</tr>
        <tr class="hover:bg-slate-50"><td class="border border-slate-300 p-2 text-left">p-value</td>${celdaT(t1, 'p')}${celdaT(t2, 'p')}</tr>
        <tr class="hover:bg-slate-50"><td class="border border-slate-300 p-2 text-left">alpha</td><td class="border border-slate-300 p-2 font-mono">0.05</td><td class="border border-slate-300 p-2 font-mono">0.05</td></tr>
        <tr class="hover:bg-slate-50"><td class="border border-slate-300 p-2 text-left">normal</td>${celdaN(t1)}${celdaN(t2)}</tr>`;
    };
    const tbNorm = document.getElementById('tablaNormalidad');
    tbNorm.innerHTML =
        bloqueTest('Shapiro-Wilk Test', norm.shapiro, 'stat', 'W-stat', 'p-2 text-left text-slate-800') +
        bloqueTest("d'Agostino-Pearson", norm.dagostino, 'stat', 'DA-stat', 'p-2 pt-6 text-left text-slate-800 border-t-2 border-slate-300');
    const ocNorm = [];
    if (!apPrec.a1) ocNorm.push(1);
    if (!apPrec.a2) ocNorm.push(2);
    window.ocultarColumnasTabla(tbNorm.closest('table'), ocNorm);

    const cardKw = document.getElementById('cardNoParametrica');
    const algunoNoNormal = (test) => ['analista_1', 'analista_2'].some(a => test && test[a] && test[a].normal === false);
    const noNormalShapiro = algunoNoNormal(norm.shapiro);
    const noNormalDagostino = algunoNoNormal(norm.dagostino);

    if ((noNormalShapiro || noNormalDagostino) && dataPrec.no_parametrica) {
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
    if (dataPrec.anova && Object.keys(dataPrec.anova).length > 0 && dataPrec.anova.analista && dataPrec.anova.replica) {
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

    const paleta = window.PALETA_ANALISTAS;
    const crearGradiente = window.crearGradienteVertical;

    window.chartPrecisionInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Array.from({ length: maxLen }, (_, i) => `Ensayo ${i + 1}`),
            datasets: [
                {
                    label: 'Analista 1',
                    data: valsA1,
                    borderColor: paleta.analista1.linea,
                    backgroundColor: (context) => crearGradiente(context.chart, paleta.analista1.arribaClara, paleta.analista1.abajoTransp),
                    borderWidth: 2.5,
                    tension: 0.42,
                    fill: 'origin',
                    pointRadius: 3,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: paleta.analista1.linea,
                    pointBorderWidth: 2,
                    order: 2
                },
                {
                    label: 'Analista 2',
                    data: valsA2,
                    borderColor: paleta.analista2.linea,
                    backgroundColor: (context) => crearGradiente(context.chart, paleta.analista2.arribaClara, paleta.analista2.abajoTransp),
                    borderWidth: 2.5,
                    tension: 0.42,
                    fill: 'origin',
                    pointRadius: 3,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: paleta.analista2.linea,
                    pointBorderWidth: 2,
                    order: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8', font: { size: 11 } }
                },
                y: {
                    grid: { color: '#eef2f7' },
                    ticks: { color: '#94a3b8', font: { size: 11 } }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                    align: 'end',
                    labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 8, padding: 16, color: '#475569', font: { size: 12, weight: '600' } }
                },
                tooltip: {
                    backgroundColor: '#1e293b',
                    padding: 10,
                    cornerRadius: 8,
                    titleFont: { size: 12 },
                    bodyFont: { size: 12 }
                }
            }
        }
    });
    // Analista sin lecturas: no se dibuja su serie ni aparece en la leyenda
    window.quitarDatasetsVacios(window.chartPrecisionInstance);
};