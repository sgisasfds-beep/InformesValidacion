/**
 * SECCIÓN 6 - ESTIMACIÓN DE INCERTIDUMBRE (GUM / ISO 17025)
 * -----------------------------------------------------------------------
 * Tabla metrológica de referencia (TABLA_METROLOGIA), cálculo de
 * incertidumbres Tipo A/Tipo B (calcularIncertidumbre), su gráfico de
 * contribución a la varianza y guardado/carga de configuración por
 * elemento. Incluye capturarImagenCanvas (usada también por el informe).
 * Depende de core-estado.js y core-navegacion.js.
 * -----------------------------------------------------------------------
 */

window.TABLA_METROLOGIA = {
    balon: [
        { vol: 10, tol: 0.025 }, { vol: 25, tol: 0.040 },
        { vol: 50, tol: 0.100 }, { vol: 100, tol: 0.100 }, { vol: 250, tol: 0.120 },
        { vol: 500, tol: 0.250 }, { vol: 1000, tol: 0.400 }
    ],
    pipeta: [
        { vol: 0.5, tol: 0.006 }, { vol: 1, tol: 0.008 }, { vol: 2, tol: 0.010 },
        { vol: 3, tol: 0.010 }, { vol: 4, tol: 0.010 }, { vol: 5, tol: 0.015 },
        { vol: 6, tol: 0.015 }, { vol: 7, tol: 0.015 }, { vol: 10, tol: 0.020 },
        { vol: 15, tol: 0.030 }, { vol: 20, tol: 0.030 }
    ],
    // Probeta: tratada igual que el vidrio aforado (tolerancia / √6 + dilatación térmica).
    probeta: [
        { vol: 50, tol: 0.5 }, { vol: 100, tol: 0.5 }
    ],
    // Transferpipetas (micropipetas) por código de equipo. Cada código tiene su propia
    // tabla de (volumen nominal, incertidumbre) tomada del certificado de calibración.
    // Estos valores se usan DIRECTAMENTE como incertidumbre absoluta (mL) del volumen más
    // cercano al que se está pipeteando — NO se dividen entre raíz de 6 (no es tolerancia
    // de fabricación, ya es una incertidumbre combinada de calibración).
    // OJO: verificar con el usuario si estos 6 valores (DAC-01 / DAM-06) están expresados
    // en mL o en µL — ver nota en la respuesta del chat.
    transferpipeta: {
        "DAX-07": [{ vol: 1, u: 0.00016 }, { vol: 5, u: 0.0016 }, { vol: 10, u: 0.0016 }],
        "DAC-01": [{ vol: 0.1, u: 0.093 }, { vol: 0.5, u: 0.16 }, { vol: 1, u: 0.27 }],
        "DAM-06": [{ vol: 0.1, u: 0.2 }, { vol: 0.5, u: 0.19 }, { vol: 1, u: 0.23 }],
        "DAX-10": [{ vol: 1, u: 0.00016 }, { vol: 5, u: 0.0016 }, { vol: 10, u: 0.002 }]
    },
    bureta: 0.0013, // U combinada (mL), usada directamente (igual criterio que la transferpipeta)
    balanza: 7.8e-04,  // Balanza Analítica Precisa XB 220 A
    delta_T: 3,        // Variación T°C en el laboratorio (±3 °C)
    gamma_H2O: 0.00021 // Coeficiente de dilatación térmica del agua (°C^-1)
};

// Etiquetas e iconos (SVG inline) de cada categoría de instrumento, usados tanto en el
// botón selector como en la ventana emergente.
window.CATEGORIAS_INSTRUMENTO = {
    pipeta: { label: 'Pipeta Aforada', sub: 'Selecciona el volumen' },
    probeta: { label: 'Probeta', sub: 'Selecciona el volumen' },
    transfer: { label: 'Transferpipeta', sub: 'Selecciona el equipo' },
    bureta: { label: 'Bureta', sub: 'U = 0.0013 mL (fija)' },
    balanza: { label: 'Balanza Analítica', sub: 'Se usa automáticamente si hay Peso (g)' }
};

window.ICONOS_INSTRUMENTO = {
    pipeta: `<svg viewBox="0 0 24 40" class="w-5 h-9" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 1h6l1 4-2 1v3l3 3-1 22a3 3 0 0 1-6 0L8 12l3-3V6l-2-1z"/><line x1="9.5" y1="19" x2="14.5" y2="19"/><line x1="10" y1="24" x2="14" y2="24"/></svg>`,
    probeta: `<svg viewBox="0 0 24 40" class="w-5 h-9" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2h8v4l2 2v26a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8l2-2z"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="6" y1="18" x2="18" y2="18"/><line x1="6" y1="24" x2="18" y2="24"/><line x1="6" y1="30" x2="18" y2="30"/></svg>`,
    transfer: `<svg viewBox="0 0 24 40" class="w-5 h-9" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7 2h10v6a3 3 0 0 1-1.2 2.4L14 12v4"/><rect x="10" y="16" width="4" height="4" rx="0.5"/><path d="M11 20l-1.2 15a2.2 2.2 0 0 0 4.4 0L13 20"/></svg>`,
    bureta: `<svg viewBox="0 0 24 40" class="w-5 h-9" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="1" width="6" height="5" rx="1"/><line x1="10" y1="6" x2="10" y2="30"/><line x1="14" y1="6" x2="14" y2="30"/><line x1="8" y1="10" x2="10" y2="10"/><line x1="8" y1="16" x2="10" y2="16"/><line x1="8" y1="22" x2="10" y2="22"/><path d="M10 30l2 8 2-8"/><circle cx="12" cy="33" r="1" fill="currentColor" stroke="none"/></svg>`,
    balanza: `<svg viewBox="0 0 24 40" class="w-5 h-9" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="26" width="18" height="10" rx="1.5"/><rect x="8" y="20" width="8" height="6"/><line x1="8" y1="20" x2="8" y2="14"/><line x1="16" y1="20" x2="16" y2="14"/><line x1="5" y1="14" x2="19" y2="14"/><path d="M5 14l-2 5h4l-2-5z"/><path d="M19 14l-2 5h4l-2-5z"/></svg>`
};

/**
 * Dado un código de transferpipeta y el volumen (alícuota) que se va a usar, devuelve la
 * entrada {vol, u} de su tabla cuyo volumen nominal esté más cerca del solicitado (según
 * instrucción del usuario: p.ej. con una transfer de 1/5/10 mL, una alícuota de 2 mL toma
 * la incertidumbre tabulada en 1 mL, y 6 mL toma la de 5 mL).
 */
window.obtenerEntradaTransferCercana = function (codigo, volumen) {
    const tabla = window.TABLA_METROLOGIA.transferpipeta[codigo];
    if (!tabla || !tabla.length) return null;
    let mejor = tabla[0];
    let menorDif = Math.abs(volumen - mejor.vol);
    for (let i = 1; i < tabla.length; i++) {
        const dif = Math.abs(volumen - tabla[i].vol);
        if (dif < menorDif) { menorDif = dif; mejor = tabla[i]; }
    }
    return mejor;
};

// U combinada (absoluta, mL) del material usado para medir el Volumen Titulante en la
// estandarización. A diferencia de TABLA_METROLOGIA.transferpipeta (que son factores
// relativos usados en la preparación/curva), estos valores se usan DIRECTAMENTE como
// incertidumbre del instrumento (no como tolerancia a dividir entre raíz de 6).
window.U_BURETA = 0.0013;
window.U_TRANSFER_TITULANTE = {
    trans_1_10ml: 0.0007,
    trans_100_1000: 0.0945
};

window.chartIncertidumbreInstance = null;

/**
 * Busca en la tabla de instrumentación la tolerancia del material aforado.
 * Si el volumen exacto no está, toma el del recipiente de volumen superior más cercano.
 */
window.obtenerToleranciaAforada = function (tipo, volumen) {
    const lista = window.TABLA_METROLOGIA[tipo];
    if (!Array.isArray(lista)) return 0;
    for (let item of lista) {
        if (volumen <= item.vol) return item.tol;
    }
    return lista[lista.length - 1].tol; // Si supera el máximo de la tabla, toma el mayor
};

/**
 * Incertidumbre estándar de un volumen (alícuota o volumen final), desglosada.
 *
 * Vidrio aforado:
 *   u_aforo = tolerancia / √6                      (distribución triangular)
 *   u_coef  = (V × ΔT × γ) / √3                    (distribución rectangular), donde
 *             V × 3 °C × 0.00021 es la dilatación térmica del volumen:
 *             ΔT = 3 °C de fluctuación de temperatura y γ = 0.00021 °C⁻¹ de coeficiente
 *             de expansión térmica (TABLA_METROLOGIA.delta_T y gamma_H2O).
 *   u_abs   = √(u_aforo² + u_coef²)     u_rel = u_abs / V
 * Transferpipeta y Bureta: incertidumbre de calibración directa (mL), tomando — en el caso
 * de la transferpipeta — la entrada de volumen más cercana a la alícuota (ver
 * obtenerEntradaTransferCercana).
 *
 * @param {number} volumen   Alícuota o volumen final, en mL.
 * @param {string} categoria 'pipeta' | 'probeta' | 'balon' | 'bureta' | 'transfer'
 * @param {string} codigoTransfer  Código del equipo (p.ej. 'DAX-07'), solo si categoria === 'transfer'.
 */
