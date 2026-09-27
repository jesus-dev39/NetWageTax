import { useState, type ReactNode } from 'react';
import {
  calculateStateIncomeTax,
  formatStateRate,
  STATE_TAX_DATA_AS_OF,
  STATES,
  STATES_BY_CODE,
  STRUCTURE_LABELS,
  statePagePath,
  type StateCode,
  type StateTaxInfo,
  type TaxStructure,
} from '../lib/state-tax-data';
import { formatUSD } from './CurrencyInput';
import NoStateTaxBadge from './NoStateTaxBadge';
import StateSelect from './StateSelect';
import USStateMap, { MAP_LEGEND } from './USStateMap';

const PAYCHECK_PATH = '/tools/paycheck-calculator/';
const OBBBA_PATH = '/tools/obbba-tax-calculator/';
const EXAMPLE_WAGES = 50_000;
const STRUCTURES: TaxStructure[] = ['none', 'flat', 'graduated'];

// Both calculators read ?state=<postal code> on mount and preselect it.
const paycheckHref = (s: StateTaxInfo) => `${PAYCHECK_PATH}?state=${s.code}#calculator`;
const obbbaHref = (s: StateTaxInfo) => `${OBBBA_PATH}?state=${s.code}#calculator`;

export default function StateExplorer() {
  const [selected, setSelected] = useState<StateCode | null>(null);
  const [highlighted, setHighlighted] = useState<StateCode | null>(null);
  const [filter, setFilter] = useState<TaxStructure | null>(null);

  // Old ?state= deep links are redirected to /state-taxes/<slug>/ by the page itself.
  const select = (code: StateCode | null) => setSelected(code);

  const info = selected ? STATES_BY_CODE[selected] : null;

  return (
    <div className="flex flex-col gap-10">
      <section
        aria-labelledby="map-heading"
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-xl"
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="map-heading" className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
              2026 state income tax map
            </h2>
            <p className="mt-1 text-slate-600 dark:text-slate-400">Hover over a state to see its rate, or click to see details.</p>
          </div>
          <div role="group" aria-label="Filter the map by tax structure" className="flex flex-wrap gap-2">
            <FilterChip active={filter === null} onClick={() => setFilter(null)}>
              All 51
            </FilterChip>
            {MAP_LEGEND.map(({ structure, label, swatch }) => (
              <FilterChip
                key={structure}
                active={filter === structure}
                onClick={() => setFilter(filter === structure ? null : structure)}
              >
                <span className={`h-2.5 w-2.5 rounded-sm ${swatch}`} aria-hidden="true" />
                {label} ({STATES.filter((s) => s.structure === structure).length})
              </FilterChip>
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <USStateMap selected={selected} onSelect={select} highlighted={highlighted} filter={filter} />

          <div className="flex flex-col gap-4">
            <div>
              <label htmlFor="explorer-state" className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                Find your state
              </label>
              <div className="mt-2">
                <StateSelect id="explorer-state" value={selected} onChange={select} />
              </div>
            </div>

            {info ? (
              <StateDetail info={info} />
            ) : (
              <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                Select a state on the map or search above to see its 2026 income tax structure and an example estimate.
              </p>
            )}
          </div>
        </div>
      </section>

      <section aria-labelledby="directory-heading">
        <h2 id="directory-heading" className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          State directory
        </h2>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Pick a state to see its 2026 rates, a worked example, and how it compares with its neighbors.
        </p>

        {STRUCTURES.map((structure) => {
          const group = STATES.filter((s) => s.structure === structure);
          return (
            <div key={structure} className="mt-8">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                <span className={`h-3 w-3 rounded-sm ${MAP_LEGEND.find((l) => l.structure === structure)!.swatch}`} aria-hidden="true" />
                {STRUCTURE_LABELS[structure]}
                <span className="text-sm font-normal text-slate-500 dark:text-slate-400">({group.length})</span>
              </h3>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {group.map((s) => (
                  <li key={s.code}>
                    <a
                      href={statePagePath(s)}
                      onMouseEnter={() => setHighlighted(s.code)}
                      onMouseLeave={() => setHighlighted(null)}
                      onFocus={() => setHighlighted(s.code)}
                      onBlur={() => setHighlighted(null)}
                      className="group flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 transition hover:border-emerald-400 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-500/60"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-slate-900 dark:text-slate-100">{s.name}</span>
                        <span className="block text-xs text-slate-500 dark:text-slate-400">{formatStateRate(s)}</span>
                      </span>
                      <span className="shrink-0 font-mono text-xs text-slate-400 transition group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                        {s.code} <span aria-hidden="true">→</span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}

        <p className="mt-8 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          Data: {STATE_TAX_DATA_AS_OF}. Estimates cover state income tax on wages for a single filer and exclude local
          income taxes and state credits. Progressive-state estimates use the typical effective rate for about $65,000
          of wages. Most states do not allow the federal tips and overtime deduction. Check your state revenue
          department for exact figures.
        </p>
      </section>
    </div>
  );
}

function StateDetail({ info }: { info: StateTaxInfo }) {
  const example = calculateStateIncomeTax(EXAMPLE_WAGES, info.code);
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800/40" aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{info.name}</h3>
        <span className="font-mono text-sm text-slate-400">{info.code}</span>
      </div>
      {info.structure === 'none' ? (
        <NoStateTaxBadge className="mt-2" />
      ) : (
        <p className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-300">{formatStateRate(info)}</p>
      )}
      <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{info.note}</p>
      {info.localTaxNote && (
        <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          <span className="font-medium text-slate-700 dark:text-slate-300">Local taxes: </span>
          {info.localTaxNote}
        </p>
      )}
      <p className="mt-3 border-t border-slate-200 pt-3 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400">
        Est. state tax on {formatUSD(EXAMPLE_WAGES)} of wages:{' '}
        <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{formatUSD(example)}</span>
      </p>
      <a
        href={statePagePath(info)}
        className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 dark:text-emerald-400"
      >
        Full {info.name} tax guide <span aria-hidden="true">→</span>
      </a>
      <div className="mt-4 flex flex-col gap-2" role="group" aria-label={`Calculators with ${info.name} taxes`}>
        <ToolCard
          href={paycheckHref(info)}
          title="Paycheck Calculator"
          subtitle={`Calculate take-home pay with ${info.name} tax`}
          icon="M3 7.5A1.5 1.5 0 0 1 4.5 6h13A1.5 1.5 0 0 1 19 7.5v1H15a2.5 2.5 0 0 0 0 5h4v1a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 3 14.5z M15 8.5h5v5h-5a2.5 2.5 0 0 1 0-5Z M15.5 11h.01 M6 6l7.5-2.5L15 6"
        />
        <ToolCard
          href={obbbaHref(info)}
          title="Tips & Overtime Calculator"
          subtitle={`Calculate Schedule 1-A deduction with ${info.name} tax`}
          icon="M6 3h12v18l-2-1.25L14 21l-2-1.25L10 21l-2-1.25L6 21z M9 8h6 M9 11.5h6 M9 15h3.5"
        />
      </div>
    </div>
  );
}

/** Equal-weight launcher for a calculator, preset to the selected state. */
function ToolCard(props: { href: string; title: string; subtitle: string; icon: string }) {
  return (
    <a
      href={props.href}
      className="group flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 text-left transition-all hover:border-emerald-500/60 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 dark:border-slate-700/80 dark:bg-slate-800/80 dark:hover:border-emerald-500/60 dark:hover:bg-slate-800"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={props.icon} />
          </svg>
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">{props.title}</span>
          <span className="block text-xs text-slate-500 dark:text-slate-400">{props.subtitle}</span>
        </span>
      </span>
      <span
        aria-hidden="true"
        className="shrink-0 text-lg text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-emerald-500 dark:text-slate-500 dark:group-hover:text-emerald-400"
      >
        →
      </span>
    </a>
  );
}

function FilterChip(props: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={props.active}
      onClick={props.onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 ${
        props.active
          ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
          : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600'
      }`}
    >
      {props.children}
    </button>
  );
}
