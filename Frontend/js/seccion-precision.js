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
    if (!window.elementoActivo || !window.datosGlobales[window.elementoActivo] || !window.datosGlobales[window.elementoActivo].precision) return;
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
};