window.calcUEstandarVolumen = function (volumen, categoria, codigoTransfer) {
    const res = { u_aforo: 0, u_coef: 0, u_abs: 0, u_rel: 0 };
    if (!(volumen > 0)) return res;

    // 1. Transferpipeta: incertidumbre de calibración directa, al volumen tabulado más cercano
    if (categoria === 'transfer') {
        const entrada = window.obtenerEntradaTransferCercana(codigoTransfer, volumen);
        res.u_abs = entrada ? entrada.u / Math.sqrt(6) : 0;
        res.u_rel = res.u_abs / volumen;
        return res;
    }

    // 2. Bureta: incertidumbre de calibración directa (valor único)
    if (categoria === 'bureta') {
        res.u_abs = window.TABLA_METROLOGIA.bureta / Math.sqrt(6);
        res.u_rel = res.u_abs / volumen;
        return res;
    }

    // 3. Vidrio Aforado (pipeta / probeta / balón): Combinación Triangular (Aforo) + Rectangular (Temperatura)
    const tol = window.obtenerToleranciaAforada(categoria, volumen);
    res.u_aforo = tol / Math.sqrt(6);
    res.u_coef = (volumen * window.TABLA_METROLOGIA.delta_T * window.TABLA_METROLOGIA.gamma_H2O) / Math.sqrt(3);
    res.u_abs = Math.sqrt(Math.pow(res.u_aforo, 2) + Math.pow(res.u_coef, 2));
    res.u_rel = res.u_abs / volumen;
    return res;
};

/**
 * Calcula la incertidumbre relativa combinada de un volumen (Aforo + Dilatación Térmica,
 * o incertidumbre de calibración directa para transferpipeta/bureta).
 */
window.calcUVolumetricaRel = function (volumen, categoria, codigoTransfer) {
    return window.calcUEstandarVolumen(volumen, categoria, codigoTransfer).u_rel;
};

/**
 * Incertidumbre estándar de CUALQUIER alícuota: preparación de patrón de trabajo, punto de la
 * curva de calibración o toma de muestra. Única puerta de entrada, para que todas apliquen
 * la misma lógica por instrumento:
 *   - Peso > 0            -> balanza analítica (calcularU_BalanzaGramos)
 *   - 'balanza' sin peso  -> 0 (no hay nada que medir)
 *   - transfer / bureta   -> incertidumbre de calibración directa (calcUEstandarVolumen)
 *   - pipeta / probeta    -> tolerancia/√6 + dilatación térmica (calcUEstandarVolumen)
 */
window.calcUAlicuota = function (valor, peso, categoria, codigo) {
    const res = { u_aforo: 0, u_coef: 0, u_abs: 0, u_rel: 0 };
    if (peso > 0) {
        res.u_abs = res.u_rel = window.calcularU_BalanzaGramos(peso);
        return res;
    }
    if (categoria === 'balanza') return res;
    return window.calcUEstandarVolumen(valor, categoria || 'pipeta', codigo);
};

// Función para alternar visibilidad del selector de volumen final
window.toggleVolFinalMuestra = function () {
    const isChecked = document.getElementById('checkVolFinalMuestra')?.checked;
    const div = document.getElementById('divVolFinalMuestra');
    if (div) {
        div.style.display = isChecked ? 'block' : 'none';
    }
};

// ============================================================================
// PREPARACIONES DEL PATRÓN DE TRABAJO (lista dinámica: 1..N por elemento)
// ============================================================================
window.preparacionesTrabajo = null;   // Array de preparaciones del elemento activo
window._prepElemento = undefined;     // Elemento al que pertenece el array en memoria

window.OPCIONES_VOLFINAL_PREP = [
    ['50', '50 mL (±0.100 mL)'],
    ['100', '100 mL (±0.100 mL)'],
    ['250', '250 mL (±0.120 mL)'],
    ['500', '500 mL (±0.250 mL)'],
    ['1000', '1000 mL (±0.400 mL)']
];

window.preparacionTrabajoDefault = function () {
    return { conc: '', alicuota: 5, peso: 0, instCategoria: 'pipeta', instCodigo: null, volFinal: 100, control: false };
};

const _escAttr = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Arma el array en memoria a partir de la configuración guardada. Soporta el formato
 * anterior (una sola preparación en inpAlicuotaTrabajo / inpPesoTrabajo / ...).
 */
// Traduce el campo antiguo `inst` (string plano: 'pipeta' | 'trans_...' | 'balanza') al
// nuevo modelo { instCategoria, instCodigo }. Los códigos de transferpipeta cambiaron de
// catálogo, así que una `inst` antigua tipo 'trans_*' queda sin código (el usuario debe
// volver a elegir el equipo en la ventana emergente).
window.migrarInstrumentoAntiguo = function (p) {
    if (p.instCategoria) return p; // ya está en el formato nuevo
    if (typeof p.inst === 'string' && p.inst.startsWith('trans_')) {
        p.instCategoria = 'transfer';
        p.instCodigo = null;
    } else if (p.inst === 'balanza') {
        p.instCategoria = 'balanza';
    } else {
        p.instCategoria = 'pipeta';
    }
    delete p.inst;
    return p;
};

window.inicializarPreparacionesDesdeConfig = function (config) {
    let lista;
    if (config && Array.isArray(config.preparaciones) && config.preparaciones.length > 0) {
        lista = config.preparaciones.map(p => window.migrarInstrumentoAntiguo(Object.assign(window.preparacionTrabajoDefault(), p)));
    } else if (config && (config.inpAlicuotaTrabajo !== undefined || config.inpPesoTrabajo !== undefined)) {
        lista = [window.migrarInstrumentoAntiguo(Object.assign(window.preparacionTrabajoDefault(), {
            alicuota: config.inpAlicuotaTrabajo ?? 5,
            peso: config.inpPesoTrabajo ?? 0,
            inst: config.selInstTrabajo || 'pipeta',
            volFinal: config.selVolFinalTrabajo || 100
        }))];
    } else {
        lista = [window.preparacionTrabajoDefault()];
    }
    window.preparacionesTrabajo = lista;
    window._prepElemento = window.elementoActivo;
    window.renderizarPreparacionesTrabajo();
};

/**
 * Garantiza que el array en memoria corresponda al elemento activo y que el DOM
 * (que puede haberse reinyectado al cambiar de pestaña) esté sincronizado.
 */
window.asegurarPreparacionesTrabajo = function () {
    if (!Array.isArray(window.preparacionesTrabajo) || window._prepElemento !== window.elementoActivo) {
        let config = window.datosGlobales?.[window.elementoActivo]?.configIncertidumbre;
        if (!config) {
            try {
                const localData = localStorage.getItem(`lims_cfg_incertidumbre_${window.elementoActivo}`);
                if (localData) config = JSON.parse(localData);
            } catch (e) { }
        }
        window.inicializarPreparacionesDesdeConfig(config);
        return;
    }
    const cont = document.getElementById('contenedorPreparaciones');
    if (cont && cont.children.length !== window.preparacionesTrabajo.length) {
        window.renderizarPreparacionesTrabajo();
    }
};

