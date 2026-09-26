/**
 * INFORME - GRÁFICAS FINALES Y EXPORTACIÓN A PDF/ZIP
 * -----------------------------------------------------------------------
 * renderizarGraficas (gráficos embebidos del informe), preparación del
 * layout especial para RAS antes de imprimir, exportarPDF/generarPDFBlob
 * y exportarTodosPDFsZip (descarga masiva). Se ejecuta también aquí la
 * inicialización de la app al cargar el DOM.
 * Depende de todos los módulos anteriores.
 * -----------------------------------------------------------------------
 */

let instanciaChartPrecision = null;
let instanciaChartCurvasInd = null;
let instanciaChartCurvaPromedio = null;

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

window.renderizarGraficas = function (dataElem) {
    if (!dataElem) return;

    // 1. Gráfica de Precisión Intermedia (LCM)
    const lcm1 = dataElem.lcm?.analista_1?.valores || dataElem.analista_1?.valores || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const lcm2 = dataElem.lcm?.analista_2?.valores || dataElem.analista_2?.valores || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const labelsEnsayos = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

    const ctxPrecision = document.getElementById('chart-precision');
    if (ctxPrecision) {
        if (instanciaChartPrecision) instanciaChartPrecision.destroy();

        const paletaPrecision = window.PALETA_ANALISTAS;
        const gradientePrecision = window.crearGradienteVertical;

        instanciaChartPrecision = new Chart(ctxPrecision, {
            type: 'line',
            data: {
                labels: labelsEnsayos,
                datasets: [
                    {
                        label: 'Analista 1',
                        data: lcm1,
                        borderColor: paletaPrecision.analista1.linea,
                        backgroundColor: (context) => gradientePrecision(context.chart, paletaPrecision.analista1.arribaClara, paletaPrecision.analista1.abajoTransp),
                        borderWidth: 2.5,
                        tension: 0.42,
                        fill: 'origin',
                        pointRadius: 2.5,
                        pointHoverRadius: 5,
                        pointBackgroundColor: '#ffffff',
                        pointBorderColor: paletaPrecision.analista1.linea,
                        pointBorderWidth: 1.5,
                        order: 2
                    },
                    {
                        label: 'Analista 2',
                        data: lcm2,
                        borderColor: paletaPrecision.analista2.linea,
                        backgroundColor: (context) => gradientePrecision(context.chart, paletaPrecision.analista2.arribaClara, paletaPrecision.analista2.abajoTransp),
                        borderWidth: 2.5,
                        tension: 0.42,
                        fill: 'origin',
                        pointRadius: 2.5,
                        pointHoverRadius: 5,
                        pointBackgroundColor: '#ffffff',
                        pointBorderColor: paletaPrecision.analista2.linea,
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
                plugins: {
                    legend: { position: 'top', labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 8, color: '#475569', font: { size: 10, weight: '600' } } },
                    tooltip: { backgroundColor: '#1e293b', padding: 8, cornerRadius: 6 }
                },
                scales: {
                    y: { title: { display: true, text: 'Concentración Calculada (mg/L)', color: '#64748b', font: { size: 10 } }, grid: { color: '#eef2f7' }, ticks: { color: '#94a3b8', font: { size: 9 } } },
                    x: { title: { display: true, text: 'Ensayo N°', color: '#64748b', font: { size: 10 } }, grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 9 } } }
                }
            }
        });
    }

    // Ubicamos los datos independientemente de si vienen en la raíz o dentro del nodo 'linealidad'
    const curvasRaw = dataElem.curvas_raw || dataElem.linealidad?.curvas_raw;
    const tablaData = dataElem.tabla || dataElem.linealidad?.tabla;
    const statsData = dataElem.stats || dataElem.linealidad?.stats;

    // 2. Gráfico de Curvas Individuales
    // Fallback al ID antiguo 'chart-calibracion' si no se ha actualizado el HTML
    const canvasInd = document.getElementById('chartCurvasInd') || document.getElementById('chart-calibracion');

    if (canvasInd && curvasRaw && Array.isArray(curvasRaw)) {
        const ctxInd = canvasInd.getContext('2d');
        if (instanciaChartCurvasInd) instanciaChartCurvasInd.destroy();

        let datasetsInd = curvasRaw.map((curva, i) => {
            const color = `hsl(${i * 60 + 200}, 70%, 50%)`;
            return {
                label: `Curva ${i + 1}`,
                data: curva.map(pt => ({ x: pt[0], y: pt[1] })),
                borderColor: color,
                backgroundColor: color,
                showLine: true,
                tension: 0
            };
        });

        instanciaChartCurvasInd = new Chart(ctxInd, {
            type: 'scatter',
            data: { datasets: datasetsInd },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { title: { display: true, text: 'Concentración' } },
                    y: { title: { display: true, text: 'Señal' } }
                }
            }
        });
    }

    // 3. Gráfico Curva Promedio
    const canvasAvg = document.getElementById('chartCurvaPromedio');

    if (canvasAvg && tablaData && Array.isArray(tablaData)) {
        const ctxAvg = canvasAvg.getContext('2d');
        if (instanciaChartCurvaPromedio) instanciaChartCurvaPromedio.destroy();

        let puntosPromedio = tablaData.map(row => ({ x: row.concentracion, y: row.promedio }));
        let lineaTendencia = [];

        if (statsData) {
            const xVals = tablaData.map(r => r.concentracion);
            const minX = Math.min(...xVals);
            const maxX = Math.max(...xVals);
            lineaTendencia = [
                { x: minX, y: statsData.intercepto_raw + (statsData.promedio_pendientes_raw * minX) },
                { x: maxX, y: statsData.intercepto_raw + (statsData.promedio_pendientes_raw * maxX) }
            ];
        }

        instanciaChartCurvaPromedio = new Chart(ctxAvg, {
            type: 'scatter',
            data: {
                datasets: [
                    {
                        label: 'Promedio Experimental',
                        data: puntosPromedio,
                        borderColor: '#2563eb',
                        backgroundColor: '#2563eb',
                        pointRadius: 5
                    },
                    {
                        type: 'line',
                        label: 'Línea de Regresión',
                        data: lineaTendencia,
                        borderColor: '#ef4444',
                        borderDash: [5, 5],
                        borderWidth: 2,
                        fill: false,
                        pointRadius: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { title: { display: true, text: 'Concentración' } },
                    y: { title: { display: true, text: 'Promedio de Señal' } }
                }
            }
        });
    }
};

