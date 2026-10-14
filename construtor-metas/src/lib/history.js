// ---------------------------------------------------------------------------
// Modelo analítico do histórico (Jan–Set)
// Constrói índices por vendedor × indústria, equipes, vínculo com gerentes,
// médias históricas e melhor mês.
// ---------------------------------------------------------------------------
import { EQUIPE_OUTROS, SEM_GERENTE, ordenarEquipes, canalDaEquipe } from './constants';

const zeros = () => new Array(13).fill(0);

/**
 * @param {Array} rows  linhas normalizadas {codVend,nomeVend,spv,supervisor,codForn,nomeForn,mes,ano,fat,pos}
 * @param {Object} config  {fornGerente, outrosSpvs, limiarVinculo, vendInativos, gerentes}
 */
export function construirModelo(rows, config) {
  const anos = [...new Set(rows.map((r) => r.ano).filter(Boolean))];
  const ano = anos.length ? Math.max(...anos) : null;
  const dados = ano ? rows.filter((r) => !r.ano || r.ano === ano) : rows;

  const outros = new Set((config.outrosSpvs || []).map((s) => s.toUpperCase()));
  const equipeDe = (spv) => (outros.has(String(spv).toUpperCase()) ? EQUIPE_OUTROS : spv);

  const fornecedores = new Map();
  const vendedores = new Map();
  const series = new Map(); // `${v}|${f}` -> {fat, pos}
  const equipes = new Map();
  const mesesSet = new Set();

  for (const r of dados) {
    if (!r.mes || r.mes < 1 || r.mes > 12) continue;
    mesesSet.add(r.mes);

    let f = fornecedores.get(r.codForn);
    if (!f) {
      f = { cod: r.codForn, nome: r.nomeForn, total: 0, fat: zeros(), pos: zeros(), vendedores: new Set() };
      fornecedores.set(r.codForn, f);
    }
    f.total += r.fat;
    f.fat[r.mes] += r.fat;
    f.pos[r.mes] += r.pos;
    f.vendedores.add(r.codVend);

    let v = vendedores.get(r.codVend);
    if (!v) {
      v = { cod: r.codVend, nome: r.nomeVend, spv: r.spv, supervisor: r.supervisor, ultimoMes: 0, total: 0, porFornecedor: new Map() };
      vendedores.set(r.codVend, v);
    }
    // equipe do vendedor = a do registro mais recente
    if (r.mes >= v.ultimoMes) {
      v.ultimoMes = r.mes;
      v.spv = r.spv;
      if (r.supervisor) v.supervisor = r.supervisor;
    }
    v.total += r.fat;
    v.porFornecedor.set(r.codForn, (v.porFornecedor.get(r.codForn) || 0) + r.fat);

    const k = `${r.codVend}|${r.codForn}`;
    let s = series.get(k);
    if (!s) series.set(k, (s = { fat: zeros(), pos: zeros() }));
    s.fat[r.mes] += r.fat;
    s.pos[r.mes] += r.pos;
  }

  const meses = [...mesesSet].sort((a, b) => a - b);
  const gerenteDe = (codForn) => config.fornGerente?.[codForn] || SEM_GERENTE.id;
  const inativos = new Set((config.vendInativos || []).map(Number));
  const limiar = config.limiarVinculo ?? 0.1;

  // Equipes e vínculo vendedor × gerente
  for (const v of vendedores.values()) {
    v.equipe = equipeDe(v.spv);
    v.ativo = !inativos.has(v.cod);
    const porGerente = {};
    let totalPos = 0;
    for (const [f, val] of v.porFornecedor) {
      if (val <= 0) continue;
      const g = gerenteDe(f);
      porGerente[g] = (porGerente[g] || 0) + val;
      totalPos += val;
    }
    v.participacaoGerente = {};
    for (const g of Object.keys(porGerente)) v.participacaoGerente[g] = totalPos > 0 ? porGerente[g] / totalPos : 0;

    let e = equipes.get(v.equipe);
    if (!e) equipes.set(v.equipe, (e = { id: v.equipe, canal: canalDaEquipe(v.equipe), spvs: new Set(), supervisores: new Map(), vendedores: [] }));
    e.spvs.add(v.spv);
    if (v.supervisor) e.supervisores.set(v.supervisor, (e.supervisores.get(v.supervisor) || 0) + 1);
    e.vendedores.push(v.cod);
  }
  for (const e of equipes.values()) {
    const sups = [...e.supervisores.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
    e.supervisor = e.id === EQUIPE_OUTROS ? sups.join(' / ') || 'Diversos' : sups[0] || '—';
    e.vendedores.sort((a, b) => (vendedores.get(a).nome || '').localeCompare(vendedores.get(b).nome || '', 'pt-BR'));
  }

  const listaEquipes = [...equipes.keys()].sort(ordenarEquipes);
  const listaFornecedores = [...fornecedores.values()].sort((a, b) => b.total - a.total);

  const serie = (codVend, codForn) => series.get(`${codVend}|${codForn}`) || null;
  const vinculado = (codVend, gerente) => {
    const v = vendedores.get(codVend);
    if (!v) return false;
    // Indústrias ainda sem gerente: qualquer vendedor com histórico participa
    if (gerente === SEM_GERENTE.id) return true;
    return (v.participacaoGerente[gerente] || 0) >= limiar;
  };

  return {
    ano,
    meses,
    fornecedores,
    listaFornecedores,
    vendedores,
    equipes,
    listaEquipes,
    serie,
    gerenteDe,
    vinculado,
    linhas: dados.length,
  };
}

// ---------------------------------------------------------------------------
// Médias / bases históricas
// ---------------------------------------------------------------------------

/** Retorna os meses usados pela base escolhida, para uma série de faturamento */
export function mesesDaBase(fat, base, meses) {
  const disp = meses || [];
  switch (base.mode) {
    case 'ult3':
      return disp.slice(-3);
    case 'ult6':
      return disp.slice(-6);
    case 'todos':
      return disp;
    case 'top3':
      return [...disp].sort((a, b) => (fat?.[b] || 0) - (fat?.[a] || 0)).slice(0, 3);
    case 'melhor':
      return [...disp].sort((a, b) => (fat?.[b] || 0) - (fat?.[a] || 0)).slice(0, 1);
    case 'custom': {
      const sel = (base.months || []).filter((m) => disp.includes(m));
      return sel.length ? sel : disp;
    }
    default:
      return disp.slice(-3);
  }
}

export function mediaSerie(arr, mesesUsados) {
  if (!arr || !mesesUsados.length) return 0;
  return mesesUsados.reduce((a, m) => a + (arr[m] || 0), 0) / mesesUsados.length;
}

/** Valor de referência (média) de uma série de faturamento conforme a base */
export function valorBase(fat, base, meses) {
  return mediaSerie(fat, mesesDaBase(fat, base, meses));
}

export function melhorMes(fat, meses) {
  let best = { mes: null, valor: 0 };
  for (const m of meses || []) {
    const v = fat?.[m] || 0;
    if (best.mes === null || v > best.valor) best = { mes: m, valor: v };
  }
  return best;
}

// ---------------------------------------------------------------------------
// Pesos para o rateio
// ---------------------------------------------------------------------------

/** Vendedores da equipe que participam do rateio de uma indústria */
export function vendedoresDoRateio(modelo, equipe, codForn, { todos = false } = {}) {
  const e = modelo.equipes.get(equipe);
  if (!e) return [];
  const g = modelo.gerenteDe(codForn);
  return e.vendedores.filter((cv) => {
    const v = modelo.vendedores.get(cv);
    if (!v.ativo) return false;
    if (todos) return true;
    const s = modelo.serie(cv, codForn);
    const temHistorico = s && s.fat.some((x) => x > 0);
    return temHistorico && modelo.vinculado(cv, g);
  });
}

/** Peso de um vendedor numa indústria (média da base, só vendedores ativos e vinculados ao gerente) */
export function pesoVendedor(modelo, codVend, codForn, base) {
  const v = modelo.vendedores.get(codVend);
  if (!v || !v.ativo) return 0;
  if (!modelo.vinculado(codVend, modelo.gerenteDe(codForn))) return 0;
  const s = modelo.serie(codVend, codForn);
  if (!s) return 0;
  return Math.max(0, valorBase(s.fat, base, modelo.meses));
}

/** Peso de uma equipe numa indústria = soma dos pesos dos vendedores */
export function pesoEquipe(modelo, equipe, codForn, base) {
  const e = modelo.equipes.get(equipe);
  if (!e) return 0;
  return e.vendedores.reduce((a, cv) => a + pesoVendedor(modelo, cv, codForn, base), 0);
}

/** Série agregada (fat) de uma equipe numa indústria, considerando vendedores vinculados */
export function serieEquipe(modelo, equipe, codForn) {
  const e = modelo.equipes.get(equipe);
  const out = new Array(13).fill(0);
  if (!e) return out;
  const g = modelo.gerenteDe(codForn);
  for (const cv of e.vendedores) {
    const v = modelo.vendedores.get(cv);
    if (!v.ativo || !modelo.vinculado(cv, g)) continue;
    const s = modelo.serie(cv, codForn);
    if (!s) continue;
    for (let m = 1; m <= 12; m++) out[m] += s.fat[m];
  }
  return out;
}

/** Equipes que atuam nas indústrias de um gerente (têm peso > 0 em alguma delas) */
export function equipesDoGerente(modelo, gerente, base) {
  const forns = modelo.listaFornecedores.filter((f) => modelo.gerenteDe(f.cod) === gerente);
  return modelo.listaEquipes.filter((eq) => forns.some((f) => pesoEquipe(modelo, eq, f.cod, base) > 0 || serieEquipe(modelo, eq, f.cod).some((x) => x > 0)));
}
