import { useState } from 'react';
import { formatLongDate } from '../lib/site';
import { STATES, statePagePath, type StateCode } from '../lib/state-tax-data';
import { INFERRED_NOTE, TREATMENT_LABEL, type TipsOvertimeTreatment } from '../lib/state-tips-overtime';
import { Field } from './form';
import NativeSelect from './NativeSelect';
import USStateMap, { TIPS_MAP_LEGEND } from './USStateMap';

const link = 'text-link underline underline-offset-[3px] hover:decoration-2';
const rowId = (code: StateCode) => `tips-${code.toLowerCase()}`;
const count = (t: TipsOvertimeTreatment) => STATES.filter((s) => s.tipsOvertime.treatment === t).length;

/** Only the categories some state is in (e.g. "Not yet confirmed" disappears once DC is resolved). */
const LEGEND = TIPS_MAP_LEGEND.filter(({ treatment }) => count(treatment) > 0);

/**
 * Map, category filter, and table of how every state treats the federal tips and overtime deduction,
 * for /guides/which-states-tax-tips-and-overtime/. The table is the accessible version of the map:
 * every fact is there as text, and the page is complete without JavaScript (all rows render).
 */
export default function TipsOvertimeExplorer() {
  const [filter, setFilter] = useState<TipsOvertimeTreatment | null>(null);
  const [highlighted, setHighlighted] = useState<StateCode | null>(null);

  const rows = filter ? STATES.filter((s) => s.tipsOvertime.treatment === filter) : STATES;

  // Clicking a state on the map jumps to its row (showing all rows if the filter hides it).
  function select(code: StateCode) {
    if (filter && STATES.find((s) => s.code === code)!.tipsOvertime.treatment !== filter) setFilter(null);
    setHighlighted(code);
    requestAnimationFrame(() => document.getElementById(rowId(code))?.scrollIntoView({ block: 'center' }));
  }

  return (
    <div>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <USStateMap selected={null} onSelect={select} highlighted={highlighted} colorBy="tips" filter={filter} />

        <div className="flex flex-col gap-5">
          <ul aria-label="Map key" className="border-t border-line">
            {LEGEND.map(({ treatment, label, swatch }) => (
              <li key={treatment} className="flex items-center justify-between gap-3 border-b border-line py-2 text-[15px]">
                <span className="flex items-center gap-2.5 text-ink">
                  <span className={`h-3.5 w-3.5 shrink-0 ${swatch}`} aria-hidden="true" />
                  {label}
                </span>
                <span className="num text-ink-2">{count(treatment)}</span>
              </li>
            ))}
          </ul>
          <Field id="tips-filter" label="Show in the table">
            <NativeSelect
              id="tips-filter"
              value={filter ?? ''}
              onChange={(e) => {
                setFilter((e.target.value || null) as TipsOvertimeTreatment | null);
                setHighlighted(null);
              }}
            >
              <option value="">All states and DC ({STATES.length})</option>
              {LEGEND.map(({ treatment, label }) => (
                <option key={treatment} value={treatment}>
                  {label} ({count(treatment)})
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {filter ? `Showing ${rows.length} states: ${TREATMENT_LABEL[filter]}.` : ''}
      </p>

      <table className="mt-8 w-full text-[15px] max-md:block">
        <caption className="sr-only">How each state treats the federal tips and overtime deduction in 2026</caption>
        <thead className="max-md:sr-only">
          <tr>
            {['State', 'Category', 'Details', 'Official source', 'Checked'].map((h) => (
              <th key={h} scope="col" className="bg-surface px-3 py-2 text-left font-semibold text-ink">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="max-md:block max-md:border-t max-md:border-line">
          {rows.map((s) => {
            const r = s.tipsOvertime;
            const swatch = TIPS_MAP_LEGEND.find((l) => l.treatment === r.treatment)!.swatch;
            return (
              <tr
                key={s.code}
                id={rowId(s.code)}
                className={`scroll-mt-24 align-top max-md:block max-md:border-b max-md:border-line max-md:py-3 ${s.code === highlighted ? 'bg-surface' : ''}`}
              >
                <th scope="row" className="border-t border-line px-3 py-3 text-left font-semibold max-md:block max-md:border-0 max-md:p-0">
                  <a href={statePagePath(s)} className={link}>
                    {s.name}
                  </a>
                </th>
                <td className="border-t border-line px-3 py-3 max-md:block max-md:border-0 max-md:px-0 max-md:py-1">
                  <span className="flex items-center gap-2 font-semibold text-ink md:min-w-36">
                    <span className={`h-3 w-3 shrink-0 ${swatch}`} aria-hidden="true" />
                    {TREATMENT_LABEL[r.treatment]}
                  </span>
                </td>
                <td className="border-t border-line px-3 py-3 text-ink max-md:block max-md:border-0 max-md:px-0 max-md:py-1">
                  {r.detail}
                  {r.inferred && <span className="mt-1 block text-ink-2">{INFERRED_NOTE}</span>}
                </td>
                <td className="border-t border-line px-3 py-3 max-md:block max-md:border-0 max-md:px-0 max-md:py-1 md:w-[30%]">
                  <span className="font-semibold text-ink md:sr-only">Source: </span>
                  {r.sources.length === 0 && <span className="text-ink-2">None yet</span>}
                  <ul className="max-md:inline">
                    {r.sources.map((src) => (
                      <li key={src.url} className="max-md:mt-1 md:[&+li]:mt-2">
                        <a href={src.url} rel="noopener" target="_blank" className={link}>
                          {src.label}
                        </a>
                        {src.date && <span className="text-ink-2">, {src.date}</span>}
                      </li>
                    ))}
                  </ul>
                </td>
                <td className="num border-t border-line px-3 py-3 text-ink-2 max-md:block max-md:border-0 max-md:px-0 max-md:py-1 md:whitespace-nowrap">
                  <span className="md:sr-only">Checked </span>
                  <time dateTime={r.checked}>{formatLongDate(r.checked)}</time>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
