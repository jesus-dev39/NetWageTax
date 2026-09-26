import { useEffect, useMemo, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import type { PaycheckInput, PaycheckResult } from '../lib/paycheck';
import {
  buildPaycheckSummary,
  PAYCHECK_DISCLAIMER,
  PAYCHECK_NOT_A_PAYSTUB,
  type PaycheckSummary,
  type PaycheckSummaryRow,
} from '../lib/paycheck-summary';
import { formatUSDCents } from './CurrencyInput';
import ExportPrepModal from './ExportPrepModal';
import ExportToolbar from './ExportToolbar';
import Logo from './Logo';

interface Props {
  input: PaycheckInput;
  result: PaycheckResult;
}

export default function PaycheckExportActions({ input, result }: Props) {
  const canExport = result.grossAnnual > 0;
  const [generatedAt, setGeneratedAt] = useState(() => new Date());
  const [mounted, setMounted] = useState(false);
  const [prepOpen, setPrepOpen] = useState(false);

  const summary = useMemo(() => buildPaycheckSummary(input, result, generatedAt), [input, result, generatedAt]);

  // Portaled to <body> after hydration (so server and client markup match) for the print stylesheet.
  useEffect(() => setMounted(true), []);

  // Stamp the estimate at print time, including Ctrl+P.
  useEffect(() => {
    const stamp = () => flushSync(() => setGeneratedAt(new Date()));
    window.addEventListener('beforeprint', stamp);
    return () => window.removeEventListener('beforeprint', stamp);
  }, []);

  function handlePrint() {
    flushSync(() => setGeneratedAt(new Date()));
    window.print();
  }

  const fresh = () => buildPaycheckSummary(input, result, new Date());

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 print:hidden dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-xl">
      <ExportToolbar
        heading="Save your paycheck estimate"
        canExport={canExport}
        disabledHint="Enter your pay to enable exports."
        onPrint={() => setPrepOpen(true)}
        onExport={{
          docx: async () => (await import('../lib/paycheck-summary-docx')).downloadPaycheckDocx(fresh()),
          xlsx: async () => (await import('../lib/paycheck-summary-xlsx')).downloadPaycheckXlsx(fresh()),
        }}
      />

      <ExportPrepModal
        open={prepOpen}
        taxYear={summary.taxYear}
        title={`Preparing Your ${summary.taxYear} Paycheck Estimate`}
        onPrint={handlePrint}
        onClose={() => setPrepOpen(false)}
      />

      {mounted && canExport && createPortal(<PaycheckVoucher summary={summary} />, document.body)}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Print-only estimate (one page, Letter or A4)
// ---------------------------------------------------------------------------

export function PaycheckVoucher({ summary: s }: { summary: PaycheckSummary }) {
  return (
    <div className="print-voucher hidden min-h-[245mm] flex-col bg-white text-[13px] text-slate-900 print:flex" aria-hidden="true">
      <header className="rounded-xl bg-slate-900 px-6 py-4 text-white">
        <div className="flex items-start justify-between gap-6">
          <div>
            <Logo tone="dark" />
            <p className="mt-1 text-xs text-slate-400">NetWageTax.com · {s.taxYear} Paycheck Estimate</p>
          </div>
          <div className="text-right text-xs">
            <p className="uppercase tracking-wider text-slate-400">Estimate reference</p>
            <p className="font-mono text-sm font-semibold text-emerald-400">{s.referenceId}</p>
            <p className="mt-1 text-slate-400">{s.generatedAt}</p>
          </div>
        </div>
        <div className="mt-4 flex items-end justify-between gap-4 border-t border-white/10 pt-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{s.taxYear} Paycheck &amp; Take-Home Pay Estimate</h1>
            <p className="mt-0.5 text-slate-300">
              {s.frequencyLabel} ({s.periods}/yr) · {s.filingStatus}
              {s.stateName ? ` · ${s.stateName}` : ''}
            </p>
          </div>
          <span className="shrink-0 rounded-md border border-amber-300/60 px-2 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-amber-200">
            Estimate · Not a pay stub
          </span>
        </div>
      </header>

      <p className="mt-4 text-xs text-slate-600">
        <span className="font-semibold text-slate-900">Earnings: </span>
        {s.earnings}
      </p>

      <section className="mt-3 grid grid-cols-3 gap-3 break-inside-avoid">
        <Highlight label="Gross pay" perPeriod={s.gross.perPeriod} annual={s.gross.annual} short={s.frequencyShort} />
        <Highlight label="Total taxes withheld (est.)" perPeriod={s.taxes.perPeriod} annual={s.taxes.annual} short={s.frequencyShort} />
        <Highlight label="Net take-home pay" perPeriod={s.net.perPeriod} annual={s.net.annual} short={s.frequencyShort} accent />
      </section>

      <section className="mt-5 break-inside-avoid">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Paycheck breakdown</h2>
        <table className="mt-2 w-full border-collapse text-left">
          <thead>
            <tr className="bg-slate-100 text-[11px] uppercase tracking-wide text-slate-600">
              <th scope="col" className="px-3 py-2 font-semibold">Item</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Per paycheck</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Annual</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">% of gross</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {s.rows.map((r, i) => (
              <VoucherRow key={r.label} row={r} zebra={i % 2 === 1} gross={s.gross.annual} />
            ))}
          </tbody>
        </table>
      </section>

      <footer className="mt-auto break-inside-avoid rounded-lg border border-slate-300 p-4 pt-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-600 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
            <span aria-hidden="true">✓</span> 2026 IRS brackets, FICA wage base &amp; state estimates
          </span>
          <span className="text-[11px] text-slate-500">
            Generated {s.generatedAt} · {s.referenceId}
          </span>
        </div>
        <p className="mt-3 text-xs font-semibold text-slate-900">{PAYCHECK_NOT_A_PAYSTUB}</p>
        <p className="mt-1 text-[10.5px] leading-relaxed text-slate-600">{PAYCHECK_DISCLAIMER}</p>
      </footer>
    </div>
  );
}

