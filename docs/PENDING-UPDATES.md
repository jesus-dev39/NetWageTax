# Pending data updates

Tasks for keeping the tax data current. Federal figures live in `src/lib/marginal-rate.ts` and
`src/lib/fica.ts`; state data lives in `src/lib/state-tax-data.ts`, with bracket tables in its
`BRACKETS` map. Tick an item when it's done, and update `STATE_TAX_LAST_UPDATED` after every review
(the status strip and /methodology/ show it as "rules last checked").

The review schedule is published on /methodology/: federal and FICA figures when the IRS and SSA
publish the next year's numbers, and all states every January.

## Scheduled

- [ ] **Federal and FICA: 2027 figures (mid-November 2026).** Once the IRS publishes its 2027
      inflation adjustments (Revenue Procedure) and the SSA announces the 2027 wage base, update the
      brackets and standard deductions in `marginal-rate.ts`, the Social Security wage base in
      `fica.ts`, and check the tips and overtime parameters in `obbba-params.ts`. Decide with the
      January state review when the site switches `SITE_TAX_YEAR` to 2027.
- [ ] **New York: switch the bracket source (Dec 2026–Jan 2027).** Once the 2026 Form IT-201
      instructions are published, replace `bracketsSource` (currently the NYS-50-T-NYS withholding
      tables) with the IT-201 instructions' tax rate schedule, and confirm the single-filer brackets
      match the ones on the page.
- [ ] **California: update to the 2026 brackets when the FTB publishes them.** Replace the 2025
      schedule in `BRACKETS.CA` and set `year: 2026`. The inflation note above the table then
      disappears on its own (it only shows when `bracketsYear` is before 2026).
- [ ] **Georgia: check the 2027 rate and standard deduction (January 2027).** HB 463 (2026) cuts the
      rate by 0.125 point a year toward 3.99% only if state revenue conditions are met: confirm whether
      2027 is 4.865% or stays at 4.99%. The single standard deduction rises to $15,000 in 2027 (update
      `exemptAmount` from $12,000), with later $375 steps also tied to revenue. The state's own
      tips/overtime exclusion ($1,750 each) runs through 2028. Source: `RATE_SOURCES.GA`.
- [ ] **Arizona: confirm the 2026 single standard deduction (pending decision).** The site uses
      $16,100. A.R.S. 43-1041 (https://www.azleg.gov/ars/43/01041.htm) now lists $15,750 for a single
      filer, indexed for inflation "in the same manner" as the federal standard deduction (subsection H),
      and A.R.S. 43-105 conforms to the Internal Revenue Code as in effect on January 1, 2026 (HB 4168,
      2026 omnibus). That points to $16,100 for 2026, not $8,350, but azdor.gov blocked automated access
      and the figure isn't confirmed by an ADOR publication yet (2026 Form 140 instructions or
      withholding tables). Confirm before changing `exemptAmount` or the note.
- [ ] **Michigan: link the official notice.** `TIPS_OVERTIME_NOTES.MI` is based on Treasury's notice
      "New Deductions for Qualified Overtime Compensation and Qualified Tips" (January 6, 2026), which
      blocked automated access. Open it in a browser, confirm the wording, and check the 2026 rate
      (Treasury's April 15, 2026 rate determination; the site uses 4.25%).
- [ ] **Progressive states: review the 2026 data (October 2026).** Check `estimateRate`, `exemptAmount`,
      `bracketRange` and the note of every `GRAD` state against an official 2026 source, and add a
      `rateSource` for each one verified. Start with the states that changed in 2026:
  - [ ] **Arkansas:** top rate cut to 3.7% for 2026, retroactive to January 1. Update `bracketRange`
        (currently 2%–3.9%), the note ("Top rate cut to 3.9% in 2024") and recalibrate `estimateRate`.
  - [ ] **South Carolina:** 2026 rate changes. Check the brackets (currently 0%, 3% and 6%) and the
        top rate.
  - [ ] **West Virginia:** 2026 rate cut. Replace the "2025 schedule shown" note and update
        `bracketRange` (currently 2.22%–4.82%) and `estimateRate`.
  - [ ] Then the rest of the progressive states, alphabetically.
- [ ] **All states: review the 2027 data (January 15, 2027).** Rates, `exemptAmount`, `estimateRate`,
      `bracketRange`, notes, local tax notes, bracket tables and `sourceUrl` for all 50 states + DC.
      Then update `STATE_TAX_DATA_AS_OF`, `STATE_TAX_LAST_UPDATED` and the tax year shown on the pages.
