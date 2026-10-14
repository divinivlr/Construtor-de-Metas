// ---------------------------------------------------------------------------
// Estado global (React Context + useReducer) com persistência no navegador.
// Todas as metas ficam salvas no localStorage deste computador e podem ser
// exportadas/importadas como backup (.json) na tela "Base & Config".
//
// As metas existem em DUAS métricas independentes:
//   fin = Financeiro (R$)   ·   pos = Positivação (clientes)
// A métrica ativa é escolhida no seletor do topo da tela.
// ---------------------------------------------------------------------------
import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { FORNECEDOR_GERENTE_PADRAO, GERENTES_PADRAO, LIMIAR_VINCULO_PADRAO, OUTROS_SPVS_PADRAO } from './lib/constants';
import { construirModelo } from './lib/history';
import BASE_EMBUTIDA from './data/baseHistorico.json';
import { compactar, descompactar } from './lib/importExcel';
import { METRICAS } from './lib/metrica';

const STORAGE_KEY = 'construtor-metas:v1';
const VERSAO = 3;

const metasVazias = () => ({
  metasDir: {}, // { [codForn]: { 10, 11, 12 } }
  metasGer: {}, // { [codForn]: { [equipe]: { 10, 11, 12 } } }
  metasSup: {}, // { [equipe]: { [codForn]: { [codVend]: { 10, 11, 12 } } } }
});

export const estadoInicial = () => ({
  versao: VERSAO,
  metrica: 'fin',
  dataset: { fonte: 'embutida', arquivo: null, carregadoEm: null, rowsC: null },
  config: {
    gerentes: GERENTES_PADRAO,
    fornGerente: { ...FORNECEDOR_GERENTE_PADRAO },
    outrosSpvs: OUTROS_SPVS_PADRAO,
    limiarVinculo: LIMIAR_VINCULO_PADRAO,
    vendInativos: [],
  },
  metas: { fin: metasVazias(), pos: metasVazias() },
});

/**
 * Migrações de versões anteriores salvas no navegador / backups antigos.
 *  v1 → v2: ATACADO e CALL CENTER deixam de ser "OUTROS" e viram equipes próprias
 *           (o rateio feito para "OUTROS" é descartado e precisa ser refeito).
 *  v2 → v3: metas passam a existir por métrica (as antigas viram "Financeiro").
 */
function migrar(entrada) {
  const ini = estadoInicial();
  let s = { ...entrada, versao: entrada.versao || 1, config: { ...ini.config, ...(entrada.config || {}) } };

  if (s.versao < 2) {
    const fora = ['ATACADO', 'CALL CENTER'];
    const outrosSpvs = (s.config.outrosSpvs || []).filter((x) => !fora.includes(String(x).toUpperCase()));
    const metasGer = {};
    for (const [f, porEq] of Object.entries(s.metasGer || {})) {
      const { OUTROS, ...resto } = porEq || {}; // eslint-disable-line no-unused-vars
      metasGer[f] = resto;
    }
    const { OUTROS, ...metasSup } = s.metasSup || {}; // eslint-disable-line no-unused-vars
    s = { ...s, versao: 2, config: { ...s.config, outrosSpvs }, metasGer, metasSup };
  }
  if (s.versao < 3) {
    const { metasDir = {}, metasGer = {}, metasSup = {}, ...resto } = s;
    s = { ...resto, versao: 3, metrica: 'fin', metas: { fin: { metasDir, metasGer, metasSup }, pos: metasVazias() } };
  }
  return {
    ...ini,
    ...s,
    // dados fictícios das versões antigas → base padrão embutida no sistema
    dataset: s.dataset?.fonte === 'planilha' && s.dataset?.rowsC ? { ...ini.dataset, ...s.dataset } : ini.dataset,
    metas: { fin: { ...metasVazias(), ...(s.metas?.fin || {}) }, pos: { ...metasVazias(), ...(s.metas?.pos || {}) } },
    metrica: METRICAS[s.metrica] ? s.metrica : 'fin',
  };
}

function carregar() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? migrar(JSON.parse(raw)) : estadoInicial();
  } catch {
    return estadoInicial();
  }
}

const setIn = (obj, path, valor) => {
  const [k, ...rest] = path;
  const atual = obj?.[k] ?? {};
  return { ...obj, [k]: rest.length ? setIn(atual, rest, valor) : valor };
};

const arred = (v, dec) => {
  const e = 10 ** dec;
  return Math.round((Number(v) || 0) * e) / e;
};

