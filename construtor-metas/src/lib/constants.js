// ---------------------------------------------------------------------------
// Constantes de negócio
// ---------------------------------------------------------------------------

export const MESES_NOMES = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
export const MESES_ABREV = ['', 'jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** Meses do trimestre de metas */
export const MESES_META = [10, 11, 12];

/** Gerentes padrão (nomes editáveis na tela "Base & Config") */
export const GERENTES_PADRAO = [
  { id: 'V1', nome: 'Gerente V1' },
  { id: 'V2', nome: 'Gerente V2' },
  { id: 'V3', nome: 'Gerente V3' },
];

export const SEM_GERENTE = { id: 'SEM', nome: 'Sem gerente' };

/**
 * Carteira de indústrias (código do fornecedor) de cada gerente.
 * É a regra que separa os gerentes: um vendedor aparece para o gerente
 * dono da indústria que ele vende, independente do supervisor dele.
 */
export const FORNECEDOR_GERENTE_PADRAO = {
  // Gerente V1
  6090: 'V1', 187: 'V1', 8663: 'V1', 8986: 'V1', 9536: 'V1', 7837: 'V1',
  // Gerente V2
  8629: 'V2', 1938: 'V2', 232: 'V2', 8820: 'V2', 168: 'V2', 105: 'V2', 9623: 'V2', 9632: 'V2',
  // Gerente V3
  9322: 'V3',
};

/**
 * Equipes (coluna "Varejo Spv") agrupadas em OUTROS.
 * ATACADO e CALL CENTER são equipes próprias, com supervisor próprio.
 */
export const OUTROS_SPVS_PADRAO = ['CÓDIGOS INATIVOS'];
export const EQUIPE_OUTROS = 'OUTROS';

/**
 * Um vendedor é vinculado a um gerente quando pelo menos X% do faturamento
 * histórico dele vem das indústrias desse gerente.
 */
export const LIMIAR_VINCULO_PADRAO = 0.1;

export const CANAIS = {
  VAREJO: { label: 'Varejo', cor: 'bg-sky-100 text-sky-800 ring-sky-200', dot: 'bg-sky-500' },
  INTERIOR: { label: 'Interior', cor: 'bg-amber-100 text-amber-800 ring-amber-200', dot: 'bg-amber-500' },
  PONDERADA: { label: 'Ponderada', cor: 'bg-violet-100 text-violet-800 ring-violet-200', dot: 'bg-violet-500' },
  ATACADO: { label: 'Atacado', cor: 'bg-emerald-100 text-emerald-800 ring-emerald-200', dot: 'bg-emerald-500' },
  CALLCENTER: { label: 'Call Center', cor: 'bg-rose-100 text-rose-800 ring-rose-200', dot: 'bg-rose-500' },
  OUTROS: { label: 'Outros', cor: 'bg-slate-100 text-slate-700 ring-slate-200', dot: 'bg-slate-400' },
};

export function canalDaEquipe(equipe) {
  const e = String(equipe || '').toUpperCase();
  if (e.startsWith('VAREJO')) return 'VAREJO';
  if (e.startsWith('INTERIOR')) return 'INTERIOR';
  if (e.startsWith('PONDERADA')) return 'PONDERADA';
  if (e.startsWith('ATACADO')) return 'ATACADO';
  if (e.replace(/\s/g, '').startsWith('CALLCENTER')) return 'CALLCENTER';
  return 'OUTROS';
}

const ORDEM_CANAL = { VAREJO: 0, INTERIOR: 1, PONDERADA: 2, ATACADO: 3, CALLCENTER: 4, OUTROS: 5 };
export function ordenarEquipes(a, b) {
  const ca = ORDEM_CANAL[canalDaEquipe(a)];
  const cb = ORDEM_CANAL[canalDaEquipe(b)];
  return ca - cb || String(a).localeCompare(String(b), 'pt-BR', { numeric: true });
}

/** Opções do filtro de média histórica */
export const BASES = [
  { id: 'ult3', label: 'Média dos últimos 3 meses' },
  { id: 'ult6', label: 'Média dos últimos 6 meses' },
  { id: 'todos', label: 'Média de todo o período (Jan–Set)' },
  { id: 'top3', label: 'Média dos 3 melhores meses' },
  { id: 'melhor', label: 'Melhor mês' },
  { id: 'custom', label: 'Meses personalizados…' },
];

export const BASE_PADRAO = { mode: 'ult3', months: [] };
