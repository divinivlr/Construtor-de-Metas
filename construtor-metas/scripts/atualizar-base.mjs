// ---------------------------------------------------------------------------
// Atualiza a base histórica que vem embutida no sistema.
//
// Uso:  npm run atualizar-base -- "C:\caminho\Base Histórico.xlsx"
//
// Lê a planilha (mesmo layout da "Base Histórico.xlsx") e grava
// src/data/baseHistorico.json. Depois é só fazer commit/push: o Vercel
// publica a nova versão e todos passam a ver a base atualizada.
// ---------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { compactar, lerWorkbookHistorico } from '../src/lib/importExcel.js';

const arquivo = process.argv[2];
if (!arquivo) {
  console.error('Informe o caminho da planilha. Ex.: npm run atualizar-base -- "Base Histórico.xlsx"');
  process.exit(1);
}

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(arquivo);
const { rows, aba, ignoradas } = lerWorkbookHistorico(wb);

const saida = {
  arquivo: path.basename(arquivo),
  atualizadoEm: new Date().toISOString(),
  aba,
  linhas: compactar(rows),
};
const destino = new URL('../src/data/baseHistorico.json', import.meta.url);
fs.writeFileSync(destino, JSON.stringify(saida));

const meses = [...new Set(rows.map((r) => r.mes))].sort((a, b) => a - b);
console.log(`✔ ${rows.length} linhas da aba "${aba}" gravadas em src/data/baseHistorico.json`);
console.log(`  Meses: ${meses.join(', ')} · Vendedores: ${new Set(rows.map((r) => r.codVend)).size} · Indústrias: ${new Set(rows.map((r) => r.codForn)).size}`);
if (ignoradas.length) console.log(`  ${ignoradas.length} linha(s) ignoradas (sem código ou mês): ${ignoradas.slice(0, 10).join(', ')}…`);
