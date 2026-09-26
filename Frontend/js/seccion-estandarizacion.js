/**
 * SECCIÓN - ESTANDARIZACIÓN DE SOLUCIONES
 * -----------------------------------------------------------------------
 * Motor de cálculos por parámetro (Cloruros).
 * Campo editable para Volumen de Muestra en encabezado utilizado para Patrón.
 * -----------------------------------------------------------------------
 */

window.ROLES_PERMITIDOS = ['Titulante', 'Solución Valorada', 'Patrón'];

/* ------------------ MATRIZ DE FÓRMULAS POR PARÁMETRO ------------------ */

window.FORMULAS_PARAMETROS = {
    'CLORUROS': {
        calcularNSlnVal: (r) => { const p = parseFloat(r.peso), v = parseFloat(r.volSlnValorada); return (p > 0) ? ((v > 0) ? (p * 1000) / (58.44 * v) : p / 58.44) : null; },
        calcularNTitulante: (r, nSlnVal) => { const vVal = parseFloat(r.volSlnValorada), vTit = parseFloat(r.volTitulante); return (nSlnVal && vVal && vTit > 0) ? (nSlnVal * vVal) / vTit : null; },
        calcularPatron: (r, nTit, b) => { const vTit = parseFloat(r.volTitulante), vM = parseFloat(b?.volMuestra); return (nTit && vTit && vM > 0) ? (vTit * nTit * 35450) / vM : null; }
    },
    'ALCALINIDAD': {
        calcularNSlnVal: (r) => parseFloat(r.peso) ? parseFloat(r.peso) / 58.44 : null,
        calcularNTitulante: (r) => { const vVal = parseFloat(r.volSlnValorada), p = parseFloat(r.peso), vTit = parseFloat(r.volTitulante); return (vVal && p && vTit > 0) ? (vVal * p) / (vTit * 53) : null; },
        calcularPatron: (r, nTit, b) => { const vTit = parseFloat(r.volTitulante), vM = parseFloat(b?.volMuestra), fd = parseFloat(r.fd) || 1; return (nTit && vTit && vM > 0) ? ((vTit * nTit * 50000) / vM) * fd : null; }
    },
    'NITROGENO AMONIACAL': {
        calcularNSlnVal: (r) => parseFloat(r.peso) ? parseFloat(r.peso) / 58.44 : null,
        calcularNTitulante: (r) => { const vVal = parseFloat(r.volSlnValorada), p = parseFloat(r.peso), vTit = parseFloat(r.volTitulante); return (vVal && p && vTit > 0) ? (vVal * p) / (vTit * 53) : null; },
        calcularPatron: (r, nTit, b) => { const vTit = parseFloat(r.volTitulante), vM = parseFloat(b?.volMuestra), fd = parseFloat(r.fd) || 1; return (nTit && vTit && vM > 0) ? ((vTit * nTit * 14007) / vM) * fd : null; }
    },
    'NITROGENO KJELDAHL': {
        calcularNSlnVal: (r) => parseFloat(r.peso) ? parseFloat(r.peso) / 58.44 : null,
        calcularNTitulante: (r) => { const vVal = parseFloat(r.volSlnValorada), p = parseFloat(r.peso), vTit = parseFloat(r.volTitulante); return (vVal && p && vTit > 0) ? (vVal * p) / (vTit * 53) : null; },
        calcularPatron: (r, nTit, b) => { const vTit = parseFloat(r.volTitulante), vM = parseFloat(b?.volMuestra), fd = parseFloat(r.fd) || 1; return (nTit && vTit && vM > 0) ? ((vTit * nTit * 14007) / vM) * fd : null; }
    },
    'ACIDEZ': {
        calcularNSlnVal: (r) => parseFloat(r.peso) ? parseFloat(r.peso) / 58.44 : null,
        calcularNTitulante: (r, nSlnVal, b, pestana) => {
            const vVal = parseFloat(r.volSlnValorada), p = parseFloat(r.peso), vTit = parseFloat(r.volTitulante);
            const divisor = (pestana?.reactivoAcidez === 'H2SO4') ? 53 : 204.2;
            return (vVal && p && vTit > 0) ? (vVal * p) / (vTit * divisor) : null;
        },
        calcularPatron: (r, nTit, b, nSlnVal) => {
            const vNaOH = parseFloat(r.volSlnValorada), nNaOH = nSlnVal;
            const vAcido = parseFloat(r.volTitulante), nAcido = nTit;
            const vM = parseFloat(b?.volMuestra);
            if (!vNaOH || !nNaOH || !vAcido || !nAcido || !vM || vM <= 0) return null;
            return (((vNaOH * nNaOH) - (vAcido * nAcido)) * 50000) / vM;
        }
    },
    'DUREZAS': {
        calcularNSlnVal: (r) => parseFloat(r.peso) ? parseFloat(r.peso) / 58.44 : null,
        calcularNTitulante: (r, nSlnVal) => { const vVal = parseFloat(r.volSlnValorada), vTit = parseFloat(r.volTitulante); return (nSlnVal && vVal && vTit > 0) ? (vVal * nSlnVal) / vTit : null; },
        calcularPatron: (r, nTit, b) => { const vTit = parseFloat(r.volTitulante), vM = parseFloat(b?.volMuestra), fd = parseFloat(r.fd) || 1; return (nTit && vTit && vM > 0) ? ((vTit * 100000 * nTit) / vM) * fd : null; }
    },
    'CAPACIDAD DE INTERCAMBIO CATIONICO': {
        calcularNSlnVal: () => null,
        calcularNTitulante: (r) => {
            const p = parseFloat(r.peso), vTit = parseFloat(r.volTitulante);
            return (p && vTit > 0) ? (p * 1000) / (204.22 * vTit) : null;
        },
        calcularPatron: () => null
    },
    'ACIDEZ INTERCAMBIABLE': {
        calcularNSlnVal: () => null,
        calcularNTitulante: (r) => {
            const p = parseFloat(r.peso), vTit = parseFloat(r.volTitulante);
            return (p && vTit > 0) ? (p * 1000) / (204.22 * vTit) : null;
        },
        calcularPatron: () => null
    },
    'ALUMINIO INTERCAMBIABLE': {
        calcularNSlnVal: () => null,
        calcularNTitulante: (r, nSlnVal, b, pestana) => {
            const reactivo = pestana?.reactivoAluminio || 'NaOH';
            const vTit = parseFloat(r.volTitulante);

            if (reactivo === 'NaOH') {
                const p = parseFloat(r.peso);
                return (p && vTit > 0) ? (p * 1000) / (204.22 * vTit) : null;
            } else { // Caso HCl
                const vNaOH = parseFloat(r.volSlnValorada);
                const nNaOH = nSlnVal;
                return (vNaOH && nNaOH && vTit > 0) ? (vNaOH * nNaOH) / vTit : null;
            }
        },
        calcularPatron: () => null
    }
};

