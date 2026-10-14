// ---------------------------------------------------------------------------
// Exportação para Excel (.xlsx) formatado — ExcelJS carregado sob demanda
// ---------------------------------------------------------------------------
import { BASES, MESES_META, MESES_NOMES, SEM_GERENTE } from './constants';
import { METRICAS } from './metrica';
import { industriasDaEquipe, metaDir, metaEquipe, metaVend, statusGerente, statusSupervisor } from './metas';
import { somar } from './allocate';
import { gerarHistoricoFicticio } from './mockData';

const AZUL = 'FF1E2D89';
const AZUL_CLARO = 'FFEEF4FF';
const CINZA = 'FFF1F5F9';
const VERDE = 'FF047857';
const MOEDA = '"R$" #,##0.00';
const BORDA = { style: 'thin', color: { argb: 'FFCBD5E1' } };

async function novoWorkbook() {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Construtor de Metas Trimestrais';
  wb.created = new Date();
  return wb;
}

async function baixar(wb, nome) {
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

const limparNome = (s) => String(s).replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_');
const hoje = () => new Date().toLocaleString('pt-BR');
const nomeGer = (state, id) => [...state.config.gerentes, SEM_GERENTE].find((g) => g.id === id)?.nome || id;
const nomeForn = (modelo, cod) => modelo.fornecedores.get(Number(cod))?.nome || `Indústria ${cod}`;
const colLetra = (n) => {
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

/** Cabeçalho do relatório (título + linhas de informação). Retorna próxima linha livre. */
function cabecalho(ws, titulo, infos, nCols) {
  ws.mergeCells(1, 1, 1, nCols);
  const t = ws.getCell(1, 1);
  t.value = titulo;
  t.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } };
  t.alignment = { vertical: 'middle', indent: 1 };
  ws.getRow(1).height = 26;
  let r = 2;
  for (const [k, v] of infos) {
    ws.getCell(r, 1).value = k;
    ws.getCell(r, 1).font = { bold: true, color: { argb: 'FF475569' } };
    ws.mergeCells(r, 2, r, Math.max(2, nCols));
    ws.getCell(r, 2).value = v;
    r++;
  }
  return r + 1;
}

/**
 * Escreve uma tabela formatada.
 * cols: [{ header, key, width, moeda?, formula?: (rowNumber, colMap) => string, total?: 'sum' }]
 */
function tabela(ws, linhaInicial, cols, linhas, { totalLabel = 'TOTAL', freeze = true } = {}) {
  const colIdx = {};
  cols.forEach((c, i) => {
    colIdx[c.key] = i + 1;
    ws.getColumn(i + 1).width = Math.max(ws.getColumn(i + 1).width || 0, c.width || 14);
  });
  const hr = ws.getRow(linhaInicial);
  cols.forEach((c, i) => {
    const cell = hr.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: c.cor || AZUL } };
    cell.alignment = { vertical: 'middle', horizontal: c.moeda || c.numFmt ? 'right' : 'left', wrapText: true };
    cell.border = { top: BORDA, bottom: BORDA, left: BORDA, right: BORDA };
  });
  hr.height = 22;

  let r = linhaInicial + 1;
  linhas.forEach((dado, i) => {
    const row = ws.getRow(r);
    cols.forEach((c, j) => {
      const cell = row.getCell(j + 1);
      if (c.formula) cell.value = { formula: c.formula(r, colIdx), result: dado[c.key] };
      else cell.value = dado[c.key] ?? null;
      if (c.moeda) cell.numFmt = MOEDA;
      if (c.numFmt) cell.numFmt = c.numFmt;
      if (c.pct) cell.numFmt = '0.0%';
      cell.border = { top: BORDA, bottom: BORDA, left: BORDA, right: BORDA };
      if (i % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      if (dado._destaque) cell.font = { bold: true };
    });
    r++;
  });

  const ultimaDados = r - 1;
  if (cols.some((c) => c.total)) {
    const row = ws.getRow(r);
    cols.forEach((c, j) => {
      const cell = row.getCell(j + 1);
      if (j === 0) cell.value = totalLabel;
      if (c.total === 'sum' && linhas.length) {
        const L = colLetra(j + 1);
        cell.value = { formula: `SUM(${L}${linhaInicial + 1}:${L}${ultimaDados})`, result: somar(linhas.map((d) => d[c.key] || 0)) };
      }
      if (c.moeda) cell.numFmt = MOEDA;
      if (c.numFmt) cell.numFmt = c.numFmt;
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_CLARO } };
      cell.border = { top: { style: 'medium', color: { argb: AZUL } }, bottom: BORDA, left: BORDA, right: BORDA };
    });
    r++;
  }
  if (linhas.length) ws.autoFilter = { from: { row: linhaInicial, column: 1 }, to: { row: ultimaDados, column: cols.length } };
  if (freeze) ws.views = [{ state: 'frozen', ySplit: linhaInicial, xSplit: 0 }];
  return r + 1;
}

