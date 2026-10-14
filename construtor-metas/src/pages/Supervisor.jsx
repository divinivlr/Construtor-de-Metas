import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Eraser,
  FileSpreadsheet,
  Info,
  LayoutGrid,
  ListChecks,
  Scale,
  Trophy,
  Users,
  Wand2,
} from 'lucide-react';
import { useStore } from '../store';
import { BASE_PADRAO, CANAIS, MESES_META, MESES_NOMES, SEM_GERENTE } from '../lib/constants';
import { mediaSerie, melhorMes, mesesDaBase, pesoVendedor, serieEquipe, valorBase, vendedoresDoRateio } from '../lib/history';
import { industriasDaEquipe, metaEquipe, metaVend, statusSupervisor } from '../lib/metas';
import { ratear, somar } from '../lib/allocate';
import { fmtPct } from '../lib/format';
import { fmtOutro } from '../lib/metrica';
import { BaseSelector, DiffCell, Empty, EquipeTag, MesesCells, MesesHeader, MetricaBanner, MoneyInput, PageHeader, StatusPill, ToggleMeses, nomeFornecedor } from '../components/ui';
import { exportarSupervisor } from '../lib/exportExcel';

/** Lista de vendedores exibidos e sugestão de rateio para equipe × indústria */
function calcularRateio(state, modelo, equipe, forn, base, todos, met) {
  let lista = vendedoresDoRateio(modelo, equipe, forn, { todos });
  const comValor = Object.keys(state.metasSup?.[equipe]?.[forn] || {}).map(Number);
  let autoTodos = false;
  if (!lista.length && !todos) {
    lista = vendedoresDoRateio(modelo, equipe, forn, { todos: true });
    autoTodos = true;
  }
  for (const v of comValor) if (!lista.includes(v) && MESES_META.some((m) => metaVend(state, equipe, forn, v, m))) lista.push(v);

  const linhas = lista.map((cv) => {
    const v = modelo.vendedores.get(cv) || { cod: cv, nome: `Vendedor ${cv}`, participacaoGerente: {} };
    const s = modelo.serie(cv, forn);
    const mesesUsados = s ? mesesDaBase(s[met.campo], base, modelo.meses) : [];
    return {
      cod: cv,
      nome: v.nome,
      participacaoGerente: v.participacaoGerente || {},
      serie: s ? s[met.campo] : new Array(13).fill(0),
      melhor: s ? melhorMes(s[met.campo], modelo.meses) : { mes: null, valor: 0 },
      media: s ? valorBase(s[met.campo], base, modelo.meses) : 0,
      outroMedia: s ? mediaSerie(s[met.outroCampo], mesesUsados) : 0,
      peso: pesoVendedor(modelo, cv, forn, base),
      vinculado: modelo.vinculado(cv, modelo.gerenteDe(forn)),
    };
  });
  const somaPesos = linhas.reduce((a, l) => a + l.peso, 0);
  const sugestao = {};
  for (const l of linhas) sugestao[l.cod] = {};
  for (const m of MESES_META) {
    const partes = ratear(metaEquipe(state, equipe, forn, m), linhas.map((l) => l.peso), met.decimais);
    linhas.forEach((l, i) => (sugestao[l.cod][m] = partes[i]));
  }
  return { linhas, somaPesos, sugestao, autoTodos };
}