/* ------------------------- INICIALIZACIÓN / ESTADO ------------------------- */

window.inicializarEstandarizacion = function () {
    if (!window._estInicializado) {
        window._estInicializado = true;

        try {
            window.CONFIG_PARAMETROS_ESTANDARIZACION = JSON.parse(localStorage.getItem('configParametrosEstandarizacion')) || null;
        } catch (e) { window.CONFIG_PARAMETROS_ESTANDARIZACION = null; }

        if (!window.CONFIG_PARAMETROS_ESTANDARIZACION || !window.CONFIG_PARAMETROS_ESTANDARIZACION.length) {
            window.CONFIG_PARAMETROS_ESTANDARIZACION = [
                { nombre: 'CLORUROS', peq: 35.45 },
                { nombre: 'ALCALINIDAD', peq: 50 },
                { nombre: 'NITROGENO AMONIACAL', peq: 14 },
                { nombre: 'NITROGENO KJELDAHL', peq: 14 },
                { nombre: 'ACIDEZ', peq: 50 },
                { nombre: 'DUREZAS', peq: 50 },
                { nombre: 'CAPACIDAD DE INTERCAMBIO CATIONICO', peq: 1 },
                { nombre: 'ACIDEZ INTERCAMBIABLE', peq: 1 },
                { nombre: 'ALUMINIO INTERCAMBIABLE', peq: 9 }
            ];
            localStorage.setItem('configParametrosEstandarizacion', JSON.stringify(window.CONFIG_PARAMETROS_ESTANDARIZACION));
        }

        try {
            window.datosEstandarizacion = JSON.parse(localStorage.getItem('datosEstandarizacion')) || {};
        } catch (e) { window.datosEstandarizacion = {}; }

        window.parametroActivoEst = window.CONFIG_PARAMETROS_ESTANDARIZACION[0].nombre;
        window.tabActivoId = null;
    }
};

