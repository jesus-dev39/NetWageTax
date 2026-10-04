import { useMemo, useState } from 'react';
import { STANDARD_DEDUCTION_COVERS_NOTICE } from '../lib/deduction-summary';
import { calculateCarLoanInterestDeduction, type CarLoanIneligibilityReason } from '../lib/car-loan-interest';
import { compareFederalTax, isCoveredByStandardDeduction } from '../lib/marginal-rate';
import { CAR_LOAN_PARAMS_BY_YEAR, type FilingStatus } from '../lib/obbba-params';
import { SCHEDULE_1A_DRAFT_NOTICE } from '../lib/site';
import { FederalTaxRows, QualificationChecklist, ResultPanel, Row, minusUSD, type CheckItem } from './calculator-parts';
import CurrencyInput, { formatUSD } from './CurrencyInput';
import { Checkbox, Field, RadioGroup, type RadioOption } from './form';

const TAX_YEAR = 2026;
const PARAMS = CAR_LOAN_PARAMS_BY_YEAR[TAX_YEAR];
const STEP = PARAMS.phaseout.kind === 'step' ? PARAMS.phaseout : null;
const PER_STEP = formatUSD(STEP?.perStep ?? 0);
const NHTSA_VIN_DECODER = 'https://vpic.nhtsa.dot.gov/decoder/';

const FILING_STATUSES: RadioOption<FilingStatus>[] = [
  { value: 'single', label: 'Single' },
  { value: 'hoh', label: 'Head of household' },
  { value: 'mfj', label: 'Married filing jointly' },
  { value: 'mfs', label: 'Married filing separately' },
];

type YesNo = 'yes' | 'no';
const YES_NO: RadioOption<YesNo>[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];

const INELIGIBLE_COPY: Record<CarLoanIneligibilityReason, string> = {
  USED_VEHICLE: 'Used vehicles don’t qualify: the vehicle’s original use has to start with you.',
  ASSEMBLED_OUTSIDE_US: 'Only vehicles with final assembly in the United States qualify.',
};

