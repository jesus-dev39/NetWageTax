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
import Logo from './Logo';

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
    <div className="rounded-xl border border-slate-200 bg-white p-4 print:hidden dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-xl">
      <p id="export-heading" className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        Save your {result.taxYear} deduction summary
      </p>
      <div role="group" aria-labelledby="export-heading" className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => setPrepOpen(true)}
          disabled={!canExport}
          className={`${buttonBase} btn-primary disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 disabled:shadow-none dark:disabled:from-slate-800 dark:disabled:to-slate-800 dark:disabled:text-slate-500`}
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
  const totals = summary.worksheet.reduce(
    (t, r) => ({
      reported: t.reported + r.reported,
      afterCap: t.afterCap + r.afterCap,
      phaseout: t.phaseout + r.phaseoutReduction,
      allowed: t.allowed + r.allowed,
    }),
    { reported: 0, afterCap: 0, phaseout: 0, allowed: 0 },
  );
  const minus = (n: number) => (n > 0 ? `−${formatUSD(n)}` : formatUSD(0));

  return (
    <div className="print-voucher hidden min-h-[250mm] flex-col bg-white text-[13px] text-slate-900 print:flex" aria-hidden="true">
      {/* Header banner */}
      <header className="rounded-xl bg-slate-900 px-6 py-5 text-white">
        <div className="flex items-start justify-between gap-6">
          <div>
            <Logo tone="dark" />
            <p className="mt-1 text-xs text-slate-400">NetWageTax.com · {summary.taxYear} Tax Estimate</p>
          </div>
          <div className="text-right text-xs">
            <p className="uppercase tracking-wider text-slate-400">Reference</p>
            <p className="font-mono text-sm font-semibold text-emerald-400">{summary.referenceId}</p>
            <p className="mt-1 text-slate-400">{summary.generatedAt}</p>
          </div>
        </div>
        <div className="mt-5 border-t border-white/10 pt-4">
          <h1 className="text-2xl font-bold tracking-tight">{summary.taxYear} Tax Deduction Worksheet</h1>
          <p className="mt-0.5 text-slate-300">
            Federal Tips &amp; Overtime Deduction · Schedule 1-A method · {summary.filingStatus}
            {summary.stateTax ? ` · ${summary.stateTax.name}` : ''}
          </p>
        </div>
      </header>

      {/* Highlight cards */}
      <section className="mt-5 grid grid-cols-3 gap-3 break-inside-avoid">
        <HighlightCard label="Total income (MAGI)" value={formatUSD(summary.magi)} />
        <HighlightCard label="Net deduction (Schedule 1-A)" value={formatUSD(summary.totalDeduction)} />
        <HighlightCard label="Net tax savings" value={`${summary.savings > 0 ? '+' : ''}${formatUSD(summary.savings)}`} accent />
      </section>
      {summary.savingsNote && <p className="mt-2 text-xs text-emerald-800">✓ {summary.savingsNote}</p>}

      {/* Worksheet */}
      <section className="mt-6 break-inside-avoid">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Deduction worksheet</h2>
        <table className="mt-2 w-full border-collapse text-left">
          <thead>
            <tr className="bg-slate-100 text-[11px] uppercase tracking-wide text-slate-600">
              <th scope="col" className="px-3 py-2 font-semibold">Category</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Reported</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Statutory cap</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">After cap</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Phase-out</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Allowed</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {summary.worksheet.map((r, i) => (
              <tr key={r.code} className={i % 2 ? 'bg-slate-50' : ''}>
                <th scope="row" className="px-3 py-2.5 font-medium">
                  {r.label} <span className="font-mono text-[11px] text-slate-500">({r.code})</span>
                  {r.note && <span className="block text-[11px] font-normal text-slate-500">{r.note}</span>}
                </th>
                <td className="px-3 py-2.5 text-right">{formatUSD(r.reported)}</td>
                <td className="px-3 py-2.5 text-right text-slate-500">{formatUSD(r.cap)}</td>
                <td className="px-3 py-2.5 text-right">{formatUSD(r.afterCap)}</td>
                <td className="px-3 py-2.5 text-right">{minus(r.phaseoutReduction)}</td>
                <td className="px-3 py-2.5 text-right font-semibold">{formatUSD(r.allowed)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-slate-900 bg-emerald-50 font-semibold">
              <th scope="row" className="px-3 py-2.5">Total</th>
              <td className="px-3 py-2.5 text-right">{formatUSD(totals.reported)}</td>
              <td className="px-3 py-2.5" />
              <td className="px-3 py-2.5 text-right">{formatUSD(totals.afterCap)}</td>
              <td className="px-3 py-2.5 text-right">{minus(totals.phaseout)}</td>
              <td className="px-3 py-2.5 text-right text-emerald-700">{formatUSD(totals.allowed)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Tax impact */}
      <section className="mt-6 break-inside-avoid">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tax impact</h2>
        <table className="mt-2 w-full border-collapse text-left">
          <tbody className="tabular-nums">
            <ImpactRow
              label={SAVINGS_LINE_LABEL}
              detail={`${summary.taxYear} standard deduction and federal brackets`}
              value={formatUSD(summary.savings)}
              good
            />
            <ImpactRow
              label="Estimated FICA still owed on tips & overtime"
              detail="Social Security & Medicare, employee share"
              value={formatUSD(summary.fica)}
              striped
            />
            {summary.stateTax && (
              <ImpactRow
                label={`Estimated state income tax: ${summary.stateTax.name}`}
                detail={
                  summary.stateTax.structure === 'none'
                    ? 'No state income tax on wages'
                    : `${summary.stateTax.rateLabel} · single-filer estimate, excludes local taxes`
                }
                value={formatUSD(summary.stateTax.tax)}
              />
            )}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-amber-800">
          <span className="font-semibold">Important: </span>
          {summary.ficaNotice}
        </p>
      </section>

      {/* Compliance & disclaimer, pinned to the bottom of the page */}
      <footer className="mt-auto break-inside-avoid rounded-lg border border-slate-300 p-4 pt-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-600 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
            <span aria-hidden="true">✓</span> Calculated under IRC §224 / §225 &amp; FLSA §7 rules
          </span>
          <span className="text-[11px] text-slate-500">
            Generated {summary.generatedAt} · {summary.referenceId}
          </span>
        </div>
        <p className="mt-3 text-xs font-semibold text-slate-900">{SUMMARY_DISCLAIMER}</p>
        <p className="mt-1 text-[10.5px] leading-relaxed text-slate-600">{SUMMARY_LEGAL_NOTICE}</p>
      </footer>
    </div>
  );
}

function HighlightCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg px-4 py-3 ${accent ? 'border-2 border-emerald-600 bg-emerald-50' : 'border border-slate-200 bg-slate-50'}`}>
      <p className={`text-[10.5px] font-semibold uppercase leading-tight tracking-wide ${accent ? 'text-emerald-800' : 'text-slate-500'}`}>
        {label}
      </p>
      <p className={`mt-1 font-bold tabular-nums ${accent ? 'text-3xl text-emerald-700' : 'text-2xl text-slate-900'}`}>{value}</p>
    </div>
  );
}

function ImpactRow(props: { label: string; detail: string; value: string; good?: boolean; striped?: boolean }) {
  return (
    <tr className={props.striped ? 'bg-slate-50' : ''}>
      <th scope="row" className="px-3 py-2 font-medium">
        {props.label}
        <span className="block text-[11px] font-normal text-slate-500">{props.detail}</span>
      </th>
      <td className={`px-3 py-2 text-right font-semibold ${props.good ? 'text-emerald-700' : ''}`}>{props.value}</td>
    </tr>
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
