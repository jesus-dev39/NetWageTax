import { useEffect, useMemo, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import {
  buildDeductionSummary,
  SAVINGS_LINE_LABEL,
  SUMMARY_DISCLAIMER,
  SUMMARY_LEGAL_NOTICE,
  type DeductionSummary,
  type SummaryInput,
} from '../lib/deduction-summary';
import { formatUSD } from './CurrencyInput';
import ExportPrepModal from './ExportPrepModal';

type Props = SummaryInput;

export default function ExportSummaryActions(props: Props) {
  const { result, tipsReported, overtimeReported, savings, stateTax } = props;
  const canExport = result.totalCombinedDeduction > 0;

  const [generatedAt, setGeneratedAt] = useState(() => new Date());
  const [mounted, setMounted] = useState(false);
  const [docxState, setDocxState] = useState<'idle' | 'busy' | 'error'>('idle');
  const [prepOpen, setPrepOpen] = useState(false);

  const summary = useMemo(
    () => buildDeductionSummary({ result, tipsReported, overtimeReported, savings, stateTax }, generatedAt),
    [result, tipsReported, overtimeReported, savings, stateTax, generatedAt],
  );

  // The voucher is portaled to <body> after hydration so print CSS can hide every other body child.
  useEffect(() => setMounted(true), []);

  // Stamp the voucher at print time, including prints started from the browser menu / Ctrl+P.
  useEffect(() => {
    const stamp = () => flushSync(() => setGeneratedAt(new Date()));
    window.addEventListener('beforeprint', stamp);
    return () => window.removeEventListener('beforeprint', stamp);
  }, []);

  function handlePrint() {
    flushSync(() => setGeneratedAt(new Date()));
    window.print();
  }

  async function handleDocx() {
    setDocxState('busy');
    try {
      const fresh = buildDeductionSummary({ result, tipsReported, overtimeReported, savings, stateTax }, new Date());
      const { downloadSummaryDocx } = await import('../lib/deduction-summary-docx');
      await downloadSummaryDocx(fresh);
      setDocxState('idle');
    } catch (err) {
      console.error('Word export failed', err);
      setDocxState('error');
    }
  }

  const buttonBase =
    'inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 disabled:cursor-not-allowed';

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 print:hidden">
      <p id="export-heading" className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        Save your {result.taxYear} deduction summary
      </p>
      <div role="group" aria-labelledby="export-heading" className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => setPrepOpen(true)}
          disabled={!canExport}
          className={`${buttonBase} bg-ink text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500`}
        >
          <PrinterIcon />
          Download PDF / Print Summary
        </button>
        <button
          type="button"
          onClick={handleDocx}
          disabled={!canExport || docxState === 'busy'}
          aria-busy={docxState === 'busy'}
          className={`${buttonBase} border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:border-slate-200 dark:disabled:border-slate-800 disabled:bg-slate-50 dark:disabled:bg-slate-900 disabled:text-slate-400 dark:disabled:text-slate-500`}
        >
          <DocumentIcon />
          {docxState === 'busy' ? 'Preparing…' : 'Export Word (.docx)'}
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400" aria-live="polite">
        {docxState === 'error'
          ? 'The Word file could not be created. Please try again, or use Print / PDF instead.'
          : canExport
            ? 'Generated on your device. Choose “Save as PDF” in the print dialog for a PDF copy.'
            : 'Enter a qualifying tips or overtime amount to enable exports.'}
      </p>

      <ExportPrepModal
        open={prepOpen}
        taxYear={result.taxYear}
        onPrint={handlePrint}
        onClose={() => setPrepOpen(false)}
      />

      {mounted && canExport && createPortal(<PrintVoucher summary={summary} />, document.body)}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Print-only voucher
// ---------------------------------------------------------------------------

export function PrintVoucher({ summary }: { summary: DeductionSummary }) {
  return (
    <div className="print-voucher hidden break-inside-avoid bg-white text-slate-900 print:block" aria-hidden="true">
      <header className="flex items-start justify-between gap-6 border-b-2 border-navy-800 pb-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy-800 text-lg font-bold text-white">
            N
          </span>
          <div>
            <p className="text-xl font-semibold tracking-tight">
              NetWage<span className="text-navy-600">Tax</span>
            </p>
            <p className="text-sm text-slate-600">NetWageTax.com · {summary.taxYear} Tax Estimate</p>
          </div>
        </div>
        <div className="text-right text-xs text-slate-600">
          <p className="font-semibold uppercase tracking-wide text-slate-900">Generated</p>
          <p>{summary.generatedAt}</p>
        </div>
      </header>

      <h1 className="mt-4 text-xl font-semibold tracking-tight">NetWageTax Official Estimate Voucher</h1>
      <p className="mt-0.5 text-sm text-slate-600">
        {summary.taxYear} Federal Tips &amp; Overtime Deduction Summary (Schedule 1-A method)
      </p>

      <section className="mt-4 break-inside-avoid rounded-lg border-2 border-emerald-600 bg-emerald-50 px-5 py-3">
        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">{SAVINGS_LINE_LABEL}</p>
            <p className="mt-0.5 text-3xl font-bold tabular-nums text-emerald-700">
              {summary.savings > 0 ? '+' : ''}
              {formatUSD(summary.savings)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-600">Total Federal Deduction (Schedule 1-A)</p>
            <p className="text-lg font-semibold tabular-nums text-slate-900">{formatUSD(summary.totalDeduction)}</p>
          </div>
        </div>
        {summary.savingsNote && <p className="mt-2 text-sm text-emerald-900">✓ {summary.savingsNote}</p>}
      </section>

      <table className="mt-4 w-full border-collapse text-[13px] leading-snug">
        <thead>
          <tr className="bg-navy-800 text-left text-white">
            <th scope="col" className="px-3 py-1.5 font-semibold">Line item</th>
            <th scope="col" className="px-3 py-1.5 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {summary.lines.map((line) => (
            <tr
              key={line.label}
              className={`break-inside-avoid border-b border-slate-300 ${line.total ? 'bg-emerald-50 text-emerald-800' : ''}`}
            >
              <th scope="row" className={`px-3 py-1.5 text-left ${line.total ? 'font-semibold' : 'font-normal'}`}>
                {line.label}
                {line.detail && <span className="block text-[11px] font-normal text-slate-500">{line.detail}</span>}
              </th>
              <td className={`px-3 py-1.5 text-right tabular-nums ${line.total ? 'text-sm font-semibold' : ''}`}>
                {line.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-4 break-inside-avoid rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-xs text-amber-900">
        <span className="font-semibold">Important: </span>
        {summary.ficaNotice} The FICA figure above is an estimate of the employee share only.
      </p>

      <footer className="mt-4 break-inside-avoid border-t border-slate-300 pt-3 text-[10.5px] leading-relaxed text-slate-600">
        <p className="text-sm font-semibold text-slate-900">{SUMMARY_DISCLAIMER}</p>
        <p className="mt-1">{SUMMARY_LEGAL_NOTICE}</p>
      </footer>
    </div>
  );
}

function PrinterIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4">
      <path d="M5.5 7V3.5h9V7M5.5 14.5h-2v-6a1.5 1.5 0 0 1 1.5-1.5h10a1.5 1.5 0 0 1 1.5 1.5v6h-2" strokeLinejoin="round" />
      <path d="M5.5 11.5h9v5h-9z" strokeLinejoin="round" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4">
      <path d="M11.5 2.5H5.5a1.5 1.5 0 0 0-1.5 1.5v12a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 16 16V7l-4.5-4.5Z" strokeLinejoin="round" />
      <path d="M11.5 2.5V7H16M7 11h6M7 14h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