/** Ações sobre as metas de UMA métrica */
function reducerMetas(m, a, dec) {
  switch (a.type) {
    case 'META_DIR':
      return { ...m, metasDir: setIn(m.metasDir, [a.forn, a.mes], arred(a.valor, dec)) };
    case 'METAS_DIR': // { [forn]: {10,11,12} } — mescla
      return { ...m, metasDir: { ...m.metasDir, ...a.metas } };
    case 'META_GER':
      return { ...m, metasGer: setIn(m.metasGer, [a.forn, a.equipe, a.mes], arred(a.valor, dec)) };
    case 'METAS_GER_FORN': // substitui o rateio de uma indústria
      return { ...m, metasGer: { ...m.metasGer, [a.forn]: a.valores } };
    case 'META_SUP':
      return { ...m, metasSup: setIn(m.metasSup, [a.equipe, a.forn, a.vend, a.mes], arred(a.valor, dec)) };
    case 'METAS_SUP_FORN':
      return { ...m, metasSup: setIn(m.metasSup, [a.equipe, a.forn], a.valores) };
    default:
      return m;
  }
}

function reducer(state, a) {
  switch (a.type) {
    case 'METRICA':
      return { ...state, metrica: a.metrica };
    case 'META_DIR':
    case 'METAS_DIR':
    case 'META_GER':
    case 'METAS_GER_FORN':
    case 'META_SUP':
    case 'METAS_SUP_FORN': {
      const met = a.metrica || state.metrica;
      return { ...state, metas: { ...state.metas, [met]: reducerMetas(state.metas[met], a, METRICAS[met].decimais) } };
    }
    case 'GERENTE_FORN':
      return { ...state, config: { ...state.config, fornGerente: { ...state.config.fornGerente, [a.forn]: a.gerente } } };
    case 'DATASET':
      return { ...state, dataset: a.dataset };
    case 'CONFIG':
      return { ...state, config: { ...state.config, ...a.patch } };
    case 'RESET_METAS':
      return { ...state, metas: { fin: metasVazias(), pos: metasVazias() } };
    case 'IMPORTAR':
      return migrar({ ...a.state, dataset: a.state.dataset || state.dataset });
    case 'RESET_TUDO':
      return estadoInicial();
    default:
      return state;
  }
}

/** "Vista" do estado para uma métrica: expõe metasDir/metasGer/metasSup daquela métrica */
export const vistaDe = (raw, metrica) => ({ ...raw, ...raw.metas[metrica], metrica });

const Ctx = createContext(null);

export function StoreProvider({ children }) {
  const [raw, dispatch] = useReducer(reducer, undefined, carregar);
  const [avisoStorage, setAvisoStorage] = useState(null);
  const timer = useRef();

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(raw));
        setAvisoStorage(null);
      } catch (e) {
        setAvisoStorage('Não foi possível salvar no navegador (armazenamento cheio ou bloqueado). Use "Exportar backup" para não perder o trabalho.');
      }
    }, 300);
    return () => clearTimeout(timer.current);
  }, [raw]);

  const rows = useMemo(
    () => (raw.dataset.fonte === 'planilha' && raw.dataset.rowsC ? descompactar(raw.dataset.rowsC) : descompactar(BASE_EMBUTIDA.linhas)),
    [raw.dataset]
  );
  const modeloBase = useMemo(() => construirModelo(rows, raw.config), [rows, raw.config]);
  const modelos = useMemo(
    () => ({ fin: { ...modeloBase, campo: 'fat' }, pos: { ...modeloBase, campo: 'pos' } }),
    [modeloBase]
  );

  const value = useMemo(() => {
    const met = METRICAS[raw.metrica];
    return {
      raw,
      dispatch,
      met,
      state: vistaDe(raw, raw.metrica),
      modelo: modelos[raw.metrica],
      vista: (m) => vistaDe(raw, m),
      modeloDe: (m) => modelos[m],
      avisoStorage,
    };
  }, [raw, modelos, avisoStorage]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useStore = () => useContext(Ctx);

export function datasetDePlanilha(rows, arquivo) {
  return { fonte: 'planilha', arquivo, carregadoEm: new Date().toISOString(), rowsC: compactar(rows) };
}

/** Volta para a base padrão que vem embutida no sistema (src/data/baseHistorico.json) */
export const datasetPadrao = () => ({ fonte: 'embutida', arquivo: null, carregadoEm: null, rowsC: null });

export const INFO_BASE_EMBUTIDA = { arquivo: BASE_EMBUTIDA.arquivo, atualizadoEm: BASE_EMBUTIDA.atualizadoEm, linhas: BASE_EMBUTIDA.linhas.length };
