/**
 * SECCIÓN 4 - EXACTITUD, RECUPERACIÓN Y TEST DE GRUBBS
 * -----------------------------------------------------------------------
 * calcularExactitudGrupo, dibujarGraficoRecuperacion y renderizarExactitud:
 * detección de atípicos (Grubbs) y métricas de % error / % recuperación.
 * Depende de core-estado.js y core-navegacion.js.
 * -----------------------------------------------------------------------
 */

window.chartExactitudInstancia = null;

// Paleta de identidad por analista, compartida visualmente con la sección de Precisión
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

window.chartMuestrasInstancia = null;
window.matrizActivaMuestra = null;

// Nombres amigables para el título de la tabla y mapeo hacia los IDs de pestaña en el HTML
window.ETIQUETAS_MATRIZ = {
    'agua superficial': 'AGUA SUPERFICIAL',
    'agua subterranea': 'AGUA SUBTERRÁNEA',
    'ar domestica': 'AGUA RESIDUAL DOMÉSTICA',
    'ar no domestica': 'AGUA RESIDUAL NO DOMÉSTICA',
    'arenoso': 'SUELO ARENOSO',
    'arcilloso': 'SUELO ARCILLOSO',
    'limoso': 'SUELO LIMOSO'
};

/**
 * Matrices que se pueden mostrar según lo que eligió el usuario al cargar:
 *  - 'suelos'  -> solo submatrices de suelo (arenoso, arcilloso, limoso)
 *  - cualquier otro -> solo matrices de agua
 */
window.obtenerMatricesPermitidas = function () {
    const esSuelos = window.tipoAnalisisActual === 'suelos';
    return esSuelos
        ? ['arenoso', 'arcilloso', 'limoso']
        : ['agua superficial', 'agua subterranea', 'ar domestica', 'ar no domestica'];
};

/**
 * Muestra solo las pestañas de matriz que aplican (según data-matriz-tipo) y oculta el resto.
 */
window.actualizarTabsMatriz = function () {
    const tipoTab = window.tipoAnalisisActual === 'suelos' ? 'suelos' : 'estandar';
    document.querySelectorAll('.tab-matriz').forEach(tab => {
        tab.style.display = (tab.getAttribute('data-matriz-tipo') === tipoTab) ? '' : 'none';
    });
};

/**
 * Muestra la humedad aplicada (pW en metales, Humedad en fisicoquímico) solo para suelos.
 */
window.actualizarInfoHumedad = function (elemData, matrizKey) {
    const cont = document.getElementById('infoHumedadMatriz');
    if (!cont) return;
    const esSuelo = window.tipoAnalisisActual === 'suelos' && window.MATRICES_SUELO.includes(matrizKey);
    const h = elemData && elemData.humedad_aplicada_matrices ? elemData.humedad_aplicada_matrices[matrizKey] : undefined;
    if (!esSuelo || h === undefined || h === null) {
        cont.classList.add('hidden');
        return;
    }
    const etiqueta = window.areaAnalisisActual === 'fisicoquimico' ? 'Humedad' : 'pW';
    document.getElementById('etiquetaHumedadMatriz').textContent = `${etiqueta}:`;
    document.getElementById('valorHumedadMatriz').textContent = `${h} %`;
    cont.classList.remove('hidden');
};

/**
 * Maneja el clic sobre las pestañas de matriz (AGUA SUPERFICIAL, AGUA SUBTERRÁNEA, etc.):
 * actualiza el resaltado visual de la pestaña activa y delega el pintado de datos
 * a renderizarMuestrasAdicionadas.
 */
