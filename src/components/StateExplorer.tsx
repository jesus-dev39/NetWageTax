import { useState } from 'react';
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
import { TIPS_OVERTIME_GUIDE_PATH } from '../lib/state-tips-overtime';
import { formatUSD } from './CurrencyInput';
import { Field, RADIO_CLASS } from './form';
import NativeSelect from './NativeSelect';
import NoStateTaxBadge from './NoStateTaxBadge';
import USStateMap, { MAP_LEGEND } from './USStateMap';

const PAYCHECK_PATH = '/tools/paycheck-calculator/';
const OBBBA_PATH = '/tools/obbba-tax-calculator/';
const EXAMPLE_WAGES = 50_000;
const STRUCTURES: TaxStructure[] = ['none', 'flat', 'graduated'];

// Both calculators read ?state=<postal code> on mount and preselect it.
const paycheckHref = (s: StateTaxInfo) => `${PAYCHECK_PATH}?state=${s.code}#calculator`;
const obbbaHref = (s: StateTaxInfo) => `${OBBBA_PATH}?state=${s.code}#calculator`;

const link = 'text-link underline underline-offset-[3px] hover:decoration-2';

export default function StateExplorer() {
  const [selected, setSelected] = useState<StateCode | null>(null);
  const [highlighted, setHighlighted] = useState<StateCode | null>(null);
  const [filter, setFilter] = useState<TaxStructure | null>(null);

  // Old ?state= deep links are redirected to /state-taxes/<slug>/ by the page itself.
  const select = (code: StateCode | null) => setSelected(code);

  const info = selected ? STATES_BY_CODE[selected] : null;

  return (
    <div className="flex flex-col gap-12">
      <section aria-labelledby="map-heading">
        <h2 id="map-heading" className="text-2xl/[1.2] font-bold tracking-[-0.01em] text-ink md:text-[1.75rem]">
          2026 state income tax map
        </h2>
        <p className="mt-2 text-ink-2">Point at a state to see its rate, or select it to see details.</p>

        <fieldset className="mt-4">
          <legend className="mb-2 font-semibold text-ink">Show on the map</legend>
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            <FilterRadio checked={filter === null} onChange={() => setFilter(null)} label={`All (${STATES.length})`} />
            {MAP_LEGEND.map(({ structure, label, swatch }) => (
              <FilterRadio
                key={structure}
                checked={filter === structure}
                onChange={() => setFilter(structure)}
                label={`${label} (${STATES.filter((s) => s.structure === structure).length})`}
                swatch={swatch}
              />
            ))}
          </div>
        </fieldset>

        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <USStateMap selected={selected} onSelect={select} highlighted={highlighted} filter={filter} />

          <div className="flex flex-col gap-5">
            <Field id="explorer-state" label="Find your state">
              <NativeSelect id="explorer-state" value={selected ?? ''} onChange={(e) => select((e.target.value || null) as StateCode | null)}>
                <option value="">Choose a state</option>
                {STATES.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>

            {info ? (
              <StateDetail info={info} />
            ) : (
              <p className="border-l-4 border-line bg-surface px-4 py-3 text-[15px] text-ink-2">
                Select a state on the map or choose one above to see its 2026 income tax structure and an example estimate.
              </p>
            )}
          </div>
        </div>
      </section>

      <section aria-labelledby="directory-heading" className="border-t border-line pt-10">
        <h2 id="directory-heading" className="text-2xl/[1.2] font-bold tracking-[-0.01em] text-ink md:text-[1.75rem]">
          State directory
        </h2>
        <p className="mt-2 text-ink-2">Pick a state to see its 2026 rates, a worked example, and how it compares with its neighbors.</p>

        {STRUCTURES.map((structure) => {
          const group = STATES.filter((s) => s.structure === structure);
          return (
            <div key={structure} className="mt-8">
              <h3 className="flex items-center gap-2 font-bold text-ink">
                <span className={`h-3 w-3 ${MAP_LEGEND.find((l) => l.structure === structure)!.swatch}`} aria-hidden="true" />
                {STRUCTURE_LABELS[structure]}
                <span className="num font-normal text-ink-2">({group.length})</span>
              </h3>
              <ul className="mt-2 grid border-t border-line sm:grid-cols-2 sm:gap-x-8 lg:grid-cols-3">
                {group.map((s) => (
                  <li key={s.code} className="flex flex-wrap items-baseline justify-between gap-x-3 border-b border-line py-2">
                    <a
                      href={statePagePath(s)}
                      onMouseEnter={() => setHighlighted(s.code)}
                      onMouseLeave={() => setHighlighted(null)}
                      onFocus={() => setHighlighted(s.code)}
                      onBlur={() => setHighlighted(null)}
                      className={link}
                    >
                      {s.name}
                    </a>
                    {structure !== 'none' && <span className="num text-[15px] text-ink-2">{formatStateRate(s)}</span>}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}

        <p className="mt-8 max-w-3xl text-sm text-ink-2">
          Data: {STATE_TAX_DATA_AS_OF}. Estimates cover state income tax on wages for a single filer and exclude local
          income taxes and state credits. Progressive-state estimates use the typical effective rate for about $65,000 of
          wages. Each state decides whether to follow the federal tips and overtime deduction:{' '}
          <a href={TIPS_OVERTIME_GUIDE_PATH} className={link}>
            see which states tax tips and overtime
          </a>
          . Check your state’s revenue department for exact figures.{' '}
          <a href="/methodology/" className={link}>
            How we calculate
          </a>
        </p>
      </section>
    </div>
  );
}

function StateDetail({ info }: { info: StateTaxInfo }) {
  const example = calculateStateIncomeTax(EXAMPLE_WAGES, info.code);
  return (
    <div aria-live="polite">
      <h3 className="text-xl/[1.3] font-bold text-ink">{info.name}</h3>
      <div className="mt-1">
        {info.structure === 'none' ? <NoStateTaxBadge /> : <p className="num font-semibold text-ink">{formatStateRate(info)}</p>}
      </div>
      <p className="mt-3 text-[15px] text-ink-2">{info.note}</p>
      <dl className="num mt-3 border-t border-line text-[15px]">
        <div className="flex justify-between gap-4 border-b border-line py-2">
          <dt className="text-ink-2">Est. tax on {formatUSD(EXAMPLE_WAGES)} of wages</dt>
          <dd className="font-semibold text-ink">{formatUSD(example)}</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-line py-2">
          <dt className="text-ink-2">Local income taxes</dt>
          <dd className="text-right font-semibold text-ink">{info.localTaxLabel}</dd>
        </div>
      </dl>
      <ul className="mt-4 flex flex-col gap-2" aria-label={`More about ${info.name}`}>
        <li>
          <a href={statePagePath(info)} className={`${link} font-semibold`}>
            Full {info.name} tax guide
          </a>
        </li>
        <li>
          <a href={paycheckHref(info)} className={link}>
            Paycheck calculator for {info.name}
          </a>
        </li>
        <li>
          <a href={obbbaHref(info)} className={link}>
            Tips and overtime calculator for {info.name}
          </a>
        </li>
      </ul>
    </div>
  );
}

function FilterRadio(props: { checked: boolean; onChange: () => void; label: string; swatch?: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-ink">
      <input type="radio" name="map-filter" checked={props.checked} onChange={props.onChange} className={RADIO_CLASS} />
      {props.swatch && <span className={`h-3 w-3 ${props.swatch}`} aria-hidden="true" />}
      <span className="num">{props.label}</span>
    </label>
  );
}
