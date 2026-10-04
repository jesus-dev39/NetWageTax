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
- [ ] **Arizona: confirm the 2026 single standard deduction when ADOR publishes the 2026 forms.** The site
      uses $16,100: A.R.S. 43-1041 (https://www.azleg.gov/ars/43/01041.htm) lists $15,750 for a single
      filer, indexed "in the same manner" as the federal standard deduction (subsection H), and HB 4168
      (2026, signed June 13, 2026) conforms to the IRC as of January 1, 2026. Check the figure against the
      2026 Form 140 instructions or withholding tables. HB 4168 also adds a state subtraction for
      qualified tips and the overtime premium, matching the federal deduction (`AZ` is marked as
      following it, with a `tipsOvertimeNote`).
- [x] **Michigan: link the official notice.** Treasury's notice on the new deductions for qualified
      overtime and tips (https://www.michigan.gov/treasury/reference/taxpayer-notices/notice-regarding-new-deductions-for-qualified-overtime-compensation-and-qualified-tips)
      confirms `TIPS_OVERTIME_NOTES.MI` and "follows"; the April 15, 2026 rate notice confirms 4.25%.
- [ ] **Progressive states: review the 2026 data (October 2026).** Check `estimateRate`, `exemptAmount`,
      `bracketRange` and the note of every `GRAD` state against an official 2026 source, and add a
      `rateSource` for each one verified.
  - [x] **Arkansas:** 3.7% top rate (HB 1001, 2026 First Extraordinary Session), $2,470 standard deduction.
  - [x] **South Carolina:** 1.99% / 5.21% and the SCIAD deduction (H.4216, Act 110 of 2026), with brackets.
  - [x] **West Virginia:** 2026 schedule from SB 392 (2026), with brackets.
  - [x] **Nebraska, Oregon, Rhode Island, Vermont, Virginia:** 2026 exempt amounts and `estimateRate`
        recalibrated at $65,000. The bracket thresholds used for the calibration come from the Tax
        Foundation's February 2026 table: confirm them against each state's 2026 publication. Personal
        exemption credits (Arkansas $29, Nebraska $176) aren't applied; Oregon's $256 is (see below).
  - [x] **Maine:** $21,000 ($15,700 basic standard deduction + $5,300 personal exemption, MRS 2026
        withholding tables, revised August 2026), phased out above $102,250 of Maine income.
        https://www.maine.gov/revenue/sites/maine.gov.revenue/files/inline-files/26_wh_tab_instr_August2026.pdf
  - [x] **Hawaii:** $9,144 ($8,000 standard deduction under Act 46, Announcement 2024-03, + $1,144
        exemption). https://files.hawaii.gov/tax/news/announce/ann24-03.pdf
  - [x] **Wisconsin:** $9,274 at $65,000 ($13,960 less 12% of income over $20,120, + $700 exemption;
        Form 1-ES instructions, D-101A R. 1-26). https://www.revenue.wi.gov/TaxForms2026/2026-Form1-ES-Inst.pdf
  - [x] **Oregon:** `estimateRate` recalibrated to 7.03% with the federal income tax subtraction ($5,620
        at $65,000, under the cap) and the $256 exemption credit. Confirm the 2026 subtraction cap when
        the 2026 Form OR-40 instructions are published.
  - [x] **Vermont:** 2025 tax-year brackets (official rate schedule) with the inflation note, like
        California; 2026 personal exemption $5,400 (TaxTables-2026) + the 2025 standard deduction $7,650
        = $13,050; `estimateRate` 3.51% ($1,823 at $65,000). The "VT Rate Schedules" are withholding
        tables: don't use them for the income tax brackets.
  - [ ] Then the rest of the progressive states, alphabetically.
- [ ] **Vermont: 2026 brackets and standard deduction (January 2027).** When the "Tax Year 2026 Vermont
      Tax Rate Schedules" are published, replace `BRACKETS.VT` (now 2025) and set `year: 2026`, update the
      standard deduction in `exemptAmount` (now the 2025 $7,650 + the 2026 $5,400 exemption), and
      recalibrate `estimateRate` at $65,000.
- [ ] **South Carolina: 2027 bracket indexing (January 2027).** The $30,000 threshold is the 2026 figure;
      H.4216 indexes it under Section 12-6-520 starting in 2027. Update `BRACKETS.SC` and the
      `estimateRate` once SCDOR publishes the 2027 figure.
- [ ] **All states: review the 2027 data (January 15, 2027).** Rates, `exemptAmount`, `estimateRate`,
      `bracketRange`, notes, local tax notes, bracket tables and `sourceUrl` for all 50 states + DC.
      Then update `STATE_TAX_DATA_AS_OF`, `STATE_TAX_LAST_UPDATED` and the tax year shown on the pages.

- [ ] **Schedule 1-A: final 2026 form and instructions (when the IRS publishes them).** The senior deduction
      and car loan interest calculators follow the 2026 draft Schedule 1-A (https://www.irs.gov/pub/irs-dft/f1040s1a--dft.pdf)
      and the 2025 instructions. When the final form and the 2026 instructions are out, check the amounts,
      thresholds, the birth date cutoff (January 2, 1962), the car loan rounding (part steps rounded up), the
      vehicle and loan requirements (also in TD 10054, effective November 9, 2026), and the wording of each calculator against them,
      then remove `SCHEDULE_1A_DRAFT_NOTICE` (`src/lib/site.ts`) from their assumptions. The draft carries the
      total to Form 1040 line 13a (13b in 2025): the site cites no 1040 line numbers for 2026 until then.

## After the redesign ships

- [ ] **Bracket engine (approved October 4, 2026).** Replace `exemptAmount × estimateRate` with a
      calculation from `BRACKETS`, in the approved phases. The model has four pieces: deductions and
      exemptions, the bracket schedule, credits, and a **federal income tax deduction** (Oregon with
      its cap, Alabama, and Missouri). Decisions: Arkansas uses the schedule for net income up to
      $94,700, with a note for higher incomes; New York and Connecticut recapture stays a note, not part
      of the calculation; California's 1% Behavioral Health Services Tax is its own row in the
      calculation.
