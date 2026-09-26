/**
 * seccion-robustez.js
 * Módulo de lógica y renderizado para el Análisis de Robustez (Diseño Youden & Steiner - ISO 17025).
 * Integra extracción de datos crudos, cálculos estadísticos, matriz de combinaciones y promedios globales.
 */

(function () {
    const estadoLocal = {
        tabActiva: 'general',
        parametroActual: null,
        datosRobustez: null,
        factorExpandido: null,
        motor: null
    };

    /**
     * MOTOR ESTADÍSTICO Y ANALÍTICO
     */
    function calcularEstadisticasBase(valores) {
        if (!valores || valores.length === 0) return { prom: null, std: null, rsd: null, n: 0 };
        const n = valores.length;
        const sum = valores.reduce((a, b) => a + b, 0);
        const prom = sum / n;
        if (n === 1) return { prom, std: 0, rsd: 0, n };
        
        const sumSq = valores.reduce((a, b) => a + Math.pow(b - prom, 2), 0);
        const std = Math.sqrt(sumSq / (n - 1));
        const rsd = prom !== 0 ? (std / prom) * 100 : 0;
        return { prom, std, rsd, n };
    }

    function procesarMotorAnalitico(data) {
        const { factores, escenarios, datos_crudos, valor_teorico } = data;
        const resultadosFactores = {};
        const resultadosEscenarios = {};

        // 1. Estadísticas por Simbología (A, a, B, b...)
        'AaBbCcDdEeFfGg'.split('').forEach(sym => {
            const lecturas = datos_crudos ? (datos_crudos[sym] || []) : [];
            const vals = lecturas.map(l => l.valor);
            const stats = calcularEstadisticasBase(vals);
            
            let error = null;
            if (stats.prom !== null && valor_teorico && valor_teorico > 0) {
                error = ((stats.prom - valor_teorico) / valor_teorico) * 100;
            }
            resultadosFactores[sym] = { ...stats, lecturas, error, descripcion: factores[sym] || 'Sin condición' };
        });

        // 2. Promedios Globales de cada Escenario
        escenarios.forEach(esc => {
            let sum = 0, count = 0;
            esc.combinacion.forEach(sym => {
                const fStats = resultadosFactores[sym];
                if (fStats && fStats.prom !== null) {
                    sum += fStats.prom;
                    count++;
                }
            });
            resultadosEscenarios[esc.id] = count > 0 ? (sum / count) : null;
        });

        // 3. Matriz Youden (X vs x) y Efectos
        const matrizYouden = [];
        'ABCDEFG'.split('').forEach(mayus => {
            const minus = mayus.toLowerCase();
            let sumMayus = 0, countMayus = 0;
            let sumMinus = 0, countMinus = 0;

            escenarios.forEach(esc => {
                const valEsc = resultadosEscenarios[esc.id];
                if (valEsc !== null) {
                    if (esc.combinacion.includes(mayus)) { sumMayus += valEsc; countMayus++; }
                    if (esc.combinacion.includes(minus)) { sumMinus += valEsc; countMinus++; }
                }
            });

            const promMayus = countMayus > 0 ? (sumMayus / countMayus) : null;
            const promMinus = countMinus > 0 ? (sumMinus / countMinus) : null;
            const dif = (promMayus !== null && promMinus !== null) ? (promMayus - promMinus) : null;

            matrizYouden.push({ letra: mayus, promMayus, promMinus, dif });
        });

        // 4. Desviación Estándar de Escenarios y Raíz(2)*S
        const promediosValidosEsc = Object.values(resultadosEscenarios).filter(v => v !== null);
        const statsGlobales = calcularEstadisticasBase(promediosValidosEsc);
        const raiz2S = statsGlobales.std !== null ? (Math.sqrt(2) * statsGlobales.std) : null;

        return { resultadosFactores, resultadosEscenarios, matrizYouden, s: statsGlobales.std, raiz2S, valor_teorico };
    }

    /**
     * INICIALIZACIÓN Y RENDERIZADO PRINCIPAL
     */
    function inicializar(elemento, datosGlobales) {
        estadoLocal.parametroActual = elemento || window.elementoActivo;
        estadoLocal.factorExpandido = null;
        
        const origenDatos = datosGlobales || window.datosGlobales;
        if (origenDatos && origenDatos[estadoLocal.parametroActual]) {
            estadoLocal.datosRobustez = origenDatos[estadoLocal.parametroActual].robustez || null;
        } else {
            estadoLocal.datosRobustez = null;
        }

        if (estadoLocal.datosRobustez && estadoLocal.datosRobustez.escenarios) {
            estadoLocal.motor = procesarMotorAnalitico(estadoLocal.datosRobustez);
        }

        renderizar();
    }

    function renderizar() {
        const container = document.getElementById('robustez-container');
        if (!container) return;

        const data = estadoLocal.datosRobustez;
        if (!data || !data.escenarios || data.escenarios.length === 0) {
            container.innerHTML = renderizarSinDatos();
            return;
        }

        container.innerHTML = `
            <div class="space-y-6 animate-fade-in">
                ${renderizarTabs(data.escenarios)}
                <div class="transition-all duration-200">
                    ${estadoLocal.tabActiva === 'general' 
                        ? renderizarVistaGeneral(data.factores, data.escenarios) 
                        : renderizarVistaEscenario(estadoLocal.tabActiva, data.escenarios)}
                </div>
            </div>
        `;
        asociarEventosDOM();
    }

    function renderizarTabs(escenarios) {
        const isGeneral = estadoLocal.tabActiva === 'general';
        const clsActive = "bg-[#4361EE] text-white shadow-md font-bold";
        const clsInactive = "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200 font-medium";

        let html = `
            <div class="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200 no-scrollbar">
                <button type="button" data-tab-robustez="general" class="px-4 py-2 text-sm rounded-xl transition-all duration-150 flex items-center gap-2 shrink-0 ${isGeneral ? clsActive : clsInactive}">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>
                    Vista General (Matriz Youden)
                </button>`;

        escenarios.forEach(esc => {
            const isAct = String(estadoLocal.tabActiva) === String(esc.id);
            const prom = estadoLocal.motor.resultadosEscenarios[esc.id];
            html += `
                <button type="button" data-tab-robustez="${esc.id}" class="px-4 py-2 text-sm rounded-xl transition-all duration-150 shrink-0 flex items-center gap-1.5 ${isAct ? clsActive : clsInactive}">
                    <span>Escenario ${esc.id}</span>
                    ${prom !== null ? `<span class="text-[10px] px-1.5 py-0.5 rounded-md ${isAct ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'} font-semibold">${prom.toFixed(4)}</span>` : ''}
                </button>`;
        });

        return html + `</div>`;
    }

    /**
     * VISTA GENERAL RESTAURADA (MATRIZ YOUDEN COMPLETA + CÁLCULOS)
     */
    function renderizarVistaGeneral(factores, escenarios) {
        const m = estadoLocal.motor;

        // Construir Filas de la Matriz 7x8
        const rowsMatriz = [0, 1, 2, 3, 4, 5, 6].map(rowIndex => {
            const primerSimbolo = escenarios[0]?.combinacion[rowIndex] || `V${rowIndex+1}`;
            const nombreVar = primerSimbolo.toUpperCase();
            
            return `
                <tr class="hover:bg-slate-50">
                    <td class="px-3 py-2.5 font-bold text-slate-500 text-left bg-slate-50/50 border-r border-slate-100">Variable ${nombreVar}</td>
                    ${escenarios.map(e => {
                        const val = e.combinacion[rowIndex] || '-';
                        const esAlto = val === val.toUpperCase();
                        return `
                            <td class="px-2 py-2.5">
                                <span class="inline-block w-6 h-6 leading-6 rounded-md font-bold text-center ${esAlto ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-800'}">${val}</span>
                            </td>
                        `;
                    }).join('')}
                </tr>
            `;
        }).join('');

        return `
            <div class="space-y-6">
                <!-- MATRIZ DE YOUDEN COMPLETA -->
                <div class="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
                    <div class="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                        <h3 class="text-base font-bold text-slate-800">Matriz de Escenarios Youden & Steiner</h3>
                        <span class="text-xs font-semibold px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-lg">8 Ensayos x 7 Variables</span>
                    </div>
                    <table class="w-full text-xs text-center border-collapse min-w-[600px]">
                        <thead>
                            <tr class="bg-slate-50 text-slate-500 uppercase text-[10px] border-b border-slate-200">
                                <th class="px-3 py-2 font-bold text-left border-r border-slate-100">Factor / Variable</th>
                                ${escenarios.map(e => `<th class="px-2 py-2 text-indigo-600 font-bold">Esc. ${e.id}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 text-slate-700 font-semibold">
                            ${rowsMatriz}
                            <!-- Fila de Resultados Dinámicos -->
                            <tr class="bg-indigo-50/50 font-bold border-t-2 border-indigo-100">
                                <td class="px-3 py-3 text-indigo-800 text-left">Promedio Global (y)</td>
                                ${escenarios.map(e => {
                                    const res = m.resultadosEscenarios[e.id];
                                    return `<td class="px-2 py-3 text-indigo-700 font-extrabold text-sm">${res ? res.toFixed(4) : '-'}</td>`;
                                }).join('')}
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- DIFERENCIAS (X - x) Y LÍMITES -->
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div class="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                        <div class="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                            <h3 class="text-base font-bold text-slate-800">Evaluación de Criterios</h3>
                            <span class="text-xs font-semibold text-slate-500">Diferencias de Promedios (X - x)</span>
                        </div>
                        <div class="overflow-x-auto">
                            <table class="w-full text-xs text-center border-collapse">
                                <thead>
                                    <tr class="bg-slate-50 text-slate-500 uppercase text-[10px] border-b border-slate-200">
                                        <th class="px-3 py-2 font-bold text-left">Comparación</th>
                                        <th class="px-3 py-2 font-bold">Sin Modificar (X)</th>
                                        <th class="px-3 py-2 font-bold">Modificado (x)</th>
                                        <th class="px-3 py-2 font-bold text-right">Diferencia (Di)</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-slate-100 text-slate-700 font-semibold">
                                    ${m.matrizYouden.map(row => `
                                        <tr class="hover:bg-slate-50">
                                            <td class="px-3 py-3 text-left font-bold text-slate-600 flex items-center gap-2">
                                                <span class="w-6 h-6 flex justify-center items-center rounded bg-indigo-100 text-indigo-700">${row.letra}</span>
                                                vs
                                                <span class="w-6 h-6 flex justify-center items-center rounded bg-amber-100 text-amber-700">${row.letra.toLowerCase()}</span>
                                            </td>
                                            <td class="px-3 py-3">${row.promMayus ? row.promMayus.toFixed(4) : '-'}</td>
                                            <td class="px-3 py-3">${row.promMinus ? row.promMinus.toFixed(4) : '-'}</td>
                                            <td class="px-3 py-3 text-right font-black ${row.dif && Math.abs(row.dif) > 0.05 ? 'text-rose-500' : 'text-emerald-500'}">
                                                ${row.dif ? row.dif.toFixed(4) : '-'}
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div class="lg:col-span-1 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-center gap-6">
                        <div class="text-center p-4 bg-slate-50 rounded-xl border border-slate-200">
                            <span class="block text-xs uppercase font-bold text-slate-500 mb-1">Desviación Estándar (S)</span>
                            <span class="text-3xl font-black text-slate-800">${m.s ? m.s.toFixed(4) : 'N/A'}</span>
                            <p class="text-[10px] text-slate-400 mt-2">Calculada de los 8 promedios globales de ensayos.</p>
                        </div>
                        <div class="text-center p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                            <span class="block text-xs uppercase font-bold text-indigo-500 mb-1">Límite Aceptación (√2 * S)</span>
                            <span class="text-3xl font-black text-[#4361EE]">${m.raiz2S ? m.raiz2S.toFixed(4) : 'N/A'}</span>
                            <p class="text-[10px] text-indigo-400 mt-2">Límite máximo permitido para las diferencias (Di).</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * VISTA DETALLE DE ESCENARIO
     */
    function renderizarVistaEscenario(idEscenario, escenarios) {
        const esc = escenarios.find(e => String(e.id) === String(idEscenario));
        if (!esc) return '';
        
        const m = estadoLocal.motor;
        const promEsc = m.resultadosEscenarios[idEscenario];

        return `
            <div class="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
                <!-- Header -->
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                    <div>
                        <div class="flex items-center gap-2">
                            <h3 class="text-xl font-bold text-slate-800">Detalle del Escenario ${esc.id}</h3>
                        </div>
                        <p class="text-xs text-slate-400 mt-1">Haz clic en un factor para ver la tabla de datos analizados.</p>
                    </div>
                    <div class="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 p-3.5 rounded-xl flex items-center gap-4 shadow-sm">
                        <div class="text-right">
                            <span class="text-[10px] uppercase tracking-wider font-bold text-indigo-400 block">Promedio Global</span>
                            <span class="text-2xl font-black text-indigo-700">${promEsc ? promEsc.toFixed(4) : 'N/A'}</span>
                        </div>
                    </div>
                </div>

                <!-- Tarjetas Interactivas de Factores -->
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    ${esc.combinacion.map(letra => {
                        const esAlto = letra === letra.toUpperCase();
                        const esExpandido = estadoLocal.factorExpandido === letra;
                        const stats = m.resultadosFactores[letra];

                        return `
                            <div data-factor-toggle="${letra}" class="cursor-pointer p-4 rounded-xl border-2 transition-all hover:shadow-md ${esExpandido ? 'border-[#4361EE] bg-blue-50/20' : (esAlto ? 'border-indigo-100 bg-indigo-50/30 hover:border-indigo-300' : 'border-amber-100 bg-amber-50/30 hover:border-amber-300')} flex flex-col gap-2">
                                <div class="flex items-center justify-between">
                                    <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-black text-sm shadow-sm ${esAlto ? 'bg-indigo-600 text-white' : 'bg-amber-500 text-white'}">${letra}</div>
                                    <span class="text-[10px] font-bold px-1.5 py-0.5 rounded ${esAlto ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-800'}">${esAlto ? 'Sin Modificar' : 'Modificado'}</span>
                                </div>
                                <div class="mt-1">
                                    <p class="text-[10px] font-bold text-slate-400 truncate" title="${stats.descripcion}">${stats.descripcion}</p>
                                    <p class="text-lg font-black text-slate-800 mt-0.5">${stats.prom ? stats.prom.toFixed(4) : 'Sin datos'}</p>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>

                <!-- Tabla de Datos Crudos (Desplegable) -->
                ${estadoLocal.factorExpandido ? renderizarTablaCrudos(estadoLocal.factorExpandido) : ''}
            </div>
        `;
    }

    function renderizarTablaCrudos(sym) {
        const f = estadoLocal.motor.resultadosFactores[sym];
        const vTeo = estadoLocal.motor.valor_teorico || 0;

        return `
            <div class="mt-6 border-t-2 border-[#4361EE] pt-6 animate-fade-in">
                <div class="mb-4">
                    <h3 class="text-base font-black text-slate-800">Datos Analizados - Factor <span class="text-[#4361EE]">${sym}</span></h3>
                    <p class="text-xs font-semibold text-slate-500 mt-1">Valor Teórico Robustez: <strong>${vTeo}</strong> | Condición: <em>${f.descripcion}</em></p>
                </div>

                <div class="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
                    <table class="w-full text-xs text-center bg-white">
                        <thead class="bg-slate-800 text-white font-bold uppercase text-[10px] tracking-wider">
                            <tr>
                                <th class="py-3 px-3">Fecha</th>
                                <th class="py-3 px-2">Simb.</th>
                                <th class="py-3 px-3 text-left">Condición</th>
                                <th class="py-3 px-3">Concentración</th>
                                <th class="py-3 px-3">Promedio</th>
                                <th class="py-3 px-3">% Error (Vs Teórico)</th>
                                <th class="py-3 px-3">Desv. Est.</th>
                                <th class="py-3 px-3">% RSD</th>
                                <th class="py-3 px-3 bg-[#324BCC]">Prom. General</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 text-slate-600 font-medium">
                            ${f.lecturas.length === 0 ? `<tr><td colspan="9" class="py-8 text-slate-400 italic">No se encontraron lecturas en los archivos .xls para el Factor ${sym}.</td></tr>` : ''}
                            ${f.lecturas.map((lec) => `
                                <tr class="hover:bg-slate-50 transition-colors">
                                    <td class="py-2.5 px-3 font-mono">${lec.fecha}</td>
                                    <td class="py-2.5 px-2 font-black text-slate-800">${sym}</td>
                                    <td class="py-2.5 px-3 text-left truncate max-w-[150px]" title="${f.descripcion}">${f.descripcion}</td>
                                    <td class="py-2.5 px-3 font-bold text-slate-800">${lec.valor.toFixed(4)}</td>
                                    
                                    <td class="py-2.5 px-3 bg-slate-50/50">${f.prom.toFixed(4)}</td>
                                    <td class="py-2.5 px-3 bg-slate-50/50 font-bold ${f.error !== null && Math.abs(f.error) > 5 ? 'text-rose-500' : 'text-emerald-500'}">
                                        ${f.error !== null ? f.error.toFixed(2) + '%' : 'N/A'}
                                    </td>
                                    <td class="py-2.5 px-3 bg-slate-50/50">${f.std.toFixed(4)}</td>
                                    <td class="py-2.5 px-3 bg-slate-50/50">${f.rsd.toFixed(2)}%</td>
                                    <td class="py-2.5 px-3 bg-indigo-50/50 font-black text-[#4361EE]">${f.prom.toFixed(4)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    function renderizarSinDatos() {
        return `
            <div class="flex flex-col items-center justify-center py-12 px-4 text-center bg-white rounded-2xl border border-slate-100 shadow-sm">
                <div class="w-16 h-16 bg-slate-50 text-slate-300 rounded-2xl flex items-center justify-center mb-4">
                    <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>
                </div>
                <h3 class="text-base font-bold text-slate-700">Sin datos de robustez</h3>
                <p class="text-xs text-slate-400 max-w-sm mt-1">No se han extraído parámetros de robustez para <strong class="text-slate-600">${estadoLocal.parametroActual || 'este elemento'}</strong>.</p>
            </div>
        `;
    }

    function asociarEventosDOM() {
        const container = document.getElementById('robustez-container');
        if (!container) return;

        container.querySelectorAll('button[data-tab-robustez]').forEach(btn => {
            btn.addEventListener('click', () => {
                estadoLocal.tabActiva = btn.getAttribute('data-tab-robustez');
                estadoLocal.factorExpandido = null; 
                renderizar();
            });
        });

        container.querySelectorAll('[data-factor-toggle]').forEach(card => {
            card.addEventListener('click', () => {
                const f = card.getAttribute('data-factor-toggle');
                estadoLocal.factorExpandido = (estadoLocal.factorExpandido === f) ? null : f;
                renderizar();
            });
        });
    }

    window.SeccionRobustez = {
        init: inicializar,
        render: renderizar
    };
})();