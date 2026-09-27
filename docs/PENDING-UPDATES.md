# Pending data updates

Tasks for keeping the state tax data current. State data lives in `src/lib/state-tax-data.ts`;
bracket tables are in the `BRACKETS` map there. Tick an item when it's done, and update
`STATE_TAX_LAST_UPDATED` whenever the data changes.

## Scheduled

- [ ] **New York: switch the bracket source (Dec 2026–Jan 2027).** Once the 2026 Form IT-201
      instructions are published, replace `bracketsSource` (currently the NYS-50-T-NYS withholding
      tables) with the IT-201 instructions' tax rate schedule, and confirm the single-filer brackets
      match the ones on the page.
- [ ] **California: update to the 2026 brackets when the FTB publishes them.** Replace the 2025
      schedule in `BRACKETS.CA` and set `year: 2026`. The inflation note above the table then
      disappears on its own (it only shows when `bracketsYear` is before 2026).
- [ ] **All states: review the 2027 data in January 2027.** Rates, `exemptAmount`, `estimateRate`,
      `bracketRange`, notes, local tax notes, bracket tables and `sourceUrl` for all 50 states + DC.
      Then update `STATE_TAX_DATA_AS_OF`, `STATE_TAX_LAST_UPDATED` and the tax year shown on the pages.
