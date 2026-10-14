const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const brl0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const num2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const pct1 = new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const fmtBRL = (v) => brl.format(Number(v) || 0);
export const fmtBRL0 = (v) => brl0.format(Number(v) || 0);
export const fmtNum2 = (v) => num2.format(Number(v) || 0);
export const fmtNum0 = (v) => num0.format(Number(v) || 0);
export const fmtPct = (v) => (Number.isFinite(v) ? pct1.format(v) : '—');

/** Formato compacto: 1,2 mi / 350 mil */
export function fmtCompacto(v) {
  const n = Number(v) || 0;
  const a = Math.abs(n);
  if (a >= 1e6) return `R$ ${num2.format(n / 1e6)} mi`;
  if (a >= 1e3) return `R$ ${num0.format(n / 1e3)} mil`;
  return brl0.format(n);
}

/** Converte texto digitado (pt-BR ou en) em número */
export function parseValor(texto) {
  if (texto === null || texto === undefined) return 0;
  let s = String(texto).trim().replace(/[R$\s]/g, '');
  if (!s) return 0;
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (!/^-?\d+(\.\d{1,2})?$/.test(s)) {
    s = s.replace(/\./g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

export const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
export const iguais = (a, b) => Math.abs((a || 0) - (b || 0)) < 0.005;
