# NetWageTax design system

> **Status: approved September 29, 2026; being rolled out in phases (see §10).**
> Screenshots of the site before the redesign: `docs/design-audit/current/`.
> Home page mockup: `docs/design-audit/proposal/hero-mockup.html` (screenshots `hero-*.png`).

The goal is a **plain, clear public tool**. We borrow the working method of the GOV.UK Design
System (large type, obvious forms, no decoration, the task comes first) and the way NerdWallet's
calculators present results (big result on top, breakdown in rows, assumptions in view). We don't
copy their colors, typefaces, or signature components (GOV.UK's yellow focus state and
bottom-shadow buttons, NerdWallet's green).

## 1. Principles

1. **The number is the product.** The largest thing on any page is a calculated figure, not a
   slogan. Figures are always tabular and right-aligned in tables.
2. **Show assumptions instead of making promises.** Instead of "100% private", "Instant", or
   "Smart", state the tax year, the date the rules were last checked, and what the estimate
   assumes (standard deduction, no 401(k), and so on).
3. **One color, one meaning.** Green is the primary action and net pay. Blue is a link. Every
   other color exists only inside breakdown charts.
4. **Borders, not shadows.** Hierarchy comes from spacing, type size, and 1px rules. No
   gradients, blurs, glows, or floating cards.
5. **Lists before cards.** Several items of the same kind are a list with dividers. A bordered
   panel is reserved for the calculator.
6. **Say each fact once per page.** Don't repeat "50 states + DC" or "runs in your browser" in
   the headline, a stats strip, the cards, and the footer.

## 2. Color

Every text pair meets WCAG 2.2 AA (at least 4.5:1); most meet AAA. Ratios below are measured.
Tokens live in `src/styles/global.css` as `--color-*` and switch values under `.dark`, so
components use one class (`text-ink`, `border-line`) with no `dark:` variant.

### Light

| Token | Hex | Use | Contrast |
|---|---|---|---|
| `ink` | `#1a1f24` | Body text, radio and checkbox borders | 16.6 on white |
| `ink-2` | `#4b5560` | Secondary text, field hints, row labels | 7.6 |
| `muted` | `#6b7580` | Small metadata only (dates, sources) | 4.7 |
| `field` | `#5f6b77` | Input and select borders (2px) | 5.5 (3:1 needed) |
| `line` | `#d5d9de` | Dividers and panel borders (1px) | decorative |
| `surface` | `#f3f4f5` | Status strip, table headers, `$` prefix | — |
| `page` | `#ffffff` | Page background (white, not gray) | — |
| `green` | `#0d6b47` | Primary button, net-pay figure, logo | 6.5 (white text on it: 6.5) |
| `green-hover` | `#0a5639` | Primary button hover and active | 8.7 |
| `green-tint` | `#e9f3ee` | Result panel background | `ink` on it: 14.6 |
| `link` | `#1c5da8` | Links (always underlined in running text) and focus ring | 6.6 |
| `error` | `#b3261e` | Validation errors | 6.5 |
| `warning` | `#a56a12` | Notice border (background `warning-tint` `#fbf5e9`) | 4.5 |

### Dark

| Token | Hex | Contrast on `page` |
|---|---|---|
| `page` | `#111417` | — |
| `surface` | `#1a1e22` | — |
| `line` | `#343a41` | decorative |
| `field` | `#7d8894` | 5.1 |
| `ink` | `#eceef0` | 15.9 |
| `ink-2` | `#a9b1ba` | 8.5 |
| `muted` | `#8d96a0` | 6.2 |
| `green` | `#4cc38a` | 8.3 (`page`-colored text on it: 8.3) |
| `green-hover` | `#6fd3a2` | 10.1 |
| `green-tint` | `#15271f` | `ink` on it: 13.5 |
| `link` | `#7eb3ef` | 8.4 |
| `error` | `#f2958c` | 8.3 |
| `warning` | `#e0a64a` | 8.6 (`warning-tint` `#2a2215`) |

### Data colors

Used only in breakdown bars and their legends, always next to a text label.

| Token | Light | Dark | Meaning |
|---|---|---|---|
| `data-net` | `#0d6b47` | `#4cc38a` | Net / take-home pay |
| `data-federal` | `#3c5a82` | `#8fa9cc` | Federal income tax |
| `data-fica` | `#a56a12` | `#e0a64a` | Social Security + Medicare |
| `data-state` | `#7a4f93` | `#b996d0` | State income tax |

### Retired

The emerald/teal/cyan gradients, the `navy` scale (only used for links and hovers), the sky,
violet, and amber accents on cards and icons, `ink #0b0f19` as a results background, the
gradient `btn-primary` utility, and the `glow-emerald` utility.

## 3. Typography

**Typeface: [Public Sans](https://public-sans.digital.gov/)** (variable, 100–900), self-hosted
through `@fontsource-variable/public-sans` as today.

- It's the U.S. Web Design System typeface: it reads as a U.S. public service without imitating
  GOV.UK. SIL Open Font License.
- It has true tabular figures. Checked in Chrome: with `tabular-nums`, "1111" and "0000" are
  the same width (112px); without it, 68.5px vs. 102.8px.
- One family only. No monospace for numbers.

**Figures:** every amount, percentage, and tax rate uses
`font-variant-numeric: tabular-nums lining-nums` (the `.num` utility; on by default for
`table`, result `dl`s, and numeric inputs). Right-align figures in tables. Use a true minus
sign (`−`, U+2212) for deductions.

**Scale** (desktop / mobile, px; line height in parentheses):

| Role | Desktop | Mobile | Weight |
|---|---|---|---|
| Result figure | 48 (1.05) | 40 | 700 |
| H1 | 44 (1.1) | 32 (1.15) | 700, tracking −0.02em |
| H2 | 28 (1.2) | 24 | 700 |
| H3 | 20 (1.3) | 19 | 700 |
| Lead paragraph | 20 (1.5) | 18 | 400, `ink-2` |
| Body | 17 (1.55) | 16 | 400 |
| Field label | 16 | 16 | 600 |
| Hint, note, footer | 15 / 14 | 14 | 400, `ink-2` |

Rules: weights 400, 600, and 700 only. No letter-spaced ALL CAPS labels ("eyebrows"). Headings
in sentence case ("Figure out your take-home pay"), not Title Case. Maximum reading width 68ch.

**Copy:** U.S. English, with the serial comma ("Social Security, Medicare, and state tax").
Dates are written "September 27, 2026", in running text and in the status strip alike.

## 4. Spacing and layout

- 4px base. Scale: 4, 8, 12, 16, 20, 24, 32, 48, 64, 96.
- Container: 1120px max width; side gutters 16px (mobile), 24px (tablet), 32px (desktop).
- Between page sections: 64px on desktop, 40px on mobile, separated by a `line` rule rather
  than alternating white and gray backgrounds.
- Inside forms: 20px between fields, 6px between a label and its input.
- Touch targets at least 44px.

## 5. Radius, borders, shadows, and motion

| | Value | Where |
|---|---|---|
| Control radius | 4px | Buttons, inputs, selects |
| Panel radius | 6px | Calculator, notices |
| No radius | 0 | Tables, lists, strips, breakdown bars |
| Circle | 50% | Radio inputs only |
| Panel border | 1px `line` | |
| Field border | 2px `field` | Heavier than panels so it's clear where to type |
| Shadow | none | Only exception: menus and modals, `0 8px 24px rgb(26 31 36 / .12)` |
| Focus | 3px `link` outline, 2px offset | Every interactive element |

Motion: only 150ms color transitions and the width of breakdown bars. Remove the pulse, the
floating card, the drawn chart line, hover `translate`, and the animated counter on the result
figure (it's hard to read and delays the number).

## 6. Components

- **Site header.** Solid white background, 1px bottom rule, no `backdrop-blur`. Logo, five short
  links ("Paycheck", "Tips & overtime", "State taxes", "W-2 codes", "About"), and the dark mode
  toggle. "Contact" lives in the footer only. On mobile, the toggle plus a "Menu" text button.
- **Status strip** (replaces the "2026 OBBBA TAX LAW ACTIVE" pill): a `surface` band under the
  header on every page: "**Tax year 2026.** Federal, FICA, and state rules last checked
  September 27, 2026. How we calculate". The date comes from `STATE_TAX_LAST_UPDATED`; the link
  goes to `/methodology/`.
- **Primary button.** `green` fill, white 600 text, 44px tall, 4px radius, flat. One primary
  button per view. **Secondary:** white with a 2px `ink` border. **Tertiary:** underlined link.
- **Money field.** Input with a `$` prefix in a `surface` box separated by 1px, 2px `field`
  border, figure in `.num` at 18px. Hints go under the label, not inside the input.
- **Choices.** Real radios (22px circle) for 2–3 options; a native `select` for 4 or more (pay
  frequency, state). The black segmented control is retired.
- **Result panel.** `green-tint` background, no gradient: a label ("Take-home per paycheck"),
  the 48px figure in `ink`, a context line ("$52,451 a year, 26 paychecks"), a flat 10px
  breakdown bar, and item/amount rows. Assumptions underneath at 14px.
- **Summary list** (replaces the four fact cards on state pages): `dt`/`dd` rows with a 1px
  divider, label in `ink-2` on the left, value in 600 on the right.
- **Table.** `surface` header in sentence case (not uppercase), 15px text, 1px row rules,
  right-aligned figures, total row in 700 with a 2px `ink` top rule.
- **Notice.** 4px left border (`warning` or `line`), very light background, `ink` text, no icon.
- **Tool list** (replaces icon cards): a 19px title link plus a one-line description, rows
  separated by 1px; three columns on desktop.
- **Link columns** (for long link sets such as the 51 states): a heading with a count in
  `ink-2`, then plain underlined text links in CSS columns. No chips or bordered pills.
- **Status tag** (data only, e.g. "No state income tax"): 14px 600 text on `green-tint`, 2px
  radius, no check mark or ring.
- **Icons.** No decorative icons. Functional icons only (menu, theme toggle, select chevron,
  external link), 16–20px with a 2px stroke.
- **Logo.** The same "N" monogram in flat `green` (`green-hover` for the fold) instead of the
  emerald-to-cyan gradient; "NetWageTax" in a single color at weight 700.
- **Ads.** `AdSlot` keeps its existing rules. Never place one between the mini calculator's form
  and its result, or next to any button.

## 7. Voice

- Task verbs in headings and buttons: "Figure out your take-home pay", "See the full
  breakdown", "Estimate your deduction".
- Verifiable facts instead of adjectives: "2026 brackets, 10% to 37%" rather than "Smart";
  "Your figures stay on this device" (once) rather than "100% in your browser" on repeat.
- Drop: "Flagship", "New for 2026", "1-Click PDF worksheet ready", "Zero sign-up", "no
  upsell", "exactly what… puts back in your pocket", rows of check marks, and a → after every
  link.
- State pages, local income taxes: "None" when a state has none, "Some cities and counties"
  when it does (instead of "None in our data" / "Yes, see note").

## 8. Home page

Mockup: `docs/design-audit/proposal/hero-mockup.html`, screenshots `hero-desktop-full.png` and
`hero-mobile-full.png` (real engine output for $65,000, single, California, bi-weekly).

**`<title>` and meta description** keep the phrase "paycheck calculator" for search. The H1
changes to "Figure out your take-home pay".

**Header, desktop (1440):** two columns, 4/8.

- Left: the H1; a one-sentence lead; a summary list of the 2026 parameters the estimate uses
  (federal brackets, standard deduction, Social Security wage base, states covered); a one-line
  privacy note.
- Right: the calculator panel, 1px border, split in two:
  - Form: "How are you paid?" (Salary / Hourly radios), "Annual salary" (or hourly rate and
    hours for Hourly), "Paid" (frequency select), "Filing as" (select), "State" (select).
  - Result (`green-tint`): take-home per paycheck at 48px, the yearly amount and number of
    paychecks, the breakdown bar, three rows (federal, Social Security & Medicare, state) plus
    the total, a "See the full breakdown" button, and the assumptions.

**Header, mobile (390):** one column. H1 at 32px, the lead, and the calculator starting on the
first screen (about 350px down), with the result right below the form. The parameter list shrinks
to one line under the calculator. "Paid" and "Filing as" are stacked, not side by side: at half
width "Head of household" doesn't fit in the select, on mobile or in the desktop form column.

**Behavior:**

- Defaults that show a result on load ($65,000, bi-weekly, single, no state or the state in the
  URL); never show "$0.00".
- Same engine as the full calculator (`src/lib/paycheck.ts`); no duplicated logic.
- "See the full breakdown" opens `/tools/paycheck-calculator/` with the inputs in the URL.
  Today only `?state=` is read, so `salary`, `rate`, `hours`, `freq`, and `filing` need adding.
- No animated figure; `aria-live="polite"` on the result, as the calculator already does.
- Without JavaScript the section shows the example precomputed at build time and the link to the
  full calculator.

**Below the header:**

1. "Other tools" as a tool list (tips & overtime, W-2 codes). State taxes aren't repeated here
   because the next section links to every state.
2. "2026 income tax by state": all 51 states and DC as link columns grouped into no income tax,
   flat rate, and progressive brackets, with counts. These are important internal links for
   search, so they stay on the home page.

**Removed:** the pulsing pill, the gradient H1, the check-mark row, the "Explore Calculators" and
"Browse 50-State Taxes" buttons, the floating dark card with its decorative chart, the four-stat
strip, and the "Calculators", "Tax Guides & State Resources", and "Why NetWageTax" card sections.

## 9. Methodology page

`/methodology/` ("How we calculate") ships in the site header phase, before the status strip
links to it. It's listed in the footer and in the sitemap (the sitemap integration picks up
every page). Contents:

- **Sources:** IRS (brackets, standard deduction, Schedule 1-A, Publication 15-T), SSA (Social
  Security wage base), and each state's official tax agency (linked from the state pages).
- **What's exact and what's estimated:** federal income tax and FICA follow the published
  brackets and rates; state tax is a simplified estimate (in progressive-bracket states, one
  average rate calibrated for a single filer around $65,000), which is less accurate at much
  higher or lower incomes. Check the exact method in `src/lib/state-tax-data.ts` when writing
  the page.
- **Assumptions:** standard deduction, no pre-tax deductions (401(k), health insurance, HSA),
  standard W-4 withholding, no local income taxes.
- **Review schedule:** how often the data is checked and where the "last checked" date comes
  from.
- **Reporting an error:** a link to `/contact/`.

## 10. Rollout

Each phase ends with `npm run build`, `npm test`, screenshots at 1440px and 390px in light and
dark mode, and a commit. Work pauses after each phase for review.

1. **Tokens and typeface:** color, radius, and figure tokens in `global.css` (light and dark),
   Public Sans, a flat `btn-primary`, and no `glow-emerald`.
2. **Site header and footer:** header, status strip, flat logo, footer (with "Contact" and
   "How we calculate"), and the `/methodology/` page.
3. **Home page:** the mini calculator header, tool list, and state link columns.
4. **Calculators:** paycheck and tips & overtime (forms, result panel, tables, URL inputs).
5. **State pages:** summary list, local-tax wording, tables, and notices; state directory and map.
6. **Remaining pages and exports:** about, contact, legal pages, W-2 guide, and the PDF, Word,
   and Excel exports (their colors live in `src/lib/*-docx.ts` and `*-xlsx.ts`).