window.prepararRASParaPDF = async function (container) {
    // 1. Validar si el elemento actual es RAS
    const selectElem = document.getElementById('selectElementoInforme');
    const paramVal = selectElem ? selectElem.value : window.elementoActivo;
    if (paramVal !== 'RAS' && !paramVal.includes('RAS')) return null;

    const linDataRAS = window.datosGlobales['RAS']?.linealidad;
    if (!linDataRAS || !linDataRAS.es_ras_combinado) return null;

    // 2. Crear un contenedor temporal al final del informe
    const tempWrapper = document.createElement('div');
    tempWrapper.id = 'bloque-temporal-ras-pdf';
    tempWrapper.className = 'w-full flex flex-col gap-6 mt-4 page-break-before'; // Salto de página

    const title = document.createElement('h3');
    title.className = 'font-bold text-xl text-slate-800 border-b-2 border-slate-300 pb-2 mb-2 uppercase text-center bg-slate-100 p-2 rounded';
    title.innerText = 'Desglose de Calibración y Sensibilidad para RAS (Ca, Mg, Na)';
    tempWrapper.appendChild(title);

    const chartsToDestroy = [];

    // 3. Iterar sobre los 3 cationes y construir su HTML
    ['Ca', 'Mg', 'Na'].forEach(elem => {
        const dataLin = linDataRAS[elem];
        if (!dataLin) return;

        const block = document.createElement('div');
        // page-break-inside-avoid evita que la gráfica se corte a la mitad de la página en el PDF
        block.className = 'p-5 border border-slate-300 rounded-lg bg-white shadow-sm';
        block.style.pageBreakInside = 'avoid';

        block.innerHTML = `
            <h4 class="font-bold text-slate-800 text-lg mb-3">Curva de Calibración - ${elem}</h4>
            <div class="flex flex-wrap gap-4 mb-4 text-sm">
                <div class="bg-blue-50 px-4 py-2 border border-blue-200 rounded text-blue-800 font-bold">Sensibilidad: ${dataLin.stats.sensibilidad}</div>
                <div class="bg-emerald-50 px-4 py-2 border border-emerald-200 rounded text-emerald-800 font-bold">R²: ${dataLin.stats.r2}</div>
                <div class="bg-slate-50 px-4 py-2 border border-slate-200 rounded text-slate-700">Ecuación: ${dataLin.stats.ecuacion}</div>
            </div>
            <div class="relative w-full flex justify-center" style="height: 320px;">
                <canvas id="temp-canvas-pdf-${elem}"></canvas>
            </div>
        `;
        tempWrapper.appendChild(block);
    });

    container.appendChild(tempWrapper);

    // 4. Renderizar las gráficas de Chart.js con la animación apagada
    ['Ca', 'Mg', 'Na'].forEach(elem => {
        const dataLin = linDataRAS[elem];
        if (!dataLin) return;

        const ctx = document.getElementById(`temp-canvas-pdf-${elem}`).getContext('2d');

        const puntosPromedio = dataLin.tabla.map(row => ({ x: row.concentracion, y: row.promedio }));
        const xVals = dataLin.tabla.map(r => r.concentracion);
        const minX = Math.min(...xVals);
        const maxX = Math.max(...xVals);
        const lineaTendencia = [
            { x: minX, y: dataLin.stats.intercepto_raw + dataLin.stats.promedio_pendientes_raw * minX },
            { x: maxX, y: dataLin.stats.intercepto_raw + dataLin.stats.promedio_pendientes_raw * maxX }
        ];

        const chart = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [
                    {
                        label: 'Promedio Experimental',
                        data: puntosPromedio,
                        borderColor: '#2563eb',
                        backgroundColor: '#2563eb',
                        pointRadius: 5
                    },
                    {
                        type: 'line',
                        label: 'Línea de Regresión',
                        data: lineaTendencia,
                        borderColor: '#ef4444',
                        borderDash: [5, 5],
                        borderWidth: 2,
                        fill: false,
                        pointRadius: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false, // ¡Crucial! Evita que html2canvas capture un canvas en blanco
                scales: {
                    x: { title: { display: true, text: 'Concentración' } },
                    y: { title: { display: true, text: 'Promedio de Señal' } }
                }
            }
        });
        chartsToDestroy.push(chart);
    });

    // Pequeña pausa para asegurar que el DOM dibujó los canvas
    await new Promise(r => setTimeout(r, 250));

    return { tempWrapper, chartsToDestroy };
};

