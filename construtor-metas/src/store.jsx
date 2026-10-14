// ---------------------------------------------------------------------------
// Estado global (React Context + useReducer) com persistência no navegador.
// Todas as metas ficam salvas no localStorage deste computador e podem ser
// exportadas/importadas como backup (.json) na tela "Base & Config".
// ---------------------------------------------------------------------------
import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  FORNECEDOR_GERENTE_PADRAO,
  GERENTES_PADRAO,
  LIMIAR_VINCULO_PADRAO,
  OUTROS_SPVS_PADRAO,
} from './lib/constants';
import { construirModelo } from './lib/history';
import { gerarHistoricoFicticio } from './lib/mockData';
import { compactar, descompactar } from './lib/importExcel';
import { round2 } from './lib/format';

const STORAGE_KEY = 'construtor-metas:v1';

export const estadoInicial = () => ({
  versao: 1,
  dataset: { fonte: 'ficticio', arquivo: null, carregadoEm: null, rowsC: null },
  config: {
    gerentes: GERENTES_PADRAO,
    fornGerente: { ...FORNECEDOR_GERENTE_PADRAO },
    outrosSpvs: OUTROS_SPVS_PADRAO,
    limiarVinculo: LIMIAR_VINCULO_PADRAO,
    vendInativos: [],
  },
  metasDir: {}, // { [codForn]: { 10, 11, 12 } }
  metasGer: {}, // { [codForn]: { [equipe]: { 10, 11, 12 } } }
  metasSup: {}, // { [equipe]: { [codForn]: { [codVend]: { 10, 11, 12 } } } }
});

function carregar() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return estadoInicial();
    const s = JSON.parse(raw);
    const ini = estadoInicial();
    return { ...ini, ...s, config: { ...ini.config, ...(s.config || {}) }, dataset: { ...ini.dataset, ...(s.dataset || {}) } };
  } catch {
    return estadoInicial();
  }
}

const setIn = (obj, path, valor) => {
  const [k, ...rest] = path;
  const atual = obj?.[k] ?? {};
  return { ...obj, [k]: rest.length ? setIn(atual, rest, valor) : valor };
};

function reducer(state, a) {
  switch (a.type) {
    case 'META_DIR':
      return { ...state, metasDir: setIn(state.metasDir, [a.forn, a.mes], round2(a.valor)) };
    case 'METAS_DIR': // { [forn]: {10,11,12} } — mescla
      return { ...state, metasDir: { ...state.metasDir, ...a.metas } };
    case 'GERENTE_FORN':
      return { ...state, config: { ...state.config, fornGerente: { ...state.config.fornGerente, [a.forn]: a.gerente } } };
    case 'META_GER':
      return { ...state, metasGer: setIn(state.metasGer, [a.forn, a.equipe, a.mes], round2(a.valor)) };
    case 'METAS_GER_FORN': // substitui o rateio de uma indústria
      return { ...state, metasGer: { ...state.metasGer, [a.forn]: a.valores } };
    case 'META_SUP':
      return { ...state, metasSup: setIn(state.metasSup, [a.equipe, a.forn, a.vend, a.mes], round2(a.valor)) };
    case 'METAS_SUP_FORN':
      return { ...state, metasSup: setIn(state.metasSup, [a.equipe, a.forn], a.valores) };
    case 'DATASET':
      return { ...state, dataset: a.dataset };
    case 'CONFIG':
      return { ...state, config: { ...state.config, ...a.patch } };
    case 'RESET_METAS':
      if (a.nivel === 'dir') return { ...state, metasDir: {} };
      if (a.nivel === 'ger') return { ...state, metasGer: {} };
      if (a.nivel === 'sup') return { ...state, metasSup: {} };
      return { ...state, metasDir: {}, metasGer: {}, metasSup: {} };
    case 'IMPORTAR':
      return { ...estadoInicial(), ...a.state, dataset: a.state.dataset || state.dataset };
    case 'RESET_TUDO':
      return estadoInicial();
    default:
      return state;
  }
}

const Ctx = createContext(null);

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, carregar);
  const [avisoStorage, setAvisoStorage] = useState(null);
  const timer = useRef();

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        setAvisoStorage(null);
      } catch (e) {
        setAvisoStorage('Não foi possível salvar no navegador (armazenamento cheio ou bloqueado). Use "Exportar backup" para não perder o trabalho.');
      }
    }, 300);
    return () => clearTimeout(timer.current);
  }, [state]);

  const rows = useMemo(
    () => (state.dataset.fonte === 'planilha' && state.dataset.rowsC ? descompactar(state.dataset.rowsC) : gerarHistoricoFicticio()),
    [state.dataset]
  );
  const modelo = useMemo(() => construirModelo(rows, state.config), [rows, state.config]);

  const value = useMemo(() => ({ state, dispatch, modelo, avisoStorage }), [state, modelo, avisoStorage]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useStore = () => useContext(Ctx);

export function datasetDePlanilha(rows, arquivo) {
  return { fonte: 'planilha', arquivo, carregadoEm: new Date().toISOString(), rowsC: compactar(rows) };
}

export const datasetFicticio = () => ({ fonte: 'ficticio', arquivo: null, carregadoEm: null, rowsC: null });
