// Errores del núcleo sin textos: llevan una clave de los diccionarios (src/i18n) y sus datos,
// y la interfaz los traduce con tx() de src/ui/i18n.js.

/** Aviso para listas de errores: { clave, args }. */
export const err = (clave, ...args) => ({ clave, args });

/** Excepción con clave de diccionario; el mensaje es la clave, por si nadie la traduce. */
export class ErrorClave extends Error {
  constructor(clave, ...args) {
    super(clave);
    this.clave = clave;
    this.args = args;
  }
}
