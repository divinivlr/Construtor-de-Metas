import { useMemo, useRef, useState } from 'react';
import { Database, Download, FileSpreadsheet, FolderOpen, RotateCcw, Save, Search, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { useStore, datasetDePlanilha, datasetFicticio } from '../store';
import { EQUIPE_OUTROS, MESES_NOMES } from '../lib/constants';
import { lerPlanilhaHistorico } from '../lib/importExcel';
import { fmtBRL, fmtCompacto } from '../lib/format';
import { EquipeTag, Kpi, PageHeader } from '../components/ui';
import { baixarModelo } from '../lib/exportExcel';

export default function Dados() {
  const { raw, state, dispatch, modelo, avisoStorage } = useStore();
  const [msg, setMsg] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [busca, setBusca] = useState('');
  const fileRef = useRef();
  const backupRef = useRef();
  const ds = state.dataset;

  const spvs = useMemo(() => {
    const s = new Set();
    for (const v of modelo.vendedores.values()) s.add(v.spv);
    return [...s].sort();
  }, [modelo]);

  const carregarArquivo = async (file) => {
    if (!file) return;
    setCarregando(true);
    setMsg(null);
    try {
      const { rows, aba, ignoradas } = await lerPlanilhaHistorico(file);
      dispatch({ type: 'DATASET', dataset: datasetDePlanilha(rows, file.name) });
      setMsg({
        tipo: 'ok',
        texto: `${rows.length.toLocaleString('pt-BR')} linhas carregadas da aba “${aba}”.${ignoradas.length ? ` ${ignoradas.length} linha(s) ignoradas por falta de código ou mês.` : ''}`,
      });
    } catch (e) {
      setMsg({ tipo: 'erro', texto: e.message || String(e) });
    } finally {
      setCarregando(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const exportarBackup = () => {
    const blob = new Blob([JSON.stringify(raw)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `metas-trimestrais-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importarBackup = async (file) => {
    if (!file) return;
    try {
      const s = JSON.parse(await file.text());
      if (!s || typeof s !== 'object' || !('metasDir' in s || 'metas' in s)) throw new Error('Arquivo não é um backup deste sistema.');
      dispatch({ type: 'IMPORTAR', state: s });
      setMsg({ tipo: 'ok', texto: 'Backup restaurado.' });
    } catch (e) {
      setMsg({ tipo: 'erro', texto: e.message });
    } finally {
      backupRef.current.value = '';
    }
  };

  const inativos = new Set(state.config.vendInativos.map(Number));
  const vendedores = [...modelo.vendedores.values()]
    .filter((v) => !busca || `${v.cod} ${v.nome} ${v.spv}`.toLowerCase().includes(busca.toLowerCase()))
    .sort((a, b) => a.equipe.localeCompare(b.equipe) || a.nome.localeCompare(b.nome));

  return (
    <div>
      <PageHeader
        step="Base & Configurações"
        title="Histórico, carteiras e backup"
        subtitle="Carregue a planilha de histórico (Jan–Set), ajuste os parâmetros do rateio e salve/restaure o trabalho. Os dados ficam só neste navegador — nada é enviado para servidor."
      />

      {avisoStorage && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{avisoStorage}</div>}
      {msg && (
        <div
          className={`mb-4 rounded-xl border p-3 text-sm ${
            msg.tipo === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {msg.texto}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <div className="mb-3 flex items-center gap-2 font-semibold">
            <Database size={18} className="text-brand-600" /> Base histórica em uso
          </div>
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
            {ds.fonte === 'planilha' ? (
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                Planilha: {ds.arquivo} · {new Date(ds.carregadoEm).toLocaleString('pt-BR')}
              </span>
            ) : (
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                Dados fictícios de demonstração
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label="Linhas" value={modelo.linhas.toLocaleString('pt-BR')} />
            <Kpi label="Período" value={`${MESES_NOMES[modelo.meses[0]] || '—'}–${MESES_NOMES[modelo.meses.at(-1)] || '—'} ${modelo.ano || ''}`} />
            <Kpi label="Vendedores" value={modelo.vendedores.size} sub={`${modelo.listaEquipes.length} equipes`} />
            <Kpi label="Indústrias" value={modelo.fornecedores.size} sub={fmtCompacto(modelo.listaFornecedores.reduce((a, f) => a + f.total, 0))} />
          </div>

          <div
            className="mt-5 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              carregarArquivo(e.dataTransfer.files?.[0]);
            }}
          >
            <Upload className="text-slate-400" />
            <div className="text-sm font-medium">Arraste a “Base Histórico.xlsx” aqui</div>
            <div className="text-xs text-slate-500">
              Colunas: Cod Vendedor · Nome Vendedor · Varejo Spv · Nome Supervisor · Cod Fornecedor · Nome Fornecedor · Mês · Ano · R$ Faturamento · Positivação
            </div>
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              <button className="btn-primary" disabled={carregando} onClick={() => fileRef.current.click()}>
                <FileSpreadsheet size={16} /> {carregando ? 'Lendo…' : 'Selecionar planilha'}
              </button>
              <button className="btn-secondary" onClick={() => baixarModelo()}>
                <Download size={16} /> Baixar modelo
              </button>
              {ds.fonte === 'planilha' && (
                <button className="btn-ghost" onClick={() => dispatch({ type: 'DATASET', dataset: datasetFicticio() })}>
                  <RotateCcw size={16} /> Voltar aos dados fictícios
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={(e) => carregarArquivo(e.target.files?.[0])} />
          </div>
        </div>

        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2 font-semibold">
            <ShieldCheck size={18} className="text-brand-600" /> Backup do trabalho
          </div>
          <p className="mb-4 text-sm text-slate-500">
            Tudo é salvo automaticamente neste navegador. Para passar o trabalho para outra pessoa (ex.: diretoria → gerente → supervisor), exporte o
            backup e ela importa no computador dela.
          </p>
          <div className="flex flex-col gap-2">
            <button className="btn-secondary justify-center" onClick={exportarBackup}>
              <Save size={16} /> Exportar backup (.json)
            </button>
            <button className="btn-secondary justify-center" onClick={() => backupRef.current.click()}>
              <FolderOpen size={16} /> Importar backup
            </button>
            <input ref={backupRef} type="file" accept=".json" className="hidden" onChange={(e) => importarBackup(e.target.files?.[0])} />
            <hr className="my-2" />
            <button
              className="btn-ghost justify-center text-rose-600 hover:bg-rose-50"
              onClick={() => window.confirm('Apagar TODAS as metas (Financeiro e Positivação, de diretoria, gerentes e supervisores)?') && dispatch({ type: 'RESET_METAS' })}
            >
              <Trash2 size={16} /> Apagar todas as metas
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="card p-5">
          <div className="mb-3 font-semibold">Gerentes</div>
          <div className="space-y-2">
            {state.config.gerentes.map((g, i) => (
              <div key={g.id} className="flex items-center gap-2">
                <span className="w-10 text-xs font-semibold text-slate-500">{g.id}</span>
                <input
                  className="select flex-1"
                  value={g.nome}
                  onChange={(e) => {
                    const gerentes = state.config.gerentes.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x));
                    dispatch({ type: 'CONFIG', patch: { gerentes } });
                  }}
                />
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">A carteira (indústria → gerente) é definida na Etapa 1, coluna “Gerente”.</p>
        </div>

        <div className="card p-5">
          <div className="mb-3 font-semibold">Vínculo vendedor × gerente</div>
          <label className="text-sm text-slate-600">Participação mínima na carteira do gerente</label>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={50}
              step={1}
              value={Math.round(state.config.limiarVinculo * 100)}
              onChange={(e) => dispatch({ type: 'CONFIG', patch: { limiarVinculo: Number(e.target.value) / 100 } })}
              className="flex-1"
            />
            <span className="w-10 text-right text-sm font-semibold">{Math.round(state.config.limiarVinculo * 100)}%</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Ex.: com 10%, um vendedor do Varejo 1 que tem 70% do faturamento em indústrias do V2 aparece no rateio do V2. Quem vende só por acaso
            (abaixo do limite) não recebe meta daquela carteira.
          </p>
        </div>

        <div className="card p-5">
          <div className="mb-3 font-semibold">Equipes agrupadas em “{EQUIPE_OUTROS}”</div>
          <div className="flex flex-wrap gap-2">
            {spvs.map((s) => {
              const on = state.config.outrosSpvs.map((x) => x.toUpperCase()).includes(s.toUpperCase());
              return (
                <button
                  key={s}
                  onClick={() =>
                    dispatch({
                      type: 'CONFIG',
                      patch: { outrosSpvs: on ? state.config.outrosSpvs.filter((x) => x.toUpperCase() !== s.toUpperCase()) : [...state.config.outrosSpvs, s] },
                    })
                  }
                  className={`rounded-md px-2 py-1 text-xs font-medium ring-1 ${on ? 'bg-slate-800 text-white ring-slate-800' : 'bg-white text-slate-600 ring-slate-300'}`}
                >
                  {s}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-slate-500">Selecionadas = somadas na equipe “Outros”. As demais viram equipes próprias.</p>
        </div>
      </div>

      <div className="card mt-4">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3">
          <div className="font-semibold">Vendedores ({modelo.vendedores.size})</div>
          <span className="text-xs text-slate-500">Desmarque quem não deve receber meta (vagos, códigos de supervisor, inativos).</span>
          <div className="relative ml-auto">
            <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
            <input className="select pl-8" placeholder="Buscar…" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
        </div>
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full">
            <thead className="sticky top-0">
              <tr>
                <th className="th">Ativo</th>
                <th className="th">Vendedor</th>
                <th className="th">Equipe</th>
                <th className="th">Supervisor</th>
                <th className="th">Carteiras (% do faturamento)</th>
                <th className="th num">Faturamento Jan–Set</th>
              </tr>
            </thead>
            <tbody>
              {vendedores.map((v) => (
                <tr key={v.cod} className={inativos.has(v.cod) ? 'opacity-50' : ''}>
                  <td className="td">
                    <input
                      type="checkbox"
                      checked={!inativos.has(v.cod)}
                      onChange={(e) => {
                        const set = new Set(inativos);
                        e.target.checked ? set.delete(v.cod) : set.add(v.cod);
                        dispatch({ type: 'CONFIG', patch: { vendInativos: [...set] } });
                      }}
                    />
                  </td>
                  <td className="td">
                    <span className="font-medium">{v.nome}</span> <span className="text-xs text-slate-400">({v.cod})</span>
                  </td>
                  <td className="td">
                    <EquipeTag equipe={v.equipe} />
                    {v.equipe !== v.spv && <span className="ml-1 text-xs text-slate-400">{v.spv}</span>}
                  </td>
                  <td className="td text-slate-600">{v.supervisor || '—'}</td>
                  <td className="td text-xs">
                    {Object.entries(v.participacaoGerente)
                      .sort((a, b) => b[1] - a[1])
                      .filter(([, p]) => p >= 0.01)
                      .map(([g, p]) => (
                        <span
                          key={g}
                          className={`mr-1 rounded px-1.5 py-0.5 ${p >= state.config.limiarVinculo ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-400'}`}
                        >
                          {g} {Math.round(p * 100)}%
                        </span>
                      ))}
                  </td>
                  <td className="td num">{fmtBRL(v.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