const VERDE_AGUA = 'FF0F766E';
const PREF = { fin: 'R$', pos: 'Posit.' };

/** Colunas Out/Nov/Dez de uma métrica (chaves fin10.. / pos10..) */
const colsMeses = (mid, prefixo = '') =>
  MESES_META.map((m) => ({
    header: `${prefixo}${PREF[mid]} ${MESES_NOMES[m]}/26`,
    key: `${mid}${m}`,
    width: mid === 'fin' ? 16 : 12,
    numFmt: METRICAS[mid].xlsxFmt,
    cor: mid === 'pos' ? VERDE_AGUA : undefined,
    total: 'sum',
  }));
const colTotal = (mid) => ({
  header: mid === 'fin' ? 'R$ Total Tri' : 'Posit. Soma Tri',
  key: `${mid}Tri`,
  width: mid === 'fin' ? 18 : 13,
  numFmt: METRICAS[mid].xlsxFmt,
  cor: mid === 'pos' ? VERDE_AGUA : undefined,
  total: 'sum',
  formula: (r, c) => `SUM(${colLetra(c[`${mid}10`])}${r}:${colLetra(c[`${mid}12`])}${r})`,
});
const preencher = (obj, mid, fn) => {
  for (const m of MESES_META) obj[`${mid}${m}`] = fn(m);
  obj[`${mid}Tri`] = somar(MESES_META.map((m) => obj[`${mid}${m}`]));
  return obj;
};
const unir = (...listas) => [...new Set(listas.flat().map(Number))];

