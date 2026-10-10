/**
 * Lógica para la sección Rango de Trabajo (RT)
 * -----------------------------------------------------------------------
 * El cálculo (concentración con factor de dilución, % error, % recuperación,
 * estadísticos por analista y Test de Grubbs) vive en window.calcularDatosRT()
 * y el pintado de las tarjetas en window.pintarStatsRT(prefijo, resultado).
 * Ambas son reutilizadas por el informe (informe-datos.js ->
 * renderizarRangoTrabajoInforme), de modo que la vista y el informe siempre
 * muestran los mismos números, incluyendo los factores de dilución editados.
 * -----------------------------------------------------------------------
 */

window.factoresDilucionRT = window.factoresDilucionRT || {};

/* ========================================================================== */
/* CÁLCULO COMPARTIDO (vista RT + informe)                                    */
/* ========================================================================== */

window.tieneRT = function (elem) {
    const d = (window.datosGlobales || {})[elem];
    return !!(d && d.rt && Array.isArray(d.rt.raw) && d.rt.raw.length > 0);
};

window.calcularStatsRT = function (arr, teorico) {
    if (!arr || arr.length === 0) return { prom: 0, std: 0, errProm: 0, recProm: 0, count: 0 };
    const vals = arr.map(d => d.concFinal);
    const prom = vals.reduce((a, b) => a + b, 0) / vals.length;
    const std = vals.length > 1
        ? Math.sqrt(vals.reduce((a, b) => a + Math.pow(b - prom, 2), 0) / (vals.length - 1))
        : 0;
    const errProm = Math.abs(prom - teorico);
    const recProm = teorico > 0 ? (prom / teorico) * 100 : 0;
    return { prom, std, errProm, recProm, count: arr.length };
};

/**
 * Devuelve el RT ya procesado para un elemento, o null si no hay lecturas.
 * Usa los factores de dilución guardados en window.factoresDilucionRT[elem]
 * (1.0 por defecto si el usuario nunca los modificó).
 */
window.calcularDatosRT = function (elem) {
    const dataElem = (window.datosGlobales || {})[elem];
    if (!dataElem || !dataElem.rt || !Array.isArray(dataElem.rt.raw) || dataElem.rt.raw.length === 0) {
        return null;
    }

    const teorico = parseFloat(dataElem.rt.teorico_RT) || 0.0;
    const factores = (window.factoresDilucionRT && window.factoresDilucionRT[elem]) || [];

    const datos = dataElem.rt.raw.map((item, idx) => {
        const factor = parseFloat(factores[idx]) || 1.0;
        const valorExtraido = parseFloat(item.valor) || 0.0;
        const concFinal = valorExtraido * factor;
        const errorPct = teorico > 0 ? (Math.abs(concFinal - teorico) / teorico) * 100 : 0.0;
        const recPct = teorico > 0 ? (concFinal / teorico) * 100 : 0.0;
        return { ...item, idx, factor, valorExtraido, concFinal, errorPct, recPct, esOutlier: false, gCalc: 0 };
    });

    const datosA1 = datos.filter(d => d.analista === 'Analista 1');
    const datosA2 = datos.filter(d => d.analista === 'Analista 2');

    const grubbsA1 = calcularGrubbsJS(datosA1.map(d => d.concFinal));
    const grubbsA2 = calcularGrubbsJS(datosA2.map(d => d.concFinal));

    // Marcar atípicos directamente en cada fila (datosA1/A2 comparten referencia con datos)
    datosA1.forEach((d, i) => { d.esOutlier = grubbsA1.indicesOutliers.includes(i); d.gCalc = grubbsA1.gCalc; });
    datosA2.forEach((d, i) => { d.esOutlier = grubbsA2.indicesOutliers.includes(i); d.gCalc = grubbsA2.gCalc; });

    return {
        teorico,
        datos,
        datosA1,
        datosA2,
        grubbsA1,
        grubbsA2,
        stA1: window.calcularStatsRT(datosA1, teorico),
        stA2: window.calcularStatsRT(datosA2, teorico),
        stGlobal: window.calcularStatsRT(datos, teorico)
    };
};

/**
 * Pinta las tarjetas de estadísticos. `prefijo` es 'rt' para la vista de
 * Rango de Trabajo y 'inf-rt' para el informe (ids: `${prefijo}-a1-prom`, etc.).
 * Si `r` es null limpia las tarjetas.
 */