window.crearBloqueVacio = function (id) {
    return {
        id: id,
        nombreMuestra: '',
        fecha: '',
        volMuestra: '', // Campo para el volumen de muestra a nivel de bloque
        replicas: [
            { peso: '', volSlnValorada: '', volTitulante: '', fd: '1' },
            { peso: '', volSlnValorada: '', volTitulante: '', fd: '1' },
            { peso: '', volSlnValorada: '', volTitulante: '', fd: '1' }
        ]
    };
};

window.asegurarEstructuraParametro = function (parametro) {
    if (!window.datosEstandarizacion[parametro]) {
        window.datosEstandarizacion[parametro] = {
            pestanas: [
                {
                    id: 'tab_' + Date.now(),
                    nombre: 'Solución 1',
                    rol: 'Titulante',
                    creadoEn: Date.now(),
                    estandarizaciones: [window.crearBloqueVacio(1)]
                }
            ]
        };
    }
    const pestanas = window.datosEstandarizacion[parametro].pestanas;
    if (pestanas.length > 0 && !window.tabActivoId) {
        window.tabActivoId = pestanas[0].id;
    }
};

window.guardarEstandarizacion = function () {
    try {
        localStorage.setItem('datosEstandarizacion', JSON.stringify(window.datosEstandarizacion));
    } catch (e) {
        console.error('No se pudo guardar la estandarización en localStorage', e);
    }
};

/* ---------------- MOTOR DE BÚSQUEDA Y CÁLCULOS POR RÉPLICA ---------------- */

window.obtenerReplicaMismaFila = function (parametro, rolBuscado, bloqueIdx, replicaIdx) {
    const pestanas = window.datosEstandarizacion[parametro]?.pestanas || [];
    const pestanaOrigen = pestanas
        .filter(p => p.rol === rolBuscado && p.id !== window.tabActivoId)
        .sort((a, b) => (b.creadoEn || 0) - (a.creadoEn || 0))[0];

    if (!pestanaOrigen) return null;
    return pestanaOrigen.estandarizaciones[bloqueIdx]?.replicas[replicaIdx] || null;
};

window.resolverCalculosFila = function (parametro, pestana, replicaActual, bloque, bloqueIdx, replicaIdx) {
    const rolActual = pestana?.rol;
    const formulas = window.FORMULAS_PARAMETROS[parametro.toUpperCase()] || window.FORMULAS_PARAMETROS['CLORUROS'];

    let nSlnVal = null;
    let nTit = null;
    let resultadoFinal = null;

    // 1. Normalidad Solución Valorada
    if (rolActual === 'Solución Valorada') {
        nSlnVal = formulas.calcularNSlnVal(replicaActual);
    } else {
        const replicaSlnVal = window.obtenerReplicaMismaFila(parametro, 'Solución Valorada', bloqueIdx, replicaIdx);
        if (replicaSlnVal) {
            nSlnVal = formulas.calcularNSlnVal(replicaSlnVal);
        }

        if (nSlnVal === null) {
            const replicaTit = window.obtenerReplicaMismaFila(parametro, 'Titulante', bloqueIdx, replicaIdx);
            if (replicaTit) {
                nSlnVal = formulas.calcularNSlnVal(replicaTit);
            }
        }

        if (nSlnVal === null) {
            nSlnVal = formulas.calcularNSlnVal(replicaActual);
        }
    }

    // 2. Normalidad Titulante
    if (rolActual === 'Titulante') {
        nTit = formulas.calcularNTitulante(replicaActual, nSlnVal, bloque, pestana);
    } else {
        const replicaTit = window.obtenerReplicaMismaFila(parametro, 'Titulante', bloqueIdx, replicaIdx);
        if (replicaTit) {
            const nSlnValRef = formulas.calcularNSlnVal(replicaTit) || nSlnVal;
            nTit = formulas.calcularNTitulante(replicaTit, nSlnValRef, bloque, pestana);
        }
    }

    // 3. Resultado Final según el Rol
    if (rolActual === 'Solución Valorada') {
        resultadoFinal = nSlnVal;
    } else if (rolActual === 'Titulante') {
        resultadoFinal = nTit;
    } else if (rolActual === 'Patrón') {
        resultadoFinal = formulas.calcularPatron(replicaActual, nTit, bloque, nSlnVal);
    }

    return { nSlnVal, nTit, resultadoFinal };
};