export default function CarLoanInterestApp() {
  const [filingStatus, setFilingStatus] = useState<FilingStatus>('single');
  const [interest, setInterest] = useState<number | null>(null);
  const [magi, setMagi] = useState<number | null>(null);
  const [isNew, setIsNew] = useState<YesNo>('yes');
  const [usAssembled, setUsAssembled] = useState<YesNo>('yes');
  const [loanDate, setLoanDate] = useState(false);
  const [vehicleType, setVehicleType] = useState(false);
  const [personalUse, setPersonalUse] = useState(false);
  const [notLease, setNotLease] = useState(false);
  const [hasVin, setHasVin] = useState(false);

  const magiValue = magi ?? 0;
  const interestValue = interest ?? 0;

  const result = useMemo(
    () =>
      calculateCarLoanInterestDeduction({
        filingStatus,
        magi: magiValue,
        taxYear: TAX_YEAR,
        interestPaid: interestValue,
        isNewVehicle: isNew === 'yes',
        isUsAssembled: usAssembled === 'yes',
      }),
    [filingStatus, magiValue, interestValue, isNew, usAssembled],
  );

  const federal = compareFederalTax(magiValue, result.deductionFinal, filingStatus);
  const coveredByStandardDeduction = isCoveredByStandardDeduction(magiValue, filingStatus);
  const confirmations = [loanDate, vehicleType, personalUse, notLease, hasVin];
  const allConfirmed = confirmations.every(Boolean);

  const statusLine = result.ineligibilityReason
    ? INELIGIBLE_COPY[result.ineligibilityReason]
    : interestValue <= 0
      ? 'Enter the interest you paid to see your deduction.'
      : magiValue <= 0
        ? `Enter your MAGI to apply the phase-out above ${formatUSD(result.threshold)}.`
        : result.deductionFinal === 0
          ? 'Fully phased out at your MAGI.'
          : result.excessMagi > 0 && result.nextStepAboveMagi !== null
            ? `Drops by another ${PER_STEP} once MAGI passes ${formatUSD(result.nextStepAboveMagi)}.`
            : `The phase-out starts once MAGI passes ${formatUSD(result.threshold)}.`;

  const confirmItem = (key: string, label: string, checked: boolean, met: string, pending: string): CheckItem => ({
    key,
    label,
    status: checked ? 'pass' : 'pending',
    detail: checked ? met : pending,
  });

  const checklist: CheckItem[] = [
    {
      key: 'new',
      label: 'New vehicle',
      status: isNew === 'yes' ? 'pass' : 'fail',
      detail: isNew === 'yes' ? 'The vehicle’s original use started with you.' : 'Used vehicles don’t qualify.',
    },
    {
      key: 'assembly',
      label: 'Final assembly in the United States',
      status: usAssembled === 'yes' ? 'pass' : 'fail',
      detail: usAssembled === 'yes' ? 'Shown on the vehicle label or in the VIN’s plant of manufacture.' : 'Vehicles assembled outside the U.S. don’t qualify.',
    },
    confirmItem('loan', 'Loan taken out after December 31, 2024', loanDate, 'Secured by a first lien on the vehicle.', 'Confirm the loan date and the first lien (checkbox above).'),
    confirmItem('type', 'Qualifying vehicle type and weight', vehicleType, 'Car, minivan, van, SUV, pickup, or motorcycle under 14,000 pounds.', 'Confirm the vehicle type and weight (checkbox above).'),
    confirmItem('use', 'Mostly personal use', personalUse, 'You expect more than 50% personal use.', 'Confirm you expect more than 50% personal use (checkbox above).'),
    confirmItem('lease', 'Not a lease or a related-party loan', notLease, 'A purchase loan from an unrelated lender.', 'Confirm it isn’t a lease or a loan from a relative or related business (checkbox above).'),
    {
      key: 'vin',
      label: 'VIN on your return',
      status: hasVin ? 'pass' : 'pending',
      detail: 'The deduction isn’t allowed unless you enter each vehicle’s VIN on Schedule 1-A.',
      control: (
        <Checkbox id="car-vin" checked={hasVin} onChange={setHasVin}>
          I have the VIN (we never ask for it)
        </Checkbox>
      ),
    },
    {
      key: 'magi',
      label: 'Income phase-out',
      status:
        magiValue <= 0
          ? 'pending'
          : magiValue <= result.threshold
            ? 'pass'
            : result.deductionFinal > 0 || result.afterCap === 0
              ? 'warn'
              : 'fail',
      detail:
        magiValue <= 0
          ? 'Enter your MAGI above.'
          : magiValue <= result.threshold
            ? `Below the ${formatUSD(result.threshold)} phase-out threshold.`
            : `Above ${formatUSD(result.threshold)}: reduced ${PER_STEP} for each $1,000 or part of $1,000.`,
    },
    {
      key: 'schedule',
      label: 'Schedule 1-A, Part IV',
      status: result.deductionFinal > 0 && allConfirmed ? 'pass' : 'pending',
      detail:
        result.deductionFinal > 0
          ? allConfirmed
            ? `Claim ${formatUSD(result.deductionFinal)} on Schedule 1-A, Part IV; the total carries to Form 1040.`
            : 'Confirm the items above to complete eligibility.'
          : 'Complete the items above to see your Schedule 1-A amount.',
    },
  ];

  return (
    <section id="calculator" aria-labelledby="calculator-heading" className="scroll-mt-24">
      <h2 id="calculator-heading" className="text-2xl/[1.2] font-bold tracking-[-0.01em] text-ink md:text-[1.75rem]">
        Estimate your {TAX_YEAR} car loan interest deduction
      </h2>

      <div className="mt-6 grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-12">
        {/* ------------------------------ Inputs ------------------------------ */}
        <form className="flex flex-col gap-6 lg:col-span-7" onSubmit={(e) => e.preventDefault()} noValidate>
          <RadioGroup legend="Filing status" name="car-filing-status" options={FILING_STATUSES} value={filingStatus} onChange={setFilingStatus} />

          <Field
            id="car-interest"
            label={`Car loan interest paid in ${TAX_YEAR}`}
            hint="From Form 1098-VLI, box 1, for each qualifying loan. Leave out any interest you deduct on Schedule C, E, or F."
          >
            <div className="sm:max-w-xs">
              <CurrencyInput id="car-interest" value={interest} onValueChange={setInterest} placeholder="0" describedBy="car-interest-hint" />
            </div>
          </Field>

          <Field
            id="car-magi"
            label="Modified adjusted gross income (MAGI)"
            hint="Your adjusted gross income (AGI) from Form 1040. If you have foreign or U.S. territory income, your MAGI may be higher than your AGI."
          >
            <div className="sm:max-w-xs">
              <CurrencyInput id="car-magi" value={magi} onValueChange={setMagi} placeholder="65,000" describedBy="car-magi-hint" />
            </div>
          </Field>

          <RadioGroup legend="Was the vehicle new when you bought it?" name="car-new" options={YES_NO} value={isNew} onChange={setIsNew} inline />

          <div>
            <RadioGroup legend="Was its final assembly in the United States?" name="car-us-assembly" options={YES_NO} value={usAssembled} onChange={setUsAssembled} inline />
            <p className="mt-2 text-[15px] text-ink-2">
              Check the label on the vehicle, or enter the VIN in the{' '}
              <a href={NHTSA_VIN_DECODER} className="text-link underline underline-offset-[3px]" rel="noopener noreferrer" target="_blank">
                NHTSA VIN decoder
              </a>{' '}
              to see the plant of manufacture.
            </p>
          </div>

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 font-semibold text-ink">The loan and the vehicle</legend>
            <Checkbox id="car-loan-date" checked={loanDate} onChange={setLoanDate}>
              I took out the loan after December 31, 2024, to buy the vehicle, and it’s secured by a first lien on it.
            </Checkbox>
            <Checkbox id="car-vehicle-type" checked={vehicleType} onChange={setVehicleType}>
              It’s a car, minivan, van, SUV, pickup truck, or motorcycle with a gross vehicle weight rating under 14,000 pounds.
            </Checkbox>
            <Checkbox id="car-personal-use" checked={personalUse} onChange={setPersonalUse}>
              I expect to use it for personal use more than 50% of the time.
            </Checkbox>
            <Checkbox id="car-not-lease" checked={notLease} onChange={setNotLease}>
              It isn’t a lease, and the lender isn’t a relative or a business related to me.
            </Checkbox>
          </fieldset>

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
                Car loan interest deduction: <span className="font-semibold text-ink">{formatUSD(result.deductionFinal)}</span>
              </>
            }
            liveText={`Estimated federal income tax saved ${formatUSD(federal.saved)}. Car loan interest deduction ${formatUSD(result.deductionFinal)}.`}
          >
            {coveredByStandardDeduction && result.deductionFinal > 0 && <p className="mt-3 text-[15px] text-ink">{STANDARD_DEDUCTION_COVERS_NOTICE}</p>}
            {result.ineligibilityReason && <p className="mt-3 text-[15px] font-semibold text-ink">{INELIGIBLE_COPY[result.ineligibilityReason]}</p>}
          </ResultPanel>

          <section aria-labelledby="deduction-breakdown-heading">
            <h3 id="deduction-breakdown-heading" className="font-semibold text-ink">
              Deduction breakdown
            </h3>
            <dl className="num mt-2">
              <Row label="Interest you entered" value={formatUSD(interestValue)} />
              <Row label={`After the ${formatUSD(result.cap)} cap`} value={formatUSD(result.afterCap)} />
              <Row
                label={`MAGI over ${formatUSD(result.threshold)}`}
                hint={result.phaseoutSteps > 0 ? `${result.phaseoutSteps} ${result.phaseoutSteps === 1 ? 'step' : 'steps'} of $1,000, part steps rounded up` : undefined}
                value={formatUSD(result.excessMagi)}
              />
              <Row
                label="Phase-out reduction"
                hint={`${PER_STEP} per step, up to the amount after the cap`}
                value={minusUSD(result.reductionApplied)}
              />
              <Row label="Car loan interest deduction" value={formatUSD(result.deductionFinal)} strong />
            </dl>
            <p className="mt-2 text-sm text-ink-2">{statusLine}</p>
          </section>

          <FederalTaxRows comparison={federal} deductionLabel="car loan interest deduction" />

          <p className="border-l-4 border-warning bg-warning-tint px-4 py-3 text-[15px] text-ink">
            Estimates only, not tax advice. Savings assume the {TAX_YEAR} standard deduction and federal brackets and treat
            MAGI as AGI. {SCHEDULE_1A_DRAFT_NOTICE}{' '}
            <a href="/methodology/" className="text-link underline underline-offset-[3px]">
              How we calculate
            </a>
          </p>
        </aside>
      </div>
    </section>
  );
}