window.pintarStatsRT = function (prefijo, r) {
    const set = (id, v) => {
        const el = document.getElementById(`${prefijo}-${id}`);
        if (el) el.textContent = v;
    };

    if (!r) {
        ['a1', 'a2', 'global'].forEach(k => set(`${k}-count`, '0 lecturas'));
        ['a1-prom', 'a1-std', 'a1-err-prom', 'a1-rec-prom', 'a1-grubbs',
         'a2-prom', 'a2-std', 'a2-err-prom', 'a2-rec-prom', 'a2-grubbs',
         'global-prom', 'global-std', 'valor-teorico-card', 'global-err', 'global-rec'
        ].forEach(id => set(id, '--'));
        return;
    }

    const { teorico, stA1, stA2, stGlobal, grubbsA1, grubbsA2 } = r;

    [['a1', stA1, grubbsA1], ['a2', stA2, grubbsA2]].forEach(([k, st, gr]) => {
        const errPct = teorico > 0 ? (st.errProm / teorico) * 100 : 0;
        set(`${k}-count`, `${st.count} lecturas`);
        set(`${k}-prom`, st.prom.toFixed(4));
        set(`${k}-std`, st.std.toFixed(4));
        set(`${k}-err-prom`, `${errPct.toFixed(2)}%`);
        set(`${k}-rec-prom`, `${st.recProm.toFixed(2)}%`);
        set(`${k}-grubbs`, gr.indicesOutliers.length > 0 ? `${gr.indicesOutliers.length} atípicos` : 'Sin atípicos');
    });

    set('global-count', `${stGlobal.count} lecturas`);
    set('global-prom', stGlobal.prom.toFixed(4));
    set('global-std', stGlobal.std.toFixed(4));
    set('valor-teorico-card', teorico.toFixed(4));
    set('global-err', `${(teorico > 0 ? (Math.abs(stGlobal.prom - teorico) / teorico) * 100 : 0).toFixed(2)}%`);
    set('global-rec', `${stGlobal.recProm.toFixed(2)}%`);
};

/* ========================================================================== */
/* VISTA: RANGO DE TRABAJO                                                    */
/* ========================================================================== */

window.renderizarRangoTrabajo = function (elementoSeleccionado) {
    const datosGlobales = window.datosGlobales || {};
    const selectElem = document.getElementById('selectElementoRT');
    const contenedorRT = document.getElementById('contenidoRT');
    if (!contenedorRT) return;

    // El aviso va FUERA de contenidoRT: antes se reemplazaba su innerHTML y la tabla se perdía para siempre
    let aviso = document.getElementById('rt-sin-datos');
    const mostrarAviso = (texto) => {
        if (!aviso) {
            aviso = document.createElement('div');
            aviso.id = 'rt-sin-datos';
            aviso.className = 'p-8 text-center text-slate-500 font-semibold';
            contenedorRT.parentNode.insertBefore(aviso, contenedorRT);
        }
        aviso.textContent = texto;
        aviso.style.display = '';
        contenedorRT.classList.add('hidden');
    };

    const conRT = Object.keys(datosGlobales).filter(e => window.tieneRT(e));
    if (conRT.length === 0) {
        mostrarAviso('No hay lecturas registradas para el control de Rango de Trabajo.');
        return;
    }

    // El selector solo ofrece elementos que tienen RT
    if (selectElem && Array.from(selectElem.options).map(o => o.value).join('|') !== conRT.join('|')) {
        selectElem.innerHTML = '';
        conRT.forEach(elem => {
            const opt = document.createElement('option');
            opt.value = elem;
            opt.textContent = elem;
            selectElem.appendChild(opt);
        });
    }

    const elem = elementoSeleccionado || (selectElem ? selectElem.value : conRT[0]);
    if (selectElem && conRT.includes(elem)) selectElem.value = elem;

    if (!window.tieneRT(elem)) {
        mostrarAviso(`No hay lecturas registradas para el control RT en ${elem}.`);
        return;
    }

    if (aviso) aviso.style.display = 'none';
    contenedorRT.classList.remove('hidden');

    // Inicializar o recuperar factores de dilución guardados
    if (!window.factoresDilucionRT[elem]) {
        window.factoresDilucionRT[elem] = datosGlobales[elem].rt.raw.map(item => parseFloat(item.factor) || 1.0);
    }

    window.actualizarTablaYEstadisticasRT(elem, elem);
};

