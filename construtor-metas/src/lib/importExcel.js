// ---------------------------------------------------------------------------
// Leitura da planilha de histórico (layout "Base Histórico.xlsx")
// Colunas esperadas (ordem livre, nomes tolerantes a acento/maiúsculas):
// Cod Vendedor | Nome Vendedor | Varejo Spv | Nome Supervisor | Cod Fornecedor |
// Nome Fornecedor | Mês | Ano | R$ Faturamento | Positivação
// ---------------------------------------------------------------------------
import { MESES_ABREV } from './constants';

const norm = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const CAMPOS = {
  codVend: ['codvendedor', 'codigovendedor', 'codvend', 'vendedorcod'],
  nomeVend: ['nomevendedor', 'vendedor', 'nomevend'],
  spv: ['varejospv', 'spv', 'equipe', 'time'],
  supervisor: ['nomesupervisor', 'supervisor'],
  codForn: ['codfornecedor', 'codigofornecedor', 'codforn', 'codindustria'],
  nomeForn: ['nomefornecedor', 'fornecedor', 'industria', 'nomeindustria'],
  mes: ['mes', 'month'],
  ano: ['ano', 'year'],
  fat: ['rfaturamento', 'faturamento', 'valor', 'vendas', 'rvenda'],
  pos: ['positivacao', 'positivacoes', 'clientespositivados'],
};
const OBRIGATORIOS = ['codVend', 'nomeVend', 'spv', 'codForn', 'nomeForn', 'mes', 'fat'];

function valorCelula(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object') {
    if (v instanceof Date) return v;
    if ('result' in v) return v.result;
    if ('richText' in v) return v.richText.map((t) => t.text).join('');
    if ('text' in v) return v.text;
  }
  return v;
}

function parseMes(v) {
  if (v instanceof Date) return v.getUTCMonth() + 1;
  if (typeof v === 'number') return v >= 1 && v <= 12 ? Math.round(v) : null;
  const s = norm(v).slice(0, 3);
  const idx = MESES_ABREV.indexOf(s);
  if (idx > 0) return idx;
  const n = Number(s);
  return n >= 1 && n <= 12 ? n : null;
}

function parseNumero(v) {
  if (typeof v === 'number') return v;
  if (v === null || v === undefined || v === '') return 0;
  let s = String(v).trim().replace(/[R$\s]/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

const texto = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();

export async function lerPlanilhaHistorico(file) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());

  // escolhe a aba que contém os cabeçalhos esperados
  for (const ws of wb.worksheets) {
    let headerRow = null;
    let mapa = null;
    for (let r = 1; r <= Math.min(ws.rowCount, 15); r++) {
      const cells = ws.getRow(r).values; // índice 1-based
      const m = {};
      cells.forEach((c, i) => {
        const n = norm(valorCelula(c));
        if (!n) return;
        for (const [campo, aliases] of Object.entries(CAMPOS)) {
          if (m[campo]) continue;
          if (aliases.includes(n)) m[campo] = i;
        }
      });
      if (OBRIGATORIOS.every((c) => m[c])) {
        headerRow = r;
        mapa = m;
        break;
      }
    }
    if (!headerRow) continue;

    const rows = [];
    const ignoradas = [];
    for (let r = headerRow + 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const get = (campo) => (mapa[campo] ? valorCelula(row.getCell(mapa[campo]).value) : null);
      const codVend = Number(get('codVend'));
      const codForn = Number(get('codForn'));
      const mes = parseMes(get('mes'));
      if (!codVend && !codForn) continue; // linha vazia
      if (!Number.isFinite(codVend) || !Number.isFinite(codForn) || !mes) {
        ignoradas.push(r);
        continue;
      }
      rows.push({
        codVend,
        nomeVend: texto(get('nomeVend')),
        spv: texto(get('spv')).toUpperCase() || 'SEM EQUIPE',
        supervisor: texto(get('supervisor')),
        codForn,
        nomeForn: texto(get('nomeForn')),
        mes,
        ano: Number(get('ano')) || null,
        fat: Math.round(parseNumero(get('fat')) * 100) / 100,
        pos: Math.round(parseNumero(get('pos'))),
      });
    }
    if (!rows.length) throw new Error('A planilha não tem linhas de dados abaixo do cabeçalho.');
    return { rows, aba: ws.name, ignoradas };
  }
  throw new Error(
    'Não encontrei os cabeçalhos esperados. A planilha precisa ter: Cod Vendedor, Nome Vendedor, Varejo Spv, Cod Fornecedor, Nome Fornecedor, Mês e R$ Faturamento.'
  );
}

/** Compacta linhas para salvar no navegador */
export const compactar = (rows) =>
  rows.map((r) => [r.codVend, r.nomeVend, r.spv, r.supervisor, r.codForn, r.nomeForn, r.mes, r.ano, r.fat, r.pos]);

export const descompactar = (arr) =>
  (arr || []).map(([codVend, nomeVend, spv, supervisor, codForn, nomeForn, mes, ano, fat, pos]) => ({
    codVend, nomeVend, spv, supervisor, codForn, nomeForn, mes, ano, fat, pos,
  }));