window.cambiarReactivoAcidezEst = function (tabId, reactivo) {
    const parametro = window.parametroActivoEst;
    const pestana = window.datosEstandarizacion[parametro]?.pestanas.find(p => p.id === tabId);
    if (pestana) {
        pestana.reactivoAcidez = reactivo;
        window.guardarEstandarizacion();
        window.renderizarEstandarizacion();
    }
};

window.cambiarReactivoAluminioEst = function (tabId, reactivo) {
    const parametro = window.parametroActivoEst;
    const pestana = window.datosEstandarizacion[parametro]?.pestanas.find(p => p.id === tabId);
    if (pestana) {
        pestana.reactivoAluminio = reactivo;
        window.guardarEstandarizacion();
        window.renderizarEstandarizacion();
    }
};
/* ---------------------- GESTIÓN DINÁMICA DE PESTAÑAS ---------------------- */

window.agregarPestanaEst = function () {
    const parametro = window.parametroActivoEst;
    if (!parametro) return;
    window.asegurarEstructuraParametro(parametro);

    const pestanas = window.datosEstandarizacion[parametro].pestanas;
    const num = pestanas.length + 1;
    const nuevaPestana = {
        id: 'tab_' + Date.now(),
        nombre: `Solución ${num}`,
        rol: 'Titulante',
        creadoEn: Date.now(),
        estandarizaciones: [window.crearBloqueVacio(1)]
    };

    pestanas.push(nuevaPestana);
    window.tabActivoId = nuevaPestana.id;
    window.guardarEstandarizacion();
    window.renderizarEstandarizacion();
};

window.seleccionarPestanaEst = function (tabId) {
    window.tabActivoId = tabId;
    window.renderizarEstandarizacion();
};

window.eliminarPestanaEst = function (tabId, event) {
    if (event) event.stopPropagation();
    const parametro = window.parametroActivoEst;
    let pestanas = window.datosEstandarizacion[parametro].pestanas;

    if (pestanas.length <= 1) {
        alert('Debe haber al menos una solución creada.');
        return;
    }

    window.datosEstandarizacion[parametro].pestanas = pestanas.filter(p => p.id !== tabId);
    if (window.tabActivoId === tabId) {
        window.tabActivoId = window.datosEstandarizacion[parametro].pestanas[0].id;
    }
    window.guardarEstandarizacion();
    window.renderizarEstandarizacion();
};

window.cambiarRolPestanaEst = function (tabId, nuevoRol) {
    const parametro = window.parametroActivoEst;
    const pestana = window.datosEstandarizacion[parametro].pestanas.find(p => p.id === tabId);
    if (pestana) {
        pestana.rol = nuevoRol;
        window.guardarEstandarizacion();
        window.renderizarEstandarizacion();
    }
};

window.cambiarNombrePestanaEst = function (tabId, nuevoNombre) {
    const parametro = window.parametroActivoEst;
    const pestana = window.datosEstandarizacion[parametro].pestanas.find(p => p.id === tabId);
    if (pestana) {
        pestana.nombre = nuevoNombre;
        window.guardarEstandarizacion();
        window.renderizarTabsEst(parametro);
    }
};

window.agregarBloqueEstandarizacion = function () {
    const parametro = window.parametroActivoEst;
    const pestana = window.datosEstandarizacion[parametro].pestanas.find(p => p.id === window.tabActivoId);

    if (pestana) {
        if (pestana.estandarizaciones.length < 10) {
            const nuevoId = pestana.estandarizaciones.length + 1;
            pestana.estandarizaciones.push(window.crearBloqueVacio(nuevoId));
            window.guardarEstandarizacion();
            window.renderizarEstandarizacion();
        } else {
            alert("El límite recomendado es de 10 estandarizaciones por solución.");
        }
    }
};

