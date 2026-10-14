import { useMemo, useState } from 'react';
import { AlertTriangle, Building2, Download, Eraser, Target, TrendingUp, Wand2 } from 'lucide-react';
import { useStore } from '../store';
import { BASE_PADRAO, MESES_META, MESES_NOMES, SEM_GERENTE } from '../lib/constants';
import { melhorMes, valorBase } from '../lib/history';
import { metaDir, totalDir } from '../lib/metas';
import { somar } from '../lib/allocate';
import { fmtBRL, fmtCompacto, fmtPct } from '../lib/format';
import { BaseSelector, Kpi, MoneyInput, PageHeader } from '../components/ui';
import { exportarDiretoria } from '../lib/exportExcel';

const arred100 = (v) => Math.max(0, Math.round(v / 100) * 100);

export default function Diretoria() {
  const { state, dispatch, modelo } = useStore();
  const [base, setBase] = useState(BASE_PADRAO);
  const [crescimento, setCrescimento] = useState(10);
  const [filtro, setFiltro] = useState('todos');
  const [ocultarSemHist, setOcultarSemHist] = useState(true);
  const gerentes = [...state.config.gerentes, SEM_GERENTE];

  const linhas = useMemo(() => {
    const lista = modelo.listaFornecedores.map((f) => ({
      cod: f.cod,
      nome: f.nome,
      total: f.total,
      media: valorBase(f.fat, base, modelo.meses),
      melhor: melhorMes(f.fat, modelo.meses),
    }));
    // indústrias com meta mas fora da base atual
    for (const cod of Object.keys(state.metasDir).map(Number))
      if (!modelo.fornecedores.has(cod)) lista.push({ cod, nome: `Indústria ${cod}`, total: 0, media: 0, melhor: { mes: null, valor: 0 } });
    return lista.map((l) => ({ ...l, gerente: modelo.gerenteDe(l.cod) }));
  }, [modelo, base, state.metasDir]);

  const visiveis = linhas.filter(
    (l) => (filtro === 'todos' || l.gerente === filtro) && (!ocultarSemHist || l.total > 1000 || totalDir(state, l.cod) > 0)
  );

  const totMes = (m, lst = visiveis) => somar(lst.map((l) => metaDir(state, l.cod, m)));
  const totTri = (lst = visiveis) => somar(MESES_META.map((m) => totMes(m, lst)));
  const refTri = (lst = visiveis) => lst.reduce((a, l) => a + l.media * 3, 0);
  const semGerente = linhas.filter((l) => l.gerente === SEM_GERENTE.id && l.total > 1000);

  const sugerir = (lst) => {
    const temValores = lst.some((l) => totalDir(state, l.cod) > 0);
    if (temValores && !window.confirm('Substituir as metas já digitadas pela sugestão (média × crescimento)?')) return;
    const metas = {};
    for (const l of lst) {
      const v = arred100(l.media * (1 + crescimento / 100));
      metas[l.cod] = { 10: v, 11: v, 12: v };
    }
    dispatch({ type: 'METAS_DIR', metas });
  };

  const limpar = () => {
    if (!window.confirm('Apagar as metas das indústrias exibidas?')) return;
    const metas = {};
    for (const l of visiveis) metas[l.cod] = {};
    dispatch({ type: 'METAS_DIR', metas });
  };

  return (
    <div>
      <PageHeader
        step="Etapa 1 · Diretoria"
        title="Meta por indústria"
        subtitle="Defina a meta de Outubro, Novembro e Dezembro de cada indústria e confirme qual gerente é dono de cada carteira. A carteira decide para qual gerente a meta (e o vendedor que a vende) vai."
        actions={
          <button className="btn-secondary" onClick={() => exportarDiretoria(state, modelo, linhas)}>
            <Download size={16} /> Exportar Excel
          </button>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi icon={Target} tone="brand" label="Meta do trimestre" value={fmtCompacto(totTri(linhas))} sub={fmtBRL(totTri(linhas))} />
        {MESES_META.map((m) => (
          <Kpi key={m} label={`Meta ${MESES_NOMES[m]}`} value={fmtCompacto(totMes(m, linhas))} />
        ))}
        <Kpi
          icon={TrendingUp}
          tone={totTri(linhas) >= refTri(linhas) ? 'green' : 'amber'}
          label="vs. histórico × 3"
          value={refTri(linhas) ? fmtPct(totTri(linhas) / refTri(linhas) - 1) : '—'}
          sub={`Ref.: ${fmtCompacto(refTri(linhas))}`}
        />
      </div>

      {semGerente.length > 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <div>
            <b>{semGerente.length} indústria(s) com histórico ainda sem gerente:</b>{' '}
            {semGerente.map((l) => `${l.cod} ${l.nome}`).join(' · ')}. Escolha o gerente na coluna “Gerente” — a escolha fica salva.
          </div>
        </div>
      )}

      <div className="card mb-4 flex flex-wrap items-center gap-x-6 gap-y-3 p-3">
        <BaseSelector base={base} onChange={setBase} meses={modelo.meses} />
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-500">Crescimento</label>
          <input
            type="number"
            className="select w-20 py-1.5 text-right"
            value={crescimento}
            onChange={(e) => setCrescimento(Number(e.target.value) || 0)}
          />
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
              <th className="th num">Total tri</th>
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
                  <td className="td num text-slate-600">{fmtBRL(l.media)}</td>
                  <td className="td num text-slate-600">
                    {l.melhor.mes ? (
                      <>
                        <span className="mr-1 rounded bg-slate-100 px-1 text-xs">{MESES_NOMES[l.melhor.mes]}</span>
                        {fmtCompacto(l.melhor.valor)}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  {MESES_META.map((m) => (
                    <td key={m} className="td num">
                      <MoneyInput
                        className="w-32"
                        value={metaDir(state, l.cod, m)}
                        onChange={(v) => dispatch({ type: 'META_DIR', forn: l.cod, mes: m, valor: v })}
                      />
                    </td>
                  ))}
                  <td className="td num font-semibold">{fmtBRL(tot)}</td>
                  <td className={`td num text-xs font-medium ${varr === null ? 'text-slate-400' : varr >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {varr === null ? '—' : fmtPct(varr)}
                  </td>
                  <td className="td">
                    <button
                      className="btn-ghost px-2 py-1"
                      title="Sugerir só esta indústria"
                      onClick={() => {
                        const v = arred100(l.media * (1 + crescimento / 100));
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
                  {fmtBRL(totMes(m))}
                </td>
              ))}
              <td className="td num">{fmtBRL(totTri())}</td>
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
              <div className="mt-2 text-lg font-semibold tabular-nums">{fmtBRL(totTri(lst))}</div>
              <div className="text-xs text-slate-500">
                {MESES_META.map((m) => `${MESES_NOMES[m]} ${fmtCompacto(totMes(m, lst))}`).join(' · ')}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