window.cambiarMatrizMuestra = function (matrizKey) {
    if (!window.obtenerMatricesPermitidas().includes(matrizKey)) return;
    window.matrizActivaMuestra = matrizKey;

    // Resaltar visualmente la pestaña seleccionada
    document.querySelectorAll('[id^="tab-matriz-"]').forEach(tab => {
        tab.classList.remove('border-blue-600', 'text-blue-700');
        tab.classList.add('border-transparent', 'text-slate-500');
    });

    const idPestana = `tab-matriz-${matrizKey.replace(/ /g, '-')}`;
    const tabActivo = document.getElementById(idPestana);
    if (tabActivo) {
        tabActivo.classList.remove('border-transparent', 'text-slate-500');
        tabActivo.classList.add('border-blue-600', 'text-blue-700');
    }

    window.renderizarMuestrasAdicionadas(matrizKey);
};

window.renderizarMuestrasAdicionadas = function (matrizKey) {
    if (!window.elementoActivo || !window.datosGlobales[window.elementoActivo]) return;

    // 1. Alternar visibilidad de contenedores
    const contExactitud = document.getElementById('contenidoExactitud');
    const contMuestras = document.getElementById('contenidoMuestras');

    if (contExactitud) contExactitud.classList.add('hidden');
    if (contMuestras) contMuestras.classList.remove('hidden');

    window.subvistaExactitud = 'muestras';
    window.actualizarTabsMatriz();

    // 2. Capturar datos del JSON global del backend para el elemento activo
    const elemData = window.datosGlobales[window.elementoActivo];
    const muestrasData = elemData.muestras || {};

    // Solo matrices coherentes con el tipo de análisis (suelos -> submatrices de suelo; resto -> agua)
    const permitidas = window.obtenerMatricesPermitidas();
    const matricesConDatos = Object.keys(muestrasData).filter(m => permitidas.includes(m));

    // Matriz a mostrar: la pedida/activa si es válida; si no, la primera con datos; si no, la primera permitida
    let matrizSeleccionada = matrizKey || window.matrizActivaMuestra;
    if (!permitidas.includes(matrizSeleccionada)) {
        matrizSeleccionada = matricesConDatos[0] || permitidas[0];
    }
    window.matrizActivaMuestra = matrizSeleccionada;
    window.actualizarInfoHumedad(elemData, matrizSeleccionada);

    // Sincronizar el resaltado de la pestaña aunque se llame sin pasar matrizKey
    // (por ejemplo, desde el botón principal "Muestras y Adicionados")
    if (matrizSeleccionada) {
        document.querySelectorAll('[id^="tab-matriz-"]').forEach(tab => {
            tab.classList.remove('border-blue-600', 'text-blue-700');
            tab.classList.add('border-transparent', 'text-slate-500');
        });
        const tabActivo = document.getElementById(`tab-matriz-${matrizSeleccionada.replace(/ /g, '-')}`);
        if (tabActivo) {
            tabActivo.classList.remove('border-transparent', 'text-slate-500');
            tabActivo.classList.add('border-blue-600', 'text-blue-700');
        }
    }

    console.log(`Inspeccionando muestras para el elemento (${window.elementoActivo}), matriz [${matrizSeleccionada}]:`, muestrasData);

    const registrosMatriz = muestrasData[matrizSeleccionada] || [];
    const tablaMuestras = document.getElementById('tablaResultadosMuestras');
    const tituloTabla = document.getElementById('tituloTablaMatriz');

    if (tituloTabla) {
        const etiqueta = window.ETIQUETAS_MATRIZ[matrizSeleccionada] || (matrizSeleccionada || '').toUpperCase();
        tituloTabla.textContent = `Resultados de Muestras Ambientales — ${etiqueta}`;
    }

    if (!tablaMuestras) return;

    // 3. Validar si existen registros para renderizar
    if (registrosMatriz.length === 0) {
        tablaMuestras.innerHTML = `<tr><td colspan="8" class="p-4 text-center text-slate-500 font-medium">No hay datos de muestras registradas para la matriz seleccionada.</td></tr>`;
        window.dibujarGraficoMuestrasMatriz([]);
        return;
    }

    // 4. Construir las filas HTML basadas en la estructura del JSON del backend
    let filasHTML = '';
    registrosMatriz.forEach((m) => {
        filasHTML += `
            <tr class="hover:bg-slate-50">
                <td class="border border-slate-300 p-2 font-bold text-slate-700 bg-slate-50">#${m.replica}</td>
                <td class="border border-slate-300 p-2">${m.analista}</td>
                <td class="border border-slate-300 p-2 font-mono">${m.normal}</td>
                <td class="border border-slate-300 p-2 font-mono">${m.adicionada}</td>
                <td class="border border-slate-300 p-2 font-mono">${m.duplicada}</td>
                <td class="border border-slate-300 p-2 font-mono text-blue-700 font-semibold">${m.recuperacion_adic}%</td>
                <td class="border border-slate-300 p-2 font-mono text-indigo-700 font-semibold">${m.recuperacion_dup}%</td>
                <td class="border border-slate-300 p-2 font-mono text-amber-700 font-semibold">${m.rpd}%</td>
            </tr>
        `;
    });

    tablaMuestras.innerHTML = filasHTML;

    // 5. Dibujar el gráfico comparativo de la matriz seleccionada
    window.dibujarGraficoMuestrasMatriz(registrosMatriz);
};