/* ---------------- RENDERIZADO PRINCIPAL VISTA / TABS / TABLAS ---------------- */

window.poblarSelectorParametroEst = function () {
    const select = document.getElementById('selectParametroEst');
    if (!select) return;
    select.innerHTML = '';
    window.CONFIG_PARAMETROS_ESTANDARIZACION.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.nombre;
        opt.textContent = p.nombre;
        if (p.nombre === window.parametroActivoEst) opt.selected = true;
        select.appendChild(opt);
    });
};

window.cambiarParametroEstandarizacion = function (nombre) {
    window.parametroActivoEst = nombre;
    window.tabActivoId = null;
    window.renderizarEstandarizacion();
};

window.renderizarTabsEst = function (parametro) {
    const cont = document.getElementById('contenedorTabsEst');
    if (!cont) return;

    const pestanas = window.datosEstandarizacion[parametro].pestanas;

    let htmlTabs = pestanas.map(p => {
        const esActiva = p.id === window.tabActivoId;
        const bgClass = esActiva
            ? 'bg-blue-600 text-white shadow-md border-blue-700'
            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50';

        return `
        <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition border ${bgClass} cursor-pointer" 
             onclick="window.seleccionarPestanaEst('${p.id}')">
            
            <input type="text" value="${p.nombre}" 
                class="bg-transparent font-bold outline-none text-xs w-24 text-center ${esActiva ? 'text-white' : 'text-slate-800'}"
                onclick="event.stopPropagation()"
                onchange="window.cambiarNombrePestanaEst('${p.id}', this.value)">
            
            <select class="text-[11px] font-normal rounded px-1 py-0.5 bg-slate-100 text-slate-800 outline-none cursor-pointer"
                onclick="event.stopPropagation()"
                onchange="window.cambiarRolPestanaEst('${p.id}', this.value)">
                ${window.ROLES_PERMITIDOS.map(r => `<option value="${r}" ${p.rol === r ? 'selected' : ''}>${r}</option>`).join('')}
            </select>

            ${(parametro === 'ACIDEZ' && p.rol === 'Titulante') ? `
                <select class="text-[11px] font-semibold rounded px-1 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 outline-none cursor-pointer"
                    onclick="event.stopPropagation()"
                    onchange="window.cambiarReactivoAcidezEst('${p.id}', this.value)">
                    <option value="NaOH" ${(p.reactivoAcidez || 'NaOH') === 'NaOH' ? 'selected' : ''}>NaOH</option>
                    <option value="H2SO4" ${p.reactivoAcidez === 'H2SO4' ? 'selected' : ''}>H2SO4</option>
                </select>
            ` : ''}
            ${(parametro === 'ALUMINIO INTERCAMBIABLE' && p.rol === 'Titulante') ? `
                <select class="text-[11px] font-semibold rounded px-1 py-0.5 bg-sky-100 text-sky-900 border border-sky-300 outline-none cursor-pointer"
                    onclick="event.stopPropagation()"
                    onchange="window.cambiarReactivoAluminioEst('${p.id}', this.value)">
                    <option value="NaOH" ${(p.reactivoAluminio || 'NaOH') === 'NaOH' ? 'selected' : ''}>NaOH</option>
                    <option value="HCl" ${p.reactivoAluminio === 'HCl' ? 'selected' : ''}>HCl</option>
                </select>
            ` : ''}

            ${pestanas.length > 1 ? `
            <button onclick="window.eliminarPestanaEst('${p.id}', event)" 
                class="ml-1 text-xs opacity-60 hover:opacity-100 hover:text-red-300 font-bold px-1">✕</button>
            ` : ''}
        </div>`;
    }).join('');

    cont.innerHTML = htmlTabs + `
        <button onclick="window.agregarPestanaEst()" 
            class="px-3 py-1.5 text-xs font-bold rounded-lg shadow-sm bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition border border-emerald-300 whitespace-nowrap">
            + Nueva Solución
        </button>`;
};