window.renderizarPreparacionesTrabajo = function () {
    const cont = document.getElementById('contenedorPreparaciones');
    if (!cont) return;
    const preps = window.preparacionesTrabajo || [];

    cont.innerHTML = preps.map((p, i) => {
        window.migrarInstrumentoAntiguo(p);
        const optsVol = window.OPCIONES_VOLFINAL_PREP.map(([v, t]) =>
            `<option value="${v}" ${String(p.volFinal) === v ? 'selected' : ''}>${t}</option>`).join('');
        const alicuotaFija = p.instCategoria === 'pipeta' || p.instCategoria === 'probeta';

        return `
        <div class="border border-slate-200 rounded-lg p-3 bg-slate-50/60 space-y-2">
            <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-indigo-700">Preparación ${i + 1}</span>
                ${preps.length > 1 ? `<button type="button" onclick="window.eliminarPreparacionTrabajo(${i})"
                    class="text-[11px] font-semibold text-red-600 hover:text-red-800 cursor-pointer">Eliminar</button>` : ''}
            </div>

            <label class="flex items-center gap-2 text-xs font-semibold text-cyan-800 bg-cyan-50 border border-cyan-200 rounded px-2 py-1.5 cursor-pointer">
                <input type="checkbox" ${p.control === true || p.control === 'true' ? 'checked' : ''}
                    onchange="window.actualizarPreparacionTrabajo(${i}, 'control', this.checked)"
                    class="w-4 h-4 text-cyan-600 rounded cursor-pointer">
                <span>Es patrón de control</span>
            </label>

            <div>
                <label class="block text-xs font-semibold text-slate-600">Concentración del patrón (mg/L) <span class="text-[10px] text-slate-400 font-normal">(opcional, solo identifica)</span>:</label>
                <input type="text" value="${_escAttr(p.conc)}" placeholder="Ej: 250"
                    oninput="window.actualizarPreparacionTrabajo(${i}, 'conc', this.value)"
                    class="w-full border border-slate-300 rounded p-1.5 text-sm font-mono font-bold text-slate-700 bg-white">
            </div>

            <div class="grid grid-cols-2 gap-2">
                <div>
                    <label class="block text-xs font-semibold text-slate-600">Alícuota (mL) ${alicuotaFija ? '<span class="text-[10px] text-slate-400 font-normal">(fija por instrumento)</span>' : ''}:</label>
                    <input type="number" value="${_escAttr(p.alicuota)}" step="0.1" ${alicuotaFija ? 'readonly' : ''}
                        oninput="window.actualizarPreparacionTrabajo(${i}, 'alicuota', this.value)"
                        class="w-full border border-slate-300 rounded p-1.5 text-sm font-mono font-bold ${alicuotaFija ? 'text-slate-500 bg-slate-100 cursor-not-allowed' : 'text-blue-600 bg-white'}">
                </div>
                <div>
                    <label class="block text-xs font-semibold text-slate-600">Peso (g) <span class="text-[10px] text-amber-600 font-normal">(0=Volumen)</span>:</label>
                    <input type="number" value="${_escAttr(p.peso)}" step="0.0001"
                        oninput="window.actualizarPreparacionTrabajo(${i}, 'peso', this.value)"
                        class="w-full border border-slate-300 rounded p-1.5 text-sm font-mono font-bold text-emerald-600 bg-white">
                </div>
            </div>

            ${window.renderizarSelectorInstrumento('prep', i, p.instCategoria, p.instCodigo, p.instVolNominal)}

            <div>
                <label class="block text-xs font-semibold text-slate-600">Volumen Final (mL) - Balón Aforado:</label>
                <select onchange="window.actualizarPreparacionTrabajo(${i}, 'volFinal', this.value)"
                    class="w-full border border-slate-300 rounded p-1.5 text-xs font-semibold bg-white mt-1 cursor-pointer">${optsVol}</select>
            </div>
        </div>`;
    }).join('');
};

// ============================================================================
// SELECTOR DE INSTRUMENTO (Pipeta Aforada / Probeta / Transferpipeta / Bureta / Balanza)
// Componente reutilizable: se usa en cada Preparación del Patrón de Trabajo (array),
// en Toma de Muestra y en Curva de Calibración. Para Pipeta/Probeta/Transferpipeta abre
// una ventana emergente con el dibujo de cada opción; Bureta y Balanza no necesitan
// sub-selección (valor único).
// ============================================================================

window.instMuestra = { categoria: 'pipeta', codigo: null, volNominal: null };
window.instCurva = { categoria: 'pipeta', codigo: null, volNominal: null };
window._modalInstCtx = null;

window.renderizarSelectorInstrumento = function (ctxTipo, ctxIdx, categoria, codigo, volNominal) {
    const idxAttr = (ctxIdx === null || ctxIdx === undefined) ? '' : ` data-ctx-idx="${ctxIdx}"`;
    const detalleValor = (categoria === 'transfer') ? codigo : volNominal;

    const botonesCategoria = Object.keys(window.CATEGORIAS_INSTRUMENTO).map(cat => {
        const info = window.CATEGORIAS_INSTRUMENTO[cat];
        const activa = categoria === cat;
        return `
        <button type="button" title="${info.label}" data-ctx-tipo="${ctxTipo}"${idxAttr} data-categoria="${cat}"
            onclick="window.elegirCategoriaInstrumento(this)"
            class="flex flex-col items-center justify-center gap-0.5 rounded-lg border p-1.5 transition ${activa ? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-300' : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300 hover:text-slate-600'}">
            ${window.ICONOS_INSTRUMENTO[cat]}
        </button>`;
    }).join('');

    const esCurva = ctxTipo === 'curva';
    let subHtml;
    if (esCurva && (categoria === 'pipeta' || categoria === 'probeta')) {
        subHtml = `Se usa la alícuota de cada punto`;
    } else if (categoria === 'pipeta' || categoria === 'probeta') {
        subHtml = detalleValor
            ? `<span class="text-emerald-700 font-bold">${detalleValor} mL</span> seleccionados`
            : `<span class="text-amber-600 font-bold">Falta elegir el volumen</span>`;
    } else if (categoria === 'transfer') {
        subHtml = detalleValor
            ? `Equipo <span class="text-emerald-700 font-bold">${detalleValor}</span>`
            : `<span class="text-amber-600 font-bold">Falta elegir el equipo</span>`;
    } else if (categoria === 'bureta') {
        subHtml = `U = <span class="font-mono font-bold text-slate-700">0.0013 mL</span> (fija)`;
    } else {
        subHtml = `Se usa automáticamente si hay Peso (g) &gt; 0`;
    }

    const necesitaSub = categoria === 'transfer' || (!esCurva && (categoria === 'pipeta' || categoria === 'probeta'));
    const botonCambiar = necesitaSub
        ? `<button type="button" data-ctx-tipo="${ctxTipo}"${idxAttr} data-categoria="${categoria}"
             onclick="window.abrirModalSubInstrumento(this)"
             class="text-[10px] font-bold text-blue-600 hover:text-blue-800 underline decoration-dotted shrink-0">${detalleValor ? 'Cambiar' : 'Elegir'}</button>`
        : '';

    return `
    <div class="space-y-1.5">
        <label class="block text-xs font-semibold text-slate-600">Instrumento:</label>
        <div class="grid grid-cols-5 gap-1.5">${botonesCategoria}</div>
        <div class="flex items-center justify-between gap-2 text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded px-2 py-1.5">
            <span>${subHtml}</span>
            ${botonCambiar}
        </div>
    </div>`;
};

window.elegirCategoriaInstrumento = function (btn) {
    const ctxTipo = btn.dataset.ctxTipo;
    const ctxIdx = btn.dataset.ctxIdx !== undefined && btn.dataset.ctxIdx !== '' ? parseInt(btn.dataset.ctxIdx) : null;
    const categoria = btn.dataset.categoria;
    window.aplicarInstrumento(ctxTipo, ctxIdx, categoria, null);
    if (categoria === 'transfer' || (ctxTipo !== 'curva' && (categoria === 'pipeta' || categoria === 'probeta'))) {
        window.abrirModalSubInstrumento(btn);
    }
};

window.abrirModalSubInstrumento = function (el) {
    const ctxTipo = el.dataset.ctxTipo;
    const ctxIdx = el.dataset.ctxIdx !== undefined && el.dataset.ctxIdx !== '' ? parseInt(el.dataset.ctxIdx) : null;
    const categoria = el.dataset.categoria;
    window._modalInstCtx = { ctxTipo, ctxIdx, categoria };

    const modal = document.getElementById('modalInstrumentoPicker');
    const titulo = document.getElementById('modalInstTitulo');
    const sub = document.getElementById('modalInstSubtitulo');
    const grid = document.getElementById('modalInstGrid');
    if (!modal || !grid) return;

    let opciones = [];
    if (categoria === 'pipeta') {
        titulo.innerText = 'Pipeta Aforada';
        sub.innerText = 'Selecciona el volumen nominal de la pipeta usada';
        opciones = window.TABLA_METROLOGIA.pipeta.map(o => ({ valor: o.vol, label: `${o.vol} mL` }));
    } else if (categoria === 'probeta') {
        titulo.innerText = 'Probeta';
        sub.innerText = 'Selecciona el volumen nominal de la probeta usada';
        opciones = window.TABLA_METROLOGIA.probeta.map(o => ({ valor: o.vol, label: `${o.vol} mL` }));
    } else if (categoria === 'transfer') {
        titulo.innerText = 'Transferpipeta';
        sub.innerText = 'Selecciona el equipo. La incertidumbre se toma del volumen tabulado más cercano a la alícuota.';
        opciones = Object.keys(window.TABLA_METROLOGIA.transferpipeta).map(cod => ({ valor: cod, label: cod }));
    }

    const icono = window.ICONOS_INSTRUMENTO[categoria] || '';
    grid.innerHTML = opciones.map(o => `
        <button type="button" onclick="window.seleccionarValorInstrumento('${String(o.valor).replace(/'/g, "\\'")}')"
            class="flex flex-col items-center gap-2 p-3 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50 transition group">
            <span class="text-slate-400 group-hover:text-blue-600">${icono}</span>
            <span class="text-sm font-bold text-slate-700 group-hover:text-blue-700">${o.label}</span>
        </button>`).join('');

    modal.classList.remove('hidden');
};

window.cerrarModalInstrumento = function () {
    const modal = document.getElementById('modalInstrumentoPicker');
    if (modal) modal.classList.add('hidden');
    window._modalInstCtx = null;
};

window.seleccionarValorInstrumento = function (valor) {
    if (!window._modalInstCtx) return;
    const { ctxTipo, ctxIdx, categoria } = window._modalInstCtx;
    window.cerrarModalInstrumento();
    window.aplicarInstrumento(ctxTipo, ctxIdx, categoria, valor);
};

