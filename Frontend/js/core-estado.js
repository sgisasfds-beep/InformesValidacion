/**
 * CORE - ESTADO GLOBAL
 * -----------------------------------------------------------------------
 * Variables de estado compartidas por toda la app (datosGlobales, elemento
 * activo, vista actual, instancias de Chart.js) y configuración base de
 * Chart.js. Debe cargarse PRIMERO: los demás módulos leen/escriben estas
 * variables vía `window.*`.
 * -----------------------------------------------------------------------
 */

// Estado Global
window.datosGlobales = {};
window.elementoActivo = '';
window.controlActivoPrec = 'lcm';
window.controlActivoExa = 'LCM';
window.vistaActual = 'carga';

// Contexto del último procesamiento (lo fija procesarFormulario):
//  - tipoAnalisisActual: 'estandar' | 'ras' | 'suelos' | 'aire'
//  - areaAnalisisActual: rol/área del usuario ('metales' -> pW, 'fisicoquimico' -> Humedad)
window.tipoAnalisisActual = 'estandar';
window.areaAnalisisActual = 'metales';
window.subvistaExactitud = 'control'; // 'control' (LCM/CCV/EA) | 'muestras'

// Submatrices de suelo (backend: arenoso / arcilloso / limoso)
window.MATRICES_SUELO = ['arenoso', 'arcilloso', 'limoso'];
window.ETIQUETAS_SUELO = { arenoso: 'Suelo arenoso', arcilloso: 'Suelo arcilloso', limoso: 'Suelo limoso' };

// Estado para Linealidad (Actualizado: ya no requiere window.datosLinealidad)
window.parametroActivoLin = '';

if (window.Chart) {
    Chart.defaults.devicePixelRatio = Math.max(window.devicePixelRatio || 1, 3);
}

// Instancias de Gráficas para limpieza
window.chartMBInstance = null;
window.chartLCMInstance = null;
window.chartPrecisionInstance = null;
window.chartCurvasIndInstance = null;
window.chartCurvaPromedioInstance = null;