// Filas desplegables del módulo Rasante: fórmula, valores sustituidos y artículo de cada paso, para las tres normas.

import { t } from '../i18n.js';
import { fmt, q, ESP } from '../formato.js';

const sub = (a, b) => `${a}<sub>${b}</sub>`;
const n1 = (v, d = 2) => fmt(v, d);
const MPa = (v, d = 3) => `${fmt(v, d)}<span class="u">${ESP}MPa</span>`;
const fila = (id, nom, val, cuenta) => ({ id, nom, val, cuenta });
const REF = { 'EHE-08': 'EHE-08', EC2: 'EC-2 + AN', 'EC2-2023': 'EC-2 2023' };

export function filaTraza(r, x, comp, D, N) {
  const ref = N.id === 'EHE-08' ? REF['EHE-08'] : N.id === 'EC2-2004' ? REF.EC2 : REF['EC2-2023'];
  const art = (a) => `<span class="art">${ref} · ${a}</span>`;
  const P = r.P;
  const f = [];
  f.push(fila('tau', t('ras.r.tau'), MPa(r.tauEd),
    `<span class="f">${t(N.id === 'EHE-08' ? 'ras.f.tauEHE' : N.id === 'EC2-2004' ? 'ras.f.tauEC' : 'ras.f.tau23')}</span>`
    + `<span class="n">${sub('R', 'Ed')} = ${q(D.REd, 'N')} · b = ${n1(D.b, 0)} mm · L = ${n1(D.L, 0)} mm → ${MPa(r.tauEd)}</span>`
    + art(N.id === 'EHE-08' ? '47.1' : N.id === 'EC2-2004' ? '6.2.5 (6.24)' : '8.2.6(4) (8.74)')));
  // Para el dimensionado, el desglose se calcula con la cuantía necesaria
  const res = comp ? r.res : (r.caso === 'calculo' ? N.resistencia(P, r.rhoNec, r.tauEd) : N.resistencia(P, 0, r.tauEd));
  const rho = comp ? r.rho : (r.rhoNec ?? 0);
  const arm = res.contabiliza;
  if (N.id === 'EHE-08') filasEHE(f, P, res, rho, arm, art);
  else if (N.id === 'EC2-2004') filasEC(f, P, res, rho, art);
  else filas23(f, P, res, rho, art);
  if (comp) {
    f.push(fila('res', t('ras.r.res'), MPa(r.tauRd),
      `<span class="n">${t('ras.v.res', fmt(res.coh, 3), fmt(res.fric, 3), fmt(res.cosido, 3), fmt(r.tauRd, 3))}</span>`));
  }
  return f;
}

function filasEHE(f, P, res, rho, arm, art) {
  f.push(fila('coh', t('ras.r.coh'), MPa(P.coh),
    `<span class="f">${t('ras.f.cohEHE')}</span><span class="n">β = ${n1(P.R.beta, 2)} · (1,30 − 0,30·${n1(P.fck, 0)}/25) = ${n1(P.factor, 3)} · f<sub>ct,d</sub> = ${n1(P.fctd, 3)} MPa${P.tracc ? ` · ${t('ras.v.tracc')}` : ''}</span>${art('47.2.1')}`));
  if (arm) {
    f.push(fila('estado', t('ras.r.estado'), String(res.estado),
      `<span class="f">${t('ras.f.estado')}</span><span class="n">${t(res.estado === 1 ? 'ras.v.estado1' : 'ras.v.estado2', fmt(2.5 * P.coh, 3))}</span>${art('47.2.2.1, 47.2.2.2')}`));
    f.push(fila('cosido', t('ras.r.cosido'), MPa(res.cosido),
      `<span class="f">${t('ras.f.cosidoEHE')}</span><span class="n">ρ = ${n1(rho * 1000, 2)} ‰ · f<sub>yα,d</sub> = ${n1(P.fyd, 0)} MPa${P.topada ? ` (${t('ras.tope400')})` : ''} · μ = ${n1(res.mu, 1)} · α = ${n1(P.alfa, 0)}°</span>${art('47.2.2.2, tabla 47.2.2.2')}`));
    f.push(fila('fric', t('ras.r.fric'), MPa(res.fric),
      `<span class="f">${t('ras.f.fric')}</span><span class="n">μ = ${n1(res.mu, 1)} · σ<sub>cd</sub> = ${n1(P.sigN, 2)} MPa</span>${art('47.2.2')}`));
  } else {
    f.push(fila('cosido', t('ras.r.cosido'), t('ras.noContab'),
      `<span class="f">${t('ras.f.rhoMin')}</span><span class="n">ρ = ${n1(rho * 1000, 2)} ‰ &lt; ${n1(0.001 * 1000, 2)} ‰</span>${art('47.2')}`));
  }
  f.push(fila('lim', t('ras.r.lim'), MPa(P.lim),
    `<span class="f">${t('ras.f.limEHE')}</span><span class="n">f<sub>cd</sub> = ${n1(P.fcd)} MPa → ${MPa(P.lim)}</span>${art('47.2.2')}`));
}

