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
        "trans_100_1000": 0.0945, // Según certificado oficial del laboratorio
        "trans_1_10ml": 0.0007
    },
    balanza: 1.9e-04,  // Balanza Analítica Precisa XB 220 A
    delta_T: 3,        // Variación T°C en el laboratorio (±3 °C)
    gamma_H2O: 0.00021 // Coeficiente de dilatación térmica del agua (°C^-1)
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

window.OPCIONES_INST_PREP = [
    ['pipeta', 'Pipeta Aforada (Tabla Metrológica)'],
    ['trans_0.5_10', 'Transferpipeta (0.5 a 10 µL) - U: 0.0085'],
    ['trans_10_100', 'Transferpipeta (10 a 100 µL) - U: 0.0801'],
    ['trans_100_1000', 'Transferpipeta (100 a 1000 µL) - U: 0.7511'],
    ['trans_1_10ml', 'Transferpipeta (1 a 10 mL) - U: 0.0080'],
    ['balanza', 'Balanza Analitica']
];
window.OPCIONES_VOLFINAL_PREP = [
    ['50', '50 mL (±0.100 mL)'],
    ['100', '100 mL (±0.100 mL)'],
    ['250', '250 mL (±0.120 mL)'],
    ['500', '500 mL (±0.250 mL)'],
    ['1000', '1000 mL (±0.400 mL)']
];

window.preparacionTrabajoDefault = function () {
    return { conc: '', alicuota: 5, peso: 0, inst: 'pipeta', volFinal: 100 };
};

const _escAttr = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Arma el array en memoria a partir de la configuración guardada. Soporta el formato
 * anterior (una sola preparación en inpAlicuotaTrabajo / inpPesoTrabajo / ...).
 */
window.inicializarPreparacionesDesdeConfig = function (config) {
    let lista;
    if (config && Array.isArray(config.preparaciones) && config.preparaciones.length > 0) {
        lista = config.preparaciones.map(p => Object.assign(window.preparacionTrabajoDefault(), p));
    } else if (config && (config.inpAlicuotaTrabajo !== undefined || config.inpPesoTrabajo !== undefined)) {
        lista = [Object.assign(window.preparacionTrabajoDefault(), {
            alicuota: config.inpAlicuotaTrabajo ?? 5,
            peso: config.inpPesoTrabajo ?? 0,
            inst: config.selInstTrabajo || 'pipeta',
            volFinal: config.selVolFinalTrabajo || 100
        })];
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
        const optsInst = window.OPCIONES_INST_PREP.map(([v, t]) =>
            `<option value="${v}" ${p.inst === v ? 'selected' : ''}>${t}</option>`).join('');
        const optsVol = window.OPCIONES_VOLFINAL_PREP.map(([v, t]) =>
            `<option value="${v}" ${String(p.volFinal) === v ? 'selected' : ''}>${t}</option>`).join('');

        return `
        <div class="border border-slate-200 rounded-lg p-3 bg-slate-50/60 space-y-2">
            <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-indigo-700">Preparación ${i + 1}</span>
                ${preps.length > 1 ? `<button type="button" onclick="window.eliminarPreparacionTrabajo(${i})"
                    class="text-[11px] font-semibold text-red-600 hover:text-red-800 cursor-pointer">Eliminar</button>` : ''}
            </div>

            <div>
                <label class="block text-xs font-semibold text-slate-600">Concentración del patrón (mg/L) <span class="text-[10px] text-slate-400 font-normal">(opcional, solo identifica)</span>:</label>
                <input type="text" value="${_escAttr(p.conc)}" placeholder="Ej: 250"
                    oninput="window.actualizarPreparacionTrabajo(${i}, 'conc', this.value)"
                    class="w-full border border-slate-300 rounded p-1.5 text-sm font-mono font-bold text-slate-700 bg-white">
            </div>

            <div class="grid grid-cols-2 gap-2">
                <div>
                    <label class="block text-xs font-semibold text-slate-600">Alícuota (mL):</label>
                    <input type="number" value="${_escAttr(p.alicuota)}" step="0.1"
                        oninput="window.actualizarPreparacionTrabajo(${i}, 'alicuota', this.value)"
                        class="w-full border border-slate-300 rounded p-1.5 text-sm font-mono font-bold text-blue-600 bg-white">
                </div>
                <div>
                    <label class="block text-xs font-semibold text-slate-600">Peso (g) <span class="text-[10px] text-amber-600 font-normal">(0=Volumen)</span>:</label>
                    <input type="number" value="${_escAttr(p.peso)}" step="0.0001"
                        oninput="window.actualizarPreparacionTrabajo(${i}, 'peso', this.value)"
                        class="w-full border border-slate-300 rounded p-1.5 text-sm font-mono font-bold text-emerald-600 bg-white">
                </div>
            </div>

            <div>
                <label class="block text-xs font-semibold text-slate-600">Instrumento de Alícuota:</label>
                <select onchange="window.actualizarPreparacionTrabajo(${i}, 'inst', this.value)"
                    class="w-full border border-slate-300 rounded p-1.5 text-xs font-semibold bg-white mt-1 cursor-pointer">${optsInst}</select>
            </div>

            <div>
                <label class="block text-xs font-semibold text-slate-600">Volumen Final (mL) - Balón Aforado:</label>
                <select onchange="window.actualizarPreparacionTrabajo(${i}, 'volFinal', this.value)"
                    class="w-full border border-slate-300 rounded p-1.5 text-xs font-semibold bg-white mt-1 cursor-pointer">${optsVol}</select>
            </div>
        </div>`;
    }).join('');
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