window.aplicarInstrumento = function (ctxTipo, ctxIdx, categoria, detalleValor) {
    if (ctxTipo === 'prep') {
        const p = window.preparacionesTrabajo && window.preparacionesTrabajo[ctxIdx];
        if (!p) return;
        p.instCategoria = categoria;
        if (categoria === 'pipeta' || categoria === 'probeta') {
            p.instCodigo = null;
            if (detalleValor !== null && detalleValor !== undefined) {
                p.instVolNominal = parseFloat(detalleValor);
                p.alicuota = p.instVolNominal; // instrumento de volumen fijo: la alícuota ES el volumen nominal
            }
        } else if (categoria === 'transfer') {
            p.instVolNominal = null;
            if (detalleValor) p.instCodigo = detalleValor;
        } else {
            p.instCodigo = null;
            p.instVolNominal = null;
        }
        window.renderizarPreparacionesTrabajo();
    } else if (ctxTipo === 'muestra') {
        window.instMuestra.categoria = categoria;
        if (categoria === 'pipeta' || categoria === 'probeta') {
            window.instMuestra.codigo = null;
            if (detalleValor !== null && detalleValor !== undefined) {
                window.instMuestra.volNominal = parseFloat(detalleValor);
                const campo = document.getElementById('inpAlicuotaMuestra');
                if (campo) campo.value = window.instMuestra.volNominal;
            }
        } else if (categoria === 'transfer') {
            window.instMuestra.volNominal = null;
            if (detalleValor) window.instMuestra.codigo = detalleValor;
        } else {
            window.instMuestra.codigo = null;
            window.instMuestra.volNominal = null;
        }
        window.renderizarSelectorInstrumentoMuestra();
    } else if (ctxTipo === 'curva') {
        window.instCurva.categoria = categoria;
        window.instCurva.volNominal = null;
        if (categoria === 'transfer' && detalleValor) {
            window.instCurva.codigo = detalleValor;
        } else if (categoria !== 'transfer') {
            window.instCurva.codigo = null;
        }
        window.renderizarSelectorInstrumentoCurva();
    }
    window.calcularIncertidumbre();
};

window.renderizarSelectorInstrumentoMuestra = function () {
    const cont = document.getElementById('contenedorInstMuestra');
    if (!cont) return;
    const inst = window.instMuestra;
    cont.innerHTML = window.renderizarSelectorInstrumento('muestra', null, inst.categoria, inst.codigo, inst.volNominal);
};

window.actualizarPreparacionTrabajo = function (idx, campo, valor) {
    if (!window.preparacionesTrabajo || !window.preparacionesTrabajo[idx]) return;
    window.preparacionesTrabajo[idx][campo] = valor;
    window.calcularIncertidumbre();
};

window.agregarPreparacionTrabajo = function () {
    window.asegurarPreparacionesTrabajo();
    window.preparacionesTrabajo.push(window.preparacionTrabajoDefault());
    window.renderizarPreparacionesTrabajo();
    window.calcularIncertidumbre();
};

window.eliminarPreparacionTrabajo = function (idx) {
    if (!window.preparacionesTrabajo || window.preparacionesTrabajo.length <= 1) return;
    window.preparacionesTrabajo.splice(idx, 1);
    window.renderizarPreparacionesTrabajo();
    window.calcularIncertidumbre();
};

// ============================================================================
// PREPARACIÓN DE LA CURVA: alícuota y volumen final por cada punto (1 fila por nivel)
// ============================================================================
window.puntosCurva = null;        // [{ alicuota, volFinal }] alineado con linealidad.tabla
window._puntosElemento = undefined;

window.puntoCurvaDefault = function () {
    // Cada punto tiene su propio instrumento de alícuota (pipeta, probeta, transfer, bureta...).
    return { alicuota: '', volFinal: 50, instCategoria: 'pipeta', instCodigo: null };
};

window._nPuntosCurva = function () {
    return window.datosGlobales?.[window.elementoActivo]?.linealidad?.tabla?.length || 0;
};

window.inicializarPuntosCurvaDesdeConfig = function (config) {
    const guardados = (config && Array.isArray(config.puntosCurva)) ? config.puntosCurva : [];
    // Compatibilidad: antes había UN instrumento para toda la curva (config.instCurva). Los puntos
    // guardados sin instrumento propio lo heredan de ahí.
    const instAntiguo = (config && config.instCurva && config.instCurva.categoria) ? config.instCurva : null;
    window.puntosCurva = Array.from({ length: window._nPuntosCurva() }, (_, i) => {
        const pt = Object.assign(window.puntoCurvaDefault(), guardados[i] || {});
        if (instAntiguo && !(guardados[i] && guardados[i].instCategoria)) {
            pt.instCategoria = instAntiguo.categoria;
            pt.instCodigo = instAntiguo.codigo || null;
        }
        return pt;
    });
    window._puntosElemento = window.elementoActivo;
    window.renderizarPuntosCurva();
};

window.asegurarPuntosCurva = function () {
    if (!window.elementoActivo || !window.datosGlobales) return;
    const n = window._nPuntosCurva();
    if (!Array.isArray(window.puntosCurva) || window._puntosElemento !== window.elementoActivo || window.puntosCurva.length !== n) {
        let config = window.datosGlobales[window.elementoActivo]?.configIncertidumbre;
        if (!config) {
            try {
                const localData = localStorage.getItem(`lims_cfg_incertidumbre_${window.elementoActivo}`);
                if (localData) config = JSON.parse(localData);
            } catch (e) { }
        }
        window.inicializarPuntosCurvaDesdeConfig(config);
        return;
    }
    const cont = document.getElementById('contenedorPuntosCurva');
    if (cont && cont.childElementCount === 0) window.renderizarPuntosCurva();
};

// Estado del selector "aplicar a todos los puntos"
window._bulkCurva = { categoria: 'pipeta', codigo: null };

window._opcionesInstrumento = function (seleccionada) {
    return Object.keys(window.CATEGORIAS_INSTRUMENTO).map(cat =>
        `<option value="${cat}" ${seleccionada === cat ? 'selected' : ''}>${window.CATEGORIAS_INSTRUMENTO[cat].label}</option>`).join('');
};

window._opcionesEquipoTransfer = function (seleccionado) {
    const codigos = Object.keys(window.TABLA_METROLOGIA.transferpipeta);
    return `<option value="" ${!seleccionado ? 'selected' : ''} disabled>Elegir equipo…</option>` +
        codigos.map(c => `<option value="${c}" ${seleccionado === c ? 'selected' : ''}>${c}</option>`).join('');
};

/**
 * Dibuja un punto de la curva. Dos diseños según data-layout del contenedor:
 *  - 'wide'    (por defecto en pantallas anchas / pestaña): una fila tipo tabla por punto.
 *  - 'compact' (tarjeta angosta): una tarjeta pequeña por punto.
 */
