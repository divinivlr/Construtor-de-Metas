import { useMemo, useState } from 'react';
import { AlertTriangle, Building2, Download, Eraser, Target, TrendingUp, Users, Wand2 } from 'lucide-react';
import { useStore } from '../store';
import { BASE_PADRAO, MESES_META, MESES_NOMES, SEM_GERENTE } from '../lib/constants';
import { melhorMes, serieTotalEquipe, valorBase } from '../lib/history';
import { metaDir, metaEquipe, totalDir } from '../lib/metas';
import { somar } from '../lib/allocate';
import { fmtPct } from '../lib/format';
import { BaseSelector, EquipeTag, Kpi, MetricaBanner, MoneyInput, PageHeader } from '../components/ui';
import { exportarDiretoria } from '../lib/exportExcel';

export default function Diretoria({ navegar }) {
  const { state, dispatch, modelo, met, vista } = useStore();
  const [base, setBase] = useState(BASE_PADRAO);
  const [crescimento, setCrescimento] = useState(10);
  const [filtro, setFiltro] = useState('todos');
  const [ocultarSemHist, setOcultarSemHist] = useState(true);
  const gerentes = [...state.config.gerentes, SEM_GERENTE];
  const campo = met.campo;

  const linhas = useMemo(() => {
    const lista = modelo.listaFornecedores.map((f) => ({
      cod: f.cod,
      nome: f.nome,
      total: f.total,
      media: valorBase(f[campo], base, modelo.meses),
      melhor: melhorMes(f[campo], modelo.meses),
    }));
    // indústrias com meta mas fora da base atual
    for (const cod of Object.keys(state.metasDir).map(Number))
      if (!modelo.fornecedores.has(cod)) lista.push({ cod, nome: `Indústria ${cod}`, total: 0, media: 0, melhor: { mes: null, valor: 0 } });
    return lista.map((l) => ({ ...l, gerente: modelo.gerenteDe(l.cod) }));
  }, [modelo, base, state.metasDir, campo]);

  const visiveis = linhas.filter(
    (l) => (filtro === 'todos' || l.gerente === filtro) && (!ocultarSemHist || l.total > 1000 || totalDir(state, l.cod) > 0)
  );

  const totMes = (m, lst = visiveis) => somar(lst.map((l) => metaDir(state, l.cod, m)));
  const totTri = (lst = visiveis) => somar(MESES_META.map((m) => totMes(m, lst)));
  const refTri = (lst = visiveis) => lst.reduce((a, l) => a + l.media * 3, 0);
  const semGerente = linhas.filter((l) => l.gerente === SEM_GERENTE.id && l.total > 1000);

  const sugerir = (lst) => {
    const temValores = lst.some((l) => totalDir(state, l.cod) > 0);
    if (temValores && !window.confirm(`Substituir as metas de ${met.label} já digitadas pela sugestão (média × crescimento)?`)) return;
    const metas = {};
    for (const l of lst) {
      const v = met.arredSugestao(l.media * (1 + crescimento / 100));
      metas[l.cod] = { 10: v, 11: v, 12: v };
    }
    dispatch({ type: 'METAS_DIR', metas });
  };

  const limpar = () => {
    if (!window.confirm(`Apagar as metas de ${met.label} das indústrias exibidas?`)) return;
    const metas = {};
    for (const l of visiveis) metas[l.cod] = {};
    dispatch({ type: 'METAS_DIR', metas });
  };

  const outra = met.id === 'fin' ? 'pos' : 'fin';
  const outraVista = vista(outra);
  const outraTemMeta = Object.keys(outraVista.metasDir).some((f) => totalDir(outraVista, f) > 0);

  return (
    <div>
      <PageHeader
        step="Etapa 1 · Diretoria"
        title="Meta por indústria"
        subtitle="Defina a meta de Outubro, Novembro e Dezembro de cada indústria e confirme qual gerente é dono de cada carteira. Use o seletor do topo para alternar entre a meta Financeira (R$) e a de Positivação (clientes)."
        actions={
          <>
            <MetricaBanner met={met} />
            <button className="btn-secondary" onClick={() => exportarDiretoria(vista('fin'), vista('pos'), modelo, linhas)}>
              <Download size={16} /> Exportar Excel
            </button>
          </>
        }
      />

      {!outraTemMeta && totTri(linhas) > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-teal-200 bg-teal-50 p-3 text-sm text-teal-800">
          <Target size={18} className="shrink-0" />
          A meta de <b>{outra === 'pos' ? 'Positivação' : 'Financeiro'}</b> ainda não foi definida. Troque no seletor do topo para preenchê-la.
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi icon={Target} tone="brand" label="Meta do trimestre" value={met.fmtC(totTri(linhas))} sub={met.fmt(totTri(linhas))} />
        {MESES_META.map((m) => (
          <Kpi key={m} label={`Meta ${MESES_NOMES[m]}`} value={met.fmtC(totMes(m, linhas))} />
        ))}
        <Kpi
          icon={TrendingUp}
          tone={totTri(linhas) >= refTri(linhas) ? 'green' : 'amber'}
          label="vs. histórico × 3"
          value={refTri(linhas) ? fmtPct(totTri(linhas) / refTri(linhas) - 1) : '—'}
          sub={`Ref.: ${met.fmtC(refTri(linhas))}`}
        />
      </div>

      {semGerente.length > 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <div>
            <b>{semGerente.length} indústria(s) com histórico ainda sem gerente:</b>{' '}
            {semGerente.map((l) => `${l.cod} ${l.nome}`).join(' · ')}. Escolha o gerente na coluna “Gerente” — vale para as duas métricas.
          </div>
        </div>
      )}

      <div className="card mb-4 flex flex-wrap items-center gap-x-6 gap-y-3 p-3">
        <BaseSelector base={base} onChange={setBase} meses={modelo.meses} />
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-500">Crescimento</label>
          <input type="number" className="select w-20 py-1.5 text-right" value={crescimento} onChange={(e) => setCrescimento(Number(e.target.value) || 0)} />
          <span className="text-sm text-slate-500">%</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-500">Gerente</label>
          <select className="select py-1.5" value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            <option value="todos">Todos</option>
            {gerentes.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nome}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={ocultarSemHist} onChange={(e) => setOcultarSemHist(e.target.checked)} />
          Ocultar indústrias sem histórico relevante
        </label>
        <div className="ml-auto flex gap-2">
          <button className="btn-ghost" onClick={limpar}>
            <Eraser size={16} /> Limpar
          </button>
          <button className="btn-primary" onClick={() => sugerir(visiveis)}>
            <Wand2 size={16} /> Sugerir metas (média + {crescimento}%)
          </button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Indústria</th>
              <th className="th">Gerente</th>
              <th className="th num">Média base</th>
              <th className="th num">Melhor mês</th>
              {MESES_META.map((m) => (
                <th key={m} className="th num">
                  {MESES_NOMES[m]}
                </th>
              ))}
              <th className="th num">{met.labelTotal}</th>
              <th className="th num">vs. base×3</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((l) => {
              const tot = totalDir(state, l.cod);
              const varr = l.media > 0 && tot > 0 ? tot / (l.media * 3) - 1 : null;
              return (
                <tr key={l.cod} className="hover:bg-slate-50/60">
                  <td className="td">
                    <div className="flex items-center gap-2">
                      <Building2 size={14} className="text-slate-400" />
                      <div>
                        <div className="max-w-[18rem] truncate font-medium" title={l.nome}>
                          {l.nome}
                        </div>
                        <div className="text-xs text-slate-400">Cód. {l.cod}</div>
                      </div>
                    </div>
                  </td>
                  <td className="td">
                    <select
                      className={`select py-1 text-xs ${l.gerente === SEM_GERENTE.id ? 'border-amber-300 bg-amber-50' : ''}`}
                      value={l.gerente}
                      onChange={(e) => dispatch({ type: 'GERENTE_FORN', forn: l.cod, gerente: e.target.value })}
                    >
                      {gerentes.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.nome}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="td num text-slate-600">{met.fmt(l.media)}</td>
                  <td className="td num text-slate-600">
                    {l.melhor.mes ? (
                      <>
                        <span className="mr-1 rounded bg-slate-100 px-1 text-xs">{MESES_NOMES[l.melhor.mes]}</span>
                        {met.fmt(l.melhor.valor)}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  {MESES_META.map((m) => (
                    <td key={m} className="td num">
                      <MoneyInput
                        className="w-32"
                        decimais={met.decimais}
                        value={metaDir(state, l.cod, m)}
                        onChange={(v) => dispatch({ type: 'META_DIR', forn: l.cod, mes: m, valor: v })}
                      />
                    </td>
                  ))}
                  <td className="td num font-semibold">{met.fmt(tot)}</td>
                  <td className={`td num text-xs font-medium ${varr === null ? 'text-slate-400' : varr >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {varr === null ? '—' : fmtPct(varr)}
                  </td>
                  <td className="td">
                    <button
                      className="btn-ghost px-2 py-1"
                      title="Sugerir só esta indústria"
                      onClick={() => {
                        const v = met.arredSugestao(l.media * (1 + crescimento / 100));
                        dispatch({ type: 'METAS_DIR', metas: { [l.cod]: { 10: v, 11: v, 12: v } } });
                      }}
                    >
                      <Wand2 size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 font-semibold">
              <td className="td" colSpan={4}>
                Total ({visiveis.length} indústrias)
              </td>
              {MESES_META.map((m) => (
                <td key={m} className="td num">
                  {met.fmt(totMes(m))}
                </td>
              ))}
              <td className="td num">{met.fmt(totTri())}</td>
              <td className="td num text-xs">{refTri() ? fmtPct(totTri() / refTri() - 1) : '—'}</td>
              <td className="td"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        {gerentes.map((g) => {
          const lst = linhas.filter((l) => l.gerente === g.id);
          if (!lst.length) return null;
          return (
            <div key={g.id} className="card p-4">
              <div className="text-sm font-semibold text-slate-700">{g.nome}</div>
              <div className="text-xs text-slate-400">{lst.length} indústria(s)</div>
              <div className="mt-2 text-lg font-semibold tabular-nums">{met.fmt(totTri(lst))}</div>
              <div className="text-xs text-slate-500">{MESES_META.map((m) => `${MESES_NOMES[m]} ${met.fmtC(totMes(m, lst))}`).join(' · ')}</div>
            </div>
          );
        })}
      </div>

      <ConsolidadoEquipes linhas={linhas} base={base} navegar={navegar} />
    </div>
  );
}

/**
 * Visão consolidada para a diretoria: quanto da meta total foi para cada equipe
 * (somando todas as indústrias e todos os gerentes) + o que ainda não foi distribuído.
 * A soma das linhas é sempre igual à meta total da diretoria.
 */
function ConsolidadoEquipes({ linhas, base, navegar }) {
  const { state, modelo, met } = useStore();
  const forns = linhas.map((l) => l.cod);
  const totalMesDir = (m) => somar(forns.map((f) => metaDir(state, f, m)));

  const equipes = modelo.listaEquipes.filter((eq) => {
    const hist = valorBase(serieTotalEquipe(modelo, eq), base, modelo.meses);
    const temMeta = forns.some((f) => MESES_META.some((m) => metaEquipe(state, eq, f, m)));
    return Math.abs(hist) >= 1 || temMeta;
  });
  const histEq = Object.fromEntries(equipes.map((eq) => [eq, Math.max(0, valorBase(serieTotalEquipe(modelo, eq), base, modelo.meses))]));
  const histTotal = Object.values(histEq).reduce((a, b) => a + b, 0);
  const metaEq = (eq, m) => somar(forns.map((f) => metaEquipe(state, eq, f, m)));
  const distribuido = (m) => somar(equipes.map((eq) => metaEq(eq, m)));
  const naoDist = (m) => Math.round((totalMesDir(m) - distribuido(m)) * 100) / 100;
  const temPendencia = MESES_META.some((m) => Math.abs(naoDist(m)) >= 0.005);

  return (
    <div className="card mt-5 overflow-x-auto">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
        <Users size={16} className="text-brand-600" />
        <div className="font-semibold">Consolidado por equipe — {met.label}</div>
        <span className="text-xs text-slate-500">
          Soma de todas as indústrias e gerentes. Uma equipe que vende para dois gerentes (ex.: Atacado com V1 e V2) aparece com o total somado.
        </span>
      </div>
      <table className="w-full">
        <thead>
          <tr>
            <th className="th">Equipe</th>
            <th className="th">Supervisor</th>
            <th className="th num">Média base (todas ind.)</th>
            <th className="th num">% histórico</th>
            {MESES_META.map((m) => (
              <th key={m} className="th num">
                Meta {MESES_NOMES[m]}
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
              <td className="td text-xs text-slate-500">{modelo.equipes.get(eq)?.supervisor}</td>
              <td className="td num text-slate-600">{met.fmt(histEq[eq])}</td>
              <td className="td num text-xs text-slate-500">{histTotal ? fmtPct(histEq[eq] / histTotal) : '—'}</td>
              {MESES_META.map((m) => (
                <td key={m} className="td num">
                  {met.fmt(metaEq(eq, m))}
                </td>
              ))}
              <td className="td num font-semibold">{met.fmt(somar(MESES_META.map((m) => metaEq(eq, m))))}</td>
            </tr>
          ))}
          <tr className={temPendencia ? 'bg-amber-50/60' : ''}>
            <td className="td font-medium text-amber-700" colSpan={4}>
              Ainda não distribuído pelos gerentes
              {temPendencia && (
                <button className="ml-2 text-xs font-semibold text-brand-600 underline" onClick={() => navegar?.('gerentes')}>
                  ir para Gerentes
                </button>
              )}
            </td>
            {MESES_META.map((m) => (
              <td key={m} className={`td num ${Math.abs(naoDist(m)) >= 0.005 ? 'font-semibold text-amber-700' : 'text-slate-400'}`}>
                {met.fmt(naoDist(m))}
              </td>
            ))}
            <td className="td num font-semibold text-amber-700">{met.fmt(somar(MESES_META.map(naoDist)))}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr className="bg-slate-50 font-semibold">
            <td className="td" colSpan={2}>
              Total = meta da diretoria
            </td>
            <td className="td num">{met.fmt(histTotal)}</td>
            <td className="td num text-xs">100%</td>
            {MESES_META.map((m) => (
              <td key={m} className="td num">
                {met.fmt(totalMesDir(m))}
              </td>
            ))}
            <td className="td num">{met.fmt(somar(MESES_META.map(totalMesDir)))}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
