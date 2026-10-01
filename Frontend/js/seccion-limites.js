/**
 * SECCIÓN 2 - LÍMITES DE DETECCIÓN Y CUANTIFICACIÓN
 * -----------------------------------------------------------------------
 * renderizarLimites: tabla y gráficos de blancos de método (MB) y LCM.
 * Depende de core-estado.js y core-navegacion.js.
 * -----------------------------------------------------------------------
 */

window.renderizarLimites = function () {
    if (!window.elementoActivo || !window.datosGlobales[window.elementoActivo]) return;
    const data = window.datosGlobales[window.elementoActivo];
    document.getElementById('contenidoElemento').classList.remove('hidden');

    document.getElementById('stat-lod').innerText = data.lod_posible;
    document.getElementById('stat-loq').innerText = data.loq_posible;
    document.getElementById('stat-teorico').innerText = data.teorico_lcm;
    document.getElementById('stat-error').innerText = data.lcm.global.error_pct + '%';

    // Fisicoquímico: un único blanco (Analista 1). El backend lo indica con mb.solo_analista_1.
    const soloMBA1 = data.mb.solo_analista_1 === true;

    const filaStats = (ctrl, grupo, st, destacada) => `
        <tr class="${destacada ? 'bg-blue-50/40 font-bold' : 'hover:bg-slate-50'}"><td class="border border-slate-300 p-2 ${destacada ? '' : 'font-semibold bg-slate-50'}">${ctrl}</td><td class="border border-slate-300 p-2">${grupo}</td><td class="border border-slate-300 p-2 font-mono">${st.promedio}</td><td class="border border-slate-300 p-2 font-mono">${st.desviacion}</td><td class="border border-slate-300 p-2 font-mono">${st.cv}%</td></tr>`;

    const tbody = document.getElementById('tablaResultados');
    tbody.innerHTML =
        filaStats('MB', 'Analista 1', data.mb.analista_1, false) +
        (soloMBA1 ? '' : filaStats('MB', 'Analista 2', data.mb.analista_2, false) + filaStats('MB', 'Global', data.mb.global, true)) +
        filaStats('LCM', 'Analista 1', data.lcm.analista_1, false) +
        filaStats('LCM', 'Analista 2', data.lcm.analista_2, false) +
        filaStats('LCM', 'Global', data.lcm.global, true);

    // Cabecera de la tabla de datos brutos: ocultar la columna MB del Analista 2
    const thMB = document.getElementById('th-mb');
    const thMBa2 = document.getElementById('th-mb-a2');
    if (thMB) thMB.colSpan = soloMBA1 ? 1 : 2;
    if (thMBa2) thMBa2.style.display = soloMBA1 ? 'none' : '';

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
                    ${soloMBA1 ? '' : `<td class="border border-slate-300 p-1.5 font-mono text-slate-600">${vMB2}</td>`}
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
                ...(soloMBA1 ? [] : [{ label: 'Analista 2', data: data.mb.raw.filter(d => d.analista === 'Analista 2').map((d, i) => ({ x: i + 1, y: d.valor })), backgroundColor: '#059669' }])
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