window.renderizarPuntosCurva = function () {
    const cont = document.getElementById('contenedorPuntosCurva');
    if (!cont) return;
    const tabla = window.datosGlobales?.[window.elementoActivo]?.linealidad?.tabla || [];
    const pts = window.puntosCurva || [];
    if (!tabla.length) {
        cont.innerHTML = `<p class="text-[11px] text-amber-600 italic">Sin datos de linealidad: los puntos de la curva aparecerán aquí al cargarla.</p>`;
        return;
    }
    const wide = cont.dataset.layout === 'wide';
    const selCls = 'w-full border border-slate-300 rounded-md px-1.5 py-1 text-xs font-semibold bg-white text-slate-700 cursor-pointer focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none';
    const numCls = 'w-full border border-slate-300 rounded-md px-1.5 py-1 text-sm font-mono font-bold bg-white focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none';
    const b = window._bulkCurva;

    const barraTodos = `
        <div class="flex flex-wrap items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
            <span class="text-[11px] font-bold text-indigo-800 uppercase tracking-wide">Aplicar a todos</span>
            <select onchange="window.cambiarBulkCurva('categoria', this.value)" class="${selCls} !w-auto min-w-[9rem]">${window._opcionesInstrumento(b.categoria)}</select>
            ${b.categoria === 'transfer' ? `<select onchange="window.cambiarBulkCurva('codigo', this.value)" class="${selCls} !w-auto min-w-[8rem]">${window._opcionesEquipoTransfer(b.codigo)}</select>` : ''}
            <button type="button" onclick="window.aplicarInstrumentoATodosCurva()"
                class="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md px-3 py-1.5 transition cursor-pointer">Aplicar</button>
            <span class="text-[11px] text-indigo-700/70">Después puede ajustar cada punto por separado.</span>
        </div>`;

    const cabecera = wide ? `
        <div class="hidden md:grid grid-cols-12 gap-3 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <div class="col-span-2">Punto</div>
            <div class="col-span-3">Instrumento de alícuota</div>
            <div class="col-span-2">Alícuota (mL)</div>
            <div class="col-span-2">Vol. final (mL)</div>
            <div class="col-span-3 text-right">Incertidumbre (u rel.)</div>
        </div>` : '';

    const filas = pts.map((p, i) => {
        const cat = p.instCategoria || 'pipeta';
        const conc = _escAttr(tabla[i]?.concentracion ?? '');
        const selInst = `<select onchange="window.cambiarInstrumentoPuntoCurva(${i}, this.value)" class="${selCls}">${window._opcionesInstrumento(cat)}</select>`;
        const selEquipo = cat === 'transfer'
            ? `<select onchange="window.cambiarEquipoPuntoCurva(${i}, this.value)" class="${selCls} mt-1 ${p.instCodigo ? '' : 'border-amber-400 bg-amber-50'}">${window._opcionesEquipoTransfer(p.instCodigo)}</select>` : '';
        const inAlic = `<input type="number" step="any" min="0" value="${_escAttr(p.alicuota)}" placeholder="0"
            oninput="window.actualizarPuntoCurva(${i}, 'alicuota', this.value)" class="${numCls} text-blue-600">`;
        const inVf = `<input type="number" step="any" min="0" value="${_escAttr(p.volFinal)}" placeholder="0"
            oninput="window.actualizarPuntoCurva(${i}, 'volFinal', this.value)" class="${numCls} text-slate-700">`;

        if (wide) {
            return `
            <div class="grid grid-cols-2 md:grid-cols-12 gap-3 items-start bg-white border border-slate-200 hover:border-indigo-200 rounded-lg px-3 py-2.5 transition">
                <div class="col-span-2 flex md:block items-center gap-2">
                    <span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">${i + 1}</span>
                    <div class="text-[11px] font-mono text-slate-500 md:mt-1">Conc. ${conc}</div>
                </div>
                <div class="col-span-2 md:col-span-3">${selInst}${selEquipo}</div>
                <div class="md:col-span-2"><label class="md:hidden block text-[10px] font-semibold text-slate-500">Alícuota (mL)</label>${inAlic}</div>
                <div class="md:col-span-2"><label class="md:hidden block text-[10px] font-semibold text-slate-500">Vol. final (mL)</label>${inVf}</div>
                <div id="uPuntoCurva_${i}" class="col-span-2 md:col-span-3 md:text-right text-xs font-mono text-slate-500">—</div>
            </div>`;
        }
        return `
        <div class="border border-slate-200 rounded-lg p-2 bg-slate-50/60 space-y-1.5">
            <div class="flex items-center justify-between">
                <span class="text-[11px] font-bold text-indigo-700">Punto ${i + 1}</span>
                <span class="text-[11px] font-mono text-slate-500">Conc. ${conc}</span>
            </div>
            <div>${selInst}${selEquipo}</div>
            <div class="grid grid-cols-2 gap-2">
                <div><label class="block text-[11px] font-semibold text-slate-600">Alícuota (mL)</label>${inAlic}</div>
                <div><label class="block text-[11px] font-semibold text-slate-600">Vol. final (mL)</label>${inVf}</div>
            </div>
            <div id="uPuntoCurva_${i}" class="text-[10px] font-mono text-slate-500">—</div>
        </div>`;
    }).join('');

    cont.innerHTML = `<div class="space-y-2">${barraTodos}${cabecera}${filas}</div>`;
};

window.actualizarPuntoCurva = function (idx, campo, valor) {
    if (!window.puntosCurva || !window.puntosCurva[idx]) return;
    window.puntosCurva[idx][campo] = valor;
    window.calcularIncertidumbre();
};

// Instrumento propio de cada punto de la curva
window.cambiarInstrumentoPuntoCurva = function (idx, categoria) {
    const pt = window.puntosCurva && window.puntosCurva[idx];
    if (!pt) return;
    pt.instCategoria = categoria;
    if (categoria !== 'transfer') pt.instCodigo = null;
    window.renderizarPuntosCurva();   // muestra/oculta el selector de equipo
    window.calcularIncertidumbre();
};

window.cambiarEquipoPuntoCurva = function (idx, codigo) {
    const pt = window.puntosCurva && window.puntosCurva[idx];
    if (!pt) return;
    pt.instCodigo = codigo || null;
    window.renderizarPuntosCurva();
    window.calcularIncertidumbre();
};

window.cambiarBulkCurva = function (campo, valor) {
    if (campo === 'categoria') {
        window._bulkCurva.categoria = valor;
        if (valor !== 'transfer') window._bulkCurva.codigo = null;
    } else {
        window._bulkCurva.codigo = valor || null;
    }
    window.renderizarPuntosCurva();
};

window.aplicarInstrumentoATodosCurva = function () {
    const b = window._bulkCurva;
    if (b.categoria === 'transfer' && !b.codigo) return; // falta elegir el equipo
    (window.puntosCurva || []).forEach(pt => {
        pt.instCategoria = b.categoria;
        pt.instCodigo = b.categoria === 'transfer' ? b.codigo : null;
    });
    window.renderizarPuntosCurva();
    window.calcularIncertidumbre();
};

// Ya no hay un instrumento único para toda la curva (se elige por punto). Se conserva la
// función como no-op para compatibilidad con el código que todavía la invoca.
window.renderizarSelectorInstrumentoCurva = function () {
    const cont = document.getElementById('contenedorInstCurva');
    if (cont) cont.innerHTML = '';
};

// Pestañas de la vista alternativa (incertidumbre-alternativa.html)
window._tabIncertidumbre = 'patron';
window.cambiarTabIncertidumbre = function (tab) {
    window._tabIncertidumbre = tab;
    document.querySelectorAll('[data-inc-panel]').forEach(p =>
        p.classList.toggle('hidden', p.dataset.incPanel !== tab));
    const on = ['border-indigo-600', 'text-indigo-700', 'bg-white'];
    const off = ['border-transparent', 'text-slate-500', 'hover:text-slate-700', 'hover:bg-white/60'];
    document.querySelectorAll('[data-inc-tab]').forEach(btn => {
        const activo = btn.dataset.incTab === tab;
        btn.classList.remove(...(activo ? off : on));
        btn.classList.add(...(activo ? on : off));
        btn.setAttribute('aria-selected', activo ? 'true' : 'false');
    });
};

// Función para el nuevo cálculo de incertidumbre estandar de la balanza en gramos
window.calcularU_BalanzaGramos = function (valorPesado) {
    if (valorPesado <= 0) return 0;

    // 1. Incertidumbre de balanza = (1.9e-04 * valor_pesado) / 2
    const u_balanza = (window.TABLA_METROLOGIA.balanza * valorPesado) / 2;

    // 2. Primera incertidumbre estándar = u_balanza / raiz(3)
    const u_estandar_1 = u_balanza / Math.sqrt(3);

    return u_estandar_1;
};

/**
 * Calcula la incertidumbre estándar (relativa) de UNA réplica de Volumen Sln Valorada.
 * Si no hay volumen (vSlnVal <= 0) pero sí hay peso, se usa la fórmula de balanza.
 * instSlnVal: 'pipeta' | 'balon' (según el instrumento configurado en la pestaña Titulante).
 */
window.calcularUEstandarSlnValoradaReplica = function (vSlnVal, peso, instSlnVal) {
    if (vSlnVal > 0) {
        const tol = window.obtenerToleranciaAforada(instSlnVal || 'pipeta', vSlnVal);
        const u_tolerancia = tol / Math.sqrt(6);
        const u_coef = (vSlnVal * window.TABLA_METROLOGIA.delta_T * window.TABLA_METROLOGIA.gamma_H2O) / Math.sqrt(3);
        const suma = Math.sqrt(Math.pow(u_tolerancia, 2) + Math.pow(u_coef, 2));
        return suma / vSlnVal;
    }
    if (peso > 0) {
        return window.calcularU_BalanzaGramos(peso);
    }
    return null;
};

/**
 * Calcula la incertidumbre estándar (relativa) de UNA réplica de Volumen Titulante.
 * instTit: 'bureta' | 'trans_1_10ml' | 'trans_100_1000'. Para bureta se usa su U combinada
 * (0.013) como incertidumbre absoluta directa; para transferpipeta se usa la U combinada
 * de calibración directamente (no como tolerancia dividida entre raíz de 6).
 */
window.calcularUEstandarTitulanteReplica = function (vTit, instTit) {
    if (!(vTit > 0)) return null;

    const u_instrumento = (instTit === 'trans_1_10ml' || instTit === 'trans_100_1000')
        ? (window.U_TRANSFER_TITULANTE[instTit] || 0)
        : window.U_BURETA;

    const u_coef = (vTit * window.TABLA_METROLOGIA.delta_T * window.TABLA_METROLOGIA.gamma_H2O) / Math.sqrt(3);
    const suma = Math.sqrt(Math.pow(u_instrumento, 2) + Math.pow(u_coef, 2));
    return suma / vTit;
};

/**
 * Recorre las estandarizaciones guardadas (window.datosEstandarizacion) para el parámetro/
 * elemento indicado y calcula la incertidumbre relativa combinada aportada por el/los
 * Titulante(s). Solo se usa la PRIMERA tabla (estandarizaciones[0]) de cada pestaña con
 * rol 'Titulante', y sus 3 réplicas (triplicado).
 *
 * Por cada pestaña Titulante:
 *   U_comb_rel_tab = raíz( Σ u_estandar_slnVal_i² (i=1..3) + Σ u_estandar_titulante_i² (i=1..3) )
 * Si hay varias pestañas Titulante, sus varianzas se suman entre sí (RSS) para obtener
 * la incertidumbre relativa total de la estandarización.
 */
