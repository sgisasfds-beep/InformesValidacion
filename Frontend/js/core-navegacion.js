/**
 * CORE - NAVEGACIÓN Y CARGA DE DATOS
 * -----------------------------------------------------------------------
 * Router simple entre vistas (cambiarSeccion), envío del formulario de
 * carga (procesarFormulario) y utilidades de selector de elemento/tabs
 * usadas por varias secciones (poblarSelectorGlobal, cambiarElementoGlobal,
 * actualizarTabs). Cárgalo después de core-estado.js.
 * -----------------------------------------------------------------------
 */

// Gestor de Vistas (Navegación sin React)

window.aplicarPermisosVisuales = function () {
    const rolActual = (window.usuarioActual && window.usuarioActual.rol) ? window.usuarioActual.rol.toLowerCase() : '';
    document.querySelectorAll('[data-permiso]').forEach(el => {
        const permitidos = el.getAttribute('data-permiso')
            .split(',')
            .map(r => r.trim().toLowerCase());
        el.style.display = permitidos.includes(rolActual) ? '' : 'none';
    });
};

window.cambiarSeccion = async function (seccion) {
    try {
        const response = await fetch(`views/${seccion}.html`);
        const html = await response.text();
        document.getElementById('main-content').innerHTML = html;
        window.vistaActual = seccion;

        window.aplicarPermisosVisuales();

        // Actualizar barra de navegación visual
        document.querySelectorAll('aside nav button').forEach(btn => {
            btn.classList.remove('bg-blue-600', 'text-white');
            btn.classList.add('hover:bg-slate-800', 'text-slate-400');
        });
        const activeBtn = document.getElementById(`btn-${seccion}`);
        if (activeBtn) {
            activeBtn.classList.remove('hover:bg-slate-800', 'text-slate-400');
            activeBtn.classList.add('bg-blue-600', 'text-white');
        }

        // Lógica post-renderizado de vista
        if (seccion === 'carga') {
            // Corrección: Validación para evitar el TypeError si el formulario no existe
            const uploadForm = document.getElementById('uploadForm');
            if (uploadForm) {
                uploadForm.addEventListener('submit', window.procesarFormulario);
            } else {
                console.warn("Advertencia: No se encontró un elemento con id='uploadForm' en views/carga.html");
            }
        } else if (seccion === 'linealidad') {
            // Se eliminó el listener del formulario viejo. Ahora lee de datosGlobales.
            if (Object.keys(window.datosGlobales).length > 0) {
                window.poblarSelectorLinealidad();
                if (window.parametroActivoLin) {
                    window.renderizarDatosLinealidad(window.parametroActivoLin);
                }
            }
        } else if (seccion === 'informe') {
            window.poblarSelectorInforme();
            window.guardarMetadatosYCompilar();
        } else {
            window.poblarSelectorGlobal();
            if (seccion === 'limites') window.renderizarLimites();
            if (seccion === 'precision') window.renderizarPrecision(window.controlActivoPrec);
            if (seccion === 'exactitud') window.renderizarExactitud(window.controlActivoExa);
            if (seccion === 'estandarizacion') {
                window.poblarSelectorGlobal();
                if (typeof window.renderizarEstandarizacion === 'function') {
                    window.renderizarEstandarizacion();
                }
            }

            if (seccion === 'robustez') {
                if (window.SeccionRobustez && typeof window.SeccionRobustez.init === 'function') {
                    window.SeccionRobustez.init(window.elementoActivo, window.datosGlobales);
                } else {
                    console.warn("Advertencia: window.SeccionRobustez no está definido. ¿Falta el <script src='js/seccion-robustez.js'> en index.html?");
                }
            }

            if (seccion === 'rango-trabajo') {
                if (typeof window.renderizarRangoTrabajo === 'function') {
                    window.renderizarRangoTrabajo(window.elementoActivo);
                }
            }
            
            if (seccion === 'incertidumbre') {
                // Pequeño delay para asegurar que el DOM esté renderizado
                setTimeout(() => {
                    window.cargarConfigIncertidumbre();
                    window.calcularIncertidumbre();
                }, 50);
            }
        }
    } catch (e) {
        console.error("Error cargando la vista:", e);
    }
};

