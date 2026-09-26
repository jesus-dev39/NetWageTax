import { useState } from 'react';
import CurrencyInput from './CurrencyInput';
import { dispatchW2Prefill } from '../lib/w2-events';

type Box12Code = 'TA' | 'TP' | 'TT';

interface CodeInfo {
  code: Box12Code;
  shortLabel: string;
  officialTitle: string;
  definition: string;
  qualifies: boolean;
  qualifiesNote: string;
  formImpact: string;
  watchOut?: string;
}

const CODES: CodeInfo[] = [
  {
    code: 'TA',
    shortLabel: 'Trump Account contributions',
    officialTitle: 'Employer contributions to Trump Accounts',
    definition:
      'Money your employer put into a Trump Account, a tax-advantaged investment account opened for your child. Employers can contribute up to $2,500 per year, and that amount is generally not taxable to you.',
    qualifies: false,
    qualifiesNote:
      'Not part of the tips or overtime deduction. This code is informational and has nothing to do with your tips or overtime pay.',
    formImpact:
      'No impact on Schedule 1-A. Do not enter this amount in the tips or overtime fields.',
  },
  {
    code: 'TP',
    shortLabel: 'Qualified tips',
    officialTitle: 'Total amount of tips subject to the "no tax on tips" deduction',
    definition:
      'The voluntary cash and card tips your employer identified as qualified tips, earned in an occupation on the Treasury Department’s list of jobs that customarily received tips before 2025.',
    qualifies: true,
    qualifiesNote:
      'Yes. This is the starting point for the qualified tips deduction under IRC §224, capped at $25,000 per return and reduced once MAGI passes $150,000 ($300,000 if married filing jointly).',
    formImpact:
      'Schedule 1-A, Part II (No Tax on Tips). The total from Schedule 1-A flows to Form 1040, line 13b.',
    watchOut:
      'Your employer does not apply the $25,000 cap or the income phase-out. You figure those on your return.',
  },
  {
    code: 'TT',
    shortLabel: 'Qualified overtime',
    officialTitle: 'Total amount of qualified overtime compensation',
    definition:
      'The overtime premium your employer paid under the Fair Labor Standards Act (FLSA): the extra “half” in time-and-a-half. It is not your total overtime pay.',
    qualifies: true,
    qualifiesNote:
      'Yes. This is the starting point for the qualified overtime deduction, capped at $12,500 ($25,000 if married filing jointly) and reduced once MAGI passes $150,000 ($300,000 if married filing jointly).',
    formImpact:
      'Schedule 1-A, Part III (No Tax on Overtime). The total from Schedule 1-A flows to Form 1040, line 13b.',
    watchOut:
      'Only the premium portion is deductible. If you earn $20/hour and work overtime at $30/hour, only $10 of each overtime hour counts.',
  },
];

export default function W2Decoder() {
  const [selected, setSelected] = useState<Box12Code>('TP');
  const [amount, setAmount] = useState<number | null>(null);
  const info = CODES.find((c) => c.code === selected)!;

  function selectCode(code: Box12Code) {
    setSelected(code);
    setAmount(null);
  }

  function sendToCalculator() {
    if (info.code === 'TA') return;
    dispatchW2Prefill({ code: info.code, amount: amount ?? undefined });
  }

  return (
    <section
      aria-labelledby="w2-decoder-heading"
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
    >
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold uppercase tracking-wide text-navy-600">Step 1</p>
        <h2 id="w2-decoder-heading" className="text-2xl font-semibold text-slate-900">
          Decode your Form W-2, Box 12
        </h2>
        <p className="text-slate-600">
          Starting with 2025 W-2s, employers use three new Box 12 codes. Select the code you see on
          your form to learn what it means.
        </p>
      </div>

      <div role="radiogroup" aria-label="Box 12 code" className="mt-6 grid gap-3 sm:grid-cols-3">
        {CODES.map((c) => {
          const active = c.code === selected;
          return (
            <button
              key={c.code}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => selectCode(c.code)}
              className={`flex items-center gap-4 rounded-xl border p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-500/40 ${
                active
                  ? 'border-navy-600 bg-navy-50 ring-1 ring-navy-600'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <span
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg font-mono text-lg font-bold ${
                  active ? 'bg-navy-700 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {c.code}
              </span>
              <span className="flex flex-col">
                <span className="font-medium text-slate-900">Code {c.code}</span>
                <span className="text-sm text-slate-600">{c.shortLabel}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5 sm:p-6" aria-live="polite">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Official title</p>
            <h3 className="mt-1 text-lg font-semibold text-slate-900">{info.officialTitle}</h3>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${
              info.qualifies
                ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
                : 'bg-slate-200/70 text-slate-700 ring-1 ring-slate-300'
            }`}
          >
            <span aria-hidden="true">{info.qualifies ? '✓' : '—'}</span>
            {info.qualifies ? 'Qualifies for 2026 OBBBA deduction' : 'Does not qualify'}
          </span>
        </div>

        <dl className="mt-5 grid gap-5 md:grid-cols-3">
          <div>
            <dt className="text-sm font-semibold text-slate-900">In plain English</dt>
            <dd className="mt-1 text-sm leading-relaxed text-slate-700">{info.definition}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-slate-900">Does it qualify?</dt>
            <dd className="mt-1 text-sm leading-relaxed text-slate-700">{info.qualifiesNote}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-slate-900">Where it goes on your return</dt>
            <dd className="mt-1 text-sm leading-relaxed text-slate-700">{info.formImpact}</dd>
          </div>
        </dl>

        {info.watchOut && (
          <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <span className="font-semibold">Watch out: </span>
            {info.watchOut}
          </p>
        )}

        {info.code !== 'TA' ? (
          <div className="mt-6 flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-end">
            <div className="sm:w-64">
              <label htmlFor="w2-box12-amount" className="block text-sm font-medium text-slate-700">
                Box 12 Code {info.code} amount <span className="font-normal text-slate-500">(optional)</span>
              </label>
              <div className="mt-1.5">
                <CurrencyInput
                  id="w2-box12-amount"
                  value={amount}
                  onValueChange={setAmount}
                  placeholder="0"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={sendToCalculator}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-navy-700 px-5 py-2.5 font-medium text-white shadow-sm transition hover:bg-navy-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-500/50 focus-visible:ring-offset-2"
            >
              {amount !== null ? 'Use this amount in the calculator' : `Go to the ${info.code === 'TP' ? 'tips' : 'overtime'} calculator`}
              <span aria-hidden="true">↓</span>
            </button>
          </div>
        ) : (
          <p className="mt-6 border-t border-slate-200 pt-5 text-sm text-slate-600">
            Nothing to enter in the calculator for Code TA. Check Box 12 for Codes TP or TT instead.
          </p>
        )}
      </div>

      <p className="mt-4 text-sm text-slate-500">
        Tip: These amounts belong in <strong className="font-medium text-slate-700">Box 12</strong>. Some payroll
        providers also list tips or overtime in Box 14, which is a free-form box. Use the Box 12 amounts when they
        are available.
      </p>
    </section>
  );
}