window.calcularUEstandarizacionRelativa = function (elemento) {
    const detalle = { existe: false, uRel: 0, tabs: [] };
    if (!window.datosEstandarizacion) return detalle;

    // Empate flexible (mayúsculas/minúsculas) entre el nombre del elemento activo y las
    // claves de parámetro guardadas en la sección de Estandarización.
    const claveParametro = Object.keys(window.datosEstandarizacion).find(
        k => k.toUpperCase() === String(elemento || '').toUpperCase()
    );
    if (!claveParametro) return detalle;

    const pestanas = window.datosEstandarizacion[claveParametro]?.pestanas || [];
    const titulantes = pestanas.filter(p => p.rol === 'Titulante');
    if (!titulantes.length) return detalle;

    let varTotalEstandarizacion = 0;

    titulantes.forEach(pestana => {
        const bloque = pestana.estandarizaciones && pestana.estandarizaciones[0];
        if (!bloque || !Array.isArray(bloque.replicas)) return;

        const instSlnVal = pestana.instrumentoSlnValorada || 'pipeta';
        const instTit = pestana.instrumentoTitulante || 'bureta';

        let sumaSqSlnVal = 0, nSlnVal = 0;
        let sumaSqTit = 0, nTit = 0;

        bloque.replicas.forEach(r => {
            const vSlnVal = parseFloat(r.volSlnValorada);
            const peso = parseFloat(r.peso);
            const vTit = parseFloat(r.volTitulante);

            const uSlnVal = window.calcularUEstandarSlnValoradaReplica(vSlnVal, peso, instSlnVal);
            if (uSlnVal !== null && !isNaN(uSlnVal)) {
                sumaSqSlnVal += Math.pow(uSlnVal, 2);
                nSlnVal++;
            }

            const uTit = window.calcularUEstandarTitulanteReplica(vTit, instTit);
            if (uTit !== null && !isNaN(uTit)) {
                sumaSqTit += Math.pow(uTit, 2);
                nTit++;
            }
        });

        if (nSlnVal > 0 || nTit > 0) {
            const uCombRelTab = Math.sqrt(sumaSqSlnVal + sumaSqTit);
            varTotalEstandarizacion += Math.pow(uCombRelTab, 2);
            detalle.tabs.push({ nombre: pestana.nombre, uCombRelTab, nSlnVal, nTit });
        }
    });

    detalle.uRel = Math.sqrt(varTotalEstandarizacion);
    detalle.existe = detalle.tabs.length > 0;
    return detalle;
};

/**
 * Motor Principal: Evalúa incertidumbres Tipo A, Tipo B, Regresión Lineal y dibuja el gráfico.
 */
/**
 * Motor Principal: Evalúa incertidumbres Tipo A, Tipo B, Regresión Lineal y dibuja el gráfico.
 */
