// Núcleo de cortante que corresponde a la norma del proyecto (mismo contrato en todos: comprobar, dimensionar,
// cotOptimo, rangoCot, AswSDe). Las tres normas del Prontuario están migradas.
import * as ehe08 from './ehe08.js';
import * as ec2 from './ec2-2004.js';
import * as ec2023 from './ec2-2023.js';

const rangoFijo = () => ({ min: ehe08.COT_MIN, max: ehe08.COT_MAX });

export function nucleo(normaId) {
  if (normaId === 'EHE-08' || normaId === 'EHE-98') return { id: 'EHE-08', rangoCot: rangoFijo, ...ehe08 };
  if (normaId === 'EC2-2004') return { id: 'EC2-2004', rangoCot: rangoFijo, ...ec2 };
  if (normaId === 'EC2-2023') return { id: 'EC2-2023', ...ec2023 };
  return null;
}
