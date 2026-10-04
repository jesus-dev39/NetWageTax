import { useState } from 'react';
import CurrencyInput from './CurrencyInput';
import { Field, RadioGroup } from './form';
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
    <section aria-labelledby="w2-decoder-heading">
      <h2 id="w2-decoder-heading" className="text-2xl/[1.2] font-bold tracking-[-0.01em] text-ink md:text-[1.75rem]">
        Decode your Form W-2, Box 12
      </h2>
      <p className="mt-2 max-w-3xl text-ink-2">
        The 2026 Form W-2 adds three new Box 12 codes (for 2025, many employers reported these amounts in Box 14 instead).
        Choose the code you see on your form to learn what it means.
      </p>

      <div className="mt-6 grid gap-8 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-4">
          <RadioGroup
            legend="Code on your W-2"
            name="w2-code"
            options={CODES.map((c) => ({ value: c.code, label: `Code ${c.code}`, hint: c.shortLabel }))}
            value={selected}
            onChange={selectCode}
          />
        </div>

        <div className="lg:col-span-8" aria-live="polite">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h3 className="text-xl/[1.3] font-bold text-ink">{info.officialTitle}</h3>
            <span
              className={`shrink-0 rounded-[2px] px-2 py-0.5 text-sm font-semibold ${
                info.qualifies ? 'bg-green-tint text-green' : 'bg-surface text-ink-2'
              }`}
            >
              {info.qualifies ? 'Qualifies for the deduction' : 'Doesn’t qualify'}
            </span>
          </div>

          <dl className="mt-3 border-t border-line">
            {[
              ['In plain English', info.definition],
              ['Does it qualify?', info.qualifiesNote],
              ['Where it goes on your return', info.formImpact],
            ].map(([term, text]) => (
              <div key={term} className="border-b border-line py-3">
                <dt className="font-semibold text-ink">{term}</dt>
                <dd className="mt-0.5 text-ink-2">{text}</dd>
              </div>
            ))}
          </dl>

          {info.watchOut && (
            <p className="mt-4 border-l-4 border-warning bg-warning-tint px-4 py-3 text-ink">
              <span className="font-semibold">Watch out: </span>
              {info.watchOut}
            </p>
          )}

          {info.code !== 'TA' ? (
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
              <Field id="w2-box12-amount" label={<>Code {info.code} amount <span className="font-normal text-ink-2">(optional)</span></>} className="sm:w-64">
                <CurrencyInput id="w2-box12-amount" value={amount} onValueChange={setAmount} placeholder="0" />
              </Field>
              <button
                type="button"
                onClick={sendToCalculator}
                className="inline-flex h-11 items-center justify-center rounded-control border-2 border-ink bg-page px-5 font-semibold text-ink transition-colors duration-150 hover:bg-surface"
              >
                {amount !== null ? 'Use this amount in the calculator' : `Go to the ${info.code === 'TP' ? 'tips' : 'overtime'} fields`}
              </button>
            </div>
          ) : (
            <p className="mt-5 text-ink-2">Nothing to enter in the calculator for code TA. Check Box 12 for codes TP or TT instead.</p>
          )}

          <p className="mt-5 text-[15px] text-ink-2">
            These amounts belong in Box 12. Some payroll providers also list tips or overtime in Box 14, which is a
            free-form box. Use the Box 12 amounts when they are available.{' '}
            <a href="/guides/w2-box-12-guide/" className="text-link underline underline-offset-[3px]">
              See every Box 12 code
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