window.calcularIncertidumbre = function () {
    window.asegurarPreparacionesTrabajo();
    window.asegurarPuntosCurva();
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
    // Cada preparación combina la incertidumbre estándar de su alícuota (pesada o volumétrica)
    // con la de su volumen final (balón aforado). En ambas, el aporte por dilatación térmica
    // usa el valor (alícuota o volumen final) × 3 °C × 0.00021 (ver calcUEstandarVolumen).
    // Las preparaciones marcadas como "patrón de control" no se muestran por separado: sus
    // incertidumbres estándar se combinan en una sola fila (Patrones de Control).
    const num = (v, def) => { const n = parseFloat(v); return isNaN(n) ? def : n; };
    const prepsCalc = window.preparacionesTrabajo.map((p) => {
        const alic = num(p.alicuota, 0);
        const peso = num(p.peso, 0);
        const volFinal = num(p.volFinal, 100);
        const u_alic = window.calcUAlicuota(alic, peso, p.instCategoria, p.instCodigo).u_rel;
        const u_vf = window.calcUEstandarVolumen(volFinal, 'balon', null).u_rel;      // Volumen final (incluye coef. térmico)
        const varSq = Math.pow(u_alic, 2) + Math.pow(u_vf, 2);
        const control = p.control === true || p.control === 'true';
        return { conc: String(p.conc ?? '').trim(), alic, peso, volFinal, uRel: Math.sqrt(varSq), varSq, control };
    });

    // --- 3b. TIPO B: PREPARACIÓN DE LA CURVA (alícuota + volumen final de cada punto) ---
    // Por punto: u_rel = √(u_rel,alícuota² + u_rel,vol.final²), con el instrumento de alícuota
    // elegido PARA ESE PUNTO (pipeta, probeta, transfer, bureta...) y balón aforado para el volumen final (ambos incluyen dilatación térmica).
    // Curva completa: u_prep = √(Σ u_rel,punto²)  (misma combinación RSS que Patrones de Control).
    const tablaCurva = linData?.tabla || [];
    const puntosCalc = (window.puntosCurva || []).map((pt, i) => {
        const alic = num(pt.alicuota, 0);
        const vf = num(pt.volFinal, 0);
        const cat = pt.instCategoria || 'pipeta';
        const cod = pt.instCodigo || null;
        const faltaEquipo = cat === 'transfer' && !cod;
        const activo = alic > 0 && vf > 0;
        const u_alic = window.calcUAlicuota(alic, 0, cat, cod).u_rel;   // instrumento propio de este punto
        const u_vf = window.calcUEstandarVolumen(vf, 'balon', null).u_rel;
        const varSq = activo ? Math.pow(u_alic, 2) + Math.pow(u_vf, 2) : 0;
        const el = document.getElementById(`uPuntoCurva_${i}`);
        if (el) {
            if (faltaEquipo) {
                el.innerHTML = `<span class="text-amber-600 font-bold">Falta elegir el equipo</span>`;
            } else if (!activo) {
                el.innerHTML = `<span class="text-slate-400">Ingrese alícuota y volumen final</span>`;
            } else {
                el.innerHTML = `<span class="font-bold text-slate-800">${Math.sqrt(varSq).toFixed(5)}</span>` +
                    `<span class="block text-[10px] text-slate-400">alíc. ${u_alic.toFixed(5)} · vol. final ${u_vf.toFixed(5)}</span>`;
            }
        }
        return { conc: tablaCurva[i]?.concentracion, alic, volFinal: vf, instCategoria: cat, instCodigo: cod, activo, u_alic, u_vf, uRel: Math.sqrt(varSq), varSq };
    });
    let var_prep_curva = puntosCalc.reduce((acc, pc) => acc + pc.varSq, 0);
    const n_puntos_prep = puntosCalc.filter(pc => pc.activo).length;

    let u_curva_total_rel = 0;
    let s_res = 0;

    if (linData && linData.tabla && linData.tabla.length > 1) {
        // A) Parámetros de la curva
        const m_prom = linData.stats?.promedio_pendientes_raw || linData.stats?.promedio_pendientes || 1;
        const b_prom = linData.stats?.intercepto_raw || linData.stats?.intercepto || 0;

        // B) Puntos y concentraciones extremas
        const n_puntos = linData.tabla.length;
        const C_alta = linData.tabla[n_puntos - 1].concentracion;
        const C_baja = linData.tabla[0].concentracion;

        // C) Conteo total de datos (N) y Concentración Media de la curva (x_bar)
        let N_total = 0;
        let sum_conc_total = 0;

        linData.tabla.forEach(pt => {
            const senales = (pt.señales && Array.isArray(pt.señales) && pt.señales.length > 0)
                ? pt.señales
                : [pt.promedio];
            senales.forEach(() => {
                N_total++;
                sum_conc_total += pt.concentracion;
            });
        });

        const x_media = N_total > 0 ? (sum_conc_total / N_total) : 0;

        // D) Sumatoria de Cuadrados de Residuos en Absorbancia (SS_res)
        let sumatoria_cuadrados_res = 0;

        linData.tabla.forEach(pt => {
            const senales = (pt.señales && Array.isArray(pt.señales) && pt.señales.length > 0)
                ? pt.señales
                : [pt.promedio];

            const C_real = pt.concentracion;
            const Int_calc = (m_prom * C_real) + b_prom;

            senales.forEach(sig => {
                const diff = sig - Int_calc;
                sumatoria_cuadrados_res += (diff * diff);
            });
        });

        const df_res = (N_total - 2) > 0 ? (N_total - 2) : 1;
        s_res = Math.sqrt(sumatoria_cuadrados_res / df_res);

        // E) Sumatoria de Cuadrados de Concentración Sxx = SUM((Xi - X_bar)^2)
        let S_xx = 0;

        linData.tabla.forEach(pt => {
            const senales = (pt.señales && Array.isArray(pt.señales) && pt.señales.length > 0)
                ? pt.señales
                : [pt.promedio];

            const diff_x = pt.concentracion - x_media;
            S_xx += (diff_x * diff_x) * senales.length;
        });

        // F) Incertidumbre Estándar en Concentración (s_x0 = s_res / m)
        const denom_m = Math.abs(m_prom) > 0 ? Math.abs(m_prom) : 1;
        const s_x0 = s_res / denom_m;
        const n_replicas_muestra = 3; // Réplicas de lectura de muestra en el equipo

        // G) Incertidumbres individuales en extremos
        const u_interp_high = s_x0 * Math.sqrt(
            (1 / n_replicas_muestra) + (1 / N_total) + (Math.pow(C_alta - x_media, 2) / S_xx)
        );

        const u_interp_low = s_x0 * Math.sqrt(
            (1 / n_replicas_muestra) + (1 / N_total) + (Math.pow(C_baja - x_media, 2) / S_xx)
        );

        // H) Incertidumbre Relativa Combinada de la Curva
        const promedio_u_interp = (u_interp_high + u_interp_low) / 2;
        const promedio_conc_extremos = (C_alta + C_baja) / 2;

        u_curva_total_rel = promedio_conc_extremos > 0
            ? (promedio_u_interp / promedio_conc_extremos)
            : 0;
    }


    // --- 5. INCERTIDUMBRE TIPO B: TOMA DE MUESTRA ---
    const alicuotaMuestra = parseFloat(document.getElementById('inpAlicuotaMuestra')?.value || 10);
    const pesoMuestra = parseFloat(document.getElementById('inpPesoMuestra')?.value || 0);
    const usaVolFinalMuestra = document.getElementById('checkVolFinalMuestra')?.checked || false;
    const volFinalMuestra = parseFloat(document.getElementById('selVolFinalMuestra')?.value || 50);

    let u_alicuota_muestra_rel = 0;

    // Misma lógica que las demás alícuotas (peso -> balanza; si no, instrumento seleccionado)
    u_alicuota_muestra_rel = window.calcUAlicuota(alicuotaMuestra, pesoMuestra, window.instMuestra.categoria, window.instMuestra.codigo).u_rel;

    let u_vol_final_muestra_rel = 0;
    if (usaVolFinalMuestra) {
        // Si el usuario indicó que la muestra se lleva a un volumen final, calcula la incertidumbre del aforo
        u_vol_final_muestra_rel = window.calcUVolumetricaRel(volFinalMuestra, 'balon', null);
    }

    // Incertidumbre relativa de la muestra: Raíz de la suma de los cuadrados de la toma y el volumen final
    const u_muestra_rel = Math.sqrt(Math.pow(u_alicuota_muestra_rel, 2) + Math.pow(u_vol_final_muestra_rel, 2));

    // --- 6. INCERTIDUMBRE TIPO B: ESTANDARIZACIÓN DEL TITULANTE ---
    // Se obtiene automáticamente de la sección "Estandarización" para este mismo elemento
    // (pestañas con rol Titulante, primera tabla, triplicado de Volumen Sln Valorada/Peso
    // y Volumen Titulante).
    const estandarizacionInfo = window.calcularUEstandarizacionRelativa(window.elementoActivo);
    const u_estandarizacion_rel = estandarizacionInfo.uRel || 0;

    // --- === LÓGICA ESPECIAL PARA RAS === ---
    let var_curva_tot = Math.pow(u_curva_total_rel, 2);

    if (esRAS) {
        // En RAS la varianza de preparación de patrones y de la curva
        // es la suma de las contribuciones de Ca, Mg y Na (3x)
        prepsCalc.forEach(p => { p.varSq *= 3; p.uRel = Math.sqrt(p.varSq); });
        var_curva_tot *= 3;
        var_prep_curva *= 3;
        u_curva_total_rel = Math.sqrt(var_curva_tot);
    }

    // Varianza total de la preparación de patrones (de trabajo y de control: todas las preparaciones)
    const var_prep_trab = prepsCalc.reduce((acc, p) => acc + p.varSq, 0);

    // U combinada relativa de los patrones de control:
    //   raíz( Σ u_estándar² ) de las incertidumbres estándar (alícuota y volumen final) de los seleccionados
    const prepsTrabajoCalc = prepsCalc.filter(p => !p.control);
    const prepsControlCalc = prepsCalc.filter(p => p.control);
    const var_control = prepsControlCalc.reduce((acc, p) => acc + p.varSq, 0);
    const u_control_rel = Math.sqrt(var_control);

    // --- 7. COMBINACIÓN TOTAL Y EXPANDIDA ---
    const var_estandarizacion = Math.pow(u_estandarizacion_rel, 2);
    const var_total = Math.pow(u_A_rel, 2) + Math.pow(u_patron_rel, 2) + var_prep_trab + var_prep_curva + var_curva_tot + Math.pow(u_muestra_rel, 2) + var_estandarizacion;
    const u_c_total = Math.sqrt(var_total);

    // Factor Expandido Relativo y Porcentual (k=2 para 95% de confianza)
    const u_expandida_rel = 2 * u_c_total;
    const u_expandida_porc = u_expandida_rel * 100;

    const porc = (val_sq) => var_total > 0 ? ((val_sq / var_total) * 100).toFixed(1) + '%' : '0.0%';

    // --- Filas del presupuesto (única fuente para la tabla, el gráfico y el informe) ---
    const COLORES_PREP = ['#f59e0b', '#fb923c', '#fbbf24', '#d97706', '#ea580c', '#fcd34d', '#b45309', '#fdba74'];
    const n_trab = prepsTrabajoCalc.length;
    const hayControl = prepsControlCalc.length > 0;
    const n_grupo3 = n_trab + (hayControl ? 1 : 0);
    const filas = [];

    filas.push({
        txt: `1. Repetibilidad LCM (${analistaSel})`,
        html: `1. Repetibilidad LCM (${analistaSel})`,
        tipo: 'Tipo A',
        detalle: `s = ${(lcmStats.desviacion || 0).toFixed(4)}`,
        uRel: u_A_rel, varSq: Math.pow(u_A_rel, 2),
        corto: '1. Tipo A (LCM)', color: '#2563eb'
    });

    filas.push({
        txt: '2. Patrón Certificable (CRM)',
        html: '2. Patrón Certificable (CRM)',
        tipo: 'Tipo B',
        detalle: usaPatron ? '2 / 1000' : 'N/A',
        uRel: u_patron_rel, varSq: Math.pow(u_patron_rel, 2),
        corto: '2. Patrón (CRM)', color: '#10b981'
    });

    let k3 = 0;
    prepsTrabajoCalc.forEach((p, i) => {
        k3++;
        const prefijo = n_grupo3 > 1 ? `3.${k3}` : '3';
        const concTxt = p.conc ? ` ${p.conc} mg/L` : (n_trab > 1 ? ` #${i + 1}` : '');
        const modo = p.peso > 0 ? '(Pesada)' : '(Volumen)';
        const sufijoTxt = esRAS ? '(Suma 3 Cationes)' : modo;
        const sufijoHtml = esRAS ? '<span class="text-xs text-blue-600 font-semibold">(Suma 3 Cationes)</span>' : modo;
        const tag = _escAttr(concTxt);
        filas.push({
            txt: `${prefijo} Prep. Patrón Trabajo${concTxt} ${sufijoTxt}`,
            html: `${prefijo} Prep. Patrón Trabajo${tag} ${sufijoHtml}`,
            tipo: 'Tipo B',
            detalle: `${p.peso > 0 ? p.peso + ' g' : p.alic + ' mL'} → ${p.volFinal} mL`,
            uRel: p.uRel, varSq: p.varSq,
            corto: n_grupo3 > 1 ? `3.${k3} Prep. Trabajo${concTxt}` : '3. Prep. Trabajo',
            color: COLORES_PREP[i % COLORES_PREP.length]
        });
    });

    // Fila única de Patrones de Control (combina alícuotas y volúmenes de todos los seleccionados)
    if (hayControl) {
        k3++;
        const prefijo = n_grupo3 > 1 ? `3.${k3}` : '3';
        const nC = prepsControlCalc.length;
        const concsC = prepsControlCalc.map(p => p.conc).filter(Boolean);
        const detalleC = `${nC} ${nC > 1 ? 'patrones' : 'patrón'}${concsC.length ? ` (${_escAttr(concsC.join(' / '))} mg/L)` : ''}`;
        filas.push({
            txt: `${prefijo} Patrones de Control ${esRAS ? '(Suma 3 Cationes)' : ''}`.trim(),
            html: `${prefijo} Patrones de Control ${esRAS ? '<span class="text-xs text-blue-600 font-semibold">(Suma 3 Cationes)</span>' : ''}`.trim(),
            tipo: 'Tipo B',
            detalle: detalleC,
            uRel: u_control_rel, varSq: var_control,
            corto: `${prefijo} Patrones de Control`,
            color: '#0891b2'
        });
    }

    const sufRAS = esRAS ? ' (Suma 3 Cationes)' : '';
    const sufRASHtml = esRAS ? ' <span class="text-xs text-blue-600 font-semibold">(Suma 3 Cationes)</span>' : '';
    filas.push({
        txt: `4.1 Preparación de la Curva${sufRAS}`,
        html: `4.1 Preparación de la Curva${sufRASHtml}`,
        tipo: 'Tipo B',
        detalle: n_puntos_prep > 0 ? `${n_puntos_prep} ${n_puntos_prep > 1 ? 'puntos' : 'punto'}` : 'N/A',
        uRel: Math.sqrt(var_prep_curva), varSq: var_prep_curva,
        corto: '4.1 Prep. Curva', color: '#6d28d9'
    });
    filas.push({
        txt: `4.2 Interpolación de la Curva${sufRAS}`,
        html: `4.2 Interpolación de la Curva${sufRASHtml}`,
        tipo: 'Tipo B',
        detalle: `s_res = ${s_res.toFixed(4)}`,
        uRel: u_curva_total_rel, varSq: var_curva_tot,
        corto: '4.2 Interpolación', color: '#a78bfa'
    });

    filas.push({
        txt: `5. Trat. Muestra ${pesoMuestra > 0 ? '(Pesada)' : '(Volumen)'}${usaVolFinalMuestra ? ' + Aforo' : ''}`,
        html: `5. Trat. Muestra ${pesoMuestra > 0 ? '(Pesada)' : '(Volumen)'}${usaVolFinalMuestra ? ' + Aforo' : ''}`,
        tipo: 'Tipo B',
        detalle: pesoMuestra > 0 ? `${pesoMuestra} g` : `${alicuotaMuestra} mL`,
        uRel: u_muestra_rel, varSq: Math.pow(u_muestra_rel, 2),
        corto: '5. Toma Muestra', color: '#ec4899'
    });

    filas.push({
        txt: `6. Estandarización del Titulante ${estandarizacionInfo.existe ? `(${estandarizacionInfo.tabs.length} titulante${estandarizacionInfo.tabs.length > 1 ? 's' : ''})` : '(sin datos)'}`,
        html: `6. Estandarización del Titulante ${estandarizacionInfo.existe ? `<span class="text-xs text-purple-600 font-semibold">(${estandarizacionInfo.tabs.length} titulante${estandarizacionInfo.tabs.length > 1 ? 's' : ''})</span>` : '<span class="text-xs text-slate-400 font-normal">(sin datos)</span>'}`,
        tipo: 'Tipo B',
        detalle: estandarizacionInfo.existe ? 'Triplicado' : 'N/A',
        uRel: u_estandarizacion_rel, varSq: var_estandarizacion,
        corto: '6. Estandarización', color: '#a855f7'
    });

    const tbody = document.getElementById('tablaResumenIncertidumbre');
    if (tbody) {
        tbody.innerHTML = filas.map((f, i) => `
            <tr class="hover:bg-slate-50 ${i % 2 ? 'bg-slate-50/60 ' : ''}transition">
                <td class="border border-slate-300 p-2.5 text-slate-800">${f.html}</td>
                <td class="border border-slate-300 p-2.5 text-center font-bold ${f.tipo === 'Tipo A' ? 'text-blue-600' : 'text-emerald-600'}">${f.tipo}</td>
                <td class="border border-slate-300 p-2.5 text-right font-mono text-slate-600">${f.detalle}</td>
                <td class="border border-slate-300 p-2.5 text-right font-mono font-bold text-slate-700">${f.uRel.toFixed(5)}</td>
                <td class="border border-slate-300 p-2.5 text-right font-bold text-indigo-600">${porc(f.varSq)}</td>
            </tr>`).join('');
    }

    if (document.getElementById('val-uc-total')) {
        document.getElementById('val-uc-total').innerText = u_c_total.toFixed(5);
        document.getElementById('val-u-expandida').innerText = `± ${u_expandida_rel.toFixed(5)}`;
        if (document.getElementById('val-u-expandida-porc')) {
            document.getElementById('val-u-expandida-porc').innerText = `± ${u_expandida_porc.toFixed(2)}% del valor reportado`;
        }
    }

    // --- 8. RENDERIZAR GRÁFICO DE ANILLO (DOUGHNUT CHART) ---
    const varianzasComponentes = filas.map(f => f.varSq);
    window.renderizarGraficoIncertidumbre(varianzasComponentes, filas.map(f => f.corto), filas.map(f => f.color));

    // --- 9. PERSISTIR EL RESULTADO COMO DATOS (no como HTML/canvas) ---
    // El informe (informe-datos.js) lee esto directamente en vez de recalcular
    // con una fórmula propia y duplicada, y en vez de intentar clonar nodos del
    // DOM de esta vista (que dejan de existir en cuanto el router cambia de
    // pestaña). Esta es la única fuente de verdad para el presupuesto de
    // incertidumbre de cada elemento.
    if (window.datosGlobales && window.elementoActivo && window.datosGlobales[window.elementoActivo]) {
        window.datosGlobales[window.elementoActivo].resultadoIncertidumbre = {
            filas: filas.map(f => ({
                fuente: f.txt,
                tipo: f.tipo,
                detalle: f.detalle,
                uRel: f.uRel,
                varSq: f.varSq
            })),
            varianzas: varianzasComponentes,
            puntosCurva: puntosCalc,
            colores: filas.map(f => f.color),
            var_total,
            u_c_total,
            u_expandida_rel,
            u_expandida_porc,
            timestamp: Date.now()
        };
    }
};

