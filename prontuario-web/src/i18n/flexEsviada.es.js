// Textos del módulo Flexión compuesta esviada (se suman a es.js en ui/i18n.js).
const sub = (a, b) => `${a}<sub>${b}</sub>`;

export default {
  'fce.subtitulo': 'Axil y flexión en dos direcciones (N, Mx, My) en rotura: contorno de interacción Mx–My al axil dado',
  'fce.esfuerzos': 'Esfuerzos', 'fce.mx': 'Mx comprime la cara superior si es +', 'fce.my': 'My comprime la cara derecha si es +',
  'fce.nombreMx': 'Momento respecto al eje horizontal', 'fce.nombreMy': 'Momento respecto al eje vertical',
  'fce.dibujo': 'Plano de rotura', 'fce.dibujoSub': 'Sección con la zona comprimida y el eje neutro en el estado último, en la dirección del esfuerzo',
  'fce.dibujoAria': 'Sección con el eje neutro en rotura',
  'fce.contorno': 'Contorno de interacción', 'fce.contornoSub': 'Lugar de los momentos últimos (Mx, My) con el axil dado; cada punto es un plano de rotura distinto',
  'fce.ejeX': 'My [kN·m]', 'fce.ejeY': 'Mx [kN·m]', 'fce.serieN': (n) => `N = ${n} kN`,
  'fce.rayo': 'Origen–contorno', 'fce.alfa': 'Ángulo del eje neutro', 'fce.limiteCompresion': 'compresión',
  'fce.subeEmin': (ex, ey) => `* Momento elevado a N·e<sub>mín</sub> (e<sub>mín</sub> = ${ey} mm en Mx y ${ex} mm en My; criterio del Prontuario, por verificar en cada norma).`,
  'fce.fueraAxil': (l) => `El axil supera la capacidad de la sección (límite ${l}).`,
  'fce.f.coef': 'γ = |OQ| / |OP| a excentricidad constante: P = (My,Ed, Mx,Ed); Q = corte con el contorno de la recta que une el origen con P',
  'fce.f.contorno': 'Se gira la dirección de la fibra más comprimida; para cada una, estado último (máxima curvatura con plano admisible que equilibra N<sub>Ed</sub>) y esfuerzos integrados en la sección entera: M<sub>x</sub> = ∫σ·(y<sub>G</sub> − y)·dA, M<sub>y</sub> = ∫σ·(x − x<sub>G</sub>)·dA',
  'fce.f.ref': (x, y) => `Momentos respecto al c.d.g. del hormigón bruto (x = ${x}, y = ${y} desde la esquina superior izquierda).`,
  'fce.f.alfa': 'Ángulo de la recta neutra con la horizontal, entre −90° y 90° (0° = eje neutro horizontal)',
  'fce.puntos': 'Esfuerzos', 'fce.tabla': 'Esfuerzos y coeficiente de seguridad',
  'fce.contornos': (n) => `${n} puntos`,
  'fce.axilGauge': 'El axil se mueve con la regleta bajo el diagrama (azul en compresión, rosa en tracción).',
  'fce.sinEsfuerzos': 'Escribe al menos un par de esfuerzos.',
};
