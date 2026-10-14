import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Briefcase, ChevronDown, ChevronRight, Download, Eraser, Info, PlusCircle, Trophy, Wand2 } from 'lucide-react';
import { useStore } from '../store';
import { BASE_PADRAO, MESES_META, MESES_NOMES, SEM_GERENTE } from '../lib/constants';
import { equipesDoGerente, melhorMes, pesoEquipe, serieEquipe, valorBase } from '../lib/history';
import { metaDir, metaEquipe, statusGerente, totalDir } from '../lib/metas';
import { ratear, somar } from '../lib/allocate';
import { fmtPct } from '../lib/format';
import {
  BaseSelector,
  DiffCell,
  Empty,
  EquipeTag,
  MesesCells,
  MesesHeader,
  MetricaBanner,
  MoneyInput,
  PageHeader,
  StatusPill,
  nomeFornecedor,
} from '../components/ui';
import { exportarGerente } from '../lib/exportExcel';

/** Sugestão de rateio de uma indústria entre equipes */
function sugestaoIndustria(state, modelo, forn, equipes, base, decimais) {
  const pesos = equipes.map((eq) => pesoEquipe(modelo, eq, forn, base));
  const somaPesos = pesos.reduce((a, b) => a + b, 0);
  if (somaPesos <= 0) return { pesos, somaPesos, valores: null };
  const valores = {};
  for (const eq of equipes) valores[eq] = {};
  for (const m of MESES_META) {
    const partes = ratear(metaDir(state, forn, m), pesos, decimais);
    equipes.forEach((eq, i) => (valores[eq][m] = partes[i]));
  }
  return { pesos, somaPesos, valores };
}

/**
 * Completa o que falta (ou sobra) sem mexer no que já foi digitado:
 * a diferença de cada mês vai primeiro para as equipes com histórico que estão sem meta
 * (ex.: Atacado e Call Center); se todas já têm meta, é repartida entre todas pelo peso.
 */
function completarIndustria(state, modelo, forn, equipes, base, decimais) {
  const pesos = equipes.map((eq) => pesoEquipe(modelo, eq, forn, base));
  const atual = state.metasGer?.[forn] || {};
  const valores = JSON.parse(JSON.stringify(atual));
  let mudou = false;
  for (const m of MESES_META) {
    const soma = somar(Object.values(atual).map((e) => e?.[m] || 0));
    const gap = Math.round((metaDir(state, forn, m) - soma) * 100) / 100;
    if (Math.abs(gap) < 0.5 / 10 ** decimais) continue;
    let cand = equipes.map((_, i) => i).filter((i) => pesos[i] > 0 && !(atual[equipes[i]]?.[m] > 0));
    if (!cand.length || gap < 0) cand = equipes.map((_, i) => i).filter((i) => pesos[i] > 0);
    if (!cand.length) continue;
    const partes = ratear(gap, cand.map((i) => pesos[i]), decimais);
    cand.forEach((i, k) => {
      const eq = equipes[i];
      const e = 10 ** decimais;
      valores[eq] = { ...(valores[eq] || {}), [m]: Math.round(((valores[eq]?.[m] || 0) + partes[k]) * e) / e };
    });
    mudou = true;
  }
  return mudou ? valores : null;
}

/** Equipes com histórico na indústria e nenhuma meta (ex.: Atacado/Call Center após a separação) */
function equipesSemMeta(state, modelo, forn, equipes, base) {
  return equipes.filter((eq) => pesoEquipe(modelo, eq, forn, base) > 0 && !MESES_META.some((m) => metaEquipe(state, eq, forn, m) > 0));
}