// Función para el nuevo cálculo de incertidumbre estandar de la balanza en gramos
window.calcularU_BalanzaGramos = function (valorPesado) {
    if (valorPesado <= 0) return 0;

    // 1. Incertidumbre de balanza = (1.9e-04 * valor_pesado) / 2
    const u_balanza = (window.TABLA_METROLOGIA.balanza * valorPesado) / 2;

    // 2. Primera incertidumbre estándar = u_balanza / raiz(3)
    const u_estandar_1 = u_balanza / Math.sqrt(3);

    // 3. Suma de incertidumbres = raiz(u_balanza^2 + u_estandar_1^2)
    const suma_incertidumbres = Math.sqrt(Math.pow(u_balanza, 2) + Math.pow(u_estandar_1, 2));

    // 4. Segunda incertidumbre estándar relativa (la que se usa para u combinada relativa)
    const u_estandar_2 = suma_incertidumbres / valorPesado;

    return u_estandar_2;
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
    // Una fila independiente por cada preparación (p. ej. patrones de 250, 50 y 5 mg/L).
    // Cada una combina su alícuota (pesada o volumétrica) con su aforo final; las varianzas
    // de todas las preparaciones se suman después en la varianza total.
    const num = (v, def) => { const n = parseFloat(v); return isNaN(n) ? def : n; };
    const prepsCalc = window.preparacionesTrabajo.map((p) => {
        const alic = num(p.alicuota, 0);
        const peso = num(p.peso, 0);
        const volFinal = num(p.volFinal, 100);
        const u_alic = peso > 0
            ? window.calcularU_BalanzaGramos(peso)                                   // Pesada (balanza)
            : window.calcUVolumetricaRel(alic, 'pipeta', p.inst || 'pipeta');         // Volumétrica
        const u_vf = window.calcUVolumetricaRel(volFinal, 'balon', null);
        const uRel = Math.sqrt(Math.pow(u_alic, 2) + Math.pow(u_vf, 2));
        return { conc: String(p.conc ?? '').trim(), alic, peso, volFinal, uRel, varSq: Math.pow(uRel, 2) };
    });

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
    const instMuestra = document.getElementById('selInstMuestra')?.value || "pipeta";
    const usaVolFinalMuestra = document.getElementById('checkVolFinalMuestra')?.checked || false;
    const volFinalMuestra = parseFloat(document.getElementById('selVolFinalMuestra')?.value || 50);

    let u_alicuota_muestra_rel = 0;

    if (pesoMuestra > 0) {
        // Si hay un valor mayor a cero en peso, calcula la incertidumbre con la nueva fórmula para balanzas
        u_alicuota_muestra_rel = window.calcularU_BalanzaGramos(pesoMuestra);
    } else {
        // De lo contrario, calcula la incertidumbre volumétrica usando el instrumento seleccionado
        u_alicuota_muestra_rel = window.calcUVolumetricaRel(alicuotaMuestra, 'pipeta', instMuestra);
    }

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
        u_curva_total_rel = Math.sqrt(var_curva_tot);
    }

    // Varianza total de la preparación de patrones de trabajo (suma de todas las preparaciones)
    const var_prep_trab = prepsCalc.reduce((acc, p) => acc + p.varSq, 0);

    // --- 7. COMBINACIÓN TOTAL Y EXPANDIDA ---
    const var_estandarizacion = Math.pow(u_estandarizacion_rel, 2);
    const var_total = Math.pow(u_A_rel, 2) + Math.pow(u_patron_rel, 2) + var_prep_trab + var_curva_tot + Math.pow(u_muestra_rel, 2) + var_estandarizacion;
    const u_c_total = Math.sqrt(var_total);

    // Factor Expandido Relativo y Porcentual (k=2 para 95% de confianza)
    const u_expandida_rel = 2 * u_c_total;
    const u_expandida_porc = u_expandida_rel * 100;

    const porc = (val_sq) => var_total > 0 ? ((val_sq / var_total) * 100).toFixed(1) + '%' : '0.0%';

    // --- Filas del presupuesto (única fuente para la tabla, el gráfico y el informe) ---
    const COLORES_PREP = ['#f59e0b', '#fb923c', '#fbbf24', '#d97706', '#ea580c', '#fcd34d', '#b45309', '#fdba74'];
    const n_preps = prepsCalc.length;
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

    prepsCalc.forEach((p, i) => {
        const prefijo = n_preps > 1 ? `3.${i + 1}` : '3';
        const concTxt = p.conc ? ` ${p.conc} mg/L` : (n_preps > 1 ? ` #${i + 1}` : '');
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
            corto: n_preps > 1 ? `3.${i + 1} Prep. Trabajo${concTxt}` : '3. Prep. Trabajo',
            color: COLORES_PREP[i % COLORES_PREP.length]
        });
    });

    filas.push({
        txt: `4. Curva de Calibración ${esRAS ? '(Suma 3 Cationes)' : '(Prep + Regresión)'}`,
        html: `4. Curva de Calibración ${esRAS ? '<span class="text-xs text-blue-600 font-semibold">(Suma 3 Cationes)</span>' : '(Prep + Regresión)'}`,
        tipo: 'Tipo B',
        detalle: `s_res = ${s_res.toFixed(4)}`,
        uRel: u_curva_total_rel, varSq: var_curva_tot,
        corto: '4. Curva Calib.', color: '#8b5cf6'
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
        'selInstCurva', 'selVolFinalCurva',
        'selAnalistaTipoA', 'inpAlicuotaMuestra', 'inpPesoMuestra',
        'selInstMuestra', 'selVolFinalMuestra'
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
        'selInstCurva', 'selVolFinalCurva',
        'selAnalistaTipoA', 'inpAlicuotaMuestra', 'inpPesoMuestra',
        'selInstMuestra', 'selVolFinalMuestra'
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