/**
 * Dibuja el gráfico combinado (barras de % Recuperación por analista + línea de % RPD)
 * para la matriz de muestras actualmente seleccionada.
 */
window.dibujarGraficoMuestrasMatriz = function (registros) {
    const canvas = document.getElementById('chartMuestrasMatrices');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (window.chartMuestrasInstancia) {
        window.chartMuestrasInstancia.destroy();
        window.chartMuestrasInstancia = null;
    }

    if (!registros || registros.length === 0) return;

    const paleta = window.PALETA_ANALISTAS;
    const regsA1 = registros.filter(r => r.analista === 'Analista 1');
    const regsA2 = registros.filter(r => r.analista === 'Analista 2');
    const totalReplicas = Math.max(regsA1.length, regsA2.length);
    const labels = Array.from({ length: totalReplicas }, (_, i) => `Réplica ${i + 1}`);

    const rpdPromedio = labels.map((_, i) => {
        const valores = [regsA1[i]?.rpd, regsA2[i]?.rpd].filter(v => v !== undefined);
        return valores.length ? (valores.reduce((a, b) => a + Number(b), 0) / valores.length) : null;
    });

    window.chartMuestrasInstancia = new Chart(ctx, {
        data: {
            labels: labels,
            datasets: [
                {
                    type: 'bar',
                    label: 'Analista 1 (% Rec. Adicionado)',
                    data: regsA1.map(r => r.recuperacion_adic),
                    backgroundColor: paleta.analista1.arribaClara,
                    borderColor: paleta.analista1.linea,
                    borderWidth: 1,
                    order: 2
                },
                {
                    type: 'bar',
                    label: 'Analista 2 (% Rec. Adicionado)',
                    data: regsA2.map(r => r.recuperacion_adic),
                    backgroundColor: paleta.analista2.arribaClara,
                    borderColor: paleta.analista2.linea,
                    borderWidth: 1,
                    order: 2
                },
                {
                    type: 'line',
                    label: '% RPD (promedio)',
                    data: rpdPromedio,
                    borderColor: '#dc2626',
                    backgroundColor: '#dc2626',
                    borderWidth: 2,
                    borderDash: [4, 4],
                    pointRadius: 3,
                    tension: 0.3,
                    fill: false,
                    yAxisID: 'y1',
                    order: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                y: {
                    title: { display: true, text: '% Recuperación', color: '#64748b', font: { size: 12, weight: '600' } },
                    grid: { color: '#eef2f7' },
                    ticks: { color: '#94a3b8', font: { size: 11 } }
                },
                y1: {
                    position: 'right',
                    title: { display: true, text: '% RPD', color: '#64748b', font: { size: 12, weight: '600' } },
                    grid: { display: false },
                    ticks: { color: '#94a3b8', font: { size: 11 } }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8', font: { size: 11 } }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                    align: 'end',
                    labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 8, padding: 16, color: '#475569', font: { size: 12, weight: '600' } }
                }
            }
        }
    });
};
/**
 * Calcula métricas individuales por replicado, promedios y test de Grubbs por grupo.
 */
