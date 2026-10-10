/**
 * SECCIÓN 2 - LÍMITES DE DETECCIÓN Y CUANTIFICACIÓN
 * -----------------------------------------------------------------------
 * renderizarLimites: punto de entrada. Actualiza las tarjetas globales y
 *   decide qué vista mostrar (normal o titulados).
 * renderizarLimitesFisicoquimico: tabla y gráficos de blancos de método (MB) y LCM.
 * renderizarLimitesTitulados: tablas de resumen y datos brutos de volumetría.
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
    const hayLCM = window.tieneDatosControl ? window.tieneDatosControl(window.elementoActivo, 'lcm') : !!data.lcm;
    // Sin LCM: desaparecen las tarjetas que dependen de él
    ['stat-teorico', 'stat-error'].forEach(id => {
        const el = document.getElementById(id);
        if (el && el.parentElement) el.parentElement.style.display = hayLCM ? '' : 'none';
    });
    document.getElementById('stat-error').innerText = (hayLCM && data.lcm?.global?.error_pct !== undefined) ? data.lcm.global.error_pct + '%' : '--';

    // Fisicoquímico: un único blanco (Analista 1). El backend lo indica con mb.solo_analista_1.
    const soloMBA1 = data.mb.solo_analista_1 === true;
    const esTitulado = data.es_titulado === true;

    const vistaNormal = document.getElementById('vista-limites-normal');
    const vistaTitulada = document.getElementById('vista-limites-titulado');

    if (esTitulado) {
        if (vistaNormal) vistaNormal.classList.add('hidden');
        if (vistaTitulada) vistaTitulada.classList.remove('hidden');

        window.renderizarLimitesTitulados(data, soloMBA1);

    } else {
        if (vistaNormal) vistaNormal.classList.remove('hidden');
        if (vistaTitulada) vistaTitulada.classList.add('hidden');

        window.renderizarLimitesFisicoquimico(data, soloMBA1);
    }
};

// ----------------------------------------------------------------------
// VISTA NORMAL (Instrumental / Concentración)
// ----------------------------------------------------------------------
window.renderizarLimitesFisicoquimico = function (data, soloMBA1) {
    const filaStats = (ctrl, grupo, st, destacada) => !st ? '' : `
        <tr class="${destacada ? 'bg-blue-50/40 font-bold' : 'hover:bg-slate-50'}"><td class="border border-slate-300 p-2 ${destacada ? '' : 'font-semibold bg-slate-50'}">${ctrl}</td><td class="border border-slate-300 p-2">${grupo}</td><td class="border border-slate-300 p-2 font-mono">${st.promedio}</td><td class="border border-slate-300 p-2 font-mono">${st.desviacion}</td><td class="border border-slate-300 p-2 font-mono">${st.cv}%</td></tr>`;

    // Puede que el método no tenga LCM: en ese caso solo se muestran los blancos
    const lcmD = data.lcm || {};
    const hayLCM = window.tieneDatosControl ? window.tieneDatosControl(window.elementoActivo, 'lcm') : !!data.lcm;

    const tbody = document.getElementById('tablaResultados');
    tbody.innerHTML =
        filaStats('MB', 'Analista 1', data.mb.analista_1, false) +
        (soloMBA1 ? '' : filaStats('MB', 'Analista 2', data.mb.analista_2, false) + filaStats('MB', 'Global', data.mb.global, true)) +
        (hayLCM ? filaStats('LCM', 'Analista 1', lcmD.analista_1, false) +
            filaStats('LCM', 'Analista 2', lcmD.analista_2, false) +
            filaStats('LCM', 'Global', lcmD.global, true) : '');

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
        const valsLCMA1 = lcmD.analista_1?.valores || [];  // (vacío si no hay LCM)
        const valsLCMA2 = lcmD.analista_2?.valores || [];

        const nFilas = Math.max(valsMBA1.length, valsMBA2.length, valsLCMA1.length, valsLCMA2.length);
        for (let i = 0; i < nFilas; i++) {
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

        // Columnas de LCM (por analista) sin valores desaparecen de la tabla de datos brutos
        const baseLCM = 1 + (soloMBA1 ? 1 : 2);
        const ocultasL = [];
        if (!hayLCM || valsLCMA1.length === 0) ocultasL.push(baseLCM);
        if (!hayLCM || valsLCMA2.length === 0) ocultasL.push(baseLCM + 1);
        window.ocultarColumnasTabla(tbBrutos.closest('table'), ocultasL);
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

    // Sin LCM: ocultar la tarjeta de la gráfica de LCM
    const canvasLCM = document.getElementById('chartLCM');
    const tarjetaLCM = canvasLCM ? canvasLCM.parentElement : null;
    if (tarjetaLCM) tarjetaLCM.style.display = hayLCM ? '' : 'none';
    if (!hayLCM) { window.chartLCMInstance = null; return; }

    const ctxLCM = canvasLCM.getContext('2d');
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

// ----------------------------------------------------------------------
// VISTA TITULADOS (Volumetría)
// ----------------------------------------------------------------------
window.renderizarLimitesTitulados = function (data, soloMBA1) {
    const filaStats = (ctrl, grupo, st, destacada) => !st ? '' : `
        <tr class="${destacada ? 'bg-blue-50/40 font-bold' : 'hover:bg-slate-50'}">
            <td class="border border-slate-300 p-2 ${destacada ? '' : 'font-semibold bg-slate-50'}">${ctrl}</td>
            <td class="border border-slate-300 p-2">${grupo}</td>
            <td class="border border-slate-300 p-2 font-mono">${st.promedio}</td>
            <td class="border border-slate-300 p-2 font-mono">${st.desviacion}</td>
            <td class="border border-slate-300 p-2 font-mono">${st.cv}%</td>
        </tr>`;

    // Resumen estadístico (calculado a partir de la concentración)
    const tbResumen = document.getElementById('tablaResultadosTitulados');
    if (tbResumen) {
        tbResumen.innerHTML =
            filaStats('MB', 'Analista 1', data.mb.analista_1, false) +
            (soloMBA1 ? '' : filaStats('MB', 'Analista 2', data.mb.analista_2, false) + filaStats('MB', 'Global', data.mb.global, true)) +
            filaStats('LCM', 'Analista 1', data.lcm?.analista_1, false) +
            filaStats('LCM', 'Analista 2', data.lcm?.analista_2, false) +
            filaStats('LCM', 'Global', data.lcm?.global, true);
    }

    // Datos brutos de titulación
    const tbBrutos = document.getElementById('tablaDatosTitulados');
    if (!tbBrutos) return;

    const fmt = (v, dec = 4) => (v === undefined || v === null || isNaN(v)) ? '-' : Number(v).toFixed(dec);

    const filasDe = (ctrl, raw) => {
        const contador = {};   // la réplica reinicia por analista
        return (raw || [])
            .filter(d => !(soloMBA1 && ctrl === 'MB' && d.analista !== 'Analista 1'))
            .map(d => {
                contador[d.analista] = (contador[d.analista] || 0) + 1;
                const atipico = d.es_atipico ? 'bg-amber-50 text-amber-700' : '';
                return `
                <tr class="hover:bg-slate-50 ${atipico}" ${d.es_atipico ? 'title="Valor atípico (Grubbs)"' : ''}>
                    <td class="border border-slate-300 p-1.5 font-bold bg-slate-50">${ctrl}</td>
                    <td class="border border-slate-300 p-1.5">${d.analista}</td>
                    <td class="border border-slate-300 p-1.5">${contador[d.analista]}</td>
                    <td class="border border-slate-300 p-1.5 font-mono">${fmt(d.v_muestra, 2)}</td>
                    <td class="border border-slate-300 p-1.5 font-mono">${fmt(d.v_blanco, 2)}</td>
                    <td class="border border-slate-300 p-1.5 font-mono">${fmt(d.v_titulante, 2)}</td>
                    <td class="border border-slate-300 p-1.5 font-mono">${fmt(d.n_titulante, 4)}</td>
                    <td class="border border-slate-300 p-1.5 font-mono font-medium text-indigo-700 bg-indigo-50/50">${fmt(d.valor, 4)}</td>
                </tr>`;
            }).join('');
    };

    tbBrutos.innerHTML = filasDe('MB', data.mb.raw) + filasDe('LCM', data.lcm?.raw);
};