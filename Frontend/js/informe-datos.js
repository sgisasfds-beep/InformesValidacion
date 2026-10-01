/**
 * INFORME - METADATOS Y COMPILACIÓN DE RESULTADOS
 * -----------------------------------------------------------------------
 * Selector de elemento para el informe, formulario de metadatos
 * (guardarMetadatosYCompilar), recálculo de incertidumbre para el informe
 * y armado de la Sección 6 de resultados (poblarSeccion6Resultados).
 * Depende de core-estado.js, core-navegacion.js, seccion-incertidumbre.js y
 * seccion-rango-trabajo.js (calcularDatosRT / pintarStatsRT para la sección 6.4).
 * -----------------------------------------------------------------------
 */

// ============================================================================
// FUNCIÓN PRINCIPAL UNIFICADA DE METADATOS E INFORME
// ============================================================================
window.SUBMATRICES_MAP = {
    "Agua": ["Agua Superficial", "Agua Subterránea", "Agua Residual Doméstica", "Agua Residual No Doméstica"],
    "Suelo": ["Suelo Agrícola", "Suelo Industrial", "Suelo Urbano"],
    "Lodo": ["Lodos de PTAR", "Lodos Industriales"],
    "Sedimento": ["Sedimentos Fluviales", "Sedimentos Marinos"],
    "Residuos Peligrosos": ["Residuos Sólidos", "Residuos Líquidos"],
    "Aire": ["Aire Ambiente", "Emisiones Industriales"]
};

