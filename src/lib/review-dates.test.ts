/**
 * Review dates: the status strip, /methodology/, every state page, and the tips and overtime guide
 * show dates taken from the data (review-dates.ts, `reviewed` in state-tax-data.ts, and the `checked`
 * date of each tips row), never typed into the pages.
 */
import { readFileSync } from 'node:fs';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { loadRenderers } from 'astro:container';
import { getContainerRenderer } from '@astrojs/react/container-renderer';
import { beforeAll, describe, expect, it } from 'vitest';
import Methodology from '../pages/methodology.astro';
import StatePage from '../pages/state-taxes/[state].astro';
import TipsGuide from '../pages/guides/which-states-tax-tips-and-overtime.astro';
import {
  FEDERAL_INCOME_TAX_CHECKED,
  FICA_FIGURES_CHECKED,
  federalFiguresLabel,
  nextFullStateReviewLabel,
  statusStripText,
} from './review-dates';
import { formatDateRange, formatLongDate } from './site';
import { STATE_DATA_INITIAL_REVIEW, STATES, STATES_BY_CODE, type StateCode } from './state-tax-data';
import { TIPS_OVERTIME_FIRST_CHECKED, TIPS_OVERTIME_LAST_CHECKED, TIPS_OVERTIME_RULES } from './state-tips-overtime';

const text = (html: string) =>
  html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&#39;|&#x27;/g, '’').replace(/\s+/g, ' ').replace(/ ([.,;])/g, '$1');

describe('review dates in the data', () => {
  it('has the federal check of November 12, 2026 and leaves FICA out until it is rechecked', () => {
    expect(FEDERAL_INCOME_TAX_CHECKED).toBe('2026-11-12');
    expect(FICA_FIGURES_CHECKED).toBe('2026-09-26');
    expect(federalFiguresLabel()).toBe('Federal figures');
    expect(federalFiguresLabel('2026-11-12', '2026-11-12')).toBe('Federal and FICA figures');
    expect(nextFullStateReviewLabel()).toBe('January 2027');
  });

  it('gives every state its own review date, in four groups', () => {
    const byDate = (d: string) => STATES.filter((s) => s.reviewed === d).map((s) => s.code).sort();
    expect(byDate('2026-10-29')).toEqual(['AZ', 'CA', 'GA', 'MA', 'MD', 'NC', 'NY', 'OR', 'SC', 'WV']);
    expect(byDate('2026-10-04')).toEqual(['AR', 'HI', 'IL', 'KY', 'LA', 'ME', 'MI', 'NE', 'OH', 'RI', 'UT', 'VA', 'VT', 'WI']);
    expect(STATE_DATA_INITIAL_REVIEW).toBe('2026-09-27');
    expect(byDate('2026-11-12')).toEqual(['AK', 'FL', 'MS', 'SD', 'TN', 'TX', 'WY']);
    expect(byDate('2026-09-27')).toHaveLength(20);
    expect(STATES).toHaveLength(51);
  });

  it('takes the tips guide range from the rows', () => {
    const dates = Object.values(TIPS_OVERTIME_RULES).map((r) => r.checked).sort();
    expect([TIPS_OVERTIME_FIRST_CHECKED, TIPS_OVERTIME_LAST_CHECKED]).toEqual([dates[0], dates.at(-1)]);
    expect(formatDateRange(TIPS_OVERTIME_FIRST_CHECKED, TIPS_OVERTIME_LAST_CHECKED)).toBe('October 4–29, 2026');
  });

  it('formats date ranges', () => {
    expect(formatDateRange('2026-10-04', '2026-10-29')).toBe('October 4–29, 2026');
    expect(formatDateRange('2026-09-27', '2026-10-29')).toBe('September 27 – October 29, 2026');
    expect(formatDateRange('2026-12-30', '2027-01-15')).toBe('December 30, 2026 – January 15, 2027');
    expect(formatDateRange('2026-10-29', '2026-10-29')).toBe('October 29, 2026');
  });
});

describe('no review dates typed into the pages', () => {
  it.each([
    '../layouts/BaseLayout.astro',
    '../pages/methodology.astro',
    '../pages/state-taxes/[state].astro',
    '../pages/guides/which-states-tax-tips-and-overtime.astro',
  ])('%s has no hand-written date', (path) => {
    // The publication date of a guide (PUBLISHED) isn't a review date.
    const src = readFileSync(new URL(path, import.meta.url), 'utf8').replace(/const PUBLISHED = '[^']*';/, '');
    expect(src.match(/\b20\d\d-\d\d-\d\d\b|\b(January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}\b/g)).toBeNull();
  });
});

describe('rendered pages', () => {
  let container: AstroContainer;
  beforeAll(async () => {
    container = await AstroContainer.create({ renderers: await loadRenderers([getContainerRenderer()]) });
  });
  const render = async (page: Parameters<AstroContainer['renderToString']>[0], path: string, props = {}) =>
    text(await container.renderToString(page, { request: new Request(`https://netwagetax.com${path}`), props }));

  it('shows the new status strip and the methodology summary', async () => {
    const t = await render(Methodology, '/methodology/');
    const strip = statusStripText();
    const expected = 'Tax year 2026 · Federal figures checked November 12, 2026 · How we calculate';
    expect(`Tax year 2026 · ${strip.federal} ${strip.federalDate} · How we calculate`).toBe(expected);
    expect(t).toContain(expected);
    expect(t).not.toContain('Federal, FICA, and state rules last checked');
    expect(t).toContain('Federal figures checked November 12, 2026');
    expect(t).toContain('State rules Review date shown on each state page Full review January 2027.');
  });

  it.each(['CA', 'IL', 'TX', 'PA'] as StateCode[])('shows the state’s own review date on the %s page', async (code) => {
    const s = STATES_BY_CODE[code];
    const t = await render(StatePage, `/state-taxes/${s.slug}/`, { s });
    expect(t).toContain(`Last reviewed ${formatLongDate(s.reviewed)}.`);
  });

  it('shows the date groups on the state pages: November 12, October 29, October 4, and the initial data', () => {
    expect(formatLongDate(STATES_BY_CODE.CA.reviewed)).toBe('October 29, 2026');
    expect(formatLongDate(STATES_BY_CODE.IL.reviewed)).toBe('October 4, 2026');
    expect(formatLongDate(STATES_BY_CODE.TX.reviewed)).toBe('November 12, 2026');
    expect(formatLongDate(STATES_BY_CODE.PA.reviewed)).toBe('September 27, 2026');
  });

  it('shows the checked range on the tips and overtime guide', async () => {
    const t = await render(TipsGuide, '/guides/which-states-tax-tips-and-overtime/');
    expect(t).toContain('By NetWageTax. Rows checked October 4–29, 2026.');
    expect(t).toContain('Rows checked October 4–29, 2026.');
    expect(t).not.toContain('Rules last checked');
  });
});
