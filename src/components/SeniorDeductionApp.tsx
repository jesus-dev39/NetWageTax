import { useMemo, useState } from 'react';
import { STANDARD_DEDUCTION_COVERS_NOTICE } from '../lib/deduction-summary';
import {
  ADDITIONAL_STANDARD_DEDUCTION_AGED_2026,
  agedAdditionalStandardDeduction,
  compareFederalTax,
  isCoveredByStandardDeduction,
} from '../lib/marginal-rate';
import { SENIOR_PARAMS_BY_YEAR, seniorBirthCutoffLabel, type FilingStatus } from '../lib/obbba-params';
import { calculateSeniorDeduction, SENIOR_MFS_NOTE as MFS_NOTE, seniorIneligibilityNote } from '../lib/senior-deduction';
import { buildSeniorSummary } from '../lib/schedule-1a-summary';
import { SCHEDULE_1A_DRAFT_NOTICE } from '../lib/site';
import { FederalTaxRows, QualificationChecklist, ResultPanel, Row, minusUSD, type CheckItem } from './calculator-parts';
import CurrencyInput, { formatUSD } from './CurrencyInput';
import ExportActions from './ExportActions';
import Schedule1aVoucher from './Schedule1aVoucher';
import { Checkbox, Field, RadioGroup, type RadioOption } from './form';

const TAX_YEAR = 2026;
const CUTOFF = seniorBirthCutoffLabel(TAX_YEAR);
const PHASEOUT = SENIOR_PARAMS_BY_YEAR[TAX_YEAR].phaseout;
const RATE = PHASEOUT.kind === 'rate' ? PHASEOUT.rate : 0;
const RATE_LABEL = `${+(RATE * 100).toFixed(2)}%`;

const FILING_STATUSES: RadioOption<FilingStatus>[] = [
  { value: 'single', label: 'Single' },
  { value: 'hoh', label: 'Head of household' },
  { value: 'mfj', label: 'Married filing jointly' },
  { value: 'mfs', label: 'Married filing separately', hint: 'Can’t claim this deduction: married couples must file jointly.', disabled: true },
];

type YesNo = 'yes' | 'no';
const YES_NO: RadioOption<YesNo>[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];

