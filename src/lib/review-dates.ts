/**
 * review-dates.ts
 * When the rules behind the estimates were last checked by hand. The status strip and /methodology/
 * build their wording from these dates; each state page shows its own date (`reviewed` in
 * state-tax-data.ts). Never write a date here that wasn't an actual check against the official source.
 */
import { formatLongDate } from './site';

/**
 * Federal income tax figures used by the calculators (brackets, standard deduction, and the
 * additional amount for age): checked against IRS Rev. Proc. 2025-32 on November 12, 2026.
 */
export const FEDERAL_INCOME_TAX_CHECKED: string = '2026-11-12';

/**
 * FICA figures (Social Security wage base, Medicare rates and thresholds): date they were last
 * checked against the SSA. The 2026 wage base ($184,500) was entered on September 26, 2026 and
 * hasn't been rechecked since. When it's confirmed on the same day as the federal check, the strip
 * says "Federal and FICA figures".
 */
export const FICA_FIGURES_CHECKED: string = '2026-09-26';

/** When the next review of all 50 states and DC is due (shown as "January 2027"). */
export const NEXT_FULL_STATE_REVIEW = '2027-01';

export const nextFullStateReviewLabel = () =>
  new Date(`${NEXT_FULL_STATE_REVIEW}-15T12:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

/** "Federal figures" or "Federal and FICA figures", depending on the dates. */
export const federalFiguresLabel = (federal = FEDERAL_INCOME_TAX_CHECKED, fica = FICA_FIGURES_CHECKED) =>
  fica === federal ? 'Federal and FICA figures' : 'Federal figures';

/**
 * Site-wide status strip: "Tax year 2026 · Federal figures checked November 12, 2026 · How we calculate".
 * The state review dates are explained on /methodology/ and shown on each state page.
 */
export function statusStripText(): { federal: string; federalDate: string } {
  return { federal: `${federalFiguresLabel()} checked`, federalDate: formatLongDate(FEDERAL_INCOME_TAX_CHECKED) };
}