window.actualizarTablaYEstadisticasRT = function (parametroNombre, elemKey) {
    const tbody = document.getElementById('bodyTablaRT');
    if (!tbody) return;

    const r = window.calcularDatosRT(elemKey);
    if (!r) return;

    const { teorico } = r;
    tbody.innerHTML = '';

    r.datos.forEach((d) => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 border-b border-slate-200";

        tr.innerHTML = `
            <td class="p-2 font-mono text-xs">${d.idx + 1}</td>
            <td class="p-2">${d.fecha || 'Sin fecha'}</td>
            <td class="p-2"><span class="px-2 py-1 rounded text-xs font-semibold ${d.analista === 'Analista 1' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}">${d.analista}</span></td>
            <td class="p-2 font-bold text-slate-700">${parametroNombre}</td>
            <td class="p-2 font-semibold text-blue-700">${teorico.toFixed(4)}</td>
            <td class="p-2 font-mono">${d.valorExtraido.toFixed(4)}</td>
            <td class="p-2 bg-blue-50">
                <input type="number" step="any" min="0" value="${d.factor}" 
                       onchange="window.cambiarFactorRT('${elemKey}', ${d.idx}, this.value, '${parametroNombre}', ${teorico})"
                       class="w-20 text-center font-bold border border-blue-300 rounded px-1 py-0.5 focus:ring-2 focus:ring-blue-500 outline-none bg-white">
            </td>
            <td class="p-2 font-bold bg-emerald-50 text-emerald-900 font-mono">${d.concFinal.toFixed(4)}</td>
            <td class="p-2 font-mono">${d.errorPct.toFixed(2)}%</td>
            <td class="p-2 font-mono">${d.recPct.toFixed(2)}%</td>
            <td class="p-2">
                ${d.esOutlier
                    ? `<span class="bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded text-xs">Atípico (G_calc=${d.gCalc.toFixed(2)})</span>`
                    : `<span class="bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded text-xs">Normal</span>`}
            </td>
        `;
        tbody.appendChild(tr);
    });

    window.pintarStatsRT('rt', r);
};

window.cambiarFactorRT = function (elemKey, idx, nuevoFactor, parametroNombre /*, teorico (ya no se usa) */) {
    const val = parseFloat(nuevoFactor);
    if (!isNaN(val) && val >= 0) {
        if (idx === 0) {
            // Al modificar el factor de la primera fila, se replica en todas las
            // lecturas de este parámetro. Luego cada fila puede ajustarse por separado.
            window.factoresDilucionRT[elemKey] = window.factoresDilucionRT[elemKey].map(() => val);
        } else {
            window.factoresDilucionRT[elemKey][idx] = val;
        }
        window.actualizarTablaYEstadisticasRT(parametroNombre, elemKey);
    }
};

/* ========================================================================== */
/* TEST DE GRUBBS                                                             */
/* ========================================================================== */

function calcularGrubbsJS(valores, alpha = 0.05) {
    const n = valores.length;
    if (n < 3) return { gCalc: 0, gCrit: 0, indicesOutliers: [] };

    const prom = valores.reduce((a, b) => a + b, 0) / n;
    const std = Math.sqrt(valores.reduce((a, b) => a + Math.pow(b - prom, 2), 0) / (n - 1));
    if (std === 0) return { gCalc: 0, gCrit: 0, indicesOutliers: [] };

    let maxDev = 0;
    let outlierIdx = -1;
    valores.forEach((v, i) => {
        const dev = Math.abs(v - prom);
        if (dev > maxDev) {
            maxDev = dev;
            outlierIdx = i;
        }
    });

    const gCalc = maxDev / std;

    // Tabla aproximada de valores críticos de Grubbs (alpha = 0.05)
    const tablaGrubbs = { 3: 1.153, 4: 1.463, 5: 1.672, 6: 1.822, 7: 1.938, 8: 2.032, 9: 2.110, 10: 2.176, 11: 2.234, 12: 2.285, 15: 2.409, 20: 2.557 };
    const gCrit = tablaGrubbs[n] || 2.2;

    const indicesOutliers = gCalc > gCrit ? [outlierIdx] : [];
    return { gCalc, gCrit, indicesOutliers };
}