// ---------------------------------------------------------------------------
// SUPERVISOR — Financeiro (R$) + Positivação no mesmo arquivo
// ---------------------------------------------------------------------------
export async function exportarSupervisor(vFin, vPos, modelo, equipe, base) {
  const wb = await novoWorkbook();
  const eq = modelo.equipes.get(equipe);
  const vistas = { fin: vFin, pos: vPos };
  const ordemForn = new Map(modelo.listaFornecedores.map((f, i) => [f.cod, i]));
  const forns = unir(industriasDaEquipe(vFin, modelo, equipe), industriasDaEquipe(vPos, modelo, equipe)).sort(
    (a, b) => (ordemForn.get(a) ?? 999) - (ordemForn.get(b) ?? 999)
  );
  const baseLabel = BASES.find((b) => b.id === base.mode)?.label || base.mode;
  const infos = [
    ['Equipe', equipe],
    ['Supervisor', eq?.supervisor || '—'],
    ['Base da sugestão', baseLabel],
    ['Gerado em', hoje()],
    ['Validação', 'OK — Financeiro e Positivação: soma dos vendedores = meta da equipe em todas as indústrias e meses'],
  ];
  const nomeV = (v) => modelo.vendedores.get(v)?.nome || String(v);
  const vendsDe = (f) =>
    unir(...['fin', 'pos'].map((mid) => Object.keys(vistas[mid].metasSup?.[equipe]?.[f] || {})))
      .filter((v) => ['fin', 'pos'].some((mid) => MESES_META.some((m) => metaVend(vistas[mid], equipe, f, v, m))))
      .sort((a, b) => nomeV(a).localeCompare(nomeV(b), 'pt-BR'));

  // 1) Metas por vendedor × indústria
  const ws1 = wb.addWorksheet('Metas por Vendedor', { properties: { tabColor: { argb: AZUL } } });
  const linhas1 = [];
  for (const f of forns)
    for (const v of vendsDe(f)) {
      const l = { gerente: nomeGer(vFin, modelo.gerenteDe(f)), codForn: f, forn: nomeForn(modelo, f), codVend: v, vend: nomeV(v) };
      preencher(l, 'fin', (m) => metaVend(vFin, equipe, f, v, m));
      preencher(l, 'pos', (m) => metaVend(vPos, equipe, f, v, m));
      linhas1.push(l);
    }
  const cols1 = [
    { header: 'Gerente', key: 'gerente', width: 14 },
    { header: 'Cód. Ind.', key: 'codForn', width: 10 },
    { header: 'Indústria', key: 'forn', width: 40 },
    { header: 'Cód. Vend.', key: 'codVend', width: 11 },
    { header: 'Vendedor', key: 'vend', width: 28 },
    ...colsMeses('fin'),
    colTotal('fin'),
    ...colsMeses('pos'),
  ];
  const r1 = cabecalho(ws1, `Metas Trimestrais — ${equipe}`, infos, cols1.length);
  tabela(ws1, r1, cols1, linhas1);

  // 2) Mensal por vendedor (todas as indústrias)
  const ws2 = wb.addWorksheet('Mensal por Vendedor');
  const vendsAll = unir(...forns.map(vendsDe)).sort((a, b) => nomeV(a).localeCompare(nomeV(b), 'pt-BR'));
  const linhas2 = vendsAll.map((v) => {
    const l = { codVend: v, vend: nomeV(v) };
    preencher(l, 'fin', (m) => somar(forns.map((f) => metaVend(vFin, equipe, f, v, m))));
    preencher(l, 'pos', (m) => somar(forns.map((f) => metaVend(vPos, equipe, f, v, m))));
    return l;
  });
  const cols2 = [{ header: 'Cód.', key: 'codVend', width: 10 }, { header: 'Vendedor', key: 'vend', width: 28 }, ...colsMeses('fin'), colTotal('fin'), ...colsMeses('pos')];
  const r2 = cabecalho(ws2, `Meta mensal por vendedor (todas as indústrias) — ${equipe}`, [['Gerado em', hoje()]], cols2.length);
  tabela(ws2, r2, cols2, linhas2);

  // 3) Conferência por indústria e métrica
  const ws3 = wb.addWorksheet('Conferência');
  const linhas3 = forns.map((f) => {
    const l = { gerente: nomeGer(vFin, modelo.gerenteDe(f)), codForn: f, forn: nomeForn(modelo, f) };
    for (const mid of ['fin', 'pos']) {
      const st = statusSupervisor(vistas[mid], equipe, f);
      l[`${mid}Meta`] = somar(MESES_META.map((m) => st.meses[m].meta));
      l[`${mid}Dist`] = somar(MESES_META.map((m) => st.meses[m].soma));
      l[`${mid}Dif`] = Math.round((l[`${mid}Dist`] - l[`${mid}Meta`]) * 100) / 100;
      l[`${mid}St`] = st.ok ? 'OK' : st.temMeta ? 'PENDENTE' : 'SEM META';
    }
    return l;
  });
  const colsConf = (mid) => [
    { header: `${PREF[mid]} Meta Tri`, key: `${mid}Meta`, width: 16, numFmt: METRICAS[mid].xlsxFmt, total: 'sum', cor: mid === 'pos' ? VERDE_AGUA : undefined },
    { header: `${PREF[mid]} Distribuído`, key: `${mid}Dist`, width: 16, numFmt: METRICAS[mid].xlsxFmt, total: 'sum', cor: mid === 'pos' ? VERDE_AGUA : undefined },
    { header: `${PREF[mid]} Diferença`, key: `${mid}Dif`, width: 14, numFmt: METRICAS[mid].xlsxFmt, total: 'sum', cor: mid === 'pos' ? VERDE_AGUA : undefined },
    { header: `${PREF[mid]} Status`, key: `${mid}St`, width: 12, cor: mid === 'pos' ? VERDE_AGUA : undefined },
  ];
  const cols3 = [
    { header: 'Gerente', key: 'gerente', width: 14 },
    { header: 'Cód. Ind.', key: 'codForn', width: 10 },
    { header: 'Indústria', key: 'forn', width: 40 },
    ...colsConf('fin'),
    ...colsConf('pos'),
  ];
  const r3 = cabecalho(ws3, `Conferência do rateio — ${equipe}`, [['Gerado em', hoje()]], cols3.length);
  tabela(ws3, r3, cols3, linhas3);
  ws3.eachRow((row) =>
    row.eachCell((c) => {
      if (c.value === 'OK') c.font = { bold: true, color: { argb: VERDE } };
      if (c.value === 'PENDENTE' || c.value === 'SEM META') c.font = { bold: true, color: { argb: 'FFB45309' } };
    })
  );

  // 4/5) Matriz vendedor × indústria (trimestre) para cada métrica
  for (const mid of ['fin', 'pos']) {
    const ws = wb.addWorksheet(mid === 'fin' ? 'Vend x Ind (R$)' : 'Vend x Ind (Posit.)');
    const cols = [
      { header: 'Vendedor', key: 'vend', width: 28 },
      ...forns.map((f) => ({
        header: nomeForn(modelo, f).split(' ').slice(0, 3).join(' '),
        key: `f${f}`,
        width: 16,
        numFmt: METRICAS[mid].xlsxFmt,
        total: 'sum',
        cor: mid === 'pos' ? VERDE_AGUA : undefined,
      })),
    ];
    const ini = colLetra(2);
    const fim = colLetra(cols.length);
    cols.push({ header: mid === 'fin' ? 'R$ Total Tri' : 'Posit. Soma Tri', key: 'tri', width: 18, numFmt: METRICAS[mid].xlsxFmt, total: 'sum', formula: (r) => `SUM(${ini}${r}:${fim}${r})` });
    const linhas = vendsAll.map((v) => {
      const l = { vend: nomeV(v) };
      for (const f of forns) l[`f${f}`] = somar(MESES_META.map((m) => metaVend(vistas[mid], equipe, f, v, m))) || null;
      l.tri = somar(forns.map((f) => l[`f${f}`] || 0));
      return l;
    });
    const r = cabecalho(ws, `${METRICAS[mid].label}: meta do trimestre por vendedor e indústria — ${equipe}`, [['Gerado em', hoje()]], cols.length);
    tabela(ws, r, cols, linhas);
    ws.views = [{ state: 'frozen', ySplit: r, xSplit: 1 }];
  }

  await baixar(wb, `Metas_${limparNome(equipe)}_Out-Dez_2026.xlsx`);
}