window.limpiarRASParaPDF = function (setupData) {
    if (!setupData) return;
    // Destruir instancias de Chart.js para liberar memoria
    setupData.chartsToDestroy.forEach(c => c.destroy());
    // Eliminar el nodo temporal del DOM
    if (setupData.tempWrapper && setupData.tempWrapper.parentNode) {
        setupData.tempWrapper.parentNode.removeChild(setupData.tempWrapper);
    }
};

// -----------------------------------------------------------------------
// Obtiene la lista de "bloques" que se convertirán en imágenes del PDF.
// No basta con container.children: algunos contenedores (marcados con la
// clase 'pdf-grupo') solo agrupan visualmente varias subsecciones (p. ej.
// 6.3.1, 6.3.2, 6.3.3 y las tablas dinámicas 6.3.4+ por submatriz), y si
// se capturan como una sola imagen gigante, jsPDF la corta al llegar al
// borde de la página y el resto del contenido desaparece del PDF.
// Esta función desciende recursivamente dentro de cualquier 'pdf-grupo'
// para que cada subsección real (cada tabla/figura) sea su propio bloque.
// -----------------------------------------------------------------------
function obtenerBloquesPDF(container) {
    const bloques = [];
    function recorrer(elemento) {
        Array.from(elemento.children).forEach(hijo => {
            if (hijo.classList && hijo.classList.contains('pdf-grupo')) {
                recorrer(hijo);
            } else {
                bloques.push(hijo);
            }
        });
    }
    recorrer(container);
    return bloques;
}