window.calcularExactitudGrupo = function (valores, valorTeorico, gCritico, etiquetaAnalista) {
    if (!valores || valores.length === 0) {
        return {
            n_inicial: 0, promedio_inicial: '--', desviacion_inicial: '--',
            g_min: '--', g_max: '--', g_critico: gCritico,
            n_final: 0, promedio_final: '--', desviacion_final: '--',
            error_promedio: '--', error_pct: '--', recuperacion: '--',
            outliers: [], itemMetrics: []
        };
    }

    const nInicial = valores.length;
    const calcPromedio = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const calcSD = (arr, prom) => arr.length > 1
        ? Math.sqrt(arr.reduce((a, b) => a + Math.pow(b - prom, 2), 0) / (arr.length - 1))
        : 0;

    // 1. Cálculo de cada replicado individual (% Error y % Recuperación)
    const itemMetrics = valores.map((v, index) => {
        const errAbs = v - valorTeorico;
        const errPct = valorTeorico !== 0 ? Math.abs(errAbs / valorTeorico) * 100 : 0;
        const recPct = valorTeorico !== 0 ? (v / valorTeorico) * 100 : 0;
        return {
            replica: index + 1,
            valor: v,
            error_pct: errPct,
            recuperacion_pct: recPct
        };
    });

    const promInicial = calcPromedio(valores);
    const sdInicial = calcSD(valores, promInicial);

    // 2. Grubbs (G_min y G_max)
    const valMin = Math.min(...valores);
    const valMax = Math.max(...valores);
    const gMin = sdInicial > 0 ? Math.abs(promInicial - valMin) / sdInicial : 0;
    const gMax = sdInicial > 0 ? Math.abs(valMax - promInicial) / sdInicial : 0;

    const outliers = [];
    const valoresLimpios = [];

    valores.forEach(v => {
        const gCalc = sdInicial > 0 ? Math.abs(v - promInicial) / sdInicial : 0;
        if (gCalc > gCritico) {
            outliers.push({
                valor: v,
                analista: etiquetaAnalista,
                G_calc: gCalc.toFixed(3),
                G_crit: gCritico.toFixed(3)
            });
        } else {
            valoresLimpios.push(v);
        }
    });

    // 3. Métricas finales globales/grupo
    const nFinal = valoresLimpios.length;
    const promFinal = nFinal > 0 ? calcPromedio(valoresLimpios) : promInicial;
    const sdFinal = nFinal > 0 ? calcSD(valoresLimpios, promFinal) : sdInicial;

    const errorPromedio = promFinal - valorTeorico;
    const errorPct = valorTeorico !== 0 ? Math.abs(errorPromedio / valorTeorico) * 100 : 0;
    const recuperacion = valorTeorico !== 0 ? (promFinal / valorTeorico) * 100 : 0;

    return {
        n_inicial: nInicial,
        promedio_inicial: promInicial.toFixed(4),
        desviacion_inicial: sdInicial.toFixed(4),
        g_min: gMin.toFixed(3),
        g_max: gMax.toFixed(3),
        g_critico: gCritico.toFixed(3),
        n_final: nFinal,
        promedio_final: promFinal.toFixed(4),
        desviacion_final: sdFinal.toFixed(4),
        error_promedio: errorPromedio.toFixed(4),
        error_pct: errorPct.toFixed(2),
        recuperacion: recuperacion.toFixed(2),
        outliers: outliers,
        itemMetrics: itemMetrics
    };
};

/**
 * Renderiza gráfico Chart.js comparando el % Recuperado de cada replicado
 */