export default function Gerente({ params, navegar }) {
  const { state, dispatch, modelo, met, vista } = useStore();
  const gerentes = [...state.config.gerentes, SEM_GERENTE];
  const [gerente, setGerente] = useState(params?.g || gerentes[0].id);
  const [base, setBase] = useState(BASE_PADRAO);
  const [fechados, setFechados] = useState({});
  const mostrarMeses = false; // histórico mês a mês desligado na tela do gerente (excesso de informação)

  useEffect(() => {
    if (params?.g) setGerente(params.g);
  }, [params?.g]);

  const fornsDoGerente = (g) => {
    const lista = modelo.listaFornecedores.filter((f) => modelo.gerenteDe(f.cod) === g && (f.total > 1000 || totalDir(state, f.cod) > 0)).map((f) => f.cod);
    for (const cod of Object.keys(state.metasDir).map(Number))
      if (!lista.includes(cod) && modelo.gerenteDe(cod) === g && totalDir(state, cod) > 0) lista.push(cod);
    return lista;
  };

  const forns = useMemo(() => fornsDoGerente(gerente), [modelo, state.metasDir, gerente]); // eslint-disable-line

  const equipes = useMemo(() => {
    const set = new Set(equipesDoGerente(modelo, gerente, base));
    for (const f of forns) for (const eq of Object.keys(state.metasGer?.[f] || {})) if (Object.values(state.metasGer[f][eq] || {}).some((v) => v)) set.add(eq);
    return modelo.listaEquipes.filter((e) => set.has(e)).concat([...set].filter((e) => !modelo.listaEquipes.includes(e)));
  }, [modelo, gerente, base, forns, state.metasGer]);

  const statusTab = (g) => {
    const fs = fornsDoGerente(g).filter((f) => totalDir(state, f) > 0);
    const ok = fs.filter((f) => statusGerente(state, f).ok).length;
    return { total: fs.length, ok };
  };

  const aplicar = (forn) => {
    const s = sugestaoIndustria(state, modelo, forn, equipes, base, met.decimais);
    if (!s.valores) return;
    dispatch({ type: 'METAS_GER_FORN', forn, valores: s.valores });
  };
  const completar = (forn) => {
    const v = completarIndustria(state, modelo, forn, equipes, base, met.decimais);
    if (v) dispatch({ type: 'METAS_GER_FORN', forn, valores: v });
  };

  const aplicarTodas = () => {
    const comValores = forns.some((f) => Object.keys(state.metasGer?.[f] || {}).length);
    if (comValores && !window.confirm(`Substituir o rateio de ${met.label} já feito em todas as indústrias pela sugestão?`)) return;
    for (const f of forns) if (totalDir(state, f) > 0) aplicar(f);
  };

  const fornsComMeta = forns.filter((f) => totalDir(state, f) > 0);
  const nomeGerente = gerentes.find((g) => g.id === gerente)?.nome;

  // indústrias pendentes porque há equipes com histórico e sem meta
  const lacunas = fornsComMeta
    .filter((f) => !statusGerente(state, f).ok && Object.keys(state.metasGer?.[f] || {}).length)
    .map((f) => ({ f, eqs: equipesSemMeta(state, modelo, f, equipes, base) }))
    .filter((x) => x.eqs.length);
  const pendentes = fornsComMeta.filter((f) => !statusGerente(state, f).ok && Object.keys(state.metasGer?.[f] || {}).length);

  return (
    <div>
      <PageHeader
        step="Etapa 2 · Gerentes"
        title="Rateio da meta entre equipes"
        subtitle="Cada gerente divide a meta das indústrias da sua carteira entre as equipes que vendem essas indústrias. Vendedores de outro supervisor que vendem a sua carteira entram aqui pela equipe deles."
        actions={
          <>
            <MetricaBanner met={met} />
            <button className="btn-secondary" onClick={() => exportarGerente(vista('fin'), vista('pos'), modelo, nomeGerente, forns, equipes)}>
              <Download size={16} /> Exportar Excel
            </button>
            <button className="btn-primary" onClick={aplicarTodas} disabled={!fornsComMeta.length}>
              <Wand2 size={16} /> Aplicar sugestão em todas
            </button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {gerentes.map((g) => {
          const st = statusTab(g.id);
          if (g.id === SEM_GERENTE.id && !fornsDoGerente(g.id).length) return null;
          const ativo = g.id === gerente;
          return (
            <button
              key={g.id}
              onClick={() => {
                setGerente(g.id);
                navegar?.('gerentes', { g: g.id });
              }}
              className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 text-left transition ${
                ativo ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500' : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <Briefcase size={18} className={ativo ? 'text-brand-600' : 'text-slate-400'} />
              <div>
                <div className="text-sm font-semibold">{g.nome}</div>
                <div className="text-xs text-slate-500">{st.total ? `${st.ok}/${st.total} indústrias fechadas` : 'sem metas da diretoria'}</div>
              </div>
            </button>
          );
        })}
      </div>

      {pendentes.length > 0 && (
        <div className="mb-4 flex flex-wrap items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <b>{pendentes.length} indústria(s) com rateio que não fecha com a meta da diretoria.</b>
            {lacunas.length > 0 && (
              <>
                {' '}
                Equipes com histórico e sem meta:{' '}
                {[...new Set(lacunas.flatMap((x) => x.eqs))].join(', ')}. “Completar pendentes” distribui só a diferença para elas, sem mexer no que já foi digitado.
              </>
            )}
          </div>
          <button className="btn-secondary py-1.5" onClick={() => pendentes.forEach(completar)}>
            <PlusCircle size={14} /> Completar pendentes
          </button>
        </div>
      )}

      <div className="card mb-4 flex flex-wrap items-center gap-4 p-3">
        <BaseSelector base={base} onChange={setBase} meses={modelo.meses} />
        <div className="flex w-full items-center gap-1 text-xs text-slate-500">
          <Info size={14} /> Sugestão = meta da indústria × (média da equipe ÷ soma das médias das equipes). Só contam vendedores com ≥{' '}
          {Math.round(state.config.limiarVinculo * 100)}% do faturamento na carteira deste gerente.
        </div>
      </div>

      {!forns.length ? (
        <Empty icon={Briefcase} title="Nenhuma indústria nesta carteira">
          Atribua indústrias a este gerente na Etapa 1 (coluna “Gerente”).
        </Empty>
      ) : (
        <>
          <ResumoEquipes state={state} forns={forns} equipes={equipes} />
          <div className="space-y-4">
            {forns.map((f) => (
              <CardIndustria
                key={f}
                forn={f}
                equipes={equipes}
                base={base}
                mostrarMeses={mostrarMeses}
                aberto={!fechados[f]}
                alternar={() => setFechados((s) => ({ ...s, [f]: !s[f] }))}
                aplicar={() => aplicar(f)}
                completar={() => completar(f)}
              />
            ))}
          </div>
          <div className="mt-6 flex justify-end">
            <button className="btn-secondary" onClick={() => navegar?.('supervisores')}>
              Ir para Supervisores <ChevronRight size={16} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ResumoEquipes({ state, forns, equipes }) {
  const { met } = useStore();
  const tot = (eq, m) => somar(forns.map((f) => metaEquipe(state, eq, f, m)));
  const totMes = (m) => somar(forns.map((f) => metaDir(state, f, m)));
  return (
    <div className="card mb-4 overflow-x-auto">
      <div className="border-b border-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">Resumo da carteira por equipe — {met.label}</div>
      <table className="w-full">
        <thead>
          <tr>
            <th className="th">Equipe</th>
            {MESES_META.map((m) => (
              <th key={m} className="th num">
                {MESES_NOMES[m]}
              </th>
            ))}
            <th className="th num">{met.labelTotal}</th>
          </tr>
        </thead>
        <tbody>
          {equipes.map((eq) => (
            <tr key={eq}>
              <td className="td">
                <EquipeTag equipe={eq} />
              </td>
              {MESES_META.map((m) => (
                <td key={m} className="td num">
                  {met.fmt(tot(eq, m))}
                </td>
              ))}
              <td className="td num font-semibold">{met.fmt(somar(MESES_META.map((m) => tot(eq, m))))}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-50 text-sm">
            <td className="td font-semibold">Distribuído / Meta diretoria</td>
            {MESES_META.map((m) => {
              const s = somar(equipes.map((eq) => tot(eq, m)));
              return (
                <td key={m} className="td num">
                  <div className="font-semibold">{met.fmt(s)}</div>
                  <div className="text-xs text-slate-500">de {met.fmt(totMes(m))}</div>
                </td>
              );
            })}
            <td className="td num font-semibold">{met.fmt(somar(MESES_META.map(totMes)))}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function CardIndustria({ forn, equipes, base, mostrarMeses, aberto, alternar, aplicar, completar }) {
  const { state, dispatch, modelo, met } = useStore();
  const st = statusGerente(state, forn);
  const sug = useMemo(() => sugestaoIndustria(state, modelo, forn, equipes, base, met.decimais), [state.metasDir, modelo, forn, equipes, base, met]); // eslint-disable-line
  const temMeta = st.temMeta;
  const meses = modelo.meses;

  // Histórico da indústria inteira (mesmo número da Diretoria)
  const fInfo = modelo.fornecedores.get(Number(forn));
  const serieInd = fInfo?.[met.campo] || new Array(13).fill(0);
  const mediaInd = valorBase(serieInd, base, meses);
  const melhorInd = melhorMes(serieInd, meses);

  // Histórico por equipe
  const linhas = equipes.map((eq, i) => {
    const serie = serieEquipe(modelo, eq, forn);
    return { eq, serie, media: valorBase(serie, base, meses), melhor: melhorMes(serie, meses), peso: sug.somaPesos > 0 ? sug.pesos[i] / sug.somaPesos : 0, semHist: sug.pesos[i] <= 0 };
  });
  const serieSoma = new Array(13).fill(0);
  for (const l of linhas) for (const m of meses) serieSoma[m] += l.serie[m];
  const mediaSoma = linhas.reduce((a, l) => a + l.media, 0);
  const foraEquipes = mediaInd - mediaSoma; // vendedores sem vínculo com o gerente / inativos
  const aditiva = !['top3', 'melhor'].includes(base.mode);
  const serieFora = new Array(13).fill(0);
  for (const m of meses) serieFora[m] = serieInd[m] - serieSoma[m];
  const temFora = mostrarMeses ? meses.some((m) => Math.abs(serieFora[m]) >= 1) || (aditiva && Math.abs(foraEquipes) >= 1) : aditiva && Math.abs(foraEquipes) >= 1;
  const nCols = 4 + (mostrarMeses ? meses.length : 0);

  return (
    <div className="card">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <button onClick={alternar} className="text-slate-400 hover:text-slate-600">
          {aberto ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{nomeFornecedor(modelo, forn)}</div>
          <div className="text-xs text-slate-500">
            Cód. {forn} · Média base da indústria: <b>{met.fmt(mediaInd)}</b> · Melhor mês:{' '}
            <b>{melhorInd.mes ? `${MESES_NOMES[melhorInd.mes]} ${met.fmt(melhorInd.valor)}` : '—'}</b>
          </div>
          <div className="text-xs text-slate-500">Meta diretoria: {MESES_META.map((m) => `${MESES_NOMES[m]} ${met.fmt(metaDir(state, forn, m))}`).join(' · ')}</div>
        </div>
        <StatusPill ok={st.ok} temMeta={temMeta} label={temMeta ? undefined : 'Sem meta da diretoria'} fmt={met.fmt} />
        {aberto && temMeta && (
          <>
            <button className="btn-ghost py-1" onClick={() => dispatch({ type: 'METAS_GER_FORN', forn, valores: {} })} title="Zerar rateio desta indústria">
              <Eraser size={14} /> Zerar
            </button>
            {!st.ok && (
              <button className="btn-secondary py-1" onClick={completar} title="Distribui só a diferença, sem mexer no que já foi digitado">
                <PlusCircle size={14} /> Completar
              </button>
            )}
            <button className="btn-secondary py-1" onClick={aplicar} disabled={!sug.valores}>
              <Wand2 size={14} /> Aplicar sugestão
            </button>
          </>
        )}
      </div>

      {aberto && (
        <div className="overflow-x-auto border-t border-slate-100">
          {temMeta && !sug.valores && (
            <div className="bg-amber-50 px-4 py-2 text-xs text-amber-700">Nenhuma equipe tem histórico vinculado nesta indústria na base escolhida — distribua manualmente.</div>
          )}
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Equipe / Supervisor</th>
                <th className="th num">
                  <span className="inline-flex items-center gap-1">
                    <Trophy size={12} /> Melhor mês
                  </span>
                </th>
                <th className="th num">Média base</th>
                <th className="th num">Peso</th>
                {mostrarMeses && <MesesHeader meses={meses} />}
                {temMeta &&
                  MESES_META.map((m) => (
                    <th key={m} className="th num">
                      Meta {MESES_NOMES[m]}
                    </th>
                  ))}
                {temMeta && <th className="th num">{met.labelTotal}</th>}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.eq} className={l.semHist ? 'text-slate-400' : ''}>
                  <td className="td">
                    <div className="flex items-center gap-2">
                      <EquipeTag equipe={l.eq} />
                      <span className="text-xs text-slate-500">{modelo.equipes.get(l.eq)?.supervisor}</span>
                    </div>
                  </td>
                  <td className="td num">
                    {l.melhor.mes && l.melhor.valor > 0 ? (
                      <>
                        <span className="mr-1 rounded bg-amber-50 px-1 text-xs font-medium text-amber-700">{MESES_NOMES[l.melhor.mes]}</span>
                        {met.fmt(l.melhor.valor)}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="td num">{met.fmt(l.media)}</td>
                  <td className="td num">
                    <div className="flex items-center justify-end gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded bg-slate-100">
                        <div className="h-full bg-brand-500" style={{ width: `${Math.min(100, l.peso * 100)}%` }} />
                      </div>
                      <span className="w-12 text-xs">{fmtPct(l.peso)}</span>
                    </div>
                  </td>
                  {mostrarMeses && <MesesCells serie={l.serie} meses={meses} met={met} melhor={l.melhor.mes} />}
                  {temMeta &&
                    MESES_META.map((m) => {
                      const v = metaEquipe(state, l.eq, forn, m);
                      const s = sug.valores?.[l.eq]?.[m];
                      return (
                        <td key={m} className="td num">
                          <MoneyInput decimais={met.decimais} value={v} onChange={(val) => dispatch({ type: 'META_GER', forn, equipe: l.eq, mes: m, valor: val })} />
                          {s !== undefined && Math.abs(s - v) >= 0.01 && <div className="mt-0.5 text-[11px] text-slate-400">sug. {met.fmtIn(s)}</div>}
                        </td>
                      );
                    })}
                  {temMeta && <td className="td num font-semibold">{met.fmt(somar(MESES_META.map((m) => metaEquipe(state, l.eq, forn, m))))}</td>}
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 text-sm">
              <tr>
                <td className="td font-semibold">Soma das equipes</td>
                <td className="td num text-slate-400">—</td>
                <td className="td num font-semibold">{aditiva ? met.fmt(mediaSoma) : '—'}</td>
                <td className="td num text-xs">100%</td>
                {mostrarMeses && <MesesCells serie={serieSoma} meses={meses} met={met} className="font-semibold" />}
                {temMeta &&
                  MESES_META.map((m) => (
                    <td key={m} className="td num font-semibold">
                      {met.fmt(st.meses[m].soma)}
                    </td>
                  ))}
                {temMeta && <td className="td num font-semibold">{met.fmt(somar(MESES_META.map((m) => st.meses[m].soma)))}</td>}
              </tr>
              {temFora && (
                <tr className="text-xs text-slate-500">
                  <td className="td" colSpan={2}>
                    Vendedores fora do rateio (sem vínculo com este gerente, inativos ou códigos inativos)
                  </td>
                  <td className="td num">{aditiva ? met.fmt(foraEquipes) : '—'}</td>
                  <td className="td"></td>
                  {mostrarMeses && <MesesCells serie={serieFora} meses={meses} met={met} />}
                  {temMeta && <td className="td" colSpan={4}></td>}
                </tr>
              )}
              <tr>
                <td className="td font-semibold">Indústria (igual à Diretoria)</td>
                <td className="td num">
                  {melhorInd.mes ? (
                    <>
                      <span className="mr-1 rounded bg-amber-50 px-1 text-xs font-medium text-amber-700">{MESES_NOMES[melhorInd.mes]}</span>
                      {met.fmt(melhorInd.valor)}
                    </>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="td num font-semibold">{met.fmt(mediaInd)}</td>
                <td className="td"></td>
                {mostrarMeses && <MesesCells serie={serieInd} meses={meses} met={met} melhor={melhorInd.mes} />}
                {temMeta &&
                  MESES_META.map((m) => (
                    <td key={m} className="td num text-slate-500">
                      {met.fmt(st.meses[m].meta)}
                    </td>
                  ))}
                {temMeta && <td className="td num text-slate-500">{met.fmt(totalDir(state, forn))}</td>}
              </tr>
              {temMeta && (
                <tr>
                  <td className="td text-slate-500" colSpan={nCols}>
                    Diferença (soma das equipes − meta da diretoria)
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
              )}
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
