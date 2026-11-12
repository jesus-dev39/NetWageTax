/**
 * /guides/2027-tax-brackets/: the figures come from the _2026 and _2027 constants, the examples
 * match hand calculations, and the rendered page (Astro Container API) shows those same figures.
 */
import { readFileSync } from 'node:fs';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { loadRenderers } from 'astro:container';
import { getContainerRenderer } from '@astrojs/react/container-renderer';
import { beforeAll, describe, expect, it } from 'vitest';
import Page from '../pages/guides/2027-tax-brackets.astro';
import { formatUSD } from '../components/CurrencyInput';
import { SOCIAL_SECURITY_WAGE_BASE_2027 } from './fica';
import {
  AGED_ADDITION_ROWS,
  BRACKET_TABLES_2027,
  BRACKETS_2027_FAQS,
  BRACKETS_2027_GUIDE_PATH,
  BRACKETS_2027_GUIDE_TITLE,
  BRACKETS_2027_SOURCES,
  EXAMPLES,
  formatTaxBelow,
  HOH_TOP_NOTE,
  signedUSD,
  STANDARD_DEDUCTION_ROWS,
} from './guide-2027-brackets';
import { STANDARD_DEDUCTION_2026, STANDARD_DEDUCTION_2027, TAX_BRACKETS_2027 } from './marginal-rate';

describe('2027 brackets guide data', () => {
  it('builds each bracket table from TAX_BRACKETS_2027, with the IRS "plus" amounts', () => {
    for (const t of BRACKET_TABLES_2027) {
      const limits = TAX_BRACKETS_2027[t.status].map((b) => b.upTo);
      expect(t.rows.map((r) => r.upTo ?? Infinity)).toEqual(limits);
      expect(t.rows.map((r) => r.over)).toEqual([0, ...limits.slice(0, -1)]);
    }
    const single = BRACKET_TABLES_2027.find((t) => t.status === 'single')!;
    // Rev. Proc. 2026-35, Table 3: $1,280.00, $5,987.00, $18,549.00, $42,357.00, $60,349.00, $199,237.75.
    expect(single.rows.map((r) => r.taxBelow)).toEqual([0, 1_280, 5_987, 18_549, 42_357, 60_349, 199_237.75]);
  });

  it('compares the standard deduction and the age addition between 2026 and 2027', () => {
    for (const r of STANDARD_DEDUCTION_ROWS) {
      expect(r.y2026).toBe(STANDARD_DEDUCTION_2026[r.status]);
      expect(r.y2027).toBe(STANDARD_DEDUCTION_2027[r.status]);
    }
    expect(STANDARD_DEDUCTION_ROWS.map((r) => r.change)).toEqual([500, 1_000, 775, 500]);
    expect(AGED_ADDITION_ROWS.map((r) => [r.y2027, r.change])).toEqual([[2_100, 50], [1_700, 50]]);
  });

  it('matches the hand calculations for the three examples', () => {
    // Single $65,000. 2026: taxable 48,900 = 1,240 + 12% × 36,500 = $5,620.
    //                  2027: taxable 48,400 = 1,280 + 12% × 35,600 = $5,552.
    // MFJ $120,000.    2026: taxable 87,800 = 2,480 + 12% × 63,000 = $10,040.
    //                  2027: taxable 86,800 = 2,560 + 12% × 61,200 = $9,904.
    // HoH $80,000.     2026: taxable 55,850 = 1,770 + 12% × 38,150 = $6,348.
    //                  2027: taxable 55,075 = 1,825 + 12% × 36,825 = $6,244.
    const got = EXAMPLES.map((e) => [e.status, e.income, e.taxable2026, e.taxable2027, e.tax2026, e.tax2027, e.change]);
    const expected = [
      ['single', 65_000, 48_900, 48_400, 5_620, 5_552, -68],
      ['mfj', 120_000, 87_800, 86_800, 10_040, 9_904, -136],
      ['hoh', 80_000, 55_850, 55_075, 6_348, 6_244, -104],
    ];
    got.forEach((row, i) => row.forEach((v, j) => (typeof v === 'number' ? expect(v).toBeCloseTo(expected[i][j] as number, 6) : expect(v).toBe(expected[i][j]))));
    expect(signedUSD(EXAMPLES[0].change)).toBe('−$68');
  });

  it('notes the head of household 37% start against single', () => {
    expect(HOH_TOP_NOTE).toEqual({ hoh2027: 661_350, single2027: 661_375, equalIn2026: true, start2026: 640_600 });
  });

  it('has 4 to 5 FAQs', () => {
    expect(BRACKETS_2027_FAQS.length).toBeGreaterThanOrEqual(4);
    expect(BRACKETS_2027_FAQS.length).toBeLessThanOrEqual(5);
    expect(BRACKETS_2027_FAQS[0].question).toBe('When do the 2027 tax brackets apply?');
  });
});