// ---------------------------------------------------------------------------
// GERENTE
// ---------------------------------------------------------------------------
export async function exportarGerente(vFin, vPos, modelo, nomeGerente, forns, equipes) {
  const wb = await novoWorkbook();
  const ws = wb.addWorksheet('Rateio por Equipe', { properties: { tabColor: { argb: AZUL } } });
  const linhas = [];
  for (const f of forns)
    for (const eq of equipes) {
      const l = { codForn: f, forn: nomeForn(modelo, f), equipe: eq, sup: modelo.equipes.get(eq)?.supervisor || '' };
      preencher(l, 'fin', (m) => metaEquipe(vFin, eq, f, m));
      preencher(l, 'pos', (m) => metaEquipe(vPos, eq, f, m));
      if (l.finTri || l.posTri) linhas.push(l);
    }
  const cols = [
    { header: 'Cód. Ind.', key: 'codForn', width: 10 },
    { header: 'Indústria', key: 'forn', width: 40 },
    { header: 'Equipe', key: 'equipe', width: 14 },
    { header: 'Supervisor', key: 'sup', width: 24 },
    ...colsMeses('fin'),
    colTotal('fin'),
    ...colsMeses('pos'),
  ];
  const r = cabecalho(ws, `Rateio da carteira — ${nomeGerente}`, [['Gerado em', hoje()]], cols.length);
  tabela(ws, r, cols, linhas);

  const ws2 = wb.addWorksheet('Conferência');
  const linhas2 = forns.map((f) => {
    const l = { codForn: f, forn: nomeForn(modelo, f) };
    for (const [mid, v] of [['fin', vFin], ['pos', vPos]]) {
      const st = statusGerente(v, f);
      l[`${mid}Meta`] = somar(MESES_META.map((m) => metaDir(v, f, m)));
      l[`${mid}Dist`] = somar(MESES_META.map((m) => st.meses[m].soma));
      l[`${mid}St`] = st.ok ? 'OK' : st.temMeta ? 'PENDENTE' : 'SEM META';
    }
    return l;
  });
  const cc = (mid) => [
    { header: `${PREF[mid]} Meta Diretoria Tri`, key: `${mid}Meta`, width: 18, numFmt: METRICAS[mid].xlsxFmt, total: 'sum', cor: mid === 'pos' ? VERDE_AGUA : undefined },
    { header: `${PREF[mid]} Distribuído`, key: `${mid}Dist`, width: 16, numFmt: METRICAS[mid].xlsxFmt, total: 'sum', cor: mid === 'pos' ? VERDE_AGUA : undefined },
    { header: `${PREF[mid]} Status`, key: `${mid}St`, width: 12, cor: mid === 'pos' ? VERDE_AGUA : undefined },
  ];
  const cols2 = [{ header: 'Cód. Ind.', key: 'codForn', width: 10 }, { header: 'Indústria', key: 'forn', width: 40 }, ...cc('fin'), ...cc('pos')];
  const r2 = cabecalho(ws2, `Conferência — ${nomeGerente}`, [['Gerado em', hoje()]], cols2.length);
  tabela(ws2, r2, cols2, linhas2);

  await baixar(wb, `Rateio_${limparNome(nomeGerente)}_Out-Dez_2026.xlsx`);
}

