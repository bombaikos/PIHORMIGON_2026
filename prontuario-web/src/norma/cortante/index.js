// Núcleo de cortante que corresponde a la norma del proyecto (mismo contrato en todos: comprobar, dimensionar,
// cotOptimo, AswSDe, COT_MIN/COT_MAX). El EC-2 2023 aún no está migrado (fase 3).
import * as ehe08 from './ehe08.js';
import * as ec2 from './ec2-2004.js';

export function nucleo(normaId) {
  if (normaId === 'EHE-08' || normaId === 'EHE-98') return { id: 'EHE-08', ...ehe08 };
  if (normaId === 'EC2-2004') return { id: 'EC2-2004', ...ec2 };
  return null;
}