window.procesarFormulario = async function (e) {
    e.preventDefault();
    const formData = new FormData();
    const qcFiles = document.getElementById('archivos_qc').files;
    const configFile = document.getElementById('archivo_config').files[0];
    const rolUsuario = window.usuarioActual ? window.usuarioActual.rol : 'admin';
    const selectTipoAnalisis = document.getElementById('tipo_analisis');
    const permisosMatriz = ['metales', 'admin'];
    const tipoAnalisis = (selectTipoAnalisis && permisosMatriz.includes(rolUsuario.toLowerCase()))
        ? selectTipoAnalisis.value
        : 'estandar';

    if (!qcFiles.length || !configFile) {
        alert("Por favor selecciona los archivos requeridos.");
        return;
    }

    for (let f of qcFiles) formData.append('archivos_qc', f);
    formData.append('archivo_config', configFile);
    formData.append('tipo_analisis', tipoAnalisis);
    formData.append('area_analisis', rolUsuario);

    // Suelos: una humedad (pW / Humedad) por submatriz -> JSON {"arenoso": {"pw": x, "humedad": x}, ...}
    if (tipoAnalisis === 'suelos') {
        const humedades = window.sincronizarHumedadesSuelos();
        if (Object.keys(humedades).length === 0) {
            alert("Para la matriz Suelos agrega al menos una submatriz con su " + window.etiquetaHumedad() + ".");
            return;
        }
        formData.append('humedades_suelos', JSON.stringify(humedades));
    } else {
        formData.append('humedades_suelos', '{}');
    }
    window.tipoAnalisisActual = tipoAnalisis;
    window.areaAnalisisActual = rolUsuario.toLowerCase();

    try {
        const response = await fetch(`${window.API_BASE_URL}/api/procesar-datos`, {
            method: 'POST',
            body: formData
        });
        window.datosGlobales = await response.json();

        const elementos = Object.keys(window.datosGlobales);
        if (elementos.length > 0) {
            window.elementoActivo = elementos[0];
        }
        window.cambiarSeccion('limites');
    } catch (err) {
        alert("Error al comunicarse con el servidor o procesar archivos.");
    }
};

/* --- MANTENIENDO EL RESTO INTACTO --- */

window.cambiarElementoGlobal = function (val) {
    window.elementoActivo = val;
    if (window.vistaActual === 'limites') window.renderizarLimites();
    if (window.vistaActual === 'precision') window.renderizarPrecision(window.controlActivoPrec);
    if (window.vistaActual === 'exactitud') {
        if (window.subvistaExactitud === 'muestras') window.renderizarMuestrasAdicionadas(window.matrizActivaMuestra);
        else window.renderizarExactitud(window.controlActivoExa);
    }
    if (window.vistaActual === 'robustez') {
    if (typeof window.SeccionRobustez !== 'undefined') {
            window.SeccionRobustez.init(window.elementoActivo, window.datosGlobales);
        }
    }
    if (window.vistaActual === 'rango-trabajo') window.renderizarRangoTrabajo(window.elementoActivo);

    // Si estamos en la pestaña de incertidumbre, cargar/recalcular datos del nuevo elemento
    if (document.getElementById('sec-incertidumbre')) {
        window.cargarConfigIncertidumbre();
        window.calcularIncertidumbre();
    }
};

window.poblarSelectorGlobal = function () {
    const select = document.getElementById('selectElementoGlobal');
    if (!select) return;
    select.innerHTML = '';
    Object.keys(window.datosGlobales).forEach(elem => {
        const opt = document.createElement('option');
        opt.value = elem;
        opt.textContent = elem;
        if (elem === window.elementoActivo) opt.selected = true;
        select.appendChild(opt);
    });
};

window.actualizarTabs = function (prefijo, controlSeleccionado) {
    const botones = ['lcm', 'ccv', 'ea'];
    botones.forEach(c => {
        const btn = document.getElementById(`tab-${prefijo}-${c.toUpperCase()}`) || document.getElementById(`tab-${prefijo}-${c}`);
        if (btn) {
            if (c.toLowerCase() === controlSeleccionado.toLowerCase()) {
                btn.className = "px-4 py-2 text-sm font-bold rounded shadow-sm transition btn-tab bg-blue-600 text-white";
            } else {
                btn.className = "px-4 py-2 text-sm font-bold rounded shadow-sm transition btn-tab bg-white text-slate-600 border border-slate-300 hover:bg-slate-50";
            }
        }
    });
};

