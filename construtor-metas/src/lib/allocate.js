// ---------------------------------------------------------------------------
// Rateio proporcional com fechamento exato em centavos
// ---------------------------------------------------------------------------

/**
 * Divide `total` proporcionalmente a `pesos`, garantindo que a soma das
 * parcelas seja exatamente igual ao total (método dos maiores restos).
 * `decimais` = 2 para R$ (centavos), 0 para positivação (clientes inteiros).
 * Se todos os pesos forem zero, divide igualmente.
 */
export function ratear(total, pesos, decimais = 2) {
  const n = pesos.length;
  if (!n) return [];
  const escala = 10 ** decimais;
  const totalCent = Math.round((Number(total) || 0) * escala);
  const p = pesos.map((w) => (Number.isFinite(w) && w > 0 ? w : 0));
  let soma = p.reduce((a, b) => a + b, 0);
  const pesosEfetivos = soma > 0 ? p : p.map(() => 1);
  soma = soma > 0 ? soma : n;

  const brutos = pesosEfetivos.map((w) => (totalCent * w) / soma);
  const base = brutos.map((v) => Math.floor(v));
  let resto = totalCent - base.reduce((a, b) => a + b, 0);
  const ordem = brutos
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; resto > 0 && k < ordem.length; k++, resto--) base[ordem[k].i] += 1;
  return base.map((c) => c / escala);
}

/** Soma valores em centavos (evita erro de ponto flutuante) */
export function somar(valores) {
  return Math.round(valores.reduce((a, v) => a + Math.round((Number(v) || 0) * 100), 0)) / 100;
}
