import { forwardRef, useEffect, useState, type ChangeEvent } from 'react';

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

export function formatUSD(value: number): string {
  return usd.format(Math.round(value));
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

  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
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
        className="block w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-8 pr-3.5 text-base text-slate-900 tabular-nums shadow-sm placeholder:text-slate-400 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-500/30 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
      />
    </div>
  );
});

export default CurrencyInput;
