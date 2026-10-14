import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, CircleDashed, DollarSign, UserCheck } from 'lucide-react';
import { BASES, CANAIS, MESES_NOMES, canalDaEquipe } from '../lib/constants';
import { fmtBRL, fmtNum0, fmtNum2 as fmtNum2Base, parseValor } from '../lib/format';
import { LISTA_METRICAS } from '../lib/metrica';

/** Campo numérico: R$ (1.234,56) ou inteiro (positivação), aceita digitação em pt-BR */
export function MoneyInput({ value, onChange, className = '', invalid = false, title, decimais = 2, ...rest }) {
  const [foco, setFoco] = useState(false);
  const [texto, setTexto] = useState('');
  const fmtNum2 = decimais === 0 ? fmtNum0 : fmtNum2Base;
  const fator = 10 ** decimais;
  useEffect(() => {
    if (!foco) setTexto(value ? fmtNum2(value) : '');
  }, [value, foco]);
  return (
    <input
      type="text"
      inputMode="decimal"
      title={title}
      className={`w-28 rounded-md border px-2 py-1 text-right text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-500 ${
        invalid ? 'border-rose-300 bg-rose-50' : 'border-slate-300 bg-white'
      } ${className}`}
      value={texto}
      placeholder={decimais === 0 ? '0' : '0,00'}
      onFocus={(e) => {
        setFoco(true);
        setTexto(value ? fmtNum2(value) : '');
        requestAnimationFrame(() => e.target.select());
      }}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={() => {
        setFoco(false);
        const n = Math.round(parseValor(texto) * fator) / fator;
        if (Math.round(n * fator) !== Math.round((value || 0) * fator)) onChange(n);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          setTexto(value ? fmtNum2(value) : '');
          requestAnimationFrame(() => e.currentTarget?.blur());
        }
      }}
      {...rest}
    />
  );
}

/** Seletor da base histórica (filtro de média) */
export function BaseSelector({ base, onChange, meses, compact = false }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="text-xs font-medium text-slate-500">Base histórica</label>
      <select className="select py-1.5" value={base.mode} onChange={(e) => onChange({ ...base, mode: e.target.value })}>
        {BASES.map((b) => (
          <option key={b.id} value={b.id}>
            {b.label}
          </option>
        ))}
      </select>
      {base.mode === 'custom' && (
        <div className="flex flex-wrap gap-1">
          {meses.map((m) => {
            const ativo = base.months?.includes(m);
            return (
              <button
                key={m}
                type="button"
                onClick={() =>
                  onChange({
                    ...base,
                    months: ativo ? base.months.filter((x) => x !== m) : [...(base.months || []), m].sort((a, b) => a - b),
                  })
                }
                className={`rounded-md px-2 py-1 text-xs font-medium ring-1 ${
                  ativo ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-slate-600 ring-slate-300 hover:bg-slate-50'
                }`}
              >
                {MESES_NOMES[m]}
              </button>
            );
          })}
        </div>
      )}
      {!compact && base.mode !== 'custom' && (
        <span className="text-xs text-slate-400">
          {base.mode === 'ult3' && `(${meses.slice(-3).map((m) => MESES_NOMES[m]).join(', ')})`}
          {base.mode === 'ult6' && `(${MESES_NOMES[meses.slice(-6)[0]]}–${MESES_NOMES[meses.at(-1)]})`}
          {base.mode === 'todos' && `(${MESES_NOMES[meses[0]]}–${MESES_NOMES[meses.at(-1)]})`}
          {base.mode === 'top3' && '(calculado individualmente)'}
          {base.mode === 'melhor' && '(calculado individualmente)'}
        </span>
      )}
    </div>
  );
}

export function StatusPill({ ok, temMeta = true, diff, label, fmt = fmtBRL }) {
  if (!temMeta)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
        <CircleDashed size={12} /> {label || 'Sem meta'}
      </span>
    );
  if (ok)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
        <CheckCircle2 size={12} /> {label || 'Fechado'}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
      <AlertTriangle size={12} /> {label || (diff !== undefined ? `Dif. ${fmt(diff)}` : 'Pendente')}
    </span>
  );
}