function Highlight(props: { label: string; perPeriod: number; annual: number; short: string; accent?: boolean }) {
  const { label, perPeriod, annual, short, accent } = props;
  return (
    <div className={`rounded-lg px-4 py-3 ${accent ? 'border-2 border-emerald-600 bg-emerald-50' : 'border border-slate-200 bg-slate-50'}`}>
      <p className={`text-[10.5px] font-semibold uppercase leading-tight tracking-wide ${accent ? 'text-emerald-800' : 'text-slate-500'}`}>
        {label}
      </p>
      <p className={`mt-1 font-bold tabular-nums ${accent ? 'text-2xl text-emerald-700' : 'text-xl text-slate-900'}`}>
        {formatUSDCents(perPeriod)}
      </p>
      <p className="text-[11px] text-slate-500">
        per {short} paycheck · <span className="tabular-nums">{formatUSDCents(annual)}</span>/yr
      </p>
    </div>
  );
}

function VoucherRow({ row: r, zebra, gross }: { row: PaycheckSummaryRow; zebra: boolean; gross: number }) {
  const strong = r.kind === 'gross' || r.kind === 'subtotal' || r.kind === 'net';
  const cls =
    r.kind === 'net'
      ? 'border-t-2 border-slate-900 bg-emerald-50 font-semibold text-emerald-800'
      : r.kind === 'subtotal'
        ? 'border-t border-slate-300 font-semibold'
        : zebra
          ? 'bg-slate-50'
          : '';
  const share = gross > 0 ? `${((r.annual / gross) * 100).toFixed(1)}%` : '—';
  return (
    <tr className={cls}>
      <th scope="row" className={`px-3 py-1.5 text-left ${strong ? 'font-semibold' : 'font-medium'} ${r.kind === 'earning' ? 'pl-6 text-slate-600' : ''}`}>
        {r.label}
        {/* Gross pay's detail repeats the "Earnings" line above the cards. */}
        {r.detail && r.kind !== 'gross' && <span className="block text-[10.5px] font-normal leading-tight text-slate-500">{r.detail}</span>}
      </th>
      <td className="px-3 py-1.5 text-right">{formatUSDCents(r.perPeriod)}</td>
      <td className="px-3 py-1.5 text-right">{formatUSDCents(r.annual)}</td>
      <td className="px-3 py-1.5 text-right text-slate-500">{share}</td>
    </tr>
  );
}
