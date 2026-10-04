import type { PayFrequency, PaycheckFilingStatus, PayMode } from '../lib/paycheck';
import type { RadioOption } from './form';

/**
 * Sentence-case option labels for the paycheck forms (home page estimate and full calculator).
 * lib/paycheck.ts keeps its own labels for the exports.
 */

export const PAY_MODE_OPTIONS: RadioOption<PayMode>[] = [
  { value: 'salary', label: 'Salary' },
  { value: 'hourly', label: 'Hourly' },
];

export const FREQUENCY_OPTIONS: { value: PayFrequency; label: string }[] = [
  { value: 'weekly', label: 'Every week' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'semimonthly', label: 'Twice a month' },
  { value: 'monthly', label: 'Every month' },
];

export const FILING_OPTIONS: RadioOption<PaycheckFilingStatus>[] = [
  { value: 'single', label: 'Single' },
  { value: 'mfj', label: 'Married filing jointly' },
  { value: 'hoh', label: 'Head of household' },
];