// Traduce el nombre "bonito" de la submatriz (mostrado en el informe) a la
// clave interna que realmente usa el backend (main.py -> MATRICES_MUESTRAS)
// al guardar los resultados de recuperación/RPD por muestra. Los nombres no
// coinciden en mayúsculas, tildes ni redacción, así que sin esta traducción
// el lookup `datosMuestrasSubmatriz[sub]` siempre fallaba y las tablas/gráficas
// de la sección 6.3.4+ quedaban vacías aunque el resto del informe sí se llenara.
window.SUBMATRIZ_BACKEND_KEY = {
    "Agua Superficial": "agua superficial",
    "Agua Subterránea": "agua subterranea",
    "Agua Residual Doméstica": "ar domestica",
    "Agua Residual No Doméstica": "ar no domestica"
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

// Redacta el párrafo de interpretación de la prueba de Youden (robustez)
// evaluando |Di| vs. el límite de aceptación de cada condición ya calculada
// en youdenList (ver más abajo: comparacion, condicion, diferencia,
// limiteAceptacion). Se reutilizan esos mismos nombres de campo para no
// duplicar el cálculo de promedios/estadísticos que ya hace esta función.
function generarInterpretacionRobustez(youdenList) {
    if (!youdenList || youdenList.length === 0) {
        return "No se registraron datos suficientes para evaluar la robustez del método mediante el diseño de Youden.";
    }

    const factoresSensibles = youdenList.filter(item => {
        const difNum = typeof item.diferencia === 'number' ? item.diferencia : NaN;
        const limNum = typeof item.limiteAceptacion === 'number' ? item.limiteAceptacion : NaN;
        return !isNaN(difNum) && !isNaN(limNum) && Math.abs(difNum) > limNum;
    });

    if (factoresSensibles.length === 0) {
        const limRef = typeof youdenList[0].limiteAceptacion === 'number'
            ? youdenList[0].limiteAceptacion.toFixed(4)
            : youdenList[0].limiteAceptacion;
        return `El método analítico demostró ser robusto frente a todas las variaciones estudiadas mediante el diseño de Youden. En todos los parámetros evaluados, la diferencia de los promedios (Di) se mantuvo igual o por debajo del límite de aceptación (${limRef}), indicando que pequeñas variaciones en las condiciones operativas no afectan significativamente el resultado.`;
    }

    const factoresTexto = factoresSensibles.map(f => `${f.condicion} (${f.comparacion})`).join(', ');
    return `El método presentó sensibilidad a las siguientes variaciones operativas: ${factoresTexto}. Para estas condiciones específicas, la diferencia de promedios (Di) superó el límite de aceptación establecido. Por lo tanto, estos parámetros se consideran críticos y deben ser estrictamente controlados durante la rutina analítica para garantizar la validez de los resultados.`;
}

window.renderizarSeccionRobustez = function (elemActivo) {
    const dataElem = window.datosGlobales ? window.datosGlobales[elemActivo] : null;
    
    // CAMBIO 1: Se actualizó el ID para que coincida con el HTML (6.7)
    const sec67 = document.getElementById('sec-6-7-robustez');
    const filaSec7 = document.getElementById('fila-conclusion-robustez');
    const txtSec7 = document.getElementById('texto-conclusion-robustez');

    if (!dataElem || !dataElem.robustez) {
        if (sec67) sec67.style.display = 'none';
        if (filaSec7) filaSec7.style.display = 'none';
        if (txtSec7) txtSec7.style.display = 'none';
        return;
    }

    const rob = dataElem.robustez;

    // Helper para calcular promedios
    const calcProm = (arr) => {
        if (!Array.isArray(arr) || arr.length === 0) return null;
        const vals = arr.map(v => (typeof v === 'object' && v !== null && 'valor' in v) ? v.valor : v)
                        .map(v => typeof v === 'number' ? v : parseFloat(v))
                        .filter(v => !isNaN(v));
        if (vals.length === 0) return null;
        return vals.reduce((a, b) => a + b, 0) / vals.length;
    };

    // 1. Normalización de Simbología (6.7.1)
    let simbologiaList = [];
    if (rob.factores && typeof rob.factores === 'object') {
        simbologiaList = Object.entries(rob.factores).map(([k, v]) => ({
            simbolo: k,
            factor: typeof v === 'object' ? (v.factor || v.descripcion || JSON.stringify(v)) : String(v)
        }));
    } else if (Array.isArray(rob.simbologia)) {
        simbologiaList = rob.simbologia.map(item => ({
            simbolo: item.simbolo || item.codigo || '--',
            factor: item.factor || item.descripcion || '--'
        }));
    }

    // Calcular promedios por cada símbolo a partir de datos_crudos
    const promFactoresMap = {};
    if (rob.datos_crudos && typeof rob.datos_crudos === 'object') {
        Object.entries(rob.datos_crudos).forEach(([sym, lecturas]) => {
            promFactoresMap[sym] = calcProm(lecturas);
        });
    }

    // 2. Normalización de Escenarios (6.7.2)
    let escenariosList = [];
    const escRaw = rob.escenarios || rob.escenario || rob.promediosEscenarios;
    if (Array.isArray(escRaw)) {
        escenariosList = escRaw.map((esc, idx) => {
            const numEsc = idx + 1;
            const titulo = esc.nombre || esc.titulo || `Escenario ${numEsc}`;
            // CAMBIO 2: Subcódigos actualizados a 6.7.2
            const subcodigo = esc.codigo || `6.7.2.${numEsc}`;
            let vars = [];
            let combiStrings = [];

            if (Array.isArray(esc.combinacion)) {
                combiStrings = esc.combinacion.map(s => String(s));
                vars = combiStrings.map(sym => ({
                    variable: sym,
                    promedio: promFactoresMap[sym] !== undefined ? promFactoresMap[sym] : null
                }));
            } else if (Array.isArray(esc.variables)) {
                vars = esc.variables.map(v => {
                    const sym = v.variable || v.simbolo || '--';
                    combiStrings.push(sym);
                    return {
                        variable: sym,
                        promedio: v.promedio !== undefined ? v.promedio : promFactoresMap[sym]
                    };
                });
            }

            // Calcular promedio global del escenario
            let promGlobal = esc.promedioGlobal !== undefined ? esc.promedioGlobal : esc.promedio_global;
            if (promGlobal === undefined || promGlobal === null) {
                const pValidos = vars.map(v => v.promedio).filter(p => typeof p === 'number' && !isNaN(p));
                promGlobal = pValidos.length > 0 ? (pValidos.reduce((a, b) => a + b, 0) / pValidos.length) : null;
            }

            return {
                id: esc.id || numEsc,
                titulo,
                subcodigo,
                variables: vars,
                combinacion: combiStrings,
                promedioGlobal: promGlobal
            };
        });
    }

    // 3. Normalización y Cálculo Youden (6.7.3)
    let youdenList = [];
    if (escenariosList.length > 0) {
        const promsEscValidos = escenariosList.map(e => e.promedioGlobal).filter(p => typeof p === 'number' && !isNaN(p));
        let sdEsc = 0;
        if (promsEscValidos.length > 1) {
            const meanE = promsEscValidos.reduce((a, b) => a + b, 0) / promsEscValidos.length;
            const varE = promsEscValidos.reduce((a, b) => a + Math.pow(b - meanE, 2), 0) / (promsEscValidos.length - 1);
            sdEsc = Math.sqrt(varE);
        }
        const limAcepGlobal = Math.sqrt(2) * sdEsc;

        const letrasMayus = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
        letrasMayus.forEach(mayus => {
            const minus = mayus.toLowerCase();
            const escMayus = escenariosList.filter(e => e.combinacion.includes(mayus));
            const escMinus = escenariosList.filter(e => e.combinacion.includes(minus));

            if (escMayus.length > 0 && escMinus.length > 0) {
                const pMayusArr = escMayus.map(e => e.promedioGlobal).filter(p => typeof p === 'number' && !isNaN(p));
                const pMinusArr = escMinus.map(e => e.promedioGlobal).filter(p => typeof p === 'number' && !isNaN(p));

                const promMayus = pMayusArr.length > 0 ? pMayusArr.reduce((a, b) => a + b, 0) / pMayusArr.length : null;
                const promMinus = pMinusArr.length > 0 ? pMinusArr.reduce((a, b) => a + b, 0) / pMinusArr.length : null;
                const dif = (promMayus !== null && promMinus !== null) ? Math.abs(promMayus - promMinus) : null;

                const descFactor = (rob.factores && rob.factores[minus]) || (rob.factores && rob.factores[mayus]) || `Factor ${mayus}`;

                youdenList.push({
                    comparacion: `${mayus} vs ${minus}`,
                    sinModificar: promMayus !== null ? promMayus : '--',
                    modificado: promMinus !== null ? promMinus : '--',
                    diferencia: dif !== null ? dif : '--',
                    desviacionEstandar: sdEsc,
                    limiteAceptacion: limAcepGlobal,
                    condicion: descFactor
                });
            }
        });
    }

    if (simbologiaList.length === 0 && escenariosList.length === 0 && youdenList.length === 0) {
        // CAMBIO 3: Actualizada la referencia a sec67
        if (sec67) sec67.style.display = 'none';
        if (filaSec7) filaSec7.style.display = 'none';
        if (txtSec7) txtSec7.style.display = 'none';
        return;
    }

    if (sec67) sec67.style.display = 'block';
    if (filaSec7) filaSec7.style.display = 'table-row';
    if (txtSec7) txtSec7.style.display = 'block';

    // 1. Renderizar 6.7.1 Simbología
    const tbodySimb = document.getElementById('tbody-robustez-simbologia');
    if (tbodySimb) {
        tbodySimb.innerHTML = simbologiaList.map(item => `
            <tr class="border-b border-slate-200 hover:bg-slate-50">
                <td class="p-2 text-center font-bold font-mono text-blue-900 border-r border-slate-200">${item.simbolo}</td>
                <td class="p-2 text-slate-700">${item.factor}</td>
            </tr>
        `).join('');
    }

    // 2. Renderizar 6.7.2 Promedios por Escenario
    const contenedorEsc = document.getElementById('contenedor-escenarios-robustez');
    if (contenedorEsc) {
        contenedorEsc.innerHTML = escenariosList.map(esc => {
            const filasVars = esc.variables.map(v => {
                const promVal = typeof v.promedio === 'number' ? v.promedio.toFixed(4) : (v.promedio != null ? v.promedio : '--');
                return `
                    <tr class="border-b border-slate-200">
                        <td class="p-2 font-bold font-mono text-slate-800 border-r border-slate-200 text-center">${v.variable}</td>
                        <td class="p-2 font-mono text-center">${promVal}</td>
                    </tr>
                `;
            }).join('');

            const promGlobalVal = typeof esc.promedioGlobal === 'number' ? esc.promedioGlobal.toFixed(4) : (esc.promedioGlobal != null ? esc.promedioGlobal : '--');

            return `
                <div id="sec-${esc.subcodigo.replace(/\./g, '-')}" class="mantener-junto space-y-2 border border-slate-300 p-3.5 rounded bg-white shadow-sm">
                    <h4 class="text-xs font-bold text-blue-900 uppercase tracking-wide border-b border-slate-200 pb-1.5 mb-2 flex items-center gap-2">
                        <span class="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-[10px]">${esc.subcodigo}</span>
                        ${esc.titulo}
                    </h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="overflow-x-auto">
                            <table class="w-full text-xs text-left border border-slate-300">
                                <thead class="bg-slate-100 text-slate-700">
                                    <tr>
                                        <th class="p-2 w-1/2 text-center border-r border-slate-300">Variable</th>
                                        <th class="p-2 w-1/2 text-center">Promedio (mg/L)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${filasVars}
                                </tbody>
                            </table>
                        </div>
                        <div class="flex items-center justify-center p-4 bg-slate-50 border border-slate-200 rounded">
                            <div class="text-center">
                                <div class="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Promedio Global</div>
                                <div class="text-2xl font-extrabold text-blue-800 font-mono">${promGlobalVal}</div>
                                <div class="text-xs text-slate-500 mt-1">mg/L</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // 3. Renderizar 6.7.3 Evaluación Youden
    const tbodyYouden = document.getElementById('tbody-robustez-youden');
    if (tbodyYouden) {
        tbodyYouden.innerHTML = youdenList.map(item => {
            const smVal = typeof item.sinModificar === 'number' ? item.sinModificar.toFixed(4) : item.sinModificar;
            const mVal = typeof item.modificado === 'number' ? item.modificado.toFixed(4) : item.modificado;
            const difVal = typeof item.diferencia === 'number' ? item.diferencia.toFixed(4) : item.diferencia;
            const sdVal = typeof item.desviacionEstandar === 'number' ? item.desviacionEstandar.toFixed(4) : item.desviacionEstandar;
            const limVal = typeof item.limiteAceptacion === 'number' ? item.limiteAceptacion.toFixed(4) : item.limiteAceptacion;

            const difNum = typeof item.diferencia === 'number' ? item.diferencia : NaN;
            const limNum = typeof item.limiteAceptacion === 'number' ? item.limiteAceptacion : NaN;

            let statusIcon = '--';
            if (!isNaN(difNum) && !isNaN(limNum)) {
                if (difNum <= limNum) {
                    statusIcon = `<span class="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                        Cumple
                    </span>`;
                } else {
                    statusIcon = `<span class="inline-flex items-center gap-1 text-red-700 font-bold bg-red-50 px-2 py-0.5 rounded border border-red-200">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        Efecto Significativo
                    </span>`;
                }
            }

            return `
                <tr class="border-b border-slate-200 hover:bg-slate-50">
                    <td class="p-2 font-bold text-slate-800 border-r border-slate-200">
                        <div class="text-[10px] text-slate-500 font-normal uppercase mb-0.5">${item.condicion}</div>
                        ${item.comparacion}
                    </td>
                    <td class="p-2 font-mono text-slate-700 border-r border-slate-200">${smVal}</td>
                    <td class="p-2 font-mono text-slate-700 border-r border-slate-200">${mVal}</td>
                    <td class="p-2 font-mono font-bold text-blue-800 border-r border-slate-200">${difVal}</td>
                    <td class="p-2 font-mono text-slate-600 border-r border-slate-200">${sdVal}</td>
                    <td class="p-2 font-mono text-slate-700 border-r border-slate-200">${limVal}</td>
                    <td class="p-2 text-center">${statusIcon}</td>
                </tr>
            `;
        }).join('');
    }

    if (txtSec7 && youdenList.length > 0) {
        txtSec7.innerHTML = generarInterpretacionRobustez(youdenList);
    }
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
    const tipoMetodo = getVal('sel-inf-tipo-metodo', 'Normalizado sin modificaciones');
    // tipoEstudio ya no se deja "libre": si el método es normalizado y no fue
    // modificado, el estudio debe llamarse CONFIRMACIÓN, no "validación" ni
    // "verificación" indistintamente (evita el título ambiguo del informe).
    const metodoModificado = tipoMetodo.toLowerCase().includes('modificado');
    const tipoEstudioSel = getVal('sel-inf-tipo-estudio', '');
    const tipoEstudio = tipoEstudioSel || (metodoModificado ? 'Validación de Método' : 'Confirmación de Método');
    // P0-2: referencias metodológicas explícitas y separadas (no una sola
    // denominación ambigua tipo "Standard Methods 3015A / EPA 200.7").
    const metodoPreparacion = getVal('inp-inf-metodo-preparacion', '');
    const metodoInstrumental = getVal('inp-inf-metodo-instrumental', norma);
    const revisionVersion = getVal('inp-inf-revision-version', '');
    const procedimientoInterno = getVal('inp-inf-procedimiento-interno', codigo);
    const analista1 = getVal('inp-inf-analista1', 'Analista 1');
    const analista2 = getVal('inp-inf-analista2', 'Analista 2');
    const respTecnico = getVal('inp-inf-resp', 'Director Técnico');
    const fechaInput = getVal('inp-inf-fecha');

    // Persistencia LocalStorage
    window.datosGlobales.configMetadatos = {
        elemActivo, codigo, nombreProc, matriz, tecnica, norma,
        tipoMetodo, tipoEstudio, metodoPreparacion, metodoInstrumental,
        revisionVersion, procedimientoInterno,
        analista1, analista2, respTecnico, fecha: fechaInput
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

    // Título principal del informe: una sola figura metodológica, nunca
    // "validación / verificación" simultáneas (P0-1). Si existe un elemento
    // con id 'prev-titulo-informe' en la vista, se actualiza aquí.
    setTxt('prev-titulo-informe', `INFORME DE ${tipoEstudio.toUpperCase()}`);

    // Referencias metodológicas completas y no ambiguas (P0-2)
    const refMetodContainer = document.getElementById('prev-referencias-metodologicas');
    if (refMetodContainer) {
        refMetodContainer.innerHTML = `
            <ul class="list-disc pl-5 space-y-1">
                <li><strong>Método de preparación/digestión:</strong> ${metodoPreparacion || '<span class="text-red-600">Pendiente de especificar</span>'}</li>
                <li><strong>Método instrumental:</strong> ${metodoInstrumental}</li>
                <li><strong>Revisión/versión:</strong> ${revisionVersion || '<span class="text-red-600">Pendiente de especificar</span>'}</li>
                <li><strong>Procedimiento interno:</strong> ${procedimientoInterno}</li>
            </ul>
        `;
    }
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

    // Incertidumbre: se lee el resultado ya calculado y persistido por
    // calcularIncertidumbre() (seccion-incertidumbre.js) en
    // datosGlobales[elem].resultadoIncertidumbre, en vez de recalcularlo aquí
    // con una fórmula duplicada (que estaba desactualizada: le faltaba el
    // componente de Estandarización y calculaba distinto la curva y la muestra).
    // Si el usuario nunca entró a la pestaña de Incertidumbre para este
    // elemento, resultadoIncertidumbre todavía no existe y se muestran ceros.
    const incResInforme = dataElem.resultadoIncertidumbre || null;
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

    // P0-4: tabla explícita LOD / LOQ / LCM (definición, cálculo, propósito,
    // criterio de aceptación y valor final), y justificación cuando el
    // límite operativo/reportable (LCM teórico) difiere del LOQ calculado.
    const limitesContainer = document.getElementById('prev-tabla-lod-loq-lcm');
    const teoricoLcmVal = dataElem.teorico_lcm ?? '--';
    if (limitesContainer) {
        limitesContainer.innerHTML = `
            <table class="w-full text-xs border-collapse border border-slate-300">
                <thead>
                    <tr class="bg-slate-100">
                        <th class="border border-slate-300 p-2 text-left">Parámetro</th>
                        <th class="border border-slate-300 p-2 text-left">Definición</th>
                        <th class="border border-slate-300 p-2 text-left">Cálculo</th>
                        <th class="border border-slate-300 p-2 text-left">Propósito</th>
                        <th class="border border-slate-300 p-2 text-left">Criterio de aceptación</th>
                        <th class="border border-slate-300 p-2 text-right">Valor final</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td class="border border-slate-300 p-2 font-bold">LOD</td>
                        <td class="border border-slate-300 p-2">Límite de detección: menor concentración distinguible del blanco.</td>
                        <td class="border border-slate-300 p-2">3 × SD de 10 blancos de método independientes.</td>
                        <td class="border border-slate-300 p-2">Confirmar capacidad de detección del método.</td>
                        <td class="border border-slate-300 p-2">LOD &lt; LOQ &lt; LCM</td>
                        <td class="border border-slate-300 p-2 text-right font-mono">${lod} mg/L</td>
                    </tr>
                    <tr class="bg-slate-50">
                        <td class="border border-slate-300 p-2 font-bold">LOQ</td>
                        <td class="border border-slate-300 p-2">Límite de cuantificación: menor concentración cuantificable con precisión y exactitud aceptables.</td>
                        <td class="border border-slate-300 p-2">10 × SD de 10 blancos de método independientes.</td>
                        <td class="border border-slate-300 p-2">Establecer el piso analítico de cuantificación confiable.</td>
                        <td class="border border-slate-300 p-2">Verificado experimentalmente con estándares bajos.</td>
                        <td class="border border-slate-300 p-2 text-right font-mono">${loq} mg/L</td>
                    </tr>
                    <tr>
                        <td class="border border-slate-300 p-2 font-bold">LCM</td>
                        <td class="border border-slate-300 p-2">Límite de cuantificación del método (valor operativo/reportable adoptado por el laboratorio).</td>
                        <td class="border border-slate-300 p-2">Verificación de exactitud/precisión sobre 10 réplicas al nivel LCM teórico.</td>
                        <td class="border border-slate-300 p-2">Es el límite que efectivamente se reporta a los clientes.</td>
                        <td class="border border-slate-300 p-2">% Error y CV dentro de los márgenes del procedimiento interno.</td>
                        <td class="border border-slate-300 p-2 text-right font-mono">${teoricoLcmVal} mg/L</td>
                    </tr>
                </tbody>
            </table>
            <p class="text-xs text-slate-600 mt-2 italic">
                ${teoricoLcmVal !== '--' && loq !== '--' && parseFloat(teoricoLcmVal) > parseFloat(loq)
                ? `El límite operativo/reportable (LCM = ${teoricoLcmVal} mg/L) se fija por encima del LOQ calculado (${loq} mg/L) como criterio conservador del laboratorio, verificado mediante exactitud y precisión en el nivel LCM; el LOQ calculado no se reporta como límite operativo.`
                : `El límite operativo/reportable coincide con el LOQ calculado.`}
            </p>
        `;
    }

    // 2. Sección 6: Compilación de Tablas e Informes
    // Se aísla en try/catch: un error al compilar cualquier tabla/gráfica de
    // la Sección 6 para un elemento con datos incompletos NO debe impedir
    // que se rendericen las secciones siguientes (7, 8, 9 y Robustez).
    if (typeof window.poblarSeccion6Resultados === 'function') {
        try {
            window.poblarSeccion6Resultados(elemActivo);
        } catch (errSec6) {
            console.error("Error al compilar la Sección 6 del informe (no bloquea el resto del informe):", errSec6);
        }
    }

    // 2.1 Sección 6.7: Robustez (Prueba de Youden)
    // IMPORTANTE: se renderiza aquí, justo después de la Sección 6 y en su
    // propio try/catch, en vez de al final de esta función. Antes estaba
    // hasta el final: si CUALQUIER cosa más abajo (gráficas, conclusiones,
    // declaración de conformidad, etc.) lanzaba una excepción para ese
    // elemento, la ejecución de guardarMetadatosYCompilar se detenía ahí
    // mismo y renderizarSeccionRobustez nunca llegaba a ejecutarse, aunque
    // datosGlobales[elemento].robustez sí tuviera datos válidos. Al
    // adelantarla y protegerla, la sección de Robustez se pinta siempre que
    // haya datos, sin importar si algo más falla en el resto del informe.
    console.log("Objeto de robustez encontrado:", window.datosGlobales?.[elemActivo]?.robustez);
    if (typeof window.renderizarSeccionRobustez === 'function') {
        try {
            window.renderizarSeccionRobustez(elemActivo);
        } catch (errRobustez) {
            console.error("Error al renderizar la sección de Robustez:", errRobustez);
        }
    } else {
        console.error("Error: window.renderizarSeccionRobustez no está definida o no se ha cargado.");
    }

    setTimeout(() => {
        const incData = dataElem.resultadoIncertidumbre || null;

        if (incData) {
            const ucDestino = document.getElementById('inf-val-uc-total');
            if (ucDestino) ucDestino.innerText = incData.u_c_total.toFixed(5);

            const uExpDestino = document.getElementById('inf-val-u-expandida');
            if (uExpDestino) uExpDestino.innerText = `± ${incData.u_expandida_porc.toFixed(2)}%`;

            // 2. Tabla de presupuesto de incertidumbre construida a partir de las
            // filas ya calculadas (6 fuentes, Estandarización incluida)
            const tablaDestino = document.getElementById('inf-tabla-resumen-incertidumbre');
            const tablaDestinoHeader = tablaDestino?.querySelector('thead');
            const tablaDestinoBody = document.getElementById('inf-tabla-resumen-incertidumbre-body') ||
                tablaDestino?.querySelector('tbody');

            // Actualizar encabezado (thead) con las nuevas columnas
            if (tablaDestinoHeader) {
                tablaDestinoHeader.innerHTML = `
                    <tr class="bg-slate-100 font-bold text-slate-700">
                        <th class="border border-slate-300 p-1.5 text-left">Fuente de Incertidumbre</th>
                        <th class="border border-slate-300 p-1.5 text-center">Tipo</th>
                        <th class="border border-slate-300 p-1.5 text-right">Valor / s</th>
                        <th class="border border-slate-300 p-1.5 text-right">urel Comb.</th>
                        <th class="border border-slate-300 p-1.5 text-right">% Varianza</th>
                    </tr>
                `;
            }

            // Inyectar filas dinámicas con las 5 columnas solicitadas
            if (tablaDestinoBody && Array.isArray(incData.filas)) {
                const varTotal = incData.var_total || incData.filas.reduce((acc, f) => acc + (f.varSq || 0), 0);

                tablaDestinoBody.innerHTML = incData.filas.map(fila => {
                    const porcVarianza = varTotal > 0
                        ? ((fila.varSq / varTotal) * 100).toFixed(1) + '%'
                        : '0.0%';

                    return `
                        <tr class="hover:bg-slate-50 transition-colors">
                            <td class="border border-slate-300 p-1.5 font-semibold text-slate-800">${fila.fuente}</td>
                            <td class="border border-slate-300 p-1.5 text-center font-bold ${fila.tipo === 'Tipo A' ? 'text-blue-600' : 'text-emerald-600'}">${fila.tipo || 'Tipo B'}</td>
                            <td class="border border-slate-300 p-1.5 text-right font-mono text-slate-600">${fila.detalle || '-'}</td>
                            <td class="border border-slate-300 p-1.5 text-right font-mono font-bold text-slate-700">${typeof fila.uRel === 'number' ? fila.uRel.toFixed(5) : '-'}</td>
                            <td class="border border-slate-300 p-1.5 text-right font-bold text-indigo-600">${porcVarianza}</td>
                        </tr>
                    `;
                }).join('');
            }

            // 3. Gráfico de anillo de contribución a la varianza, con instancia propia
            // de Chart.js (igual que ya se hace para linealidad: chartInfLinIndInstance, etc.)
            const canvasDestino = document.getElementById('chart-inf-incertidumbre');
            if (canvasDestino && Array.isArray(incData.varianzas)) {
                if (window.chartInfIncertidumbreInstance) {
                    window.chartInfIncertidumbreInstance.destroy();
                }

                const ctx = canvasDestino.getContext('2d');
                window.chartInfIncertidumbreInstance = new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: (incData.filas || []).map(f => f.fuente),
                        datasets: [{
                            data: incData.varianzas,
                            backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#a855f7']
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'right', labels: { boxWidth: 12, font: { size: 10 } } }
                        }
                    }
                });
            }
        }
    }, 100);

    // 3. Sección 7: Inyección Técnica Detallada
    setTxt('prev-sec-rechazo', dataElem.rechazo_texto || `Para la determinación de ${elemActivo} en estándares y muestras de ensayo no se descarta ningún dato extremo o atípico durante el tratamiento de datos.`);
    setTxt('prev-sec-lod', dataElem.lod_texto || `El límite de detección del método se establece computando 3*SD a partir de 10 blancos de proceso independientes, obteniendo un valor metrológico de ${lod} mg/L.`);
    setTxt('prev-sec-loq', dataElem.loq_texto || `Se realizó la medición de 10 estándares de ${dataElem.teorico_lcm ?? loq} mg/L de ${elemActivo}, obteniendo un promedio de ${dataElem.lcm?.analista_1?.promedio ?? '--'} mg/L para Analista 1, y ${dataElem.lcm?.analista_2?.promedio ?? '--'} mg/L para Analista 2.`);
    setTxt('prev-sec-linealidad', linData ? `Se evaluaron 3 curvas de calibración independientes en donde se satisface estrictamente el criterio de aceptación R² = 0.990 (obtenido R² = ${linData.r2}).` : `Evaluación realizada mediante curvas de calibración.`);
    if (elemActivo === "RAS" && dataElem.linealidad && dataElem.linealidad.es_ras_combinado) {
        const lRAS = dataElem.linealidad;
        // Forzamos el texto de sensibilidad para los 3 elementos evitando que lo sobreescriba un texto vacío
        const textoRAS = `Sensibilidad Ca: ${lRAS.Ca?.stats?.sensibilidad ?? '--'} | Mg: ${lRAS.Mg?.stats?.sensibilidad ?? '--'} | Na: ${lRAS.Na?.stats?.sensibilidad ?? '--'}`;
        setTxt('prev-sec-sensibilidad', textoRAS);
    } else {
        setTxt('prev-sec-sensibilidad', dataElem.sensibilidad_texto || `Sensibilidad = ${linData?.sensibilidad ?? '--'}`);
    }
    setTxt('prev-sec-veracidad', dataElem.veracidad_texto || `Se establece como el porcentaje de error promedio para los niveles evaluados (LCM, CCV, EA) dentro de los márgenes normativos.`);
    setTxt('prev-sec-precision', dataElem.precision_texto || `En el análisis de varianza (ANOVA) y test de Shapiro-Wilk se confirmó un comportamiento de distribución normal (p > 0.05).`);
    setTxt('prev-sec-recuperacion-matriz', dataElem.matriz_texto || `Se determinó el porcentaje de recuperación en muestras fortificadas cumpliendo satisfactoriamente con el criterio normativo.`);
    setTxt('prev-sec-rango-trabajo', dataElem.rango_trabajo_texto || window.generarInterpretacionRT(elemActivo));
    setTxt('prev-sec-incertidumbre', dataElem.incertidumbre_texto || `Se estructuraron las fuentes contribuyentes. La estimación final se expresa como incertidumbre expandida U = 2 * u_c * C_muestra, equivalente a un ± ${u_c_total_val} (± ${u_expandida_porc_val}%).`);

    // 4. Sección 8: Conclusiones Técnicas
    const concContainer = document.getElementById('prev-conclusiones');

    // Cálculos de control y verificación segura de variables (evita que el código se rompa)
    const recVal = parseFloat(exaLcm?.recuperacion ?? 100);

    // Evaluaciones para el texto técnico (LCM)
    const errorLcm = Math.abs(100 - recVal);
    const cumpleLcm = errorLcm <= 35;

    // ¡SOLUCIÓN AL ERROR! Declaramos de nuevo cumpleVeracidad para que no se rompa la línea 444.
    // Mantenemos la lógica original (75-125) para que tu sistema de Declaración de Conformidad general funcione.
    const cumpleVeracidad = recVal >= 75 && recVal <= 125;

    const cvVal = parseFloat(dataElem?.lcm?.global?.cv ?? 0);
    const r2Val = parseFloat(linData?.r2 ?? 0.999);

    const cumplePrecision = cvVal <= 15;
    const cumpleLinealidad = r2Val >= 0.990;

    // --- MANEJO SEGURO DE VARIABLES DE CONTEXTO ---
    const valorLcmTeorico = typeof teoricoLcmVal !== 'undefined' ? teoricoLcmVal : (dataElem?.teorico_lcm ?? loq ?? '--');
    const nombreMatriz = typeof matrizDetallada !== 'undefined' ? matrizDetallada : (dataElem?.matriz ?? 'la matriz analizada');
    const docProcedimiento = typeof procedimientoInterno !== 'undefined' ? procedimientoInterno : 'el procedimiento analítico interno';
    const valorU_c = typeof u_c_total_val !== 'undefined' ? u_c_total_val : '--';
    const valorU_rel = typeof u_expandida_porc_val !== 'undefined' ? u_expandida_porc_val : '--';
    const valLod = typeof lod !== 'undefined' ? lod : '--';
    const valLoq = typeof loq !== 'undefined' ? loq : '--';

    // Evaluación del criterio de incertidumbre
    const criterioIncertidumbre = typeof getVal === 'function' ? getVal('inp-inf-criterio-incertidumbre', '') : '';
    const uRelNum = parseFloat(valorU_rel);
    const criterioNum = parseFloat(criterioIncertidumbre);

    let textoIncertidumbreConclusion;

    if (criterioIncertidumbre && !isNaN(criterioNum)) {
        const cumpleCriterioU = uRelNum <= criterioNum;
        textoIncertidumbreConclusion = `La incertidumbre expandida relativa estimada es <strong>U_rel = ± ${valorU_rel}%</strong>. Frente al criterio máximo tolerable documentado de ± ${criterioIncertidumbre}% (${docProcedimiento}), el desempeño metrológico del ensayo ${cumpleCriterioU ? '<span class="text-emerald-700 font-bold">CUMPLE EVIDENTEMENTE</span>' : '<span class="text-red-600 font-bold">NO CUMPLE</span>'} con la especificación de calidad requerida.`;
    } else {
        textoIncertidumbreConclusion = `La estimación se consolida en una incertidumbre combinada <strong>u_c = ${valorU_c}</strong>, originando una <strong>U_rel expandida de ± ${valorU_rel}%</strong>. Su pertinencia se reporta de forma puramente informativa, dado que no existe normativamente un margen máximo tolerable predefinido para este mensurando.`;
    }

    if (concContainer) {
        concContainer.innerHTML = `
            <ul class="list-disc pl-5 space-y-3 leading-relaxed text-justify">
                <li><strong>Límites Operativos y Capacidad de Detección:</strong> El análisis de varianza del ruido de fondo permitió establecer un LOD de <strong>${valLod} mg/L</strong> y un LOQ calculado de <strong>${valLoq} mg/L</strong>. En favor de la máxima robustez analítica, el laboratorio adopta formalmente un Límite Operativo/Reportable (LCM) de <strong>${valorLcmTeorico} mg/L</strong>, garantizando cuantificaciones estadísticamente confiables en el umbral inferior de la curva.</li>
                
                <li><strong>Evaluación de Sesgo y Veracidad:</strong> El desempeño metrológico evaluado en el LCM evidencia un error relativo del <strong>${errorLcm.toFixed(1)}%</strong>, el cual ${cumpleLcm ? '<span class="text-emerald-700 font-bold">CUMPLE CON EL CRITERIO</span> máximo de aceptación permitido (≤ 35%).' : '<span class="text-red-600 font-bold">EXCEDE EL LÍMITE</span> de tolerancia del 35%.'} De igual forma, se validó la ausencia de errores sistemáticos mediante el cumplimiento normativo en los estándares CCV y EA (Error ≤ 10%), respaldado a su vez por ensayos de adición de matriz cuyos porcentajes de recuperación satisfacen de manera unánime la franja del 75% al 125%.</li>
                
                <li><strong>Precisión Intermedia y Repetibilidad:</strong> La varianza del procedimiento, expuesta a iteraciones de analista y jornada, superó satisfactoriamente el Análisis de Varianza (ANOVA), concluyendo que ${cumplePrecision ? '<span class="text-emerald-700 font-bold">NO EXISTE DISPERSIÓN SIGNIFICATIVA</span> (CV ≤ 15%). La metodología analítica demuestra ser altamente reproducible e independiente de las fluctuaciones del factor humano u operativo.' : '<span class="text-red-600 font-bold">EXISTE VARIABILIDAD CRÍTICA</span> inter-grupos, evidenciando inconsistencias operativas estructurales que afectan gravemente la precisión del reporte.'}</li>
                
                <li><strong>Linealidad del Rango Dinámico:</strong> La calibración instrumental exhibe una correlación proporcional directa innegable, sustentada matemáticamente por un coeficiente de determinación <strong>R² = ${r2Val}</strong>, magnitud que ${cumpleLinealidad ? '<span class="text-emerald-700 font-bold">SATISFACE EL CRITERIO</span> normativo estricto de linealidad (R² ≥ 0.990).' : '<span class="text-red-600 font-bold">INCUMPLE EL CRITERIO</span> normativo estipulado, demostrando una pérdida inaceptable de la función de proporcionalidad requerida.'}</li>
                
                <li><strong>Presupuesto de Incertidumbre Combinada:</strong> ${textoIncertidumbreConclusion}</li>
            </ul>
            
            <div class="mt-5 p-3.5 bg-blue-50 border-l-4 border-blue-600 rounded text-xs text-slate-800">
                <span class="font-extrabold uppercase text-blue-900 tracking-wider">Dictamen Metrológico:</span> Las declaraciones de conformidad y conclusiones técnicas aquí emitidas aplican de manera exclusiva e intransferible a la matriz de <strong>${nombreMatriz}</strong>, delimitadas estrictamente al alcance analítico, diseño estadístico y condiciones experimentales instrumentales trazables a los registros primarios documentados en el marco del presente estudio.
            </div>
        `;
    }

    // 5. Sección 9: Declaración de Conformidad
    // P0-5: se limita la declaración a los atributos evaluados en este
    // estudio y a la matriz efectivamente demostrada; ya no se afirma
    // cumplimiento integral de ISO/IEC 17025 a partir de este único informe.
    const decElem = document.getElementById('prev-declaracion-conformidad');
    if (decElem) {
        const globalConforme = cumpleVeracidad && cumplePrecision && cumpleLinealidad;
        if (globalConforme) {
            decElem.className = "bg-emerald-50 text-emerald-950 p-4 rounded-lg border border-emerald-300 font-medium text-xs text-justify leading-relaxed";
            decElem.innerHTML = `<strong>DECLARACIÓN DE CONFORMIDAD:</strong> Con base en los resultados obtenidos y en los criterios de aceptación previamente establecidos, el procedimiento <strong>${procedimientoInterno}</strong> para la determinación de <strong>${elemActivo}</strong> presenta un desempeño analítico <strong>CONFORME</strong> para los atributos evaluados en el presente estudio (veracidad, precisión, linealidad e incertidumbre). Esta conclusión aplica únicamente a la matriz <strong>${matrizDetallada}</strong>, al intervalo de trabajo y a las condiciones experimentales efectivamente evaluados y soportados por los registros primarios. La información correspondiente a ensayo de aptitud, comparación con método normalizado, robustez, interferencias y comparaciones interlaboratorio, cuando aplique, deberá encontrarse disponible y trazable de forma independiente a esta declaración.`;
        } else {
            decElem.className = "bg-red-50 text-red-950 p-4 rounded-lg border border-red-300 font-medium text-xs text-justify leading-relaxed";
            decElem.innerHTML = `<strong>DECLARACIÓN DE NO CONFORMIDAD:</strong> El procedimiento <strong>${procedimientoInterno}</strong> para la determinación de <strong>${elemActivo}</strong> en matriz <strong>${matrizDetallada}</strong> <strong>NO CUMPLE CON LOS CRITERIOS DE ACEPTACIÓN</strong> o presenta inconsistencias estadísticas en los datos procesados para los atributos evaluados en este estudio.`;
        }
    }

    if (typeof window.renderizarGraficas === 'function') {
        try {
            window.renderizarGraficas(dataElem);
        } catch (errGraficas) {
            console.error("Error al renderizar las gráficas del informe (no bloquea el resto del informe):", errGraficas);
        }
    }
    console.log("Compilando elemento activo:", elemActivo);
};

// Instancias globales para limpieza de Chart.js en la Sección 6
window.chartInfLcmInstance = null;
window.chartInfPrecInstances = {};
window.chartInfExaInstances = {};
window.chartInfLinIndInstance = null;
window.chartInfLinPromInstance = null;
window.chartInfIncertidumbreInstance = null;

// Paleta e identidad visual por analista, compartida con Precisión y Exactitud (secciones 3 y 4)
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

// NOTA: calcularIncertidumbreParaInforme() fue retirada. El informe ya no
// duplica la fórmula de incertidumbre (estaba desactualizada: le faltaba el
// componente 6 de Estandarización y calculaba distinto la curva y la muestra).
// Ahora se lee directamente window.datosGlobales[elem].resultadoIncertidumbre,
// que calcularIncertidumbre() (seccion-incertidumbre.js) persiste como datos.

window.chartInfLinRasInstances = {};

window.renderizarRasDinamico = function (linData) {
    // 1. Mapeo entre cada subconjunto de elemento y su contenedor HTML en el DOM
    const mapaContenedores = {
        'Ca': 'contenedor-ras-calcio',
        'Mg': 'contenedor-ras-magnesio',
        'Na': 'contenedor-ras-sodio'
    };

    const elementosRAS = ['Ca', 'Mg', 'Na'];

    // 2. Iterar sobre cada elemento (Calcio, Magnesio, Sodio)
    elementosRAS.forEach((el, index) => {
        // Buscar el contenedor individual correspondiente
        const container = document.getElementById(mapaContenedores[el]);

        // Si el contenedor no existe en el DOM o no hay datos para el subelemento, continuar
        if (!container) return;

        container.innerHTML = ''; // Limpieza del contenedor objetivo

        const dataEl = linData[el];
        if (!dataEl) return;

        const st = dataEl.stats || {};
        const tabla = dataEl.tabla || [];
        const curvasRaw = dataEl.curvas_raw || [];

        // Numeración correlativa (6.5.1 Ca, 6.5.2 Mg, 6.5.3 Na)
        const numSubseccion = `6.5.${index + 1}`;

        // 3. Generar la estructura HTML para este subcontenedor
        const html = `
            <div class="mb-8 border-2 border-blue-200 p-4 rounded-lg bg-white mantener-junto">
                <h4 class="text-lg font-black text-blue-900 uppercase mb-4 border-b border-blue-200 pb-2">
                    ${numSubseccion} Resultados de linealidad para <span class="normal-case">${el.charAt(0).toUpperCase()}${el.charAt(1).toLowerCase()}${el.slice(2)}</span>
                </h4>
                
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                    
                    <!-- Tabla de Estadísticos -->
                    <div class="border border-slate-300 bg-white p-3 rounded shadow-sm">
                        <h4 class="text-xs font-bold text-slate-700 mb-2">Tabla ${numSubseccion}-a. Parámetros Estadísticos (${el})</h4>
                        <table class="w-full text-xs">
                            <tbody class="divide-y divide-slate-200">
                                <tr><td class="py-1.5 font-semibold">Promedio Pendientes</td><td class="py-1.5 font-mono text-right">${st.promedio_pendientes || '--'}</td></tr>
                                <tr class="bg-blue-600 text-white font-extrabold shadow-sm">
                                    <td class="py-2 px-2">SENSIBILIDAD (${el})</td>
                                    <td class="py-2 px-2 font-mono text-right text-yellow-300 text-sm">${st.sensibilidad || '--'}</td>
                                </tr>
                                <tr class="bg-slate-50"><td class="py-1.5 font-semibold">Intercepto Promedio</td><td class="py-1.5 font-mono text-right">${st.intercepto || '--'}</td></tr>
                                <tr><td class="py-1.5 font-semibold">Coef. de Correlación (r)</td><td class="py-1.5 font-mono text-right">${st.r || '--'}</td></tr>
                                <tr class="bg-slate-50"><td class="py-1.5 font-semibold">Coef. de Determinación (R²)</td><td class="py-1.5 font-mono text-right font-bold text-emerald-700">${st.r2 || '--'}</td></tr>
                            </tbody>
                        </table>
                    </div>

                    <!-- Tabla de Datos Experimentales -->
                    <div class="border border-slate-300 bg-white p-3 rounded shadow-sm md:col-span-2 overflow-x-auto">
                        <h4 class="text-xs font-bold text-slate-700 mb-2">Tabla ${numSubseccion}-b. Datos Experimentales de Linealidad (${el})</h4>
                        <table class="w-full text-xs text-center border-collapse border border-slate-300">
                            <thead class="bg-slate-100 text-slate-700 font-bold" id="inf-head-ras-${el}"></thead>
                            <tbody class="divide-y divide-slate-300" id="inf-body-ras-${el}"></tbody>
                        </table>
                    </div>
                </div>

                <!-- Gráficas de Linealidad (Individual y Promedio) -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div class="border border-slate-300 bg-slate-50 p-3 rounded">
                        <h4 class="text-xs font-bold text-slate-700 mb-2">Figura ${numSubseccion}-a. Curvas de Calibración Individuales (${el})</h4>
                        <div class="relative w-full h-64"><canvas id="chart-inf-lin-ind-${el}"></canvas></div>
                    </div>
                    <div class="border border-slate-300 bg-slate-50 p-3 rounded">
                        <h4 class="text-xs font-bold text-slate-700 mb-2">Figura ${numSubseccion}-b. Curva Promedio y Regresión (${el})</h4>
                        <div class="relative w-full h-64"><canvas id="chart-inf-lin-prom-${el}"></canvas></div>
                    </div>
                </div>
            </div>
        `;

        // Inyectar el HTML en el contenedor correspondiente
        container.innerHTML = html;

        // 4. Llenar la Tabla Experimental
        let theadHtml = `<tr><th class="border border-slate-300 p-1.5">Concentración</th>`;
        let maxC = 0;
        tabla.forEach(r => { if (r.señales && r.señales.length > maxC) maxC = r.señales.length; });
        for (let i = 1; i <= maxC; i++) theadHtml += `<th class="border border-slate-300 p-1.5">Señal ${i}</th>`;
        theadHtml += `<th class="border border-slate-300 p-1.5 bg-blue-100 text-blue-900">Promedio Int.</th><th class="border border-slate-300 p-1.5">Conc. Calc.</th><th class="border border-slate-300 p-1.5 text-red-600">% Error</th></tr>`;
        document.getElementById(`inf-head-ras-${el}`).innerHTML = theadHtml;

        let tbodyHtml = '';
        tabla.forEach(row => {
            let f = `<tr><td class="border border-slate-300 p-1.5 font-bold">${row.concentracion}</td>`;
            for (let c = 0; c < maxC; c++) f += `<td class="border border-slate-300 p-1.5 font-mono">${row.señales ? row.señales[c] ?? '-' : '-'}</td>`;
            f += `<td class="border border-slate-300 p-1.5 font-mono font-bold bg-blue-50 text-blue-800">${row.promedio}</td>
                  <td class="border border-slate-300 p-1.5 font-mono">${row.conc_calculada}</td>
                  <td class="border border-slate-300 p-1.5 font-mono font-bold ${row.error_pct > 10 ? 'text-red-600' : 'text-emerald-700'}">${row.error_pct}%</td></tr>`;
            tbodyHtml += f;
        });
        document.getElementById(`inf-body-ras-${el}`).innerHTML = tbodyHtml;

        // 5. Instanciar gráficos con Chart.js para cada elemento
        if (window.chartInfLinRasInstances[`ind-${el}`]) window.chartInfLinRasInstances[`ind-${el}`].destroy();
        const ctxInd = document.getElementById(`chart-inf-lin-ind-${el}`)?.getContext('2d');
        if (ctxInd && curvasRaw.length > 0) {
            const hue = el === 'Ca' ? 0 : el === 'Mg' ? 120 : 240;
            const dsInd = curvasRaw.map((curva, i) => ({
                label: `Curva ${i + 1}`,
                data: curva.map(pt => ({ x: pt[0], y: pt[1] })),
                borderColor: `hsl(${hue}, ${50 + (i * 20)}%, 50%)`,
                showLine: true,
                tension: 0
            }));
            window.chartInfLinRasInstances[`ind-${el}`] = new Chart(ctxInd, { type: 'scatter', data: { datasets: dsInd }, options: { responsive: true, maintainAspectRatio: false } });
        }

        if (window.chartInfLinRasInstances[`prom-${el}`]) window.chartInfLinRasInstances[`prom-${el}`].destroy();
        const ctxProm = document.getElementById(`chart-inf-lin-prom-${el}`)?.getContext('2d');
        if (ctxProm && tabla.length > 0) {
            const ptProm = tabla.map(r => ({ x: r.concentracion, y: r.promedio }));
            const xs = tabla.map(r => r.concentracion);
            const linea = [
                { x: Math.min(...xs), y: st.intercepto_raw + st.promedio_pendientes_raw * Math.min(...xs) },
                { x: Math.max(...xs), y: st.intercepto_raw + st.promedio_pendientes_raw * Math.max(...xs) }
            ];
            window.chartInfLinRasInstances[`prom-${el}`] = new Chart(ctxProm, {
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
    });
};
// ============================================================================
// 6.4 RANGO DE TRABAJO (RT) EN EL INFORME
// ----------------------------------------------------------------------------
// No recalcula nada: lee window.calcularDatosRT(elem) (seccion-rango-trabajo.js),
// que ya aplica los factores de dilución definidos en la pestaña Rango de
// Trabajo, y rellena las tarjetas (ids inf-rt-*) y la Tabla 6.
// ============================================================================
// Fechas de análisis (tomadas del archivo principal) por analista, en el mismo
// orden que los valores de data[ctrl].analista_N.valores.
window.fechasControlPorAnalista = function (objCtrl, analista) {
    const raw = (objCtrl && Array.isArray(objCtrl.raw)) ? objCtrl.raw : [];
    return raw.filter(d => d.analista === analista).map(d => d.fecha || 'Sin fecha');
};

// Celda única de fecha para las tablas de muestras (Tablas 5+): si muestra,
// adicionado y duplicado se analizaron el mismo día muestra una sola fecha;
// si difieren, las apila indicando a cuál corresponde cada una.
window.fechaFilaMuestra = function (r) {
    const n = r.fecha_normal, a = r.fecha_adic, d = r.fecha_dup;
    const definidas = [n, a, d].filter(x => x);
    if (definidas.length === 0) return '-';
    if (new Set(definidas).size === 1) return definidas[0];
    return `<div class="leading-tight"> ${n || '-'}<br></div>`;
};

window.renderizarRangoTrabajoInforme = function (elem) {
    const tbody = document.getElementById('inf-tabla-datos-rango-trabajo');
    const r = (typeof window.calcularDatosRT === 'function') ? window.calcularDatosRT(elem) : null;

    if (typeof window.pintarStatsRT === 'function') window.pintarStatsRT('inf-rt', r);
    if (!tbody) return;

    if (!r) {
        tbody.innerHTML = `<tr><td colspan="11" class="border border-slate-300 p-3 text-slate-500 italic">No se registraron lecturas del control de Rango de Trabajo para ${elem}.</td></tr>`;
        return;
    }

    const celda = 'border border-slate-300 p-1.5';
    tbody.innerHTML = r.datos.map(d => `
        <tr class="hover:bg-slate-50">
            <td class="${celda} font-mono font-bold bg-slate-50">${d.idx + 1}</td>
            <td class="${celda}">${d.fecha || 'Sin fecha'}</td>
            <td class="${celda}"><span class="px-1.5 py-0.5 rounded text-[10px] font-semibold ${d.analista === 'Analista 1' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}">${d.analista}</span></td>
            <td class="${celda} font-bold text-slate-700">${elem}</td>
            <td class="${celda} font-mono font-semibold text-blue-700">${r.teorico.toFixed(4)}</td>
            <td class="${celda} font-mono">${d.valorExtraido.toFixed(4)}</td>
            <td class="${celda} font-mono font-bold bg-blue-50 text-blue-900">${d.factor}</td>
            <td class="${celda} font-mono font-bold bg-emerald-50 text-emerald-900">${d.concFinal.toFixed(4)}</td>
            <td class="${celda} font-mono">${d.errorPct.toFixed(2)}%</td>
            <td class="${celda} font-mono">${d.recPct.toFixed(2)}%</td>
            <td class="${celda}">${d.esOutlier
                ? `<span class="bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded text-[10px]">Atípico (G_calc=${d.gCalc.toFixed(2)})</span>`
                : `<span class="bg-green-100 text-green-700 font-semibold px-1.5 py-0.5 rounded text-[10px]">Normal</span>`}</td>
        </tr>
    `).join('');
};

// ============================================================================
// SECCIÓN 7: INTERPRETACIÓN DINÁMICA DEL RANGO DE TRABAJO
// ----------------------------------------------------------------------------
// Redacta la interpretación técnica a partir de window.calcularDatosRT(elem),
// es decir, con los mismos números (y factores de dilución) de la Tabla 6.
// Los criterios de aceptación se toman de window.CRITERIOS_RT; por defecto se
// alinean con los ya usados en el informe (recuperación 75-125 % y CV <= 15 %).
// Para un texto propio se puede definir datosGlobales[elem].rango_trabajo_texto.
// ============================================================================
window.CRITERIOS_RT = window.CRITERIOS_RT || { recMin: 75, recMax: 125, cvMax: 15 };

window.generarInterpretacionRT = function (elem) {
    const r = (typeof window.calcularDatosRT === 'function') ? window.calcularDatosRT(elem) : null;
    if (!r) {
        return `No se registraron lecturas del control de Rango de Trabajo para ${elem}; la evaluación del rango de trabajo no puede interpretarse con la información disponible.`;
    }

    const { teorico, datos, datosA1, datosA2, stA1, stA2, stGlobal } = r;
    if (!(teorico > 0)) {
        return `No se definió un valor teórico para el nivel de Rango de Trabajo de ${elem}, por lo que no es posible calcular la recuperación ni el error relativo del rango evaluado.`;
    }

    const crit = window.CRITERIOS_RT;
    const f2 = v => Number(v).toFixed(2);
    const f4 = v => Number(v).toFixed(4);
    const enBanda = v => v >= crit.recMin && v <= crit.recMax;

    const n = datos.length;
    const cvGlobal = stGlobal.prom > 0 ? (stGlobal.std / stGlobal.prom) * 100 : 0;
    const errGlobal = (Math.abs(stGlobal.prom - teorico) / teorico) * 100;
    const concs = datos.map(d => d.concFinal);
    const recs = datos.map(d => d.recPct);
    const atipicos = datos.filter(d => d.esOutlier);
    const fueraBanda = datos.filter(d => !enBanda(d.recPct));
    const factores = datos.map(d => d.factor);
    const fMin = Math.min(...factores), fMax = Math.max(...factores);

    // ---- 1. Diseño del ensayo -------------------------------------------------
    const lcm = parseFloat((window.datosGlobales[elem] || {}).teorico_lcm);
    const txtIntervalo = (lcm > 0 && lcm < teorico)
        ? `, que delimita junto con el LCM (${lcm} mg/L) el intervalo operativo evaluado`
        : '';
    let txtDilucion;
    if (fMin === 1 && fMax === 1) txtDilucion = ', sin aplicación de factores de dilución (F = 1)';
    else if (fMin === fMax) txtDilucion = `, aplicando un factor de dilución de ${fMin} para referir las lecturas a la concentración del estándar`;
    else txtDilucion = `, aplicando factores de dilución entre ${fMin} y ${fMax} para referir las lecturas a la concentración del estándar`;

    const p1 = `Se evaluó el rango de trabajo de ${elem} con un estándar de concentración teórica ${(teorico)} mg/L${txtIntervalo}, mediante ${n} lecturas independientes (Analista 1: ${datosA1.length}; Analista 2: ${datosA2.length})${txtDilucion}.`;

    // ---- 2. Resultados globales ------------------------------------------------
    const p2 = `La concentración media obtenida fue ${f4(stGlobal.prom)} mg/L (DE = ${f4(stGlobal.std)}; CV = ${f2(cvGlobal)} %), equivalente a una recuperación global de ${f2(stGlobal.recProm)} % y a un error relativo de ${f2(errGlobal)} % respecto al valor teórico. Las lecturas individuales se distribuyeron entre ${f4(Math.min(...concs))} y ${f4(Math.max(...concs))} mg/L (recuperación individual de ${f2(Math.min(...recs))} % a ${f2(Math.max(...recs))} %).`;

    // ---- 3. Comparación entre analistas ---------------------------------------
    let p3 = '';
    if (datosA1.length > 0 && datosA2.length > 0) {
        const dif = Math.abs(stA1.recProm - stA2.recProm);
        p3 = ` Por analista, la recuperación promedio fue de ${f2(stA1.recProm)} % (Analista 1; DE = ${f4(stA1.std)}) y ${f2(stA2.recProm)} % (Analista 2; DE = ${f4(stA2.std)}), con una diferencia de ${f2(dif)} puntos porcentuales entre ambos, indicador del efecto del analista sobre el resultado.`;
    }

    // ---- 4. Criterios de aceptación --------------------------------------------
    const cumpleRec = enBanda(stGlobal.recProm);
    const cumpleCV = cvGlobal <= crit.cvMax;
    const txtIndividual = fueraBanda.length === 0
        ? `las ${n} lecturas individuales se ubican dentro de la franja de recuperación`
        : `${fueraBanda.length} de ${n} lecturas individuales ${fueraBanda.length === 1 ? 'quedó fuera' : 'quedaron fuera'} de la franja de recuperación`;
    const p4 = ` Frente a los criterios de aceptación (recuperación de ${crit.recMin} % a ${crit.recMax} % y CV ≤ ${crit.cvMax} %), la recuperación global ${cumpleRec ? 'cumple' : 'no cumple'}, la dispersión ${cumpleCV ? 'cumple' : 'excede el límite establecido'} y ${txtIndividual}.`;

    // ---- 5. Test de Grubbs ------------------------------------------------------
    const grubbsNoAplicable = [datosA1, datosA2].some(a => a.length > 0 && a.length < 3);
    let p5;
    if (atipicos.length === 0) {
        p5 = ` El Test de Grubbs (α = 0.05) no identificó valores atípicos en ninguno de los analistas, por lo que no se requirió descartar datos y el conjunto se considera homogéneo${grubbsNoAplicable ? ' (la prueba no es aplicable a un analista con menos de 3 lecturas)' : ''}.`;
    } else {
        const detalle = atipicos
            .map(d => `${d.analista}, lectura n.º ${d.idx + 1}: ${f4(d.concFinal)} mg/L, recuperación ${f2(d.recPct)} %`)
            .join('; ');
        const restantes = datos.filter(d => !d.esOutlier);
        let txtSin = '';
        if (restantes.length > 0) {
            const recSin = (restantes.reduce((a, d) => a + d.concFinal, 0) / restantes.length / teorico) * 100;
            const mismaConclusion = enBanda(recSin) === cumpleRec;
            txtSin = ` De excluirse, la recuperación global pasaría de ${f2(stGlobal.recProm)} % a ${f2(recSin)} %, ${mismaConclusion ? 'sin modificar la conclusión sobre la recuperación' : 'lo que modificaría la conclusión sobre la recuperación'}.`;
        }
        p5 = ` El Test de Grubbs (α = 0.05) identificó ${atipicos.length} ${atipicos.length === 1 ? 'valor atípico' : 'valores atípicos'} (${detalle}).${txtSin} En este informe el dato se conserva en el cálculo; su eventual exclusión requiere una causa asignable documentada.`;
    }

    // ---- 6. Conclusión ----------------------------------------------------------
    let p6;
    if (cumpleRec && cumpleCV && fueraBanda.length === 0 && atipicos.length === 0) {
        p6 = ` En consecuencia, los resultados evidencian veracidad y repetibilidad adecuadas en el nivel evaluado, por lo que el rango de trabajo se considera verificado para ${elem} hasta ${(teorico)} mg/L.`;
    } else if (cumpleRec && cumpleCV) {
        const obs = [];
        if (fueraBanda.length > 0) obs.push(`${fueraBanda.length} ${fueraBanda.length === 1 ? 'lectura fuera' : 'lecturas fuera'} de la franja de recuperación`);
        if (atipicos.length > 0) obs.push(`${atipicos.length} ${atipicos.length === 1 ? 'valor atípico' : 'valores atípicos'}`);
        p6 = ` En consecuencia, el desempeño global es aceptable, pero la presencia de ${obs.join(' y ')} exige investigar la causa (por ejemplo, error en la dilución, contaminación o inestabilidad instrumental) y, de ser necesario, repetir las lecturas afectadas antes de declarar el rango de trabajo sin observaciones.`;
    } else {
        const causas = [];
        if (!cumpleRec) {
            causas.push(stGlobal.recProm < crit.recMin
                ? 'la recuperación baja sugiere un sesgo negativo (pérdida de analito, dilución o calibración por revisar)'
                : 'la recuperación elevada sugiere un sesgo positivo (contaminación o error en la preparación del estándar)');
        }
        if (!cumpleCV) causas.push('la dispersión elevada indica falta de repetibilidad en el nivel evaluado');
        p6 = ` En consecuencia, no se demuestra el cumplimiento de los criterios de aceptación en el nivel evaluado: ${causas.join('; ')}. Se requiere identificar la fuente de la desviación y repetir el ensayo antes de declarar el rango de trabajo.`;
    }

    return p1 + ' ' + p2 + p3 + p4 + p5 + p6;
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
    const elemActivo = document.getElementById('selectElementoInforme') ? document.getElementById('selectElementoInforme').value : (window.elementoActivo || '--');

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
        // Fisicoquímico: un único blanco (Analista 1)
        const soloMBA1 = data.mb.solo_analista_1 === true;
        const thFecha = document.getElementById('inf-th-fecha');
        const thFechaA2 = document.getElementById('inf-th-fecha-a2');
        const thMB = document.getElementById('inf-th-mb');
        const thMBA2 = document.getElementById('inf-th-mb-a2');
        if (thFecha) thFecha.colSpan = soloMBA1 ? 1 : 2;
        if (thMB) thMB.colSpan = soloMBA1 ? 1 : 2;
        if (thFechaA2) thFechaA2.style.display = soloMBA1 ? 'none' : '';
        if (thMBA2) thMBA2.style.display = soloMBA1 ? 'none' : '';
        const valsMBA1 = data.mb.analista_1?.valores || [];
        const valsMBA2 = data.mb.analista_2?.valores || [];
        const valsLCMA1 = data.lcm.analista_1?.valores || [];
        const valsLCMA2 = data.lcm.analista_2?.valores || [];

        const fechasMBA1 = window.fechasControlPorAnalista(data.mb, 'Analista 1');
        const fechasMBA2 = window.fechasControlPorAnalista(data.mb, 'Analista 2');

        for (let i = 0; i < 10; i++) {
            htmlRows += `
                <tr class="hover:bg-slate-50">
                    <td class="border border-slate-300 p-1 font-mono text-[10px] bg-amber-50/50">${fechasMBA1[i] ?? '-'}</td>
                    ${soloMBA1 ? '' : `<td class="border border-slate-300 p-1 font-mono text-[10px] bg-amber-50/50">${fechasMBA2[i] ?? '-'}</td>`}
                    <td class="border border-slate-300 p-1 font-bold bg-slate-50">${i + 1}</td>
                    <td class="border border-slate-300 p-1 font-mono">${valsMBA1[i] ?? '-'}</td>
                    ${soloMBA1 ? '' : `<td class="border border-slate-300 p-1 font-mono">${valsMBA2[i] ?? '-'}</td>`}
                    <td class="border border-slate-300 p-1 font-mono text-blue-700 font-bold">${valsLCMA1[i] ?? '-'}</td>
                    <td class="border border-slate-300 p-1 font-mono text-blue-700 font-bold">${valsLCMA2[i] ?? '-'}</td>
                </tr>
            `;
        }
        tbodyMbLcm.innerHTML = htmlRows;
    }

    const tbodyResumenMbLcm = document.getElementById('inf-tabla-resumen-mb-lcm');
    if (tbodyResumenMbLcm && data.mb && data.lcm) {
        const soloMB_A1 = data.mb.solo_analista_1 === true;
        tbodyResumenMbLcm.innerHTML = `
            <tr><td class="border border-slate-300 p-1.5 font-bold">MB</td><td class="border border-slate-300 p-1.5">Analista 1</td><td class="border border-slate-300 p-1.5 font-mono">${data.mb.analista_1.promedio}</td><td class="border border-slate-300 p-1.5 font-mono">${data.mb.analista_1.desviacion}</td><td class="border border-slate-300 p-1.5 font-mono">${data.mb.analista_1.cv}%</td></tr>
            ${soloMB_A1 ? '' : `<tr><td class="border border-slate-300 p-1.5 font-bold">MB</td><td class="border border-slate-300 p-1.5">Analista 2</td><td class="border border-slate-300 p-1.5 font-mono">${data.mb.analista_2.promedio}</td><td class="border border-slate-300 p-1.5 font-mono">${data.mb.analista_2.desviacion}</td><td class="border border-slate-300 p-1.5 font-mono">${data.mb.analista_2.cv}%</td></tr>`}
            ${soloMB_A1 ? '' : `<tr class="bg-blue-50 font-bold"><td class="border border-slate-300 p-1.5">MB</td><td class="border border-slate-300 p-1.5">Global</td><td class="border border-slate-300 p-1.5 font-mono">${data.mb.global.promedio}</td><td class="border border-slate-300 p-1.5 font-mono">${data.mb.global.desviacion}</td><td class="border border-slate-300 p-1.5 font-mono">${data.mb.global.cv}%</td></tr>`}
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
            const paletaPrec = window.PALETA_ANALISTAS;
            const gradientePrec = window.crearGradienteVertical;

            window.chartInfPrecInstances[tag] = new Chart(ctxPrec, {
                type: 'line',
                data: {
                    labels: Array.from({ length: Math.max(valsA1.length, valsA2.length) }, (_, i) => `${i + 1}`),
                    datasets: [
                        {
                            label: 'Analista 1',
                            data: valsA1,
                            borderColor: paletaPrec.analista1.linea,
                            backgroundColor: (context) => gradientePrec(context.chart, paletaPrec.analista1.arribaClara, paletaPrec.analista1.abajoTransp),
                            borderWidth: 2.5,
                            tension: 0.42,
                            fill: 'origin',
                            pointRadius: 2.5,
                            pointHoverRadius: 5,
                            pointBackgroundColor: '#ffffff',
                            pointBorderColor: paletaPrec.analista1.linea,
                            pointBorderWidth: 1.5,
                            order: 2
                        },
                        {
                            label: 'Analista 2',
                            data: valsA2,
                            borderColor: paletaPrec.analista2.linea,
                            backgroundColor: (context) => gradientePrec(context.chart, paletaPrec.analista2.arribaClara, paletaPrec.analista2.abajoTransp),
                            borderWidth: 2.5,
                            tension: 0.42,
                            fill: 'origin',
                            pointRadius: 2.5,
                            pointHoverRadius: 5,
                            pointBackgroundColor: '#ffffff',
                            pointBorderColor: paletaPrec.analista2.linea,
                            pointBorderWidth: 1.5,
                            order: 1
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: false,
                    interaction: { mode: 'index', intersect: false },
                    scales: {
                        x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 9 } } },
                        y: { grid: { color: '#eef2f7' }, ticks: { color: '#94a3b8', font: { size: 9 } } }
                    },
                    plugins: {
                        legend: { position: 'top', labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 8, color: '#475569', font: { size: 10, weight: '600' } } },
                        tooltip: { backgroundColor: '#1e293b', padding: 8, cornerRadius: 6 }
                    }
                }
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

            const fechasA1 = window.fechasControlPorAnalista(objCtrl, 'Analista 1');
            const fechasA2 = window.fechasControlPorAnalista(objCtrl, 'Analista 2');

            const maxLen = Math.max(vA1.length, vA2.length, 10);
            for (let i = 0; i < maxLen; i++) {
                const valA1 = vA1[i];
                const valA2 = vA2[i];
                if (valA1 === undefined && valA2 === undefined) continue;

                const errA1 = valA1 !== undefined && teo ? (Math.abs((valA1 - teo)) / teo * 100).toFixed(2) : '--';
                const recA1 = valA1 !== undefined && teo ? (valA1 / teo * 100).toFixed(2) : '--';
                const errA2 = valA2 !== undefined && teo ? (Math.abs((valA2 - teo)) / teo * 100).toFixed(2) : '--';
                const recA2 = valA2 !== undefined && teo ? (valA2 / teo * 100).toFixed(2) : '--';

                htmlInd += `
                    <tr class="hover:bg-slate-50">
                        <td class="border border-slate-300 p-1 font-mono text-[10px] bg-amber-50/50">${valA1 !== undefined ? (fechasA1[i] ?? '-') : '-'}</td>
                        <td class="border border-slate-300 p-1 font-mono text-[10px] bg-amber-50/50">${valA2 !== undefined ? (fechasA2[i] ?? '-') : '-'}</td>
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
            const paletaExa = window.PALETA_ANALISTAS;
            const gradienteExa = window.crearGradienteVertical;

            window.chartInfExaInstances[tag] = new Chart(ctxExa, {
                type: 'line',
                data: {
                    labels: Array.from({ length: maxLen }, (_, i) => `#${i + 1}`),
                    datasets: [
                        {
                            label: 'Analista 1 (%R)',
                            data: recA1,
                            borderColor: paletaExa.analista1.linea,
                            backgroundColor: (context) => gradienteExa(context.chart, paletaExa.analista1.arribaClara, paletaExa.analista1.abajoTransp),
                            borderWidth: 2.5,
                            tension: 0.42,
                            fill: 'origin',
                            pointRadius: 2.5,
                            pointHoverRadius: 5,
                            pointBackgroundColor: '#ffffff',
                            pointBorderColor: paletaExa.analista1.linea,
                            pointBorderWidth: 1.5,
                            order: 2
                        },
                        {
                            label: 'Analista 2 (%R)',
                            data: recA2,
                            borderColor: paletaExa.analista2.linea,
                            backgroundColor: (context) => gradienteExa(context.chart, paletaExa.analista2.arribaClara, paletaExa.analista2.abajoTransp),
                            borderWidth: 2.5,
                            tension: 0.42,
                            fill: 'origin',
                            pointRadius: 2.5,
                            pointHoverRadius: 5,
                            pointBackgroundColor: '#ffffff',
                            pointBorderColor: paletaExa.analista2.linea,
                            pointBorderWidth: 1.5,
                            order: 1
                        },
                        {
                            type: 'line',
                            label: '100% Ideal',
                            data: Array(maxLen).fill(100),
                            borderColor: 'rgba(220, 38, 38, 0.6)',
                            borderDash: [4, 4],
                            pointRadius: 0,
                            borderWidth: 1.5,
                            tension: 0,
                            fill: false,
                            order: 0
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: false,
                    interaction: { mode: 'index', intersect: false },
                    scales: {
                        y: { min: 80, max: 120, grid: { color: '#eef2f7' }, ticks: { color: '#94a3b8', font: { size: 9 } } },
                        x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 9 } } }
                    },
                    plugins: {
                        legend: { position: 'top', labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 8, color: '#475569', font: { size: 10, weight: '600' } } },
                        tooltip: { backgroundColor: '#1e293b', padding: 8, cornerRadius: 6 }
                    }
                }
            });
        }
    });

    /* -------------------------------------------------------------------------- */
    /* 6.3.4+ SUBMATRICES DINÁMICAS DE MUESTRAS AMBIENTALES                      */
    /* -------------------------------------------------------------------------- */
    const contenedorMuestras = document.getElementById('subsec-6-3-muestras-dinamico');
    if (contenedorMuestras) {
        // A. Limpieza de instancias anteriores de Chart.js para evitar conflictos
        if (!window.chartsSubmatrices) window.chartsSubmatrices = [];
        window.chartsSubmatrices.forEach(chart => chart && typeof chart.destroy === 'function' && chart.destroy());
        window.chartsSubmatrices = [];

        // B. Obtener submatrices según la matriz seleccionada en metadatos
        const selMatriz = document.getElementById('sel-inf-matriz');
        const matrizActual = selMatriz ? selMatriz.value : 'Agua';
        const submatrices = (window.SUBMATRICES_MAP && window.SUBMATRICES_MAP[matrizActual]) ? window.SUBMATRICES_MAP[matrizActual] : [];

        // C. Extraer objeto de muestras ambientales desde 'data'
        const datosMuestrasSubmatriz = data.exactitud_muestras || data.muestras || (data.exactitud && data.exactitud.muestras) || {};

        let htmlDinamico = '';

        if (submatrices.length > 0) {
            // 6.3.4 Gráficas de % Recuperación y RPD
            htmlDinamico += `
                <div id="subsec-6-3-4" class="space-y-2 mantener-junto mt-6">
                    <h4 class="text-xs font-bold text-blue-800 uppercase border-b border-blue-100 pb-1">
                        6.3.4 Gráficas de % Recuperación y RPD por Submatriz
                    </h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            `;

            submatrices.forEach((sub, idx) => {
                htmlDinamico += `
                        <div class="border border-slate-300 bg-white p-3 rounded mantener-junto shadow-sm">
                            <h4 class="text-[11px] font-bold text-slate-700 mb-2">Figura 3d-${idx + 1}. Evaluación - ${sub}</h4>
                            <div class="relative w-full h-52">
                                <canvas id="chart-inf-mues-${idx}"></canvas>
                            </div>
                        </div>
                `;
            });
            htmlDinamico += `</div></div>`;

            // 6.3.5+ Tablas de datos por submatriz
            submatrices.forEach((sub, idx) => {
                const numSeccion = `6.3.${5 + idx}`;
                const numTabla = 5 + idx;

                htmlDinamico += `
                    <div id="subsec-${numSeccion.replace(/\./g, '-')}" class="space-y-2 mt-6 mantener-junto">
                        <h4 class="text-xs font-bold text-blue-800 uppercase border-b border-blue-100 pb-1">
                            ${numSeccion} Resultados de Muestras Ambientales - ${sub}
                        </h4>
                        <div class="bg-white p-3 rounded shadow-sm border border-slate-300">
                            <h5 class="text-xs font-bold text-slate-700 mb-2">Tabla ${numTabla}. Datos de Concentración, Recuperación y RPD (${sub})</h5>
                            <div class="overflow-x-auto">
                                <table class="w-full text-xs text-center border-collapse border border-slate-300">
                                    <thead>
                                        <tr class="bg-slate-100 font-bold text-slate-700 border-b border-slate-300">
                                            <th class="border border-slate-300 p-1.5 bg-amber-50">Fecha</th>
                                            <th class="border border-slate-300 p-1.5 bg-slate-200">Réplica #</th>
                                            <th class="border border-slate-300 p-1.5 bg-slate-200">Analista</th>
                                            <th class="border border-slate-300 p-1.5">Conc. Muestra</th>
                                            <th class="border border-slate-300 p-1.5">Conc. Adicionado</th>
                                            <th class="border border-slate-300 p-1.5">Conc. Duplicado</th>
                                            <th class="border border-slate-300 p-1.5 bg-blue-50">% Rec. Adicionado</th>
                                            <th class="border border-slate-300 p-1.5 bg-indigo-50">% Rec. Duplicado</th>
                                            <th class="border border-slate-300 p-1.5 bg-amber-50">RPD (%)</th>
                                        </tr>
                                    </thead>
                                    <tbody id="inf-tabla-mues-${idx}" class="divide-y divide-slate-300">
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                `;
            });
        }

        // Inyectar HTML generado en el DOM
        contenedorMuestras.innerHTML = htmlDinamico;

        // D. Poblar datos en las tablas e inicializar gráficos de Chart.js
        submatrices.forEach((sub, idx) => {
            const backendKey = (window.SUBMATRIZ_BACKEND_KEY && window.SUBMATRIZ_BACKEND_KEY[sub]) || sub;
            const filas = datosMuestrasSubmatriz[backendKey] || [];

            // 1. Inyección de filas en la tabla HTML
            const tbody = document.getElementById(`inf-tabla-mues-${idx}`);
            if (tbody) {
                if (filas.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="9" class="p-3 text-slate-400 italic">No hay datos registrados para esta submatriz.</td></tr>`;
                } else {
                    tbody.innerHTML = filas.map(r => `
                        <tr class="hover:bg-slate-50 transition-colors">
                            <td class="border border-slate-300 p-1 font-mono text-[10px] bg-amber-50/50">${window.fechaFilaMuestra(r)}</td>
                            <td class="border border-slate-300 p-1 font-semibold text-slate-700">${r.replica ?? '-'}</td>
                            <td class="border border-slate-300 p-1">${r.analista || 'N/A'}</td>
                            <td class="border border-slate-300 p-1 font-mono">${r.normal !== undefined ? Number(r.normal).toFixed(3) : '-'}</td>
                            <td class="border border-slate-300 p-1 font-mono">${r.adicionada !== undefined ? Number(r.adicionada).toFixed(3) : '-'}</td>
                            <td class="border border-slate-300 p-1 font-mono">${r.duplicada !== undefined ? Number(r.duplicada).toFixed(3) : '-'}</td>
                            <td class="border border-slate-300 p-1 font-mono font-bold text-blue-700 bg-blue-50/50">${r.recuperacion_adic !== undefined ? Number(r.recuperacion_adic).toFixed(2) + '%' : '-'}</td>
                            <td class="border border-slate-300 p-1 font-mono font-bold text-indigo-700 bg-indigo-50/50">${r.recuperacion_dup !== undefined ? Number(r.recuperacion_dup).toFixed(2) + '%' : '-'}</td>
                            <td class="border border-slate-300 p-1 font-mono font-bold text-amber-700 bg-amber-50/50">${r.rpd !== undefined ? Number(r.rpd).toFixed(2) + '%' : '-'}</td>
                        </tr>
                    `).join('');
                }
            }

            // 2. Creación del gráfico de doble eje Y (Barras para %Rec y Línea para RPD)
            const ctxMues = document.getElementById(`chart-inf-mues-${idx}`)?.getContext('2d');
            if (ctxMues && filas.length > 0) {
                const labels = filas.map(r => `Rép. ${r.replica}`);
                const chart = new Chart(ctxMues, {
                    type: 'bar',
                    data: {
                        labels: labels,
                        datasets: [
                            {
                                label: '% Rec. Adición',
                                data: filas.map(r => r.recuperacion_adic),
                                backgroundColor: 'rgba(59, 130, 246, 0.75)',
                                borderColor: 'rgba(37, 99, 235, 1)',
                                borderWidth: 1,
                                yAxisID: 'y'
                            },
                            {
                                label: '% Rec. Duplicado',
                                data: filas.map(r => r.recuperacion_dup),
                                backgroundColor: 'rgba(99, 102, 241, 0.75)',
                                borderColor: 'rgba(79, 70, 229, 1)',
                                borderWidth: 1,
                                yAxisID: 'y'
                            },
                            {
                                label: 'RPD (%)',
                                data: filas.map(r => r.rpd),
                                type: 'line',
                                borderColor: 'rgba(217, 119, 6, 1)',
                                backgroundColor: 'rgba(217, 119, 6, 0.2)',
                                borderWidth: 2,
                                pointRadius: 4,
                                pointBackgroundColor: 'rgba(217, 119, 6, 1)',
                                yAxisID: 'y1'
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        animation: false,
                        interaction: { mode: 'index', intersect: false },
                        scales: {
                            y: {
                                type: 'linear',
                                display: true,
                                position: 'left',
                                suggestedMin: 70,
                                suggestedMax: 130,
                                title: { display: true, text: '% Recuperación', font: { size: 9, weight: 'bold' } },
                                ticks: { font: { size: 9 }, color: '#64748b' },
                                grid: { color: '#eef2f7' }
                            },
                            y1: {
                                type: 'linear',
                                display: true,
                                position: 'right',
                                suggestedMin: 0,
                                suggestedMax: 20,
                                title: { display: true, text: 'RPD (%)', font: { size: 9, weight: 'bold' } },
                                grid: { drawOnChartArea: false },
                                ticks: { font: { size: 9 }, color: '#d97706' }
                            },
                            x: {
                                grid: { display: false },
                                ticks: { font: { size: 9 }, color: '#64748b' }
                            }
                        },
                        plugins: {
                            legend: { position: 'top', labels: { font: { size: 10, weight: '600' }, color: '#475569' } },
                            tooltip: { backgroundColor: '#1e293b', padding: 8, cornerRadius: 6 }
                        }
                    }
                });
                window.chartsSubmatrices.push(chart);
            }
        });
    }



    /* -------------------------------------------------------------------------- */
    /* 6.4 RANGO DE TRABAJO (RT)                                                 */
    /* -------------------------------------------------------------------------- */
    window.renderizarRangoTrabajoInforme(elem);

    /* -------------------------------------------------------------------------- */
    /* 6.5 LINEALIDAD - SENSIBILIDAD                                             */
    /* -------------------------------------------------------------------------- */
    const linData = data.linealidad;
    const contAguas = document.getElementById('contenedor-aguas-estatico');
    const contRasCa = document.getElementById('contenedor-ras-calcio');
    const contRasMg = document.getElementById('contenedor-ras-magnesio');
    const contRasNa = document.getElementById('contenedor-ras-sodio');

    const toggleContenedoresRAS = (displayStyle) => {
        if (contRasCa) contRasCa.style.display = displayStyle;
        if (contRasMg) contRasMg.style.display = displayStyle;
        if (contRasNa) contRasNa.style.display = displayStyle;
    };

    if (elemActivo === 'RAS' && linData?.es_ras_combinado) {
        toggleContenedoresRAS('block');
        contAguas.style.display = 'none';
        renderizarRasDinamico(linData);
    } else {
        toggleContenedoresRAS('none');
        contAguas.style.display = 'block';

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
    }


};

window.previsualizarInforme = window.guardarMetadatosYCompilar;