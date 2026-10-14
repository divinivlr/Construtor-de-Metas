import { useEffect, useState } from 'react';
import { Briefcase, Building2, ChevronRight, Database, Target, Users } from 'lucide-react';
import { useStore } from './store';
import Diretoria from './pages/Diretoria';
import Gerente from './pages/Gerente';
import Supervisor from './pages/Supervisor';
import Dados from './pages/Dados';
import { statusGerente, statusSupervisor, industriasDaEquipe, totalDir } from './lib/metas';

const ETAPAS = [
  { id: 'diretoria', label: 'Diretoria', desc: 'Meta por indústria', icon: Building2 },
  { id: 'gerentes', label: 'Gerentes', desc: 'Rateio por equipe', icon: Briefcase },
  { id: 'supervisores', label: 'Supervisores', desc: 'Rateio por vendedor', icon: Users },
];

function lerHash() {
  const h = window.location.hash.replace(/^#\/?/, '');
  const [rota, query] = h.split('?');
  const params = Object.fromEntries(new URLSearchParams(query || ''));
  return { rota: rota || 'diretoria', params };
}

export default function App() {
  const { state, modelo } = useStore();
  const [{ rota, params }, setLoc] = useState(lerHash);

  useEffect(() => {
    const on = () => setLoc(lerHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  const navegar = (r, p) => {
    const q = p ? `?${new URLSearchParams(p).toString()}` : '';
    window.location.hash = `/${r}${q}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // progresso de cada etapa
  const fornsComMeta = Object.keys(state.metasDir).filter((f) => totalDir(state, f) > 0);
  const progDir = fornsComMeta.length;
  const progGer = fornsComMeta.filter((f) => statusGerente(state, f).ok).length;
  let supTotal = 0;
  let supOk = 0;
  for (const eq of modelo.listaEquipes)
    for (const f of industriasDaEquipe(state, modelo, eq)) {
      supTotal++;
      if (statusSupervisor(state, eq, f).ok) supOk++;
    }
  const progresso = {
    diretoria: progDir ? `${progDir} indústrias` : 'pendente',
    gerentes: progDir ? `${progGer}/${progDir} fechadas` : 'aguardando',
    supervisores: supTotal ? `${supOk}/${supTotal} fechadas` : 'aguardando',
  };

  const Pagina = { diretoria: Diretoria, gerentes: Gerente, supervisores: Supervisor, dados: Dados }[rota] || Diretoria;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-4 px-4 py-3 md:px-6">
          <button onClick={() => navegar('diretoria')} className="flex items-center gap-2">
            <div className="rounded-lg bg-brand-600 p-1.5 text-white">
              <Target size={18} />
            </div>
            <div className="text-left leading-tight">
              <div className="text-sm font-bold">Construtor de Metas</div>
              <div className="text-[11px] text-slate-500">4º trimestre · Out · Nov · Dez</div>
            </div>
          </button>

          <nav className="order-3 flex w-full items-center gap-1 overflow-x-auto md:order-none md:w-auto md:flex-1 md:justify-center">
            {ETAPAS.map((e, i) => {
              const ativo = rota === e.id;
              const Icon = e.icon;
              return (
                <div key={e.id} className="flex items-center">
                  {i > 0 && <ChevronRight size={16} className="mx-1 shrink-0 text-slate-300" />}
                  <button
                    onClick={() => navegar(e.id)}
                    className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-left transition ${
                      ativo ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                        ativo ? 'bg-white/20' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span>
                      <span className="flex items-center gap-1 text-sm font-semibold">
                        <Icon size={14} /> {e.label}
                      </span>
                      <span className={`block text-[11px] ${ativo ? 'text-white/80' : 'text-slate-400'}`}>{progresso[e.id]}</span>
                    </span>
                  </button>
                </div>
              );
            })}
          </nav>

          <button
            onClick={() => navegar('dados')}
            className={`ml-auto flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium md:ml-0 ${
              rota === 'dados' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Database size={16} /> Base & Config
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                state.dataset.fonte === 'planilha' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
              }`}
            >
              {state.dataset.fonte === 'planilha' ? 'REAL' : 'DEMO'}
            </span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-6 md:px-6">
        <Pagina params={params} navegar={navegar} />
      </main>

      <footer className="mx-auto max-w-[1400px] px-6 pb-8 text-xs text-slate-400">
        Dados salvos apenas neste navegador · use “Base & Config → Exportar backup” para compartilhar o trabalho.
      </footer>
    </div>
  );
}