const fmt = (v, dec = 4) => (v === null || v === undefined || isNaN(v)) ? '#¡DIV/0!' : v.toFixed(dec);

window.renderizarBloquesEst = function (parametro, pestana) {
    const cont = document.getElementById('listaEstandarizaciones');
    if (!cont) return;

    cont.innerHTML = pestana.estandarizaciones.map((bloque, bIdx) => {
        let sumaResultados = 0;
        let conteoValidos = 0;

        let filasReplicas = bloque.replicas.map((r, rIdx) => {
            const res = window.resolverCalculosFila(parametro, pestana, r, bloque, bIdx, rIdx);

            if (res.resultadoFinal !== null && !isNaN(res.resultadoFinal)) {
                sumaResultados += res.resultadoFinal;
                conteoValidos++;
            }

            const txtNormSlnVal = (pestana.rol === 'Solución Valorada') ? 'N/A' : fmt(res.nSlnVal);
            const txtNormTit = (pestana.rol === 'Titulante') ? 'N/A' : fmt(res.nTit);

            return `
            <tr>
                ${rIdx === 0 ? `<td rowspan="3" class="border border-slate-400 p-1 font-bold text-center bg-white">${bloque.id}</td>` : ''}
                <td class="border border-slate-400 p-0"><input type="number" step="any" value="${r.peso}" class="w-full h-full text-center p-1 outline-none focus:bg-blue-50" onchange="window.actualizarReplicaEst(${bloque.id}, ${rIdx}, 'peso', this.value)"></td>
                <td class="border border-slate-400 p-0"><input type="number" step="any" value="${r.volSlnValorada}" class="w-full h-full text-center p-1 outline-none focus:bg-blue-50" onchange="window.actualizarReplicaEst(${bloque.id}, ${rIdx}, 'volSlnValorada', this.value)"></td>
                
                <!-- Normalidad Solución Valorada -->
                <td class="border border-slate-400 p-1 bg-slate-100 text-center text-slate-700 font-mono text-[11px]">${txtNormSlnVal}</td>
                
                <td class="border border-slate-400 p-0"><input type="number" step="any" value="${r.volTitulante}" class="w-full h-full text-center p-1 outline-none focus:bg-blue-50" onchange="window.actualizarReplicaEst(${bloque.id}, ${rIdx}, 'volTitulante', this.value)"></td>
                
                <!-- Normalidad Titulante -->
                <td class="border border-slate-400 p-1 bg-slate-100 text-center text-slate-700 font-mono text-[11px]">${txtNormTit}</td>
                
                <td class="border border-slate-400 p-0"><input type="number" step="any" value="${r.fd}" class="w-full h-full text-center p-1 outline-none focus:bg-blue-50" onchange="window.actualizarReplicaEst(${bloque.id}, ${rIdx}, 'fd', this.value)"></td>
                
                <!-- Normalidad / Resultado Réplica -->
                <td class="border border-slate-400 p-1 font-bold text-center bg-slate-50 font-mono text-blue-800">${fmt(res.resultadoFinal)}</td>
                
                ${rIdx === 0 ? `<td id="promedio_bloque_${bloque.id}" rowspan="3" class="border border-slate-400 p-1 text-center font-bold text-blue-900 bg-blue-50/50 align-middle font-mono text-sm">#¡DIV/0!</td>` : ''}
            </tr>`;
        }).join('');

        const promedio = conteoValidos > 0 ? (sumaResultados / conteoValidos) : null;

        setTimeout(() => {
            const el = document.getElementById(`promedio_bloque_${bloque.id}`);
            if (el) el.innerText = fmt(promedio);
        }, 0);

        
        const esAcidezPatron = (parametro === 'ACIDEZ' && pestana.rol === 'Patrón');
        const lblVolVal = esAcidezPatron ? 'Volumen NaOH' : 'Volumen Sln<br>Valorada';
        const lblVolTit = esAcidezPatron ? 'Volumen H2SO4' : 'Volumen<br>Titulante';

        return `
        <div class="overflow-x-auto w-full mb-8">
            <table class="w-full text-xs border-collapse border border-slate-400 shadow-sm">
                <thead>
                    <tr class="bg-emerald-100">
                        <th rowspan="2" class="border border-slate-400 p-2 w-12">No.</th>
                        <th colspan="3" class="border border-slate-400 p-2 text-center uppercase tracking-wide">Estandarización</th>
                        <th colspan="2" class="border border-slate-400 p-1 text-center font-normal">
                            <span class="block text-[10px] mb-1 font-semibold">COLOQUE QUE ESTANDARIZA</span>
                            <input type="text" value="${bloque.nombreMuestra}" class="w-full text-center bg-white border border-slate-300 rounded px-1 outline-none" onchange="window.actualizarMetaBloqueEst(${bloque.id}, 'nombreMuestra', this.value)">
                        </th>
                        <th colspan="2" class="border border-slate-400 p-1 text-center font-normal">
                            <span class="block text-[10px] mb-1 font-semibold">COLOQUE FECHA</span>
                            <input type="date" value="${bloque.fecha}" class="w-full text-center bg-white border border-slate-300 rounded px-1 outline-none" onchange="window.actualizarMetaBloqueEst(${bloque.id}, 'fecha', this.value)">
                        </th>
                        <th colspan="2" class="border border-slate-400 p-1 text-center font-normal bg-emerald-200">
                            <span class="block text-[10px] mb-1 font-bold text-slate-800 uppercase">Volumen de Muestra (mL)</span>
                            <input type="number" step="any" value="${bloque.volMuestra || ''}" placeholder="Ej: 50" class="w-full text-center bg-white border border-slate-300 rounded px-1 outline-none font-semibold text-blue-900" onchange="window.actualizarMetaBloqueEst(${bloque.id}, 'volMuestra', this.value)">
                        </th>
                    </tr>
                    <tr class="bg-emerald-50 text-slate-700">
                        <th class="border border-slate-400 p-1 font-semibold">Peso (g)</th>
                        <th class="border border-slate-400 p-1 font-semibold">${lblVolVal}</th>
                        <th class="border border-slate-400 p-1 font-semibold">Concentración</th>
                        <th class="border border-slate-400 p-1 font-semibold">${lblVolTit}</th>
                        <th class="border border-slate-400 p-1 font-semibold">Concentración</th>
                        <th class="border border-slate-400 p-1 font-semibold">FD</th>
                        <th class="border border-slate-400 p-1 font-semibold">Concentración</th>
                        <th class="border border-slate-400 p-1 font-semibold">Promedio</th>
                    </tr>
                </thead>
                <tbody>
                    ${filasReplicas}
                </tbody>
            </table>
        </div>`;
    }).join('');
};

window.renderizarEstandarizacion = function () {
    if (!document.getElementById('sec-estandarizacion')) return;

    window.inicializarEstandarizacion();
    window.poblarSelectorParametroEst();

    const parametro = window.parametroActivoEst;
    if (!parametro) return;

    window.asegurarEstructuraParametro(parametro);
    window.renderizarTabsEst(parametro);

    const vistaActiva = document.getElementById('vistaEstandarizacionActiva');
    const pestanaActiva = window.datosEstandarizacion[parametro].pestanas.find(p => p.id === window.tabActivoId);

    if (pestanaActiva) {
        if (vistaActiva) vistaActiva.classList.remove('hidden');

        const titulo = document.getElementById('tituloPestanaActiva');
        if (titulo) titulo.innerText = `Estandarizaciones (${pestanaActiva.nombre} - Rol: ${pestanaActiva.rol})`;

        window.renderizarBloquesEst(parametro, pestanaActiva);
    } else if (vistaActiva) {
        vistaActiva.classList.add('hidden');
    }
};

/* ---------------- ACTUALIZACIÓN DE DATOS Y PERSISTENCIA ---------------- */

window.actualizarReplicaEst = function (bloqueId, idxReplica, campo, valor) {
    const parametro = window.parametroActivoEst;
    const pestana = window.datosEstandarizacion[parametro].pestanas.find(p => p.id === window.tabActivoId);
    if (!pestana) return;

    const bloque = pestana.estandarizaciones.find(b => b.id === bloqueId);
    if (!bloque) return;

    bloque.replicas[idxReplica][campo] = valor;
    window.guardarEstandarizacion();
    window.renderizarEstandarizacion();
};

window.actualizarMetaBloqueEst = function (bloqueId, campo, valor) {
    const parametro = window.parametroActivoEst;
    const pestana = window.datosEstandarizacion[parametro].pestanas.find(p => p.id === window.tabActivoId);
    if (!pestana) return;

    const bloque = pestana.estandarizaciones.find(b => b.id === bloqueId);
    if (!bloque) return;

    bloque[campo] = valor;
    window.guardarEstandarizacion();
    window.renderizarEstandarizacion();
};

/* ------------------------------ MODAL DE PARÁMETROS ------------------------------ */

window.abrirModalParametroEst = function () {
    const modal = document.getElementById('modalParametroEst');
    if (modal) {
        modal.classList.remove('hidden');
        window.renderizarListaParametrosModal();
    }
};

window.cerrarModalParametroEst = function () {
    const modal = document.getElementById('modalParametroEst');
    if (modal) modal.classList.add('hidden');
};

window.renderizarListaParametrosModal = function () {
    const cont = document.getElementById('listaParametrosModal');
    if (!cont) return;
    cont.innerHTML = window.CONFIG_PARAMETROS_ESTANDARIZACION.map((p, i) => `
        <div class="flex items-center justify-between text-sm border border-slate-200 rounded-lg px-3 py-2">
            <span class="font-semibold text-slate-700">${p.nombre}</span>
            <div class="flex items-center gap-2">
                <span class="text-xs text-slate-400">PEq:</span>
                <input type="number" step="any" value="${p.peq}" class="w-20 text-xs border border-slate-300 rounded p-1"
                    onchange="window.actualizarPeqParametroEst(${i}, this.value)">
                <button onclick="window.eliminarParametroEstandarizacion(${i})" class="text-red-500 hover:text-red-700 text-xs font-bold px-1">✕</button>
            </div>
        </div>
    `).join('');
};

window.actualizarPeqParametroEst = function (i, valor) {
    window.CONFIG_PARAMETROS_ESTANDARIZACION[i].peq = parseFloat(valor) || 0;
    localStorage.setItem('configParametrosEstandarizacion', JSON.stringify(window.CONFIG_PARAMETROS_ESTANDARIZACION));
    window.renderizarEstandarizacion();
};

window.eliminarParametroEstandarizacion = function (i) {
    const eliminado = window.CONFIG_PARAMETROS_ESTANDARIZACION.splice(i, 1)[0];
    localStorage.setItem('configParametrosEstandarizacion', JSON.stringify(window.CONFIG_PARAMETROS_ESTANDARIZACION));
    if (eliminado && window.parametroActivoEst === eliminado.nombre) {
        window.parametroActivoEst = window.CONFIG_PARAMETROS_ESTANDARIZACION[0] ? window.CONFIG_PARAMETROS_ESTANDARIZACION[0].nombre : '';
    }
    window.renderizarListaParametrosModal();
    window.poblarSelectorParametroEst();
    window.renderizarEstandarizacion();
};

window.agregarParametroEstandarizacion = function () {
    const nombreInput = document.getElementById('inputNuevoParametroNombre');
    const peqInput = document.getElementById('inputNuevoParametroPeq');
    const nombre = nombreInput.value.trim().toUpperCase();
    const peq = parseFloat(peqInput.value);

    if (!nombre) { alert('Escribe un nombre de parámetro.'); return; }
    if (window.CONFIG_PARAMETROS_ESTANDARIZACION.find(p => p.nombre === nombre)) {
        alert('Ese parámetro ya existe.');
        return;
    }

    window.CONFIG_PARAMETROS_ESTANDARIZACION.push({ nombre, peq: isNaN(peq) ? 0 : peq });
    localStorage.setItem('configParametrosEstandarizacion', JSON.stringify(window.CONFIG_PARAMETROS_ESTANDARIZACION));
    nombreInput.value = ''; peqInput.value = '';
    window.renderizarListaParametrosModal();
    window.poblarSelectorParametroEst();
    window.renderizarEstandarizacion();
};