describe('no amounts written by hand in the page', () => {
  it('has no dollar figures, thousands, or percentages in the .astro source', () => {
    const src = readFileSync(new URL('../pages/guides/2027-tax-brackets.astro', import.meta.url), 'utf8');
    expect(src.match(/\$\d|\b\d{1,3},\d{3}\b|\b\d{1,3}_\d{3}\b|\b\d+(\.\d+)?%/g)).toBeNull();
  });
});

describe('the rendered page', () => {
  let html = '';
  let text = '';
  const tableText = (caption: string) => {
    const at = html.indexOf(caption);
    expect(at, caption).toBeGreaterThan(-1);
    return html.slice(at, html.indexOf('</table>', at)).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  };

  beforeAll(async () => {
    const container = await AstroContainer.create({ renderers: await loadRenderers([getContainerRenderer()]) });
    html = await container.renderToString(Page, { request: new Request(`https://netwagetax.com${BRACKETS_2027_GUIDE_PATH}`) });
    text = html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&#39;|&#x27;/g, '’').replace(/\s+/g, ' ');
  });

  // The canonical URL needs Astro.site, which the container doesn't set: checked in dist/ instead.
  it('has the title, byline, and last-checked date', () => {
    expect(html).toContain(`<title>${BRACKETS_2027_GUIDE_TITLE}</title>`);
    expect(BRACKETS_2027_GUIDE_TITLE).toBe('2027 Tax Brackets and Standard Deduction (IRS Rev. Proc. 2026-35)');
    expect(text).toContain('By NetWageTax . Last checked November 12, 2026');
    expect(html.match(/<h1\b/g)).toHaveLength(1);
  });

  it('shows every 2027 bracket table with the constants', () => {
    for (const t of BRACKET_TABLES_2027) {
      const cells = tableText(`2027 federal tax brackets, ${t.name.toLowerCase()}`);
      for (const r of t.rows) {
        expect(cells).toContain(formatUSD(r.over));
        if (r.upTo !== null) expect(cells).toContain(formatUSD(r.upTo));
        expect(cells).toContain(formatTaxBelow(r.taxBelow));
      }
      expect(cells).toContain('37% ');
    }
    for (const amount of ['$199,237.75', '$213,290.50', '$197,360', '$106,645.25']) {
      expect(html).toContain(amount);
    }
  });

  it('shows the standard deduction and age addition, 2026 vs. 2027, with the change', () => {
    const sd = tableText('Standard deduction by filing status, 2026 and 2027');
    for (const r of STANDARD_DEDUCTION_ROWS) expect(sd).toContain(`${r.name} ${formatUSD(r.y2026)} ${formatUSD(r.y2027)} +${formatUSD(r.change)}`);
    const aged = tableText('Additional standard deduction for age 65 or older, 2026 and 2027');
    expect(aged).toContain('$2,050 $2,100 +$50');
    expect(aged).toContain('$1,650 $1,700 +$50');
  });

  it('shows the three examples', () => {
    const ex = tableText('Federal income tax in 2026 and 2027 for three example incomes');
    expect(ex).toContain('Single, $65,000 Taxable $48,900 → $48,400 $5,620 $5,552 −$68');
    expect(ex).toContain('Married filing jointly, $120,000 Taxable $87,800 → $86,800 $10,040 $9,904 −$136');
    expect(ex).toContain('Head of household, $80,000 Taxable $55,850 → $55,075 $6,348 $6,244 −$104');
    expect(text).toContain('with only the standard deduction and no credits');
  });

  it('shows the other 2027 figures and links the calculators', () => {
    expect(text).toContain(formatUSD(SOCIAL_SECURITY_WAGE_BASE_2027));
    for (const t of ['Up to $25,000', 'Up to $12,500 ($25,000 joint)', '$6,000 per person 65 or older', 'Up to $10,000 per return']) expect(text).toContain(t);
    for (const href of ['/tools/obbba-tax-calculator/', '/tools/senior-deduction-calculator/', '/tools/car-loan-interest-deduction-calculator/']) {
      expect(html).toContain(`href="${href}"`);
    }
  });

  it('has the head of household note, the release date, and that the site still calculates 2026', () => {
    expect(text).toContain('at $661,350 for heads of household and at $661,375 for single filers. In 2026 both started at $640,600.');
    expect(text).toContain('November 5, 2026');
    expect(text).toContain('Our calculators still use the 2026 rules');
  });

  it('has Article, FAQPage, and BreadcrumbList data matching the visible FAQ', () => {
    const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1]);
    const types = ld['@graph'].map((n: { '@type': string }) => n['@type']);
    expect(types).toEqual(['Article', 'FAQPage', 'BreadcrumbList']);
    const faq = ld['@graph'][1];
    expect(faq.mainEntity.map((q: { name: string }) => q.name)).toEqual(BRACKETS_2027_FAQS.map((f) => f.question));
    for (const f of BRACKETS_2027_FAQS) expect(text).toContain(f.question);
    expect(ld['@graph'][2].itemListElement.at(-1).item).toBe('https://netwagetax.com/guides/2027-tax-brackets/');
  });

  it('cites the Rev. Proc., IR-2026-133, and the SSA', () => {
    for (const s of BRACKETS_2027_SOURCES) expect(html).toContain(`href="${s.href}"`);
  });
});
