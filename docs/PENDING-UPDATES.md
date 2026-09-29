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
- [ ] **All states: review the 2027 data (January 15, 2027).** Rates, `exemptAmount`, `estimateRate`,
      `bracketRange`, notes, local tax notes, bracket tables and `sourceUrl` for all 50 states + DC.
      Then update `STATE_TAX_DATA_AS_OF`, `STATE_TAX_LAST_UPDATED` and the tax year shown on the pages.
