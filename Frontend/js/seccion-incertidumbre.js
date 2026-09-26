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
        u_alicuota_trab_rel = window.calcularU_BalanzaGramos(pesoTrab);
    } else {
        // Alícuota volumétrica
        u_alicuota_trab_rel = window.calcUVolumetricaRel(alicuotaTrab, 'pipeta', instTrab);
    }
    const u_vol_final_trab_rel = window.calcUVolumetricaRel(volFinalTrab, 'balon', null);
    let u_prep_trabajo_rel = Math.sqrt(Math.pow(u_alicuota_trab_rel, 2) + Math.pow(u_vol_final_trab_rel, 2));

    // --- 4. INCERTIDUMBRE TIPO B: INTERPOLACIÓN DE LA CURVA DE CALIBRACIÓN ---
    let u_curva_total_rel = 0;
    let s_res = 0;

    if (linData && linData.tabla && linData.tabla.length > 1) {
        // A) Parámetros promedio globales de la curva
        const p_curvas = (linData.curvas_raw && linData.curvas_raw.length > 0) ? linData.curvas_raw.length : 3;
        const m_prom = linData.stats?.promedio_pendientes_raw || linData.stats?.promedio_pendientes || 1;
        const b_prom = linData.stats?.intercepto_raw || linData.stats?.intercepto || 0;

        // B) Concentración alta (último punto) y baja (primer punto)
        const pt_high = linData.tabla[linData.tabla.length - 1];
        const pt_low = linData.tabla[0];
        const C_alta = pt_high.concentracion;
        const C_baja = pt_low.concentracion;

        // C) Concentración media (Cm)
        const n_puntos = linData.tabla.length;
        const sum_conc = linData.tabla.reduce((acc, pt) => acc + pt.concentracion, 0);
        const C_media = sum_conc / n_puntos;

        // D) Número total de datos (N_total) e Intensidad media (Int media)
        let N_total = 0;
        let sum_intensidades = 0;

        linData.tabla.forEach(pt => {
            const senales = (pt.señales && Array.isArray(pt.señales) && pt.señales.length > 0) 
                ? pt.señales 
                : [pt.promedio];
            senales.forEach(sig => {
                N_total++;
                sum_intensidades += sig;
            });
        });

        const Int_media = N_total > 0 ? (sum_intensidades / N_total) : 0;

        // E) Evaluación de cada señal para Desviación Estándar Residual (s_res)
        let sumatoria_cuadrados = 0;

        linData.tabla.forEach(pt => {
            const senales = (pt.señales && Array.isArray(pt.señales) && pt.señales.length > 0) 
                ? pt.señales 
                : [pt.promedio];
            
            // Concentración real del punto
            const C_real = pt.concentracion;
            const Int_calc = (m_prom * C_real) + b_prom;

            senales.forEach(sig => {
                const int_diff = sig - Int_calc;
                sumatoria_cuadrados += (int_diff * int_diff);
            });
        });

        const df_res = (N_total - 2) > 0 ? (N_total - 2) : 1;
        s_res = Math.sqrt(sumatoria_cuadrados / df_res);

        // F) Sumatoria de cuadrados de concentración (Ci - Cm)^2 y m^2 * sumatoria
        let sumatoria_cua_conc = 0;

        linData.tabla.forEach(pt => {
            const senales = (pt.señales && Array.isArray(pt.señales) && pt.señales.length > 0) 
                ? pt.señales 
                : [pt.promedio];
            
            const Ci_Cm = pt.concentracion - C_media;
            const Ci_Cm2 = Ci_Cm * Ci_Cm;
            sumatoria_cua_conc += (Ci_Cm2 * senales.length);
        });

        const m2_sumatoria_cua_conc = Math.pow(m_prom, 2) * sumatoria_cua_conc;

        // G) Cálculos para punto alto y punto bajo (Int Pr, Int res 2)
        const Int_Pr_alta = pt_high.promedio;
        const diff_alta = Int_Pr_alta - Int_media;
        const Int_res2_alta = diff_alta * diff_alta;

        const Int_Pr_baja = pt_low.promedio;
        const diff_baja = Int_Pr_baja - Int_media;
        const Int_res2_baja = diff_baja * diff_baja;

        // H) Incertidumbre estándar individual de punto alto y bajo
        const denom_m = Math.abs(m_prom) > 0 ? Math.abs(m_prom) : 1;
        const div_m2_Sxx = m2_sumatoria_cua_conc > 0 ? m2_sumatoria_cua_conc : 1;

        const u_interp_high = (s_res / denom_m) * Math.sqrt(
            (1 / p_curvas) + (1 / N_total) + (Int_res2_alta / div_m2_Sxx)
        );

        const u_interp_low = (s_res / denom_m) * Math.sqrt(
            (1 / p_curvas) + (1 / N_total) + (Int_res2_baja / div_m2_Sxx)
        );

        // I) Incertidumbre estándar combinada relativa de la interpolación
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

    // --- 7. COMBINACIÓN TOTAL Y EXPANDIDA ---
    const var_estandarizacion = Math.pow(u_estandarizacion_rel, 2);
    const var_total = Math.pow(u_A_rel, 2) + Math.pow(u_patron_rel, 2) + var_prep_trab + var_curva_tot + Math.pow(u_muestra_rel, 2) + var_estandarizacion;
    const u_c_total = Math.sqrt(var_total);

    // Factor Expandido Relativo y Porcentual (k=2 para 95% de confianza)
    const u_expandida_rel = 2 * u_c_total;
    const u_expandida_porc = u_expandida_rel * 100;

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
                <td class="border border-slate-300 p-2.5 text-slate-800">5. Trat. Muestra ${pesoMuestra > 0 ? '(Pesada)' : '(Volumen)'}${usaVolFinalMuestra ? ' + Aforo' : ''}</td>
                <td class="border border-slate-300 p-2.5 text-center font-bold text-emerald-600">Tipo B</td>
                <td class="border border-slate-300 p-2.5 text-right font-mono text-slate-600">${pesoMuestra > 0 ? pesoMuestra + ' g' : alicuotaMuestra + ' mL'}</td>
                <td class="border border-slate-300 p-2.5 text-right font-mono font-bold text-slate-700">${u_muestra_rel.toFixed(5)}</td>
                <td class="border border-slate-300 p-2.5 text-right font-bold text-indigo-600">${porc(Math.pow(u_muestra_rel, 2))}</td>
            </tr>
            <tr class="hover:bg-slate-50 bg-slate-50/60 transition">
                <td class="border border-slate-300 p-2.5 text-slate-800">6. Estandarización del Titulante ${estandarizacionInfo.existe ? `<span class="text-xs text-purple-600 font-semibold">(${estandarizacionInfo.tabs.length} titulante${estandarizacionInfo.tabs.length > 1 ? 's' : ''})</span>` : '<span class="text-xs text-slate-400 font-normal">(sin datos)</span>'}</td>
                <td class="border border-slate-300 p-2.5 text-center font-bold text-emerald-600">Tipo B</td>
                <td class="border border-slate-300 p-2.5 text-right font-mono text-slate-600">${estandarizacionInfo.existe ? 'Triplicado' : 'N/A'}</td>
                <td class="border border-slate-300 p-2.5 text-right font-mono font-bold text-slate-700">${u_estandarizacion_rel.toFixed(5)}</td>
                <td class="border border-slate-300 p-2.5 text-right font-bold text-indigo-600">${porc(var_estandarizacion)}</td>
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
    const varianzasComponentes = [
        Math.pow(u_A_rel, 2),
        Math.pow(u_patron_rel, 2),
        var_prep_trab,
        var_curva_tot,
        Math.pow(u_muestra_rel, 2),
        var_estandarizacion
    ];
    window.renderizarGraficoIncertidumbre(varianzasComponentes);

    // --- 9. PERSISTIR EL RESULTADO COMO DATOS (no como HTML/canvas) ---
    // El informe (informe-datos.js) lee esto directamente en vez de recalcular
    // con una fórmula propia y duplicada, y en vez de intentar clonar nodos del
    // DOM de esta vista (que dejan de existir en cuanto el router cambia de
    // pestaña). Esta es la única fuente de verdad para el presupuesto de
    // incertidumbre de cada elemento.
    if (window.datosGlobales && window.elementoActivo && window.datosGlobales[window.elementoActivo]) {
        window.datosGlobales[window.elementoActivo].resultadoIncertidumbre = {
            filas: [
                {
                    fuente: `1. Repetibilidad LCM (${analistaSel})`,
                    tipo: 'Tipo A',
                    detalle: `s = ${(lcmStats.desviacion || 0).toFixed(4)}`,
                    uRel: u_A_rel,
                    varSq: Math.pow(u_A_rel, 2)
                },
                {
                    fuente: '2. Patrón Certificable (CRM)',
                    tipo: 'Tipo B',
                    detalle: usaPatron ? '2 / 1000' : 'N/A',
                    uRel: u_patron_rel,
                    varSq: Math.pow(u_patron_rel, 2)
                },
                {
                    fuente: `3. Prep. Patrón Trabajo ${esRAS ? '(Suma 3 Cationes)' : (pesoTrab > 0 ? '(Pesada)' : '(Volumen)')}`,
                    tipo: 'Tipo B',
                    detalle: pesoTrab > 0 ? `${pesoTrab} g` : `${alicuotaTrab} mL`,
                    uRel: u_prep_trabajo_rel,
                    varSq: var_prep_trab
                },
                {
                    fuente: `4. Curva de Calibración ${esRAS ? '(Suma 3 Cationes)' : '(Prep + Regresión)'}`,
                    tipo: 'Tipo B',
                    detalle: `s_res = ${s_res.toFixed(4)}`,
                    uRel: u_curva_total_rel,
                    varSq: var_curva_tot
                },
                {
                    fuente: `5. Trat. Muestra ${pesoMuestra > 0 ? '(Pesada)' : '(Volumen)'}${usaVolFinalMuestra ? ' + Aforo' : ''}`,
                    tipo: 'Tipo B',
                    detalle: pesoMuestra > 0 ? `${pesoMuestra} g` : `${alicuotaMuestra} mL`,
                    uRel: u_muestra_rel,
                    varSq: Math.pow(u_muestra_rel, 2)
                },
                {
                    fuente: `6. Estandarización del Titulante ${estandarizacionInfo.existe ? `(${estandarizacionInfo.tabs.length} titulante${estandarizacionInfo.tabs.length > 1 ? 's' : ''})` : '(sin datos)'}`,
                    tipo: 'Tipo B',
                    detalle: estandarizacionInfo.existe ? 'Triplicado' : 'N/A',
                    uRel: u_estandarizacion_rel,
                    varSq: var_estandarizacion
                }
            ],
            varianzas: varianzasComponentes,
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
            labels: ['1. Tipo A (LCM)', '2. Patrón (CRM)', '3. Prep. Trabajo', '4. Curva Calib.', '5. Toma Muestra', '6. Estandarización'],
            datasets: [{
                data: varianzas,
                backgroundColor: ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#a855f7'],
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
        'inpAlicuotaTrabajo', 'inpPesoTrabajo', 'selInstTrabajo',
        'selVolFinalTrabajo', 'selInstCurva', 'selVolFinalCurva',
        'selAnalistaTipoA', 'inpAlicuotaMuestra', 'inpPesoMuestra',
        'selInstMuestra', 'selVolFinalMuestra'
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

    const checkVolFinalMuestra = document.getElementById('checkVolFinalMuestra');
    if (checkVolFinalMuestra && config.checkVolFinalMuestra !== undefined) {
        checkVolFinalMuestra.checked = config.checkVolFinalMuestra;
        if(typeof window.toggleVolFinalMuestra === 'function') window.toggleVolFinalMuestra();
    }

    // 2. Restaurar Inputs numéricos y Selects
    const idsCampos = [
        'inpAlicuotaTrabajo', 'inpPesoTrabajo', 'selInstTrabajo',
        'selVolFinalTrabajo', 'selInstCurva', 'selVolFinalCurva',
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