// -----------------------------------------------------------------------
// Parámetros de calidad / memoria del PDF (ajustables)
//  - anchoObjetivoPx: ancho al que se rasteriza cada bloque. 1600 px sobre los
//    190 mm útiles de la hoja A4 equivalen a ~210 dpi: nítido y mucho más liviano
//    que el escalado fijo x2 anterior (que dependía del ancho de la pantalla).
//  - escalaMax: tope de escala para html2canvas.
//  - calidadJPEG: 0.90 es casi indistinguible del original en texto y tablas.
// -----------------------------------------------------------------------
window.PDF_OPCIONES = window.PDF_OPCIONES || {
    anchoObjetivoPx: 1600,
    escalaMax: 2,
    calidadJPEG: 0.9
};

// -----------------------------------------------------------------------
// Construye el PDF (compartido por exportarPDF y por la descarga masiva ZIP).
// Por qué antes se quedaba sin memoria (Out of Memory en pdf.save):
//  1. Los bloques se incrustaban como PNG: jsPDF decodifica cada PNG a píxeles
//     crudos (4 bytes/píxel) y lo vuelve a comprimir, y todo se acumula en RAM
//     hasta armar el archivo final. JPEG se incrusta tal cual, sin recodificar.
//  2. Se rasterizaba a scale 2 fijo; ahora el tamaño se acota por ancho objetivo.
//  3. Los canvas de cada bloque no se liberaban hasta que el GC pasaba.
//  4. html2canvas clona TODO el documento en cada llamada, incluyendo una copia
//     de cada gráfica Chart.js (a 3x de densidad): se omiten las que no
//     pertenecen al bloque que se está capturando.
// -----------------------------------------------------------------------
async function construirPDF(overrides = {}) {
    const opt = Object.assign({}, window.PDF_OPCIONES, overrides);
    const { jsPDF } = window.jspdf;

    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
    if (opt.zoom150) pdf.setDisplayMode(1.5, 'continuous', 'UseNone');

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const usableWidth = pageWidth - (margin * 2);
    let cursorY = margin;

    const container = document.getElementById('previewInformeContainer');
    const blocks = obtenerBloquesPDF(container).filter(b => b && b.offsetHeight > 0);

    const originalBorder = container.style.border;
    const originalShadow = container.style.boxShadow;
    container.style.border = 'none';
    container.style.boxShadow = 'none';

    try {
        for (let i = 0; i < blocks.length; i++) {
            const block = blocks[i];
            const escala = Math.max(1, Math.min(opt.escalaMax, opt.anchoObjetivoPx / block.offsetWidth));

            let canvas = await html2canvas(block, {
                scale: escala,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
                // No clonar las gráficas que no pertenecen a este bloque
                ignoreElements: (el) => el.tagName === 'CANVAS' && !block.contains(el)
            });

            const imgWidth = usableWidth;
            const imgHeight = (canvas.height * usableWidth) / canvas.width;
            let imgData = canvas.toDataURL('image/jpeg', opt.calidadJPEG);

            // Liberar el canvas de inmediato (no esperar al recolector de basura)
            canvas.width = 0;
            canvas.height = 0;
            canvas = null;

            if (cursorY + imgHeight > pageHeight - margin && cursorY > margin) {
                pdf.addPage();
                cursorY = margin;
            }

            pdf.addImage(imgData, 'JPEG', margin, cursorY, imgWidth, imgHeight, undefined, 'FAST');
            imgData = null;
            cursorY += imgHeight + 4;

            // Ceder el hilo para que el navegador pueda liberar memoria entre bloques
            await new Promise(r => setTimeout(r, 0));
        }
    } finally {
        container.style.border = originalBorder;
        container.style.boxShadow = originalShadow;
    }

    return pdf;
}