window.dibujarGraficoRecuperacion = function (metricsA1, metricsA2) {
    const canvas = document.getElementById('chartExactitudRecuperacion');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Destruir el gráfico previo si existe para no solapar encuadres
    if (window.chartExactitudInstancia) {
        window.chartExactitudInstancia.destroy();
    }

    const labels = Array.from({ length: Math.max(metricsA1.length, metricsA2.length) }, (_, i) => `Réplica ${i + 1}`);
    const dataA1 = metricsA1.map(m => m.recuperacion_pct.toFixed(2));
    const dataA2 = metricsA2.map(m => m.recuperacion_pct.toFixed(2));
    const lineaIdeal = labels.map(() => 100); // 100% ideal de recuperación

    const paleta = window.PALETA_ANALISTAS;
    const crearGradiente = window.crearGradienteVertical;

    window.chartExactitudInstancia = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Analista 1 (% Recuperación)',
                    data: dataA1,
                    borderColor: paleta.analista1.linea,
                    backgroundColor: (context) => crearGradiente(context.chart, paleta.analista1.arribaClara, paleta.analista1.abajoTransp),
                    borderWidth: 2.5,
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: paleta.analista1.linea,
                    pointBorderWidth: 2,
                    pointRadius: 3,
                    pointHoverRadius: 6,
                    tension: 0.42,
                    fill: 'origin',
                    order: 2
                },
                {
                    label: 'Analista 2 (% Recuperación)',
                    data: dataA2,
                    borderColor: paleta.analista2.linea,
                    backgroundColor: (context) => crearGradiente(context.chart, paleta.analista2.arribaClara, paleta.analista2.abajoTransp),
                    borderWidth: 2.5,
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: paleta.analista2.linea,
                    pointBorderWidth: 2,
                    pointRadius: 3,
                    pointHoverRadius: 6,
                    tension: 0.42,
                    fill: 'origin',
                    order: 1
                },
                {
                    label: '100% Ideal Teórico',
                    data: lineaIdeal,
                    borderColor: 'rgba(220, 38, 38, 0.6)',
                    borderWidth: 1.5,
                    borderDash: [6, 6],
                    pointRadius: 0,
                    tension: 0,
                    fill: false,
                    order: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                y: {
                    title: { display: true, text: '% de Recuperación', color: '#64748b', font: { size: 12, weight: '600' } },
                    min: 80,
                    max: 120,
                    grid: { color: '#eef2f7' },
                    ticks: { color: '#94a3b8', font: { size: 11 } }
                },
                x: {
                    title: { display: true, text: 'Número de Réplica', color: '#64748b', font: { size: 12, weight: '600' } },
                    grid: { display: false },
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
                    bodyFont: { size: 12 },
                    callbacks: {
                        label: function (context) {
                            return `${context.dataset.label}: ${context.raw}%`;
                        }
                    }
                }
            }
        }
    });
};

/**
 * Función principal para renderizar la pestaña de Exactitud por Analista.
 */
