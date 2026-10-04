import type { ReactNode } from 'react';

/**
 * Form building blocks for the calculators (docs/DESIGN.md §6): labels above fields, hints under
 * the label, real radios and checkboxes, 2px field borders, and conditional reveals instead of
 * toggle switches.
 */

export function Field({ id, label, hint, children, className = '' }: { id: string; label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="block font-semibold text-ink">
        {label}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="mt-0.5 text-[15px] text-ink-2">
          {hint}
        </p>
      )}
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

/** 22px radio: ink ring, filled ink dot when checked. */
export const RADIO_CLASS =
  'mt-px h-[22px] w-[22px] shrink-0 cursor-pointer appearance-none rounded-full border-2 border-ink bg-page checked:bg-ink checked:shadow-[inset_0_0_0_4px_var(--color-page)] disabled:cursor-not-allowed disabled:border-muted';

export interface RadioOption<T extends string> {
  value: T;
  label: string;
  /** Shown under the label; for a disabled option, the reason it can't be chosen. */
  hint?: string;
  disabled?: boolean;
}

export function RadioGroup<T extends string>(props: {
  legend: string;
  name: string;
  options: readonly RadioOption<T>[];
  value: T;
  onChange: (v: T) => void;
  inline?: boolean;
}) {
  const { legend, name, options, value, onChange, inline = false } = props;
  return (
    <fieldset>
      <legend className="mb-2 font-semibold text-ink">{legend}</legend>
      <div className={inline ? 'flex flex-wrap gap-x-6 gap-y-3' : 'flex flex-col gap-3'}>
        {options.map((o) => (
          <label key={o.value} className={`flex items-start gap-2.5 ${o.disabled ? 'cursor-not-allowed text-ink-2' : 'cursor-pointer text-ink'}`}>
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              disabled={o.disabled}
              onChange={() => onChange(o.value)}
              aria-describedby={o.hint ? `${name}-${o.value}-hint` : undefined}
              className={RADIO_CLASS}
            />
            <span>
              {o.label}
              {o.hint && (
                <span id={`${name}-${o.value}-hint`} className="block text-[15px] text-ink-2">
                  {o.hint}
                </span>
              )}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** 22px checkbox: ink fill when checked, with the check drawn in the page color so it works in both themes. */
export function Checkbox({ id, checked, onChange, children, controls }: { id: string; checked: boolean; onChange: (v: boolean) => void; children: ReactNode; controls?: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="relative mt-px flex h-[22px] w-[22px] shrink-0">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-controls={controls}
          aria-expanded={controls ? checked : undefined}
          className="peer h-full w-full cursor-pointer appearance-none rounded-[2px] border-2 border-ink bg-page checked:bg-ink"
        />
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className="pointer-events-none absolute inset-0 m-auto hidden h-4 w-4 text-page peer-checked:block"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m3.5 8.5 3 3 6-7" />
        </svg>
      </span>
      <label htmlFor={id} className="cursor-pointer text-ink">
        {children}
      </label>
    </div>
  );
}

/** Content shown under a checked checkbox, indented behind a 4px rule. Unmounted while closed. */
export function Reveal({ id, open, children }: { id: string; open: boolean; children: ReactNode }) {
  return (
    <div id={id} hidden={!open} className="ml-[10px] mt-3 border-l-4 border-line pl-6">
      {open && <div className="flex flex-col gap-5 py-1">{children}</div>}
    </div>
  );
}

/** Numeric text field with a unit after the number ("hours"), 0–168. */
export function HoursInput({ id, value, onChange, describedBy, unit = 'hours' }: { id: string; value: string; onChange: (v: string) => void; describedBy?: string; unit?: string }) {
  return (
    <div className="flex h-11 overflow-hidden rounded-control border-2 border-field bg-page focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-link">
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={value}
        aria-describedby={describedBy}
        onChange={(e) => {
          const cleaned = e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
          onChange(Number(cleaned) > 168 ? '168' : cleaned);
        }}
        className="num min-w-0 flex-1 bg-transparent px-3 text-lg text-ink outline-none"
      />
      <span aria-hidden="true" className="flex shrink-0 items-center border-l border-line bg-surface px-3 text-ink-2">
        {unit}
      </span>
    </div>
  );
}
