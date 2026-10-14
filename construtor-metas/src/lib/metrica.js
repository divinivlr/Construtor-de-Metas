// ---------------------------------------------------------------------------
// Métricas de meta: Financeiro (R$ faturamento) e Positivação (clientes)
// Cada métrica tem as suas próprias metas em todos os níveis.
// ---------------------------------------------------------------------------
import { fmtBRL, fmtCompacto, fmtNum0, fmtNum2 } from './format';

export const METRICAS = {
  fin: {
    id: 'fin',
    label: 'Financeiro',
    curto: 'R$',
    campo: 'fat', // campo do histórico
    outroCampo: 'pos',
    outroLabel: 'Posit. média',
    decimais: 2,
    fmt: fmtBRL,
    fmtC: fmtCompacto,
    fmtIn: fmtNum2,
    labelTotal: 'Total tri',
    xlsxFmt: '"R$" #,##0.00',
    arredSugestao: (v) => Math.max(0, Math.round(v / 100) * 100), // múltiplos de R$ 100
  },
  pos: {
    id: 'pos',
    label: 'Positivação',
    curto: 'Clientes',
    campo: 'pos',
    outroCampo: 'fat',
    outroLabel: 'Fat. médio',
    decimais: 0,
    fmt: (v) => `${fmtNum0(v)} cli.`,
    fmtC: (v) => `${fmtNum0(v)} cli.`,
    fmtIn: fmtNum0,
    labelTotal: 'Soma tri',
    xlsxFmt: '#,##0',
    arredSugestao: (v) => Math.max(0, Math.round(v)),
  },
};

export const LISTA_METRICAS = [METRICAS.fin, METRICAS.pos];

/** Formata o "outro" campo (coluna de apoio) */
export const fmtOutro = (met, v) => (met.outroCampo === 'fat' ? fmtBRL(v) : fmtNum0(v));