window.exportarPDF = async function () {
    window.scrollTo(0, 0);
    try {
        // A. Recopilar datos y generar código único corto
        const datos = recopilarDatosDelInforme();
        const codigoUnico = generarCodigoUnico(datos.parametro);
        
        // B. Mostrar el código en el documento visual
        const prevCodigo = document.getElementById('prev-codigo');
        if (prevCodigo) {
            prevCodigo.innerText = `Código: ${codigoUnico}`;
        }

        // C. Guardar el registro en la base de datos PostgreSQL
        const datosMetrologicos = window.datosGlobales[datos.parametro] || {};
        const payloadCompleto = { ...datos, ...datosMetrologicos };

        await guardarPersistenciaEnSQL(codigoUnico, datos.parametro, datos.matriz, payloadCompleto);

        // D. Generar y descargar el documento PDF
        const pdf = await construirPDF({ zoom150: true });
        pdf.setPage(1);
        pdf.save(`Informe_Validacion_${datos.parametro}_${codigoUnico}.pdf`);
    } catch (error) {
        console.error('Error al generar el PDF:', error);
        alert('Ocurrió un problema al generar el PDF. Cierre las herramientas de desarrollador (F12) e inténtelo de nuevo.');
    }
};

async function generarPDFBlob() {
    // Versión más liviana para el ZIP (varios PDFs acumulados en memoria)
    const pdf = await construirPDF({ escalaMax: 1.5, calidadJPEG: 0.75 });
    return pdf.output('blob');
}

// Función principal de exportación masiva (Se mantiene intacta ya que interactúa perfectamente mediante generarPDFBlob)
window.exportarTodosPDFsZip = async function (btnElement) {
    const select = document.getElementById('selectElementoInforme');
    if (!select || select.options.length === 0) return;

    const zip = new JSZip();
    const valorInicial = select.value;
    const textoOriginalBoton = btnElement.innerHTML;

    btnElement.disabled = true;

    try {
        for (let i = 0; i < select.options.length; i++) {
            const option = select.options[i];
            const paramVal = option.value;

            // Actualizar feedback visual en el botón
            btnElement.innerText = `Procesando ${paramVal} (${i + 1}/${select.options.length})...`;

            // Cambiar parámetro y forzar actualización del DOM / Gráficos
            select.value = paramVal;
            if (typeof window.cambiarElementoInforme === 'function') {
                window.cambiarElementoInforme(paramVal);
            }
            if (typeof window.guardarMetadatosYCompilar === 'function') {
                window.guardarMetadatosYCompilar();
            }

            // Pausa de 300ms para permitir el renderizado completo de Chart.js y tablas
            await new Promise(resolve => setTimeout(resolve, 300));

            // 1. Recopilar datos y generar código único para este elemento
            const datos = recopilarDatosDelInforme();
            const codigoUnico = generarCodigoUnico(paramVal);

            // 2. Actualizar el código visible en el encabezado del informe
            const prevCodigo = document.getElementById('prev-codigo');
            if (prevCodigo) {
                prevCodigo.innerText = `Código: ${codigoUnico}`;
            }

            // 3. Guardar persistencia en BD para este parámetro
            const datosMetrologicos = window.datosGlobales[paramVal] || {};
            const payloadCompleto = { ...datos, ...datosMetrologicos };

            await guardarPersistenciaEnSQL(codigoUnico, paramVal, datos.matriz, payloadCompleto);

            // 4. Generar el Blob del PDF e insertarlo al paquete ZIP
            const pdfBlob = await generarPDFBlob();
            zip.file(`Informe_Validacion_${paramVal}_${codigoUnico}.pdf`, pdfBlob);
        }

        btnElement.innerText = 'Empaquetando ZIP...';

        // Generar y descargar el archivo final ZIP
        const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
        const downloadLink = document.createElement('a');
        downloadLink.href = URL.createObjectURL(zipBlob);
        downloadLink.download = `Informes_Validacion_SGI_${new Date().toISOString().slice(0, 10)}.zip`;
        downloadLink.click();
        URL.revokeObjectURL(downloadLink.href);

    } catch (error) {
        console.error('Error al generar la descarga masiva ZIP:', error);
        alert('Ocurrió un problema al procesar los archivos.');
    } finally {
        // Restaurar estado original del selector y del botón
        select.value = valorInicial;
        if (typeof window.cambiarElementoInforme === 'function') {
            window.cambiarElementoInforme(valorInicial);
        }
        btnElement.innerHTML = textoOriginalBoton;
        btnElement.disabled = false;
    }
};

