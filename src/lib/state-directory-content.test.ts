import { describe, expect, it } from 'vitest';
import { DIRECTORY_DESCRIPTION, DIRECTORY_TITLE, directoryFaqs, faqPlainText, HIGHEST_RATE_STATE } from './state-directory-content';
import { MAX_TITLE_LENGTH } from './state-page-content';
import { STATES } from './state-tax-data';
import { TIPS_OVERTIME_GUIDE_PATH } from './state-tips-overtime';

const links = (faq: ReturnType<typeof directoryFaqs>[number]) =>
  faq.answer.flat().flatMap((p) => (typeof p === 'string' ? [] : [p.href]));

describe('/state-taxes/ directory copy', () => {
  it('targets "state income tax by state" within the title limit', () => {
    expect(DIRECTORY_TITLE.length).toBeLessThanOrEqual(MAX_TITLE_LENGTH);
    expect(DIRECTORY_TITLE).toMatch(/^State Income Tax by State/);
    expect(DIRECTORY_DESCRIPTION).toMatch(/^State income tax by state for 2026: 9 states don’t tax wages, 16 use a flat rate, and 26 \(including DC\)/);
  });

  it('links every no-tax and flat-tax state in its answer', () => {
    const [none, flat, highest, tips] = directoryFaqs();
    const paths = (structure: string) => STATES.filter((s) => s.structure === structure).map((s) => `/state-taxes/${s.slug}/`);
    expect(links(none)).toEqual(paths('none'));
    expect(links(none)).toHaveLength(9);
    expect(links(flat)).toEqual(paths('flat'));
    expect(links(flat)).toHaveLength(16);
    expect(faqPlainText(flat.answer[0])).toContain('Pennsylvania (3.07%)');
    expect(links(highest)).toEqual(['/state-taxes/california/']);
    expect(links(tips)).toEqual([TIPS_OVERTIME_GUIDE_PATH]);
  });

  it('names California at 13.3% over $1 million as the highest rate', () => {
    expect(HIGHEST_RATE_STATE.code).toBe('CA');
    const text = faqPlainText(directoryFaqs()[2].answer[0]);
    expect(text).toMatch(/^California, with a top marginal rate of 13\.3%\./);
    expect(text).toContain('over $1 million');
  });

  it('joins the lists with a serial comma', () => {
    const text = faqPlainText(directoryFaqs()[0].answer[0]);
    expect(text).toBe(
      'There are 9 states with no tax on wages: Alaska, Florida, Nevada, New Hampshire, South Dakota, Tennessee, Texas, Washington, and Wyoming.',
    );
  });
});