export default function Supervisor({ params, navegar }) {
  const { state, dispatch, modelo, met, vista } = useStore();
  const [equipe, setEquipe] = useState(params?.e || null);
  const [forn, setForn] = useState(null);
  const [base, setBase] = useState(BASE_PADRAO);
  const [todos, setTodos] = useState(false);
  const [mostrarMeses, setMostrarMeses] = useState(true);
  const [visao, setVisao] = useState('rateio');
  const [exportando, setExportando] = useState(false);

  // Equipes com alguma meta recebida
  const equipesComMeta = useMemo(
    () => modelo.listaEquipes.filter((eq) => ['fin', 'pos'].some((m) => industriasDaEquipe(vista(m), modelo, eq).length > 0)),
    [state.metas, modelo] // eslint-disable-line
  );
  const listaEquipes = equipesComMeta.length ? equipesComMeta : modelo.listaEquipes;

  useEffect(() => {
    if (params?.e) setEquipe(params.e);
  }, [params?.e]);
  useEffect(() => {
    if (!equipe || !modelo.equipes.has(equipe)) setEquipe(listaEquipes[0] || null);
  }, [listaEquipes, equipe, modelo]);

  const forns = useMemo(() => (equipe ? industriasDaEquipe(state, modelo, equipe) : []), [state, modelo, equipe]);
  useEffect(() => {
    if (!forns.includes(forn)) setForn(forns[0] ?? null);
  }, [forns, forn]);

  const statusPorForn = useMemo(() => Object.fromEntries(forns.map((f) => [f, statusSupervisor(state, equipe, f)])), [state, equipe, forns]);
  const fechadas = forns.filter((f) => statusPorForn[f]?.ok).length;
  const tudoOk = forns.length > 0 && fechadas === forns.length;
  const infoEquipe = modelo.equipes.get(equipe);

  // Exportação exige as DUAS métricas fechadas (Financeiro e Positivação)
  const statusMet = (mid) => {
    const v = vista(mid);
    const fs = equipe ? industriasDaEquipe(v, modelo, equipe) : [];
    const ok = fs.filter((f) => statusSupervisor(v, equipe, f).ok).length;
    return { total: fs.length, ok, fechado: fs.length > 0 && ok === fs.length };
  };
  const stFin = statusMet('fin');
  const stPos = statusMet('pos');
  const exportOk = stFin.fechado && stPos.fechado;

  const aplicarSugestao = (f) => {
    const r = calcularRateio(state, modelo, equipe, f, base, todos, met);
    dispatch({ type: 'METAS_SUP_FORN', equipe, forn: f, valores: r.sugestao });
  };
  const aplicarTodas = () => {
    const algum = forns.some((f) => Object.keys(state.metasSup?.[equipe]?.[f] || {}).length);
    if (algum && !window.confirm(`Substituir os valores de ${met.label} já distribuídos em todas as indústrias pela sugestão?`)) return;
    forns.forEach(aplicarSugestao);
  };

  const exportar = async () => {
    setExportando(true);
    try {
      await exportarSupervisor(vista('fin'), vista('pos'), modelo, equipe, base);
    } finally {
      setExportando(false);
    }
  };

  if (!equipe)
    return (
      <Empty icon={Users} title="Nenhuma equipe encontrada">
        Carregue a base histórica em “Base & Config”.
      </Empty>
    );

  return (
    <div>
      <PageHeader
        step="Etapa 3 · Supervisores"
        title="Rateio entre vendedores"
        subtitle="O supervisor recebe a meta da equipe por indústria e mês e distribui entre os vendedores. A sugestão usa o peso da média histórica de cada vendedor dentro da equipe."
        actions={
          <>
            <MetricaBanner met={met} />
            <div className="flex rounded-lg border border-slate-300 bg-white p-0.5">
              <button
                className={`btn px-2.5 py-1.5 ${visao === 'rateio' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}
                onClick={() => setVisao('rateio')}
              >
                <ListChecks size={15} /> Rateio
              </button>
              <button
                className={`btn px-2.5 py-1.5 ${visao === 'resumo' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}
                onClick={() => setVisao('resumo')}
              >
                <LayoutGrid size={15} /> Resumo da equipe
              </button>
            </div>
            <button
              className="btn-success"
              disabled={!exportOk || exportando}
              onClick={exportar}
              title={exportOk ? 'Baixar planilha com as metas de Financeiro e Positivação' : 'Disponível quando Financeiro e Positivação estiverem fechados em todas as indústrias'}
            >
              <FileSpreadsheet size={16} /> {exportando ? 'Gerando…' : 'Exportar para Excel (.xlsx)'}
            </button>
          </>
        }
      />

      {/* Seleção de equipe */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {listaEquipes.map((eq) => {
          const fs = industriasDaEquipe(state, modelo, eq);
          const ok = fs.filter((f) => statusSupervisor(state, eq, f).ok).length;
          const ativo = eq === equipe;
          const canal = CANAIS[modelo.equipes.get(eq)?.canal || 'OUTROS'];
          return (
            <button
              key={eq}
              onClick={() => {
                setEquipe(eq);
                navegar?.('supervisores', { e: eq });
              }}
              className={`min-w-[11rem] shrink-0 rounded-xl border px-3 py-2 text-left transition ${
                ativo ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500' : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${canal.dot}`} />
                <span className="text-sm font-semibold">{eq}</span>
                {fs.length > 0 && ok === fs.length && <CheckCircle2 size={14} className="text-emerald-500" />}
              </div>
              <div className="truncate text-xs text-slate-500">{modelo.equipes.get(eq)?.supervisor}</div>
              <div className="mt-1 text-[11px] text-slate-400">{fs.length ? `${met.label}: ${ok}/${fs.length} fechadas` : `${met.label}: aguardando gerente`}</div>
            </button>
          );
        })}
      </div>

      {!forns.length ? (
        <Empty icon={Users} title={`${equipe} ainda não recebeu metas`}>
          O gerente precisa distribuir a meta de {met.label} das indústrias para esta equipe na Etapa 2.
          <div className="mt-3">
            <button className="btn-secondary" onClick={() => navegar?.('gerentes')}>
              Ir para Gerentes
            </button>
          </div>
        </Empty>
      ) : (
        <>
          {/* Barra de progresso */}
          <div className="card mb-4 flex flex-wrap items-center gap-4 p-3">
            <div className="flex items-center gap-2">
              <EquipeTag equipe={equipe} />
              <span className="text-sm text-slate-600">
                Supervisor: <b>{infoEquipe?.supervisor}</b>
              </span>
            </div>
            <div className="flex min-w-[220px] flex-1 items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full ${tudoOk ? 'bg-emerald-500' : 'bg-brand-500'}`} style={{ width: `${(fechadas / forns.length) * 100}%` }} />
              </div>
              <span className="text-xs font-medium text-slate-600">
                {met.label}: {fechadas}/{forns.length} fechadas
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              {[
                ['fin', 'Financeiro', stFin],
                ['pos', 'Positivação', stPos],
              ].map(([id, label, st]) => (
                <span
                  key={id}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ring-1 ${
                    st.fechado ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-amber-50 text-amber-700 ring-amber-200'
                  }`}
                >
                  {st.fechado ? <CheckCircle2 size={12} /> : null}
                  {label} {st.total ? `${st.ok}/${st.total}` : 'sem meta'}
                </span>
              ))}
            </div>
            {!exportOk && <span className="text-xs text-amber-600">A exportação libera quando Financeiro e Positivação baterem a meta.</span>}
            {exportOk && (
              <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                <CheckCircle2 size={14} /> Rateio completo — pronto para exportar
              </span>
            )}
          </div>

          {visao === 'resumo' ? (
            <ResumoEquipe equipe={equipe} forns={forns} />
          ) : (
            <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
              {/* Lista de indústrias */}
              <aside className="card h-fit overflow-hidden">
                <div className="border-b border-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Indústrias</div>
                {[...state.config.gerentes, SEM_GERENTE].map((g) => {
                  const fsG = forns.filter((f) => modelo.gerenteDe(f) === g.id);
                  if (!fsG.length) return null;
                  return (
                    <div key={g.id}>
                      <div className="bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase text-slate-400">{g.nome}</div>
                      {fsG.map((f) => {
                        const st = statusPorForn[f];
                        return (
                          <button
                            key={f}
                            onClick={() => setForn(f)}
                            className={`flex w-full items-center gap-2 border-l-2 px-3 py-2 text-left text-sm transition ${
                              f === forn ? 'border-brand-600 bg-brand-50' : 'border-transparent hover:bg-slate-50'
                            }`}
                          >
                            {st?.ok ? (
                              <CheckCircle2 size={14} className="shrink-0 text-emerald-500" />
                            ) : (
                              <span className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-amber-400" />
                            )}
                            <span className="truncate" title={nomeFornecedor(modelo, f)}>
                              {nomeFornecedor(modelo, f)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
                <div className="border-t border-slate-100 p-2">
                  <button className="btn-secondary w-full justify-center" onClick={aplicarTodas}>
                    <Wand2 size={14} /> Sugestão em todas
                  </button>
                </div>
              </aside>

              {forn !== null && (
                <PainelRateio
                  equipe={equipe}
                  forn={forn}
                  base={base}
                  setBase={setBase}
                  todos={todos}
                  setTodos={setTodos}
                  mostrarMeses={mostrarMeses}
                  setMostrarMeses={setMostrarMeses}
                  aplicarSugestao={() => aplicarSugestao(forn)}
                />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PainelRateio({ equipe, forn, base, setBase, todos, setTodos, mostrarMeses, setMostrarMeses, aplicarSugestao }) {
  const { state, dispatch, modelo, met } = useStore();
  const r = useMemo(() => calcularRateio(state, modelo, equipe, forn, base, todos, met), [state, modelo, equipe, forn, base, todos, met]);
  const st = statusSupervisor(state, equipe, forn);
  const gerente = modelo.gerenteDe(forn);
  const nomeGer = (id) => [...state.config.gerentes, SEM_GERENTE].find((g) => g.id === id)?.nome || id;
  const meses = modelo.meses;
  const aditiva = !['top3', 'melhor'].includes(base.mode);
  // soma dos vendedores listados × equipe como o gerente vê
  const serieSoma = new Array(13).fill(0);
  for (const l of r.linhas) for (const m of meses) serieSoma[m] += l.serie[m] || 0;
  const mediaSoma = r.linhas.reduce((a, l) => a + l.media, 0);
  const serieEq = serieEquipe(modelo, equipe, forn);
  const mediaEq = valorBase(serieEq, base, meses);
  const melhorEq = melhorMes(serieEq, meses);
  const nFixas = 5 + (mostrarMeses ? meses.length : 0);

  const ajustarDiferenca = () => {
    const valores = JSON.parse(JSON.stringify(state.metasSup?.[equipe]?.[forn] || {}));
    for (const m of MESES_META) {
      const diff = st.meses[m].meta - st.meses[m].soma;
      if (Math.abs(diff) < 0.005 || !r.linhas.length) continue;
      // joga a diferença no vendedor com maior valor no mês (ou maior peso)
      const alvo = [...r.linhas].sort(
        (a, b) => (valores[b.cod]?.[m] || 0) - (valores[a.cod]?.[m] || 0) || b.peso - a.peso
      )[0].cod;
      valores[alvo] = { ...(valores[alvo] || {}), [m]: Math.round(((valores[alvo]?.[m] || 0) + diff) * 100) / 100 };
    }
    dispatch({ type: 'METAS_SUP_FORN', equipe, forn, valores });
  };

  return (
    <section className="card min-w-0">
      <div className="flex flex-wrap items-start gap-3 border-b border-slate-100 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs text-slate-500">
            {nomeGer(gerente)} · Cód. {forn}
          </div>
          <div className="truncate text-lg font-semibold">{nomeFornecedor(modelo, forn)}</div>
        </div>
        <div className="flex gap-2">
          {MESES_META.map((m) => (
            <div key={m} className="rounded-lg bg-slate-50 px-3 py-1.5 text-right ring-1 ring-slate-200">
              <div className="text-[11px] font-medium uppercase text-slate-500">Meta {MESES_NOMES[m]}</div>
              <div className="text-sm font-semibold tabular-nums">{met.fmt(st.meses[m].meta)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-2">
        <BaseSelector base={base} onChange={setBase} meses={modelo.meses} compact />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={todos} onChange={(e) => setTodos(e.target.checked)} />
          Mostrar todos os vendedores da equipe
        </label>
        <ToggleMeses ativo={mostrarMeses} onChange={setMostrarMeses} />
        <div className="ml-auto flex gap-2">
          <button className="btn-ghost py-1.5" onClick={() => dispatch({ type: 'METAS_SUP_FORN', equipe, forn, valores: {} })}>
            <Eraser size={14} /> Zerar
          </button>
          <button className="btn-secondary py-1.5" onClick={ajustarDiferenca} disabled={st.ok || !st.temMeta} title="Lança a diferença no vendedor com maior meta">
            <Scale size={14} /> Ajustar diferença
          </button>
          <button className="btn-primary py-1.5" onClick={aplicarSugestao}>
            <Wand2 size={14} /> Aplicar sugestão
          </button>
        </div>
      </div>

      {r.autoTodos && (
        <div className="flex items-center gap-2 bg-amber-50 px-4 py-2 text-xs text-amber-700">
          <Info size={14} /> Nenhum vendedor da equipe tem histórico vinculado nesta indústria — exibindo todos (sugestão em partes iguais).
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Vendedor</th>
              <th className="th num">
                <span className="inline-flex items-center gap-1">
                  <Trophy size={12} /> Melhor mês
                </span>
              </th>
              <th className="th num">Média base</th>
              <th className="th num">{met.outroLabel}</th>
              <th className="th num">Peso</th>
              {mostrarMeses && <MesesHeader meses={meses} />}
              {MESES_META.map((m) => (
                <th key={m} className="th num">
                  Meta {MESES_NOMES[m]}
                </th>
              ))}
              <th className="th num">{met.labelTotal}</th>
            </tr>
          </thead>
          <tbody>
            {r.linhas.map((l) => {
              const peso = r.somaPesos > 0 ? l.peso / r.somaPesos : 0;
              const total = somar(MESES_META.map((m) => metaVend(state, equipe, forn, l.cod, m)));
              const mix = Object.entries(l.participacaoGerente)
                .filter(([, v]) => v >= 0.05)
                .sort((a, b) => b[1] - a[1])
                .map(([g, v]) => `${g} ${Math.round(v * 100)}%`)
                .join(' · ');
              return (
                <tr key={l.cod} className="hover:bg-slate-50/60">
                  <td className="td">
                    <div className="font-medium">{l.nome}</div>
                    <div className="flex items-center gap-1 text-[11px] text-slate-400">
                      <span>Cód. {l.cod}</span>
                      {mix && <span title="Participação do faturamento por carteira de gerente">· {mix}</span>}
                      {!l.vinculado && <span className="rounded bg-slate-100 px-1 text-slate-500">sem vínculo</span>}
                    </div>
                  </td>
                  <td className="td num">
                    {l.melhor.mes ? (
                      <div>
                        <span className="mr-1 rounded bg-amber-50 px-1 text-xs font-medium text-amber-700">{MESES_NOMES[l.melhor.mes]}</span>
                        {met.fmt(l.melhor.valor)}
                      </div>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="td num">{met.fmt(l.media)}</td>
                  <td className="td num text-slate-600">{l.outroMedia ? fmtOutro(met, l.outroMedia) : '—'}</td>
                  <td className="td num">
                    <div className="flex items-center justify-end gap-2">
                      <div className="h-1.5 w-14 overflow-hidden rounded bg-slate-100">
                        <div className="h-full bg-brand-500" style={{ width: `${Math.min(100, peso * 100)}%` }} />
                      </div>
                      <span className="w-12 text-xs">{fmtPct(peso)}</span>
                    </div>
                  </td>
                  {mostrarMeses && <MesesCells serie={l.serie} meses={meses} met={met} melhor={l.melhor.mes} />}
                  {MESES_META.map((m) => {
                    const v = metaVend(state, equipe, forn, l.cod, m);
                    const s = r.sugestao[l.cod]?.[m];
                    return (
                      <td key={m} className="td num">
                        <MoneyInput decimais={met.decimais} value={v} onChange={(val) => dispatch({ type: 'META_SUP', equipe, forn, vend: l.cod, mes: m, valor: val })} />
                        {s !== undefined && Math.abs(s - v) >= 0.01 && <div className="mt-0.5 text-[11px] text-slate-400">sug. {met.fmtIn(s)}</div>}
                      </td>
                    );
                  })}
                  <td className="td num font-semibold">{met.fmt(total)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-slate-50 text-sm">
            <tr>
              <td className="td font-semibold" colSpan={2}>
                Soma dos vendedores
              </td>
              <td className="td num font-semibold">{aditiva ? met.fmt(mediaSoma) : '—'}</td>
              <td className="td" colSpan={2}></td>
              {mostrarMeses && <MesesCells serie={serieSoma} meses={meses} met={met} className="font-semibold" />}
              {MESES_META.map((m) => (
                <td key={m} className="td num font-semibold">
                  {met.fmt(st.meses[m].soma)}
                </td>
              ))}
              <td className="td num font-semibold">{met.fmt(somar(MESES_META.map((m) => st.meses[m].soma)))}</td>
            </tr>
            <tr>
              <td className="td text-slate-500">Equipe (igual à tela do gerente)</td>
              <td className="td num text-slate-500">
                {melhorEq.mes ? (
                  <>
                    <span className="mr-1 rounded bg-amber-50 px-1 text-xs font-medium text-amber-700">{MESES_NOMES[melhorEq.mes]}</span>
                    {met.fmt(melhorEq.valor)}
                  </>
                ) : (
                  '—'
                )}
              </td>
              <td className="td num text-slate-500">{met.fmt(mediaEq)}</td>
              <td className="td text-right text-xs text-slate-400" colSpan={2}>
                Meta da equipe →
              </td>
              {mostrarMeses && <MesesCells serie={serieEq} meses={meses} met={met} melhor={melhorEq.mes} />}
              {MESES_META.map((m) => (
                <td key={m} className="td num text-slate-500">
                  {met.fmt(st.meses[m].meta)}
                </td>
              ))}
              <td className="td num text-slate-500">{met.fmt(somar(MESES_META.map((m) => st.meses[m].meta)))}</td>
            </tr>
            <tr>
              <td className="td" colSpan={nFixas}>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Diferença</span>
                  <StatusPill ok={st.ok} temMeta={st.temMeta} label={st.ok ? 'Meta bateu' : 'Rateio com furo'} fmt={met.fmt} />
                </div>
              </td>
              {MESES_META.map((m) => (
                <td key={m} className="td num">
                  <DiffCell decimais={met.decimais} diff={st.meses[m].diff} />
                </td>
              ))}
              <td className="td num">
                <DiffCell decimais={met.decimais} diff={somar(MESES_META.map((m) => st.meses[m].diff))} />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

function ResumoEquipe({ equipe, forns }) {
  const { state, modelo, met } = useStore();
  const porVend = state.metasSup?.[equipe] || {};
  const vends = new Set();
  for (const f of forns) for (const v of Object.keys(porVend[f] || {})) vends.add(Number(v));
  const lista = [...vends].sort((a, b) => (modelo.vendedores.get(a)?.nome || '').localeCompare(modelo.vendedores.get(b)?.nome || '', 'pt-BR'));
  const totVF = (v, f) => somar(MESES_META.map((m) => metaVend(state, equipe, f, v, m)));
  const totVM = (v, m) => somar(forns.map((f) => metaVend(state, equipe, f, v, m)));

  if (!lista.length)
    return (
      <Empty icon={LayoutGrid} title="Nada distribuído ainda">
        Use “Aplicar sugestão” em cada indústria ou “Sugestão em todas”.
      </Empty>
    );

  return (
    <div className="space-y-4">
      <div className="card overflow-x-auto">
        <div className="border-b border-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">Meta do trimestre por vendedor × indústria — {met.label}</div>
        <table className="w-full">
          <thead>
            <tr>
              <th className="th sticky left-0 z-10">Vendedor</th>
              {forns.map((f) => (
                <th key={f} className="th num max-w-[9rem] truncate" title={nomeFornecedor(modelo, f)}>
                  {nomeFornecedor(modelo, f).split(' ').slice(0, 2).join(' ')}
                </th>
              ))}
              <th className="th num">{met.labelTotal}</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((v) => (
              <tr key={v}>
                <td className="td sticky left-0 bg-white font-medium">{modelo.vendedores.get(v)?.nome || v}</td>
                {forns.map((f) => (
                  <td key={f} className="td num">
                    {totVF(v, f) ? met.fmtC(totVF(v, f)) : <span className="text-slate-300">—</span>}
                  </td>
                ))}
                <td className="td num font-semibold">{met.fmt(somar(forns.map((f) => totVF(v, f))))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card overflow-x-auto">
        <div className="border-b border-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">Meta mensal por vendedor (todas as indústrias) — {met.label}</div>
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Vendedor</th>
              {MESES_META.map((m) => (
                <th key={m} className="th num">
                  {MESES_NOMES[m]}
                </th>
              ))}
              <th className="th num">{met.labelTotal}</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((v) => (
              <tr key={v}>
                <td className="td font-medium">{modelo.vendedores.get(v)?.nome || v}</td>
                {MESES_META.map((m) => (
                  <td key={m} className="td num">
                    {met.fmt(totVM(v, m))}
                  </td>
                ))}
                <td className="td num font-semibold">{met.fmt(somar(MESES_META.map((m) => totVM(v, m))))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 font-semibold">
              <td className="td">Total equipe</td>
              {MESES_META.map((m) => (
                <td key={m} className="td num">
                  {met.fmt(somar(lista.map((v) => totVM(v, m))))}
                </td>
              ))}
              <td className="td num">{met.fmt(somar(lista.flatMap((v) => MESES_META.map((m) => totVM(v, m)))))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