// Inicialización limpia al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
    if (typeof window.cambiarSeccion === 'function') {
        window.cambiarSeccion('carga');
    }
});

function generarCodigoUnico(parametro) {
    const timestamp = Date.now().toString().slice(-6); // Últimos 6 dígitos del timestamp
    const random = Math.floor(Math.random() * 100).toString().padStart(2, '0');
    return `INF-${parametro}-${timestamp}-${random}`;
}

// 2. Función para recolectar los datos visibles del formulario en el DOM
function recopilarDatosDelInforme() {
    return {
        parametro: document.getElementById("selectElementoInforme")?.value || "",
        codigo_procedimiento: document.getElementById("inp-inf-codigo")?.value || "",
        nombre_procedimiento: document.getElementById("inp-inf-nombre-procedimiento")?.value || "",
        matriz: document.getElementById("sel-inf-matriz")?.value || "",
        tecnica: document.getElementById("inp-inf-tecnica")?.value || "",
        norma: document.getElementById("inp-inf-norma")?.value || "",
        metodo_preparacion: document.getElementById("inp-inf-metodo-preparacion")?.value || "",
        revision: document.getElementById("inp-inf-revision-version")?.value || "",
        procedimiento_interno: document.getElementById("inp-inf-procedimiento-interno")?.value || "",
        tipo_metodo: document.getElementById("sel-inf-tipo-metodo")?.value || "",
        tipo_estudio: document.getElementById("sel-inf-tipo-estudio")?.value || "",
        analista1: document.getElementById("inp-inf-analista1")?.value || "",
        analista2: document.getElementById("inp-inf-analista2")?.value || "",
        responsable: document.getElementById("inp-inf-resp")?.value || "",
        fecha: document.getElementById("inp-inf-fecha")?.value || ""
    };
}

// 3. Función para enviar y guardar el informe en la base de datos SQL (FastAPI / PostgreSQL)
async function guardarPersistenciaEnSQL(codigoUnico, parametro, matriz, datosCompletos) {
    try {
        // CORRECCIÓN: Agregar http://localhost:8000 antes de la API
        const response = await fetch("http://localhost:8000/api/guardar-reporte", { 
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                codigo_informe: codigoUnico,
                parametro: parametro,
                matriz: matriz,
                datos_completos: datosCompletos
            })
        });
        
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(`Error en el servidor: ${JSON.stringify(errData)}`);
        }
        
        console.log(`✅ Reporte ${codigoUnico} guardado en BD exitosamente.`);
    } catch (error) {
        console.error("❌ Error al guardar en la base de datos:", error);
        alert(`Atención: El PDF se generará pero no se pudo guardar en la BD. Detalle: ${error.message}`);
    }
}