export default function SeniorDeductionApp() {
  const [filingStatus, setFilingStatus] = useState<FilingStatus>('single');
  const [taxpayer65, setTaxpayer65] = useState<YesNo>('yes');
  const [spouse65, setSpouse65] = useState<YesNo>('no');
  const [magi, setMagi] = useState<number | null>(null);
  const [hasSsn, setHasSsn] = useState(false);

  const isMfj = filingStatus === 'mfj';
  const isMfs = filingStatus === 'mfs';
  const magiValue = magi ?? 0;

  const result = useMemo(
    () =>
      calculateSeniorDeduction({
        filingStatus,
        magi: magiValue,
        taxYear: TAX_YEAR,
        taxpayerIs65: taxpayer65 === 'yes',
        spouseIs65: spouse65 === 'yes',
      }),
    [filingStatus, magiValue, taxpayer65, spouse65],
  );

  // People 65 or older on the return also get the regular additional standard deduction (IRC §63(f)).
  const people65 = (taxpayer65 === 'yes' ? 1 : 0) + (isMfj && spouse65 === 'yes' ? 1 : 0);
  const extraStandardDeduction = agedAdditionalStandardDeduction(filingStatus, people65);
  const federal = compareFederalTax(magiValue, result.deductionFinal, filingStatus, extraStandardDeduction);
  const coveredByStandardDeduction = isCoveredByStandardDeduction(magiValue, filingStatus, extraStandardDeduction);

  const notQualifyingNote = result.ineligibilityReason === 'NO_QUALIFYING_PERSON' ? seniorIneligibilityNote(result) : null;

  const statusLine = isMfs
    ? MFS_NOTE
    : notQualifyingNote
      ? notQualifyingNote
      : magiValue <= 0
        ? `Enter your MAGI to apply the phase-out above ${formatUSD(result.threshold)}.`
        : result.isFullyPhasedOut
          ? `Fully phased out at ${formatUSD(result.fullPhaseoutMagi)} of MAGI.`
          : result.excessMagi > 0
            ? `Each $1,000 more of MAGI lowers it by ${formatUSD(RATE * 1_000)} per person, reaching $0 at ${formatUSD(result.fullPhaseoutMagi)}.`
            : `Below the ${formatUSD(result.threshold)} phase-out threshold: no reduction.`;

  const checklist: CheckItem[] = [
    {
      key: 'age',
      label: `You: age 65 by December 31, ${TAX_YEAR}`,
      status: taxpayer65 === 'yes' ? 'pass' : 'fail',
      detail: taxpayer65 === 'yes' ? `Born before ${CUTOFF}.` : `Born on or after ${CUTOFF}: you don’t qualify for ${TAX_YEAR}.`,
    },
    {
      key: 'spouse-age',
      label: `Spouse: age 65 by December 31, ${TAX_YEAR}`,
      status: !isMfj ? 'na' : spouse65 === 'yes' ? 'pass' : 'fail',
      detail: !isMfj
        ? 'Only needed on a joint return.'
        : spouse65 === 'yes'
          ? `Born before ${CUTOFF}: adds a second ${formatUSD(result.amountPerPerson)}.`
          : `Your spouse doesn’t add a second ${formatUSD(result.amountPerPerson)}.`,
    },
    {
      key: 'ssn',
      label: 'Valid Social Security number',
      status: hasSsn ? 'pass' : 'pending',
      detail: 'Each person claiming it needs an SSN valid for employment, issued by the return’s due date. ITINs don’t qualify.',
      control: (
        <Checkbox id="senior-has-ssn" checked={hasSsn} onChange={setHasSsn}>
          {isMfj ? 'Each of us who qualifies has a valid SSN' : 'I have a valid SSN'} (we never ask for the number)
        </Checkbox>
      ),
    },
    {
      key: 'filing',
      label: 'Eligible filing status',
      status: isMfs ? 'fail' : 'pass',
      detail: isMfs ? 'Married couples must file jointly to claim it.' : `${FILING_STATUSES.find((f) => f.value === filingStatus)!.label} can claim it.`,
    },
    {
      key: 'magi',
      label: 'Income phase-out',
      status:
        magiValue <= 0
          ? 'pending'
          : magiValue <= result.threshold
            ? 'pass'
            : result.isFullyPhasedOut
              ? 'fail'
              : 'warn',
      detail:
        magiValue <= 0
          ? 'Enter your MAGI above.'
          : magiValue <= result.threshold
            ? `Below the ${formatUSD(result.threshold)} phase-out threshold.`
            : result.isFullyPhasedOut
              ? `Fully phased out at ${formatUSD(result.fullPhaseoutMagi)} of MAGI.`
              : `Above ${formatUSD(result.threshold)}: reduced by ${RATE_LABEL} of the excess.`,
    },
    {
      key: 'schedule',
      label: 'Schedule 1-A, Part V',
      status: result.deductionFinal > 0 && hasSsn ? 'pass' : 'pending',
      detail:
        result.deductionFinal > 0
          ? hasSsn
            ? `Claim ${formatUSD(result.deductionFinal)} on Schedule 1-A, Part V; the total carries to Form 1040.`
            : 'Confirm the SSN to complete eligibility.'
          : 'Complete the items above to see your Schedule 1-A amount.',
    },
  ];

  return (
    <section id="calculator" aria-labelledby="calculator-heading" className="scroll-mt-24">
      <h2 id="calculator-heading" className="text-2xl/[1.2] font-bold tracking-[-0.01em] text-ink md:text-[1.75rem]">
        Estimate your {TAX_YEAR} senior deduction
      </h2>

      <div className="mt-6 grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-12">
        {/* ------------------------------ Inputs ------------------------------ */}
        <form className="flex flex-col gap-6 lg:col-span-7" onSubmit={(e) => e.preventDefault()} noValidate>
          <RadioGroup legend="Filing status" name="senior-filing-status" options={FILING_STATUSES} value={filingStatus} onChange={setFilingStatus} />

          <RadioGroup legend={`Were you born before ${CUTOFF}?`} name="senior-taxpayer-65" options={YES_NO} value={taxpayer65} onChange={setTaxpayer65} inline />

          {isMfj && (
            <RadioGroup legend={`Was your spouse born before ${CUTOFF}?`} name="senior-spouse-65" options={YES_NO} value={spouse65} onChange={setSpouse65} inline />
          )}

          <Field
            id="senior-magi"
            label="Modified adjusted gross income (MAGI)"
            hint="Your adjusted gross income (AGI) from Form 1040, which includes the taxable part of your Social Security benefits. If you have foreign or U.S. territory income, your MAGI may be higher than your AGI."
          >
            <div className="sm:max-w-xs">
              <CurrencyInput id="senior-magi" value={magi} onValueChange={setMagi} placeholder="65,000" describedBy="senior-magi-hint" />
            </div>
          </Field>

          <QualificationChecklist title={`${TAX_YEAR} filing checklist`} items={checklist} />
        </form>

        {/* ------------------------------ Results ----------------------------- */}
        <aside aria-labelledby="results-heading" className="flex flex-col gap-6 lg:sticky lg:top-24 lg:col-span-5 lg:self-start">
          <ResultPanel
            id="results-heading"
            label="Federal income tax saved"
            value={formatUSD(federal.saved)}
            context={
              <>
                Senior deduction: <span className="font-semibold text-ink">{formatUSD(result.deductionFinal)}</span>
              </>
            }
            liveText={`Estimated federal income tax saved ${formatUSD(federal.saved)}. Senior deduction ${formatUSD(result.deductionFinal)}.`}
          >
            {coveredByStandardDeduction && result.deductionFinal > 0 && <p className="mt-3 text-[15px] text-ink">{STANDARD_DEDUCTION_COVERS_NOTICE}</p>}
            {isMfs && <p className="mt-3 text-[15px] font-semibold text-ink">{MFS_NOTE}</p>}
          </ResultPanel>

          <section aria-labelledby="deduction-breakdown-heading">
            <h3 id="deduction-breakdown-heading" className="font-semibold text-ink">
              Deduction breakdown
            </h3>
            <dl className="num mt-2">
              <Row
                label="Maximum deduction"
                hint={`${formatUSD(result.amountPerPerson)} × ${result.qualifyingPeople} qualifying ${result.qualifyingPeople === 1 ? 'person' : 'people'}`}
                value={formatUSD(result.maxDeduction)}
              />
              <Row label={`MAGI over ${formatUSD(result.threshold)}`} value={formatUSD(result.excessMagi)} />
              <Row
                label="Phase-out reduction"
                hint={
                  result.qualifyingPeople === 2
                    ? `${RATE_LABEL} of the excess, ${formatUSD(result.reductionPerPerson)} from each person’s ${formatUSD(result.amountPerPerson)}`
                    : `${RATE_LABEL} of the excess, up to ${formatUSD(result.amountPerPerson)}`
                }
                value={minusUSD(result.reductionTotal)}
              />
              <Row label="Senior deduction" value={formatUSD(result.deductionFinal)} strong />
            </dl>
            <p className="mt-2 text-sm text-ink-2">{statusLine}</p>
          </section>

          <FederalTaxRows comparison={federal} deductionLabel="senior deduction" />

          <ExportActions
            heading={`Save your ${TAX_YEAR} senior deduction worksheet`}
            canExport={magiValue > 0}
            disabledHint="Enter your MAGI to enable exports."
            title={`Your ${TAX_YEAR} senior deduction worksheet`}
            build={(at) =>
              buildSeniorSummary(
                { result, federal, coveredByStandardDeduction, taxpayerIs65: taxpayer65 === 'yes', spouseIs65: isMfj && spouse65 === 'yes' },
                at,
              )
            }
            voucher={(summary) => <Schedule1aVoucher summary={summary} />}
            docx={async (s) => (await import('../lib/schedule-1a-docx')).downloadSchedule1aDocx(s)}
            xlsx={async (s) => (await import('../lib/schedule-1a-xlsx')).downloadSchedule1aXlsx(s)}
          />

          <p className="border-l-4 border-warning bg-warning-tint px-4 py-3 text-[15px] text-ink">
            Estimates only, not tax advice. Savings assume the {TAX_YEAR} standard deduction, plus{' '}
            {formatUSD(ADDITIONAL_STANDARD_DEDUCTION_AGED_2026.unmarried)} ({formatUSD(ADDITIONAL_STANDARD_DEDUCTION_AGED_2026.married)} per
            spouse if married) for each person 65 or older, and the federal brackets, and treat MAGI as AGI.{' '}
            {SCHEDULE_1A_DRAFT_NOTICE}{' '}
            <a href="/methodology/" className="text-link underline underline-offset-[3px]">
              How we calculate
            </a>
          </p>
        </aside>
      </div>
    </section>
  );
}