/* ======================================================================
 * MATRIZ SUELOS: filas dinámicas "submatriz + pW/Humedad"
 * ====================================================================== */

// Metales (y admin) usan pW; fisicoquímico usa Humedad.
window.etiquetaHumedad = function () {
    const rol = (window.usuarioActual && window.usuarioActual.rol) ? window.usuarioActual.rol.toLowerCase() : 'admin';
    return rol === 'fisicoquimico' ? 'Humedad (%)' : 'pW (%)';
};

// Deshabilita en cada <select> las submatrices ya elegidas en otras filas (sin duplicados)
window.actualizarOpcionesSubmatrices = function () {
    const selects = Array.from(document.querySelectorAll('#lista_submatrices .sel-submatriz'));
    const usadas = selects.map(sel => sel.value);
    selects.forEach(sel => {
        Array.from(sel.options).forEach(opt => {
            opt.disabled = (opt.value !== sel.value) && usadas.includes(opt.value);
        });
    });
    const btn = document.getElementById('btn-agregar-submatriz');
    if (btn) btn.disabled = selects.length >= window.MATRICES_SUELO.length;
};

// Lee las filas, actualiza el input oculto #humedades_suelos y devuelve el objeto
window.sincronizarHumedadesSuelos = function () {
    const resultado = {};
    document.querySelectorAll('#lista_submatrices .fila-submatriz').forEach(fila => {
        const matriz = fila.querySelector('.sel-submatriz').value;
        const valor = parseFloat(fila.querySelector('.inp-humedad').value);
        const v = isNaN(valor) ? 0 : valor;
        // Se guardan ambas claves con el mismo valor: el backend elige según el área
        resultado[matriz] = { pw: v, humedad: v };
    });
    const hidden = document.getElementById('humedades_suelos');
    if (hidden) hidden.value = JSON.stringify(resultado);
    window.actualizarOpcionesSubmatrices();
    return resultado;
};

window.agregarFilaSubmatriz = function () {
    const lista = document.getElementById('lista_submatrices');
    if (!lista) return;

    const usadas = Array.from(lista.querySelectorAll('.sel-submatriz')).map(s => s.value);
    const libre = window.MATRICES_SUELO.find(m => !usadas.includes(m));
    if (!libre) return; // ya están las 3

    const fila = document.createElement('div');
    fila.className = 'fila-submatriz flex flex-wrap items-end gap-3';
    fila.innerHTML = `
        <div class="flex-1 min-w-[160px]">
            <label class="text-[10px] text-slate-400 uppercase font-bold block mb-1">Submatriz</label>
            <select class="sel-submatriz w-full text-sm border border-slate-200 p-2 rounded-lg bg-white focus:border-[#4361EE] focus:outline-none">
                ${window.MATRICES_SUELO.map(m => `<option value="${m}">${window.ETIQUETAS_SUELO[m]}</option>`).join('')}
            </select>
        </div>
        <div class="w-40">
            <label class="text-[10px] text-slate-400 uppercase font-bold block mb-1">${window.etiquetaHumedad()}</label>
            <input type="number" step="any" min="0" value="0"
                class="inp-humedad w-full text-sm border border-slate-200 p-2 rounded-lg bg-white focus:border-[#4361EE] focus:outline-none">
        </div>
        <button type="button" class="btn-quitar-submatriz text-red-500 hover:text-red-700 text-xs font-bold px-2 py-2">✕ Quitar</button>
    `;
    fila.querySelector('.sel-submatriz').value = libre;
    fila.querySelector('.sel-submatriz').addEventListener('change', window.sincronizarHumedadesSuelos);
    fila.querySelector('.inp-humedad').addEventListener('input', window.sincronizarHumedadesSuelos);
    fila.querySelector('.btn-quitar-submatriz').addEventListener('click', () => {
        fila.remove();
        window.sincronizarHumedadesSuelos();
    });
    lista.appendChild(fila);
    window.sincronizarHumedadesSuelos();
};