// ---------------------------------------------------------------------------
// DIRETORIA
// ---------------------------------------------------------------------------
export async function exportarDiretoria(vFin, vPos, modelo, linhasTela) {
  const wb = await novoWorkbook();
  const ws = wb.addWorksheet('Meta por Indústria', { properties: { tabColor: { argb: AZUL } } });
  const linhas = linhasTela
    .map((l) => {
      const o = { codForn: l.cod, forn: l.nome, gerente: nomeGer(vFin, l.gerente) };
      preencher(o, 'fin', (m) => metaDir(vFin, l.cod, m));
      preencher(o, 'pos', (m) => metaDir(vPos, l.cod, m));
      return o;
    })
    .filter((o) => o.finTri > 0 || o.posTri > 0);
  const cols = [
    { header: 'Cód. Ind.', key: 'codForn', width: 10 },
    { header: 'Indústria', key: 'forn', width: 42 },
    { header: 'Gerente', key: 'gerente', width: 16 },
    ...colsMeses('fin'),
    colTotal('fin'),
    ...colsMeses('pos'),
  ];
  const r = cabecalho(ws, 'Metas por Indústria — 4º trimestre 2026', [['Gerado em', hoje()]], cols.length);
  tabela(ws, r, cols, linhas);
  await baixar(wb, 'Metas_Diretoria_Out-Dez_2026.xlsx');
}

// ---------------------------------------------------------------------------
// Modelo da planilha de histórico
// ---------------------------------------------------------------------------
export async function baixarModelo() {
  const wb = await novoWorkbook();
  const ws = wb.addWorksheet('Dados');
  const headers = ['Cod Vendedor', 'Nome Vendedor', 'Varejo Spv', 'Nome Supervisor', 'Cod Fornecedor', 'Nome Fornecedor', 'Mês', 'Ano', 'R$ Faturamento', 'Positivação'];
  ws.addRow(headers);
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).eachCell((c) => (c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } }));
  const abrev = ['', 'jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set'];
  for (const r of gerarHistoricoFicticio().slice(0, 30))
    ws.addRow([r.codVend, r.nomeVend, r.spv, r.supervisor, r.codForn, r.nomeForn, abrev[r.mes], r.ano, r.fat, r.pos]);
  ws.getColumn(9).numFmt = MOEDA;
  [12, 26, 14, 22, 14, 44, 8, 8, 16, 12].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  await baixar(wb, 'modelo-base-historico.xlsx');
}