/**
 * Renderiza o actualiza el Gráfico de Anillo de contribución a la varianza usando Chart.js
 */
window.renderizarGraficoIncertidumbre = function (varianzas, etiquetas, colores) {
    const canvasElement = document.getElementById('chartIncertidumbre');
    if (!canvasElement) return;
    const ctx = canvasElement.getContext('2d');

    if (window.chartIncertidumbreInstance) {
        window.chartIncertidumbreInstance.destroy();
    }

    window.chartIncertidumbreInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: etiquetas || ['1. Tipo A (LCM)', '2. Patrón (CRM)', '3. Prep. Trabajo', '4. Curva Calib.', '5. Toma Muestra', '6. Estandarización'],
            datasets: [{
                data: varianzas,
                backgroundColor: colores || ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#a855f7'],
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

    const checkVolFinalMuestra = document.getElementById('checkVolFinalMuestra');
    if (checkVolFinalMuestra) config.checkVolFinalMuestra = checkVolFinalMuestra.checked;

    // 2. Guardar los Inputs numéricos y Selects
    const idsCampos = [
        'selAnalistaTipoA', 'inpAlicuotaMuestra', 'inpPesoMuestra',
        'selVolFinalMuestra'
    ];

    idsCampos.forEach(id => {
        const el = document.getElementById(id);
        if (el) config[id] = el.value;
    });

    // 3. Guardar las preparaciones del patrón de trabajo (lista dinámica)
    // Solo si el array en memoria pertenece a este elemento (evita copiar el de otro al cambiar).
    if (Array.isArray(window.preparacionesTrabajo) && window._prepElemento === window.elementoActivo) {
        config.preparaciones = JSON.parse(JSON.stringify(window.preparacionesTrabajo));
    }

    // 3b. Guardar alícuota / volumen final de cada punto de la curva. Si la linealidad aún no
    // está cargada (0 puntos), se conserva lo guardado antes en vez de pisarlo con una lista vacía.
    const cfgPrevia = window.datosGlobales[window.elementoActivo].configIncertidumbre;
    if (Array.isArray(window.puntosCurva) && window.puntosCurva.length > 0 && window._puntosElemento === window.elementoActivo) {
        config.puntosCurva = JSON.parse(JSON.stringify(window.puntosCurva));
    } else if (cfgPrevia && cfgPrevia.puntosCurva) {
        config.puntosCurva = cfgPrevia.puntosCurva;
    }

    // 4. Guardar el instrumento elegido para Toma de Muestra y Curva de Calibración
    config.instMuestra = JSON.parse(JSON.stringify(window.instMuestra));
    config.instCurva = JSON.parse(JSON.stringify(window.instCurva));

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

    // Preparaciones del patrón de trabajo: se restauran (o se dejan en 1 por defecto) siempre
    window.inicializarPreparacionesDesdeConfig(config);
    window.inicializarPuntosCurvaDesdeConfig(config);

    // Instrumento de Toma de Muestra y de Curva de Calibración (por defecto: Pipeta Aforada)
    window.instMuestra = (config && config.instMuestra) ? config.instMuestra : { categoria: 'pipeta', codigo: null, volNominal: null };
    window.instCurva = (config && config.instCurva) ? config.instCurva : { categoria: 'pipeta', codigo: null, volNominal: null };
    window.renderizarSelectorInstrumentoMuestra();
    window.renderizarSelectorInstrumentoCurva();

    // Si nunca se ha configurado este elemento, dejamos los valores por defecto del HTML
    if (!config) return;

    // 1. Restaurar Checkbox
    const checkPatron = document.getElementById('checkPatronCert');
    if (checkPatron && config.checkPatronCert !== undefined) {
        checkPatron.checked = config.checkPatronCert;
    }

    const checkVolFinalMuestra = document.getElementById('checkVolFinalMuestra');
    if (checkVolFinalMuestra && config.checkVolFinalMuestra !== undefined) {
        checkVolFinalMuestra.checked = config.checkVolFinalMuestra;
        if (typeof window.toggleVolFinalMuestra === 'function') window.toggleVolFinalMuestra();
    }

    // 2. Restaurar Inputs numéricos y Selects
    const idsCampos = [
        'selAnalistaTipoA', 'inpAlicuotaMuestra', 'inpPesoMuestra',
        'selVolFinalMuestra'
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