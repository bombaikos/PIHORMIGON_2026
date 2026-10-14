// Recubrimiento según EN 1992-1-1:2023 (sección 6) con valores recomendados por CEN.
// cmin,dur depende de la clase de resistencia a la exposición (ERC) y de la vida útil
// (tablas 6.3 y 6.4) y lo fija cada Anejo Nacional: aquí lo escribe el usuario.

export const CLASES = ['X0', 'XC1', 'XC2', 'XC3', 'XC4', 'XD1', 'XD2', 'XD3', 'XS1', 'XS2', 'XS3', 'XF1', 'XF2', 'XF3', 'XF4', 'XA1', 'XA2', 'XA3'];

/**
 * cnom = cmin + Δcdev, con cmin = max{cmin,b; cmin,dur; 10 mm} (6.5.2).
 * @param {Object} d
 * @param {string[]} d.clases     clases de exposición
 * @param {number} d.cminDur      mm, de las tablas 6.3 / 6.4 para la ERC y la vida útil del proyecto
 * @param {number} d.fiMax        diámetro máximo de las barras, mm (cmin,b)
 * @param {number} [d.dcdev=10]   mm
 */
export function durabilidad({ clases = [], cminDur = 0, fiMax = 0, dcdev = 10 }) {
  const cminB = fiMax;
  const cmin = Math.max(cminB, cminDur, 10);
  const manda = cmin === cminDur ? 'dur' : cmin === cminB ? 'b' : 'diez';
  const ksurf = (cact) => Math.min(1.5, Math.max(1, cact / (10 + cminDur)));
  return {
    norma: 'EC2-2023',
    clases,
    cminB,
    cminDur,
    cmin,
    mandaCmin: manda,
    dr: dcdev,
    rnom: cmin + dcdev,
    ksurf,
    notas: [{ clave: 'dur.ec2Tablas' }],
    tipificacion: clases.join(' + '),
    articulos: { rnom: '6.5.2', cmin: '6.5.2(2)', cdur: 'tablas 6.3 y 6.4' },
  };
}
