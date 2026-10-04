import { forwardRef, useEffect, useState, type ChangeEvent } from 'react';

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

export function formatUSD(value: number): string {
  return usd.format(Math.round(value));
}

const usdCents = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "$1,842.50": for per-paycheck amounts. */
export function formatUSDCents(value: number): string {
  return usdCents.format(Math.round(value * 100) / 100);
}

/** "12345.6" → "12,345.6" (keeps what the user typed, adds thousands separators). */
function withThousands(raw: string): string {
  if (raw === '') return '';
  const [int, dec] = raw.split('.');
  const intFormatted = (int || '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return dec === undefined ? intFormatted : `${intFormatted}.${dec}`;
}

function sanitize(input: string): string {
  const cleaned = input.replace(/[^0-9.]/g, '');
  const [int, ...rest] = cleaned.split('.');
  const intPart = int.replace(/^0+(?=\d)/, '');
  return rest.length ? `${intPart}.${rest.join('').slice(0, 2)}` : intPart;
}

interface CurrencyInputProps {
  id: string;
  value: number | null;
  onValueChange: (value: number | null) => void;
  placeholder?: string;
  describedBy?: string;
  disabled?: boolean;
}

const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(function CurrencyInput(
  { id, value, onValueChange, placeholder, describedBy, disabled },
  ref,
) {
  const [display, setDisplay] = useState(value === null ? '' : withThousands(String(value)));

  // Sync when the value is set from outside (e.g. W-2 decoder prefill).
  useEffect(() => {
    const current = display === '' ? null : Number(display.replace(/,/g, ''));
    if (current !== value) setDisplay(value === null ? '' : withThousands(String(value)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const raw = sanitize(e.target.value);
    setDisplay(withThousands(raw));
    onValueChange(raw === '' || raw === '.' ? null : Number(raw));
  }

  // Money field (docs/DESIGN.md §6): "$" in its own box, 2px field border, tabular figures.
  // The focus outline goes on the wrapper so it surrounds the prefix too.
  return (
    <div className="flex h-11 overflow-hidden rounded-control border-2 border-field bg-page focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-link has-disabled:bg-surface">
      <span aria-hidden="true" className="flex shrink-0 items-center border-r border-line bg-surface px-3 font-semibold text-ink-2">
        $
      </span>
      <input
        ref={ref}
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={display}
        onChange={handleChange}
        placeholder={placeholder}
        aria-describedby={describedBy}
        disabled={disabled}
        className="num min-w-0 flex-1 bg-transparent px-3 text-lg text-ink outline-none placeholder:text-muted disabled:cursor-not-allowed disabled:text-muted"
      />
    </div>
  );
});

export default CurrencyInput;
