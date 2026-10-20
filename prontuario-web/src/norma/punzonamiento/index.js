// Núcleo de punzonamiento que corresponde a la norma del proyecto (mismo contrato en los tres: comprobar, dimensionar,
// parametros, perimetros). La EHE-98 del Prontuario 3.1 se trata como EHE-08.
import * as ehe08 from './ehe08.js';
import * as ec2 from './ec2-2004.js';
import * as ec2023 from './ec2-2023.js';

export function nucleo(normaId) {
  if (normaId === 'EHE-08' || normaId === 'EHE-98') return { id: 'EHE-08', ...ehe08 };
  if (normaId === 'EC2-2004') return { id: 'EC2-2004', ...ec2 };
  if (normaId === 'EC2-2023') return { id: 'EC2-2023', ...ec2023 };
  return null;
}
