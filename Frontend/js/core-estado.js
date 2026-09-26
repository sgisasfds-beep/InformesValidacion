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