/** Célula de diferença no rodapé das tabelas */
export function DiffCell({ diff, decimais = 2 }) {
  const ok = Math.abs(diff) < 0.005;
  const f = decimais === 0 ? fmtNum0 : fmtNum2Base;
  return (
    <span className={`font-semibold tabular-nums ${ok ? 'text-emerald-600' : diff > 0 ? 'text-rose-600' : 'text-amber-600'}`}>
      {ok ? (decimais === 0 ? '✓ 0' : '✓ 0,00') : `${diff > 0 ? '+' : ''}${f(diff)}`}
    </span>
  );
}

export function EquipeTag({ equipe, className = '' }) {
  const c = CANAIS[canalDaEquipe(equipe)];
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ${c.cor} ${className}`}>{equipe}</span>;
}

export function Kpi({ label, value, sub, icon: Icon, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-600',
    brand: 'bg-brand-50 text-brand-600',
    green: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
  };
  return (
    <div className="card flex items-start gap-3 p-4">
      {Icon && (
        <div className={`rounded-lg p-2 ${tones[tone]}`}>
          <Icon size={18} />
        </div>
      )}
      <div className="min-w-0">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
        <div className="mt-0.5 truncate text-xl font-semibold tabular-nums text-slate-900">{value}</div>
        {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
      </div>
    </div>
  );
}

export function PageHeader({ step, title, subtitle, actions }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div>
        {step && <div className="text-xs font-semibold uppercase tracking-wider text-brand-600">{step}</div>}
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Empty({ icon: Icon, title, children }) {
  return (
    <div className="card flex flex-col items-center justify-center gap-2 p-10 text-center">
      {Icon && <Icon className="text-slate-300" size={36} />}
      <div className="font-semibold text-slate-700">{title}</div>
      <div className="max-w-md text-sm text-slate-500">{children}</div>
    </div>
  );
}

export function nomeFornecedor(modelo, cod) {
  return modelo.fornecedores.get(Number(cod))?.nome || `Indústria ${cod}`;
}

/** Seletor de métrica: Financeiro (R$) ⇄ Positivação (clientes) */
export function MetricaSwitch({ metrica, onChange, progresso = {} }) {
  const icones = { fin: DollarSign, pos: UserCheck };
  return (
    <div className="flex rounded-xl border border-slate-300 bg-slate-100 p-1" role="tablist" aria-label="Métrica da meta">
      {LISTA_METRICAS.map((m) => {
        const Icon = icones[m.id];
        const ativo = metrica === m.id;
        return (
          <button
            key={m.id}
            role="tab"
            aria-selected={ativo}
            onClick={() => onChange(m.id)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              ativo ? (m.id === 'fin' ? 'bg-brand-600 text-white shadow' : 'bg-teal-600 text-white shadow') : 'text-slate-600 hover:bg-white'
            }`}
          >
            <Icon size={15} /> {m.label}
            {progresso[m.id] && <span className={`text-[10px] font-medium ${ativo ? 'text-white/80' : 'text-slate-400'}`}>{progresso[m.id]}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Faixa que lembra em qual métrica a pessoa está trabalhando */
export function MetricaBanner({ met }) {
  const cor = met.id === 'fin' ? 'bg-brand-50 text-brand-700 ring-brand-200' : 'bg-teal-50 text-teal-700 ring-teal-200';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${cor}`}>
      Metas de {met.label} {met.id === 'pos' ? '(clientes positivados)' : '(R$)'}
    </span>
  );
}

/** Cabeçalhos Jan..Set do histórico */
export function MesesHeader({ meses }) {
  return meses.map((m) => (
    <th key={`h${m}`} className="th num bg-slate-100/80 text-slate-400">
      {MESES_NOMES[m]}
    </th>
  ));
}

/** Células com o histórico mês a mês (valor completo), destacando o melhor mês */
export function MesesCells({ serie, meses, met, melhor, className = '' }) {
  return meses.map((m) => {
    const bruto = serie?.[m] || 0;
    const v = Math.abs(bruto) < 0.005 ? 0 : bruto;
    const top = melhor && melhor === m && v > 0;
    return (
      <td key={`c${m}`} className={`td num text-xs ${top ? 'bg-amber-50 font-semibold text-amber-800' : v < 0 ? 'text-rose-500' : 'text-slate-500'} ${className}`}>
        {v ? met.fmt(v) : '—'}
      </td>
    );
  });
}

/** Botão liga/desliga do histórico mês a mês */
export function ToggleMeses({ ativo, onChange }) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-600">
      <input type="checkbox" checked={ativo} onChange={(e) => onChange(e.target.checked)} />
      Mostrar histórico mês a mês (Jan–Set)
    </label>
  );
}
