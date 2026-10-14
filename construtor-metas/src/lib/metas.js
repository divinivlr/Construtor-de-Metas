// ---------------------------------------------------------------------------
// Leitura e validação das metas em cada nível
// ---------------------------------------------------------------------------
import { MESES_META } from './constants';
import { somar } from './allocate';
import { iguais } from './format';

export const metaDir = (state, forn, m) => state.metasDir?.[forn]?.[m] || 0;
export const totalDir = (state, forn) => somar(MESES_META.map((m) => metaDir(state, forn, m)));

export const metaEquipe = (state, equipe, forn, m) => state.metasGer?.[forn]?.[equipe]?.[m] || 0;
export const totalEquipe = (state, equipe, forn) => somar(MESES_META.map((m) => metaEquipe(state, equipe, forn, m)));

export const metaVend = (state, equipe, forn, vend, m) => state.metasSup?.[equipe]?.[forn]?.[vend]?.[m] || 0;

/** Status do rateio do gerente para uma indústria (soma das equipes × meta da diretoria) */
export function statusGerente(state, forn) {
  const porEquipe = state.metasGer?.[forn] || {};
  const meses = {};
  let ok = true;
  for (const m of MESES_META) {
    const meta = metaDir(state, forn, m);
    const soma = somar(Object.values(porEquipe).map((e) => e?.[m] || 0));
    const diff = Math.round((soma - meta) * 100) / 100;
    meses[m] = { meta, soma, diff, ok: iguais(soma, meta) };
    if (!meses[m].ok) ok = false;
  }
  const temMeta = MESES_META.some((m) => meses[m].meta > 0);
  return { meses, ok: temMeta && ok, temMeta };
}

/** Status do rateio do supervisor (soma dos vendedores × meta da equipe) */
export function statusSupervisor(state, equipe, forn) {
  const porVend = state.metasSup?.[equipe]?.[forn] || {};
  const meses = {};
  let ok = true;
  for (const m of MESES_META) {
    const meta = metaEquipe(state, equipe, forn, m);
    const soma = somar(Object.values(porVend).map((v) => v?.[m] || 0));
    const diff = Math.round((soma - meta) * 100) / 100;
    meses[m] = { meta, soma, diff, ok: iguais(soma, meta) };
    if (!meses[m].ok) ok = false;
  }
  const temMeta = MESES_META.some((m) => meses[m].meta > 0);
  return { meses, ok: temMeta && ok, temMeta };
}

/** Indústrias com meta para a equipe (definida pelo gerente) */
export function industriasDaEquipe(state, modelo, equipe) {
  const forns = Object.keys(state.metasGer || {})
    .filter((f) => MESES_META.some((m) => metaEquipe(state, equipe, f, m) > 0))
    .map(Number);
  // Também inclui indústrias com valores já distribuídos (para não "sumir" algo digitado)
  for (const f of Object.keys(state.metasSup?.[equipe] || {}).map(Number)) if (!forns.includes(f)) {
    const temValor = Object.values(state.metasSup[equipe][f] || {}).some((v) => MESES_META.some((m) => (v?.[m] || 0) !== 0));
    if (temValor) forns.push(f);
  }
  const ordem = new Map(modelo.listaFornecedores.map((f, i) => [f.cod, i]));
  return forns.sort((a, b) => (ordem.get(a) ?? 999) - (ordem.get(b) ?? 999));
}
