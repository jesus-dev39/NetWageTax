import type { PaycheckInput, PaycheckResult } from '../lib/paycheck';
import {
  buildPaycheckSummary,
  PAYCHECK_DISCLAIMER,
  PAYCHECK_TAX_YEAR,
  PAYCHECK_NOT_A_PAYSTUB,
  type PaycheckSummary,
  type PaycheckSummaryRow,
} from '../lib/paycheck-summary';
import { formatUSDCents } from './CurrencyInput';
import ExportActions from './ExportActions';
import { VoucherFigure, VoucherFooter, VoucherHeader } from './VoucherParts';

interface Props {
  input: PaycheckInput;
  result: PaycheckResult;
}

export default function PaycheckExportActions({ input, result }: Props) {
  const build = (at: Date) => buildPaycheckSummary(input, result, at);
  return (
    <ExportActions
      heading="Save this estimate"
      canExport={result.grossAnnual > 0}
      disabledHint="Enter your pay to enable exports."
      title={`Your ${PAYCHECK_TAX_YEAR} paycheck estimate`}
      build={build}
      voucher={(summary) => <PaycheckVoucher summary={summary} />}
      docx={async (s) => (await import('../lib/paycheck-summary-docx')).downloadPaycheckDocx(s)}
      xlsx={async (s) => (await import('../lib/paycheck-summary-xlsx')).downloadPaycheckXlsx(s)}
    />
  );
}

// ---------------------------------------------------------------------------
// Print-only estimate (one page, Letter or A4)
// ---------------------------------------------------------------------------

export function PaycheckVoucher({ summary: s }: { summary: PaycheckSummary }) {
  const figure = (perPeriod: number, annual: number) => ({
    value: formatUSDCents(perPeriod),
    detail: `per ${s.frequencyShort} paycheck · ${formatUSDCents(annual)} a year`,
  });
  return (
    <div className="print-voucher hidden min-h-[245mm] flex-col bg-page text-[13px] text-ink print:flex" aria-hidden="true">
      <VoucherHeader
        subtitle={`NetWageTax.com · ${s.taxYear} paycheck estimate`}
        referenceLabel="Estimate reference"
        referenceId={s.referenceId}
        generatedAt={s.generatedAt}
      />
      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl/[1.2] font-bold tracking-[-0.01em]">{s.taxYear} paycheck and take-home pay estimate</h1>
          <p className="mt-1 text-ink-2">
            {s.frequencyLabel} ({s.periods} a year) · {s.filingStatus}
            {s.stateName ? ` · ${s.stateName}` : ''}
          </p>
        </div>
        <span className="shrink-0 rounded-[2px] bg-warning-tint px-2 py-0.5 text-xs font-semibold">Estimate, not a pay stub</span>
      </div>

      <p className="mt-3 text-xs text-ink-2">
        <span className="font-semibold text-ink">Earnings: </span>
        {s.earnings}
      </p>

      <section className="mt-3 grid grid-cols-3 gap-3 break-inside-avoid">
        <VoucherFigure label="Gross pay" {...figure(s.gross.perPeriod, s.gross.annual)} />
        <VoucherFigure label="Total taxes withheld (est.)" {...figure(s.taxes.perPeriod, s.taxes.annual)} />
        <VoucherFigure label="Take-home pay" {...figure(s.net.perPeriod, s.net.annual)} accent />
      </section>

      <section className="mt-5 break-inside-avoid">
        <h2 className="text-[15px] font-bold">Paycheck breakdown</h2>
        <table className="mt-2 w-full border-collapse text-left">
          <thead>
            <tr className="bg-surface text-xs">
              <th scope="col" className="px-3 py-2 font-semibold">Item</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Per paycheck</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Annual</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">% of gross</th>
            </tr>
          </thead>
          <tbody>
            {s.rows.map((r) => (
              <VoucherRow key={r.label} row={r} gross={s.gross.annual} />
            ))}
          </tbody>
        </table>
      </section>

      <VoucherFooter
        basis={`${s.taxYear} IRS brackets, Social Security wage base, and state estimates.`}
        generatedAt={s.generatedAt}
        referenceId={s.referenceId}
        headline={PAYCHECK_NOT_A_PAYSTUB}
        body={PAYCHECK_DISCLAIMER}
      />
    </div>
  );
}

function VoucherRow({ row: r, gross }: { row: PaycheckSummaryRow; gross: number }) {
  const strong = r.kind === 'gross' || r.kind === 'subtotal' || r.kind === 'net';
  // Net pay: 2px ink rule and the result's green tint; every other row: 1px rule, no zebra stripes.
  const cls = r.kind === 'net' ? 'border-t-2 border-ink bg-green-tint font-bold' : 'border-b border-line';
  const share = gross > 0 ? `${((r.annual / gross) * 100).toFixed(1)}%` : '—';
  return (
    <tr className={cls}>
      <th
        scope="row"
        className={`px-3 py-1.5 text-left ${strong ? 'font-semibold' : 'font-normal'} ${r.kind === 'earning' ? 'pl-6 text-ink-2' : ''}`}
      >
        {r.label}
        {/* Gross pay's detail repeats the "Earnings" line above the figures. */}
        {r.detail && r.kind !== 'gross' && <span className="block text-[10.5px] font-normal leading-tight text-ink-2">{r.detail}</span>}
      </th>
      <td className="px-3 py-1.5 text-right">{formatUSDCents(r.perPeriod)}</td>
      <td className="px-3 py-1.5 text-right">{formatUSDCents(r.annual)}</td>
      <td className="px-3 py-1.5 text-right text-ink-2">{share}</td>
    </tr>
  );
}