window.renderizarExactitud = function (control) {
    if (!window.elementoActivo || !window.datosGlobales[window.elementoActivo]) return;
    window.controlActivoExa = control;
    if (window.actualizarTabs) window.actualizarTabs('exa', control);

    const elemData = window.datosGlobales[window.elementoActivo];
    const controlKey = control.toLowerCase();
    console.log(`Inspeccionando elemento activo (${window.elementoActivo}) para el control [${control}]:`, elemData);

    const datosBase = (elemData[controlKey] && elemData[controlKey].raw)
        ? elemData[controlKey].raw
        : (elemData[control] && elemData[control].raw ? elemData[control].raw : []);

    const valorTeorico = 
        elemData.exactitud?.[controlKey]?.teorico ||
        elemData.exactitud?.[control]?.teorico ||
        elemData[controlKey]?.teorico ||
        elemData[control]?.teorico ||
        elemData[`teorico_${controlKey}`] ||
        elemData[`teorico_${control.toUpperCase()}`] ||
        1.0;

    const valsA1 = datosBase.filter(d => d.analista === 'Analista 1').map(d => d.valor);
    const valsA2 = datosBase.filter(d => d.analista === 'Analista 2').map(d => d.valor);
    const valsGlobal = [...valsA1, ...valsA2];

    const statsA1 = window.calcularExactitudGrupo(valsA1, valorTeorico, 2.290, "Analista 1");
    const statsA2 = window.calcularExactitudGrupo(valsA2, valorTeorico, 2.290, "Analista 2");
    const statsGlobal = window.calcularExactitudGrupo(valsGlobal, valorTeorico, 2.557, "Global");

    document.getElementById('contenidoExactitud').classList.remove('hidden');
    const contMuestrasEl = document.getElementById('contenidoMuestras');
    if (contMuestrasEl) contMuestrasEl.classList.add('hidden');
    window.subvistaExactitud = 'control';
    window.actualizarTabsMatriz();

    // 1. Renderizar la Tabla Detallada de los 10 Replicados Individuales
    const tbIndividual = document.getElementById('tablaExactitudIndividual');
    const tbPromedio = document.getElementById('tablaExactitudIndividualPromedio');
    const totalReplicas = Math.max(statsA1.itemMetrics.length, statsA2.itemMetrics.length, 10);

    let filasHTML = '';
    for (let i = 0; i < totalReplicas; i++) {
        const m1 = statsA1.itemMetrics[i] || { valor: '--', error_pct: '--', recuperacion_pct: '--' };
        const m2 = statsA2.itemMetrics[i] || { valor: '--', error_pct: '--', recuperacion_pct: '--' };

        const val1 = typeof m1.valor === 'number' ? m1.valor.toFixed(4) : m1.valor;
        const err1 = typeof m1.error_pct === 'number' ? `${m1.error_pct.toFixed(2)}%` : m1.error_pct;
        const rec1 = typeof m1.recuperacion_pct === 'number' ? `${m1.recuperacion_pct.toFixed(2)}%` : m1.recuperacion_pct;

        const val2 = typeof m2.valor === 'number' ? m2.valor.toFixed(4) : m2.valor;
        const err2 = typeof m2.error_pct === 'number' ? `${m2.error_pct.toFixed(2)}%` : m2.error_pct;
        const rec2 = typeof m2.recuperacion_pct === 'number' ? `${m2.recuperacion_pct.toFixed(2)}%` : m2.recuperacion_pct;

        filasHTML += `
            <tr class="hover:bg-slate-50">
                <td class="border border-slate-300 p-2 font-bold text-slate-700 bg-slate-50">#${i + 1}</td>
                <td class="border border-slate-300 p-2 font-mono">${val1}</td>
                <td class="border border-slate-300 p-2 font-mono text-amber-700">${err1}</td>
                <td class="border border-slate-300 p-2 font-mono text-blue-700 font-semibold">${rec1}</td>
                <td class="border border-slate-300 p-2 font-mono">${val2}</td>
                <td class="border border-slate-300 p-2 font-mono text-amber-700">${err2}</td>
                <td class="border border-slate-300 p-2 font-mono text-indigo-700 font-semibold">${rec2}</td>
            </tr>
        `;
    }
    tbIndividual.innerHTML = filasHTML;

    // Fila de Promedios Generales en el Pie de Tabla (tfoot)
    tbPromedio.innerHTML = `
        <tr class="bg-slate-200/80 text-slate-800">
            <td class="border border-slate-300 p-2">PROMEDIOS</td>
            <td class="border border-slate-300 p-2 font-mono">${statsA1.promedio_inicial}</td>
            <td class="border border-slate-300 p-2 font-mono text-amber-800">${statsA1.error_pct}%</td>
            <td class="border border-slate-300 p-2 font-mono text-blue-800 font-bold">${statsA1.recuperacion}%</td>
            <td class="border border-slate-300 p-2 font-mono">${statsA2.promedio_inicial}</td>
            <td class="border border-slate-300 p-2 font-mono text-amber-800">${statsA2.error_pct}%</td>
            <td class="border border-slate-300 p-2 font-mono text-indigo-800 font-bold">${statsA2.recuperacion}%</td>
        </tr>
    `;

    // 2. Renderizar Gráfico
    window.dibujarGraficoRecuperacion(statsA1.itemMetrics, statsA2.itemMetrics);

    // 3. Renderizar Tabla Test de Grubbs
    document.getElementById('tablaGrubbsStats').innerHTML = `
        <tr class="bg-slate-50">
            <td class="border border-slate-300 p-2 font-semibold">Total Datos (N)</td>
            <td class="border border-slate-300 p-2 font-mono text-right">${statsA1.n_inicial}</td>
            <td class="border border-slate-300 p-2 font-mono text-right">${statsA2.n_inicial}</td>
            <td class="border border-slate-300 p-2 font-mono text-right font-bold bg-blue-50/50">${statsGlobal.n_inicial}</td>
        </tr>
        <tr>
            <td class="border border-slate-300 p-2 font-semibold">Promedio Inicial</td>
            <td class="border border-slate-300 p-2 font-mono text-right">${statsA1.promedio_inicial}</td>
            <td class="border border-slate-300 p-2 font-mono text-right">${statsA2.promedio_inicial}</td>
            <td class="border border-slate-300 p-2 font-mono text-right font-bold bg-blue-50/50">${statsGlobal.promedio_inicial}</td>
        </tr>
        <tr class="bg-slate-50">
            <td class="border border-slate-300 p-2 font-semibold">Desviación Inicial</td>
            <td class="border border-slate-300 p-2 font-mono text-right">${statsA1.desviacion_inicial}</td>
            <td class="border border-slate-300 p-2 font-mono text-right">${statsA2.desviacion_inicial}</td>
            <td class="border border-slate-300 p-2 font-mono text-right font-bold bg-blue-50/50">${statsGlobal.desviacion_inicial}</td>
        </tr>
        <tr>
            <td class="border border-slate-300 p-2 font-semibold">G Min Calculado</td>
            <td class="border border-slate-300 p-2 font-mono text-right text-blue-700">${statsA1.g_min}</td>
            <td class="border border-slate-300 p-2 font-mono text-right text-blue-700">${statsA2.g_min}</td>
            <td class="border border-slate-300 p-2 font-mono text-right font-bold text-blue-800 bg-blue-50/50">${statsGlobal.g_min}</td>
        </tr>
        <tr class="bg-slate-50">
            <td class="border border-slate-300 p-2 font-semibold">G Max Calculado</td>
            <td class="border border-slate-300 p-2 font-mono text-right text-indigo-700">${statsA1.g_max}</td>
            <td class="border border-slate-300 p-2 font-mono text-right text-indigo-700">${statsA2.g_max}</td>
            <td class="border border-slate-300 p-2 font-mono text-right font-bold text-indigo-800 bg-blue-50/50">${statsGlobal.g_max}</td>
        </tr>
        <tr>
            <td class="border border-slate-300 p-2 font-semibold">Valor G Crítico</td>
            <td class="border border-slate-300 p-2 font-mono text-right text-red-600 font-bold">${statsA1.g_critico}</td>
            <td class="border border-slate-300 p-2 font-mono text-right text-red-600 font-bold">${statsA2.g_critico}</td>
            <td class="border border-slate-300 p-2 font-mono text-right font-bold text-red-700 bg-blue-50/50">${statsGlobal.g_critico}</td>
        </tr>
    `;

    // 4. Renderizar Tabla de Exactitud Consolidada
    document.getElementById('tablaExactitudStats').innerHTML = `
        <tr class="bg-emerald-50/60">
            <td class="border border-slate-300 p-2 font-semibold">N Final (Sin Atípicos)</td>
            <td class="border border-slate-300 p-2 font-mono text-right font-bold text-emerald-800">${statsA1.n_final}</td>
            <td class="border border-slate-300 p-2 font-mono text-right font-bold text-emerald-800">${statsA2.n_final}</td>
            <td class="border border-slate-300 p-2 font-mono text-right font-bold text-emerald-900 bg-emerald-100/50">${statsGlobal.n_final}</td>
        </tr>
        <tr>
            <td class="border border-slate-300 p-2 font-semibold">Promedio Final</td>
            <td class="border border-slate-300 p-2 font-mono text-right">${statsA1.promedio_final}</td>
            <td class="border border-slate-300 p-2 font-mono text-right">${statsA2.promedio_final}</td>
            <td class="border border-slate-300 p-2 font-mono text-right font-bold bg-emerald-50/30">${statsGlobal.promedio_final}</td>
        </tr>
        <tr class="bg-slate-50">
            <td class="border border-slate-300 p-2 font-semibold">Desviación Final</td>
            <td class="border border-slate-300 p-2 font-mono text-right">${statsA1.desviacion_final}</td>
            <td class="border border-slate-300 p-2 font-mono text-right">${statsA2.desviacion_final}</td>
            <td class="border border-slate-300 p-2 font-mono text-right font-bold bg-emerald-50/30">${statsGlobal.desviacion_final}</td>
        </tr>
        <tr>
            <td class="border border-slate-300 p-2 font-semibold">Error Promedio Absoluto</td>
            <td class="border border-slate-300 p-2 font-mono text-right">${statsA1.error_promedio}</td>
            <td class="border border-slate-300 p-2 font-mono text-right">${statsA2.error_promedio}</td>
            <td class="border border-slate-300 p-2 font-mono text-right font-bold bg-emerald-50/30">${statsGlobal.error_promedio}</td>
        </tr>
        <tr class="bg-slate-50">
            <td class="border border-slate-300 p-2 font-semibold">Porcentaje Error (%)</td>
            <td class="border border-slate-300 p-2 font-mono text-right font-bold text-amber-700">${statsA1.error_pct}%</td>
            <td class="border border-slate-300 p-2 font-mono text-right font-bold text-amber-700">${statsA2.error_pct}%</td>
            <td class="border border-slate-300 p-2 font-mono text-right font-bold bg-emerald-50/30">${statsGlobal.error_pct}%</td>
        </tr>
        <tr>
            <td class="border border-slate-300 p-2 font-semibold">Porcentaje Recuperación (%)</td>
            <td class="border border-slate-300 p-2 font-mono text-right font-bold text-blue-700">${statsA1.recuperacion}%</td>
            <td class="border border-slate-300 p-2 font-mono text-right font-bold text-blue-700">${statsA2.recuperacion}%</td>
            <td class="border border-slate-300 p-2 font-mono text-right font-bold text-blue-800 bg-emerald-50/30">${statsGlobal.recuperacion}%</td>
        </tr>
    `;

    // 5. Renderizar Tabla de Datos Atípicos
    const todosOutliers = [...(statsA1.outliers || []), ...(statsA2.outliers || [])];
    const tbOutliers = document.getElementById('tablaOutliers');

    if (todosOutliers.length === 0) {
        tbOutliers.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-500 font-medium">No se detectaron datos atípicos según el Test de Grubbs ($G \\le G_{\\text{crit}}$).</td></tr>`;
    } else {
        tbOutliers.innerHTML = todosOutliers.map(o => `
            <tr class="hover:bg-red-50/50">
                <td class="border border-slate-300 p-2 font-mono text-red-700 font-bold">${o.valor}</td>
                <td class="border border-slate-300 p-2">${o.analista}</td>
                <td class="border border-slate-300 p-2 font-mono">${o.G_calc}</td>
                <td class="border border-slate-300 p-2 font-mono">${o.G_crit}</td>
            </tr>
        `).join('');
    }
};