function filasEC(f, P, res, rho, art) {
  f.push(fila('coh', t('ras.r.coh'), MPa(P.coh),
    `<span class="f">${t('ras.f.cohEC')}</span><span class="n">c = ${n1(P.R.c, 3)} · f<sub>ctd</sub> = ${n1(P.fctd, 3)} MPa${P.tracc ? ` · ${t('ras.v.tracc')}` : ''}</span>${art('6.2.5(1), (2), (5)')}`));
  f.push(fila('fric', t('ras.r.fric'), MPa(res.fric),
    `<span class="f">${t('ras.f.fric')}</span><span class="n">μ = ${n1(P.R.mu, 1)} · σ<sub>n</sub> = ${n1(P.sigN, 2)} MPa (≤ 0,6 f<sub>cd</sub> = ${n1(0.6 * P.fcd)} MPa)</span>${art('6.2.5(1)')}`));
  f.push(fila('cosido', t('ras.r.cosido'), MPa(res.cosido),
    `<span class="f">${t('ras.f.cosidoEC')}</span><span class="n">ρ = ${n1(rho * 1000, 2)} ‰ · f<sub>yd</sub> = ${n1(P.fyd, 0)} MPa · μ = ${n1(P.R.mu, 1)} · α = ${n1(P.alfa, 0)}°</span>${art('6.2.5(1) (6.25)')}`));
  f.push(fila('lim', t('ras.r.lim'), MPa(P.lim),
    `<span class="f">${t('ras.f.limEC')}</span><span class="n">ν = ${n1(P.nu, 3)} · f<sub>cd</sub> = ${n1(P.fcd)} MPa → ${MPa(P.lim)}</span>${art('6.2.5(1) (6.25), 6.2.2(6) AN')}`));
}

function filas23(f, P, res, rho, art) {
  const cv = P.anclado ? 'c<sub>v1</sub>' : 'c<sub>v2</sub>';
  f.push(fila('coh', t('ras.r.coh'), MPa(P.coh),
    `<span class="f">${t(P.anclado ? 'ras.f.coh23a' : 'ras.f.coh23b')}</span><span class="n">${cv} = ${n1(P.cv, 3)}${P.topping ? ' (× 1,2)' : ''} · √f<sub>ck</sub> = ${n1(Math.sqrt(P.fck), 3)} · γ<sub>c</sub> = ${n1(P.gc, 2)}${P.tracc ? ` · ${t('ras.v.tracc')}` : ''}</span>${art('8.2.6(5), (7), tabla 8.2')}`));
  f.push(fila('fric', t('ras.r.fric'), MPa(res.fric),
    `<span class="f">${t('ras.f.fric')}</span><span class="n">μ<sub>v</sub> = ${n1(P.mu, 1)} · σ<sub>n</sub> = ${n1(P.sigN, 2)} MPa (≤ 0,6 f<sub>cd</sub> = ${n1(0.6 * P.fcd)} MPa)</span>${art('8.2.6(5)')}`));
  if (P.anclado) {
    f.push(fila('cosido', t('ras.r.cosido'), MPa(res.cosido),
      `<span class="f">${t('ras.f.cosido23a')}</span><span class="n">ρ = ${n1(rho * 1000, 2)} ‰ · f<sub>yd</sub> = ${n1(P.fyd, 0)} MPa · μ<sub>v</sub> = ${n1(P.mu, 1)} · α = ${n1(P.alfa, 0)}°</span>${art('8.2.6(5) (8.76)')}`));
    f.push(fila('lim', t('ras.r.lim'), MPa(res.lim),
      `<span class="f">${t('ras.f.lim23a')}</span><span class="n">f<sub>cd</sub> = ${n1(P.fcd)} MPa → 0,30 f<sub>cd</sub> + ρ f<sub>yd</sub> cosα = ${MPa(res.lim)}</span>${art('8.2.6(5) (8.76)')}`));
  } else {
    f.push(fila('cosido', t('ras.r.cosido'), MPa(res.cosido),
      `<span class="f">${t('ras.f.cosido23b')}</span><span class="n">ρ = ${n1(rho * 1000, 2)} ‰ · k<sub>v</sub> = ${n1(P.R.kv, 1)} · k<sub>dowel</sub> = ${n1(P.kdowel, 1)} · f<sub>yd</sub> = ${n1(P.fyd, 0)} MPa · f<sub>cd</sub> = ${n1(P.fcd)} MPa</span>${art('8.2.6(7) (8.77)')}`));
    f.push(fila('lim', t('ras.r.lim'), MPa(res.lim),
      `<span class="f">${t('ras.f.lim23b')}</span><span class="n">f<sub>cd</sub> = ${n1(P.fcd)} MPa → ${MPa(res.lim)}</span>${art('8.2.6(7) (8.77)')}`));
  }
}
