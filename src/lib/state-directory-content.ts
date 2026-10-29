/**
 * state-directory-content.ts
 * Title, description, and FAQ for the /state-taxes/ directory (the map page), built from
 * state-tax-data.ts so the lists and counts follow the data.
 */
import { formatUSD } from '../components/CurrencyInput';
import { pct } from './state-page-content';
import { MA_SURTAX_THRESHOLD, statePagePath, STATES, type StateTaxInfo } from './state-tax-data';
import { TIPS_OVERTIME_GUIDE_PATH } from './state-tips-overtime';

/** Complete <title>, without "| NetWageTax": with it the title would pass 60 characters (MAX_TITLE_LENGTH). */
export const DIRECTORY_TITLE = 'State Income Tax by State (2026): Rates for 50 States + DC';

const byStructure = (structure: StateTaxInfo['structure']) => STATES.filter((s) => s.structure === structure);
const NONE = byStructure('none');
const FLAT = byStructure('flat');
const GRADUATED = byStructure('graduated');

export const DIRECTORY_DESCRIPTION = `State income tax by state for 2026: ${NONE.length} states don’t tax wages, ${FLAT.length} use a flat rate, and ${GRADUATED.length} (including DC) have progressive brackets. Compare rates on the map.`;

/** A paragraph is plain text, or text with links to pages on the site. */
export type FaqPart = string | { href: string; text: string };
export interface DirectoryFaq {
  question: string;
  answer: FaqPart[][];
}

const stateLink = (s: StateTaxInfo, text = s.name): FaqPart => ({ href: statePagePath(s), text });

/** "A, B, and C" with each item a link. */
function linkList(items: FaqPart[]): FaqPart[] {
  return items.flatMap((item, i) => {
    if (i === 0) return [item];
    return [i === items.length - 1 ? (items.length > 2 ? ', and ' : ' and ') : ', ', item];
  });
}

/** Highest top marginal rate on wages. */
export const HIGHEST_RATE_STATE = GRADUATED.reduce((a, b) => (b.bracketRange![1] > a.bracketRange![1] ? b : a));

export function directoryFaqs(): DirectoryFaq[] {
  const top = HIGHEST_RATE_STATE;
  return [
    {
      question: 'Which states have no state income tax?',
      answer: [
        [`There are ${NONE.length} states with no tax on wages: `, ...linkList(NONE.map((s) => stateLink(s))), '.'],
        [
          'Two of them tax other income or did until recently: Washington taxes only long-term capital gains above a large exemption, and New Hampshire repealed its Interest and Dividends Tax starting in 2025.',
        ],
      ],
    },
    {
      question: 'Which states have a flat income tax?',
      answer: [
        [
          `These ${FLAT.length} states tax wages at a single rate: `,
          ...linkList(FLAT.map((s) => stateLink(s, `${s.name} (${pct(s.estimateRate)})`))),
          '.',
        ],
        [
          `Massachusetts adds a 4% surtax on taxable income above ${formatUSD(MA_SURTAX_THRESHOLD)} for 2026. Most of these states exempt some income first through a standard deduction or personal exemption, so the share of your wages you pay is lower than the rate.`,
        ],
      ],
    },
    {
      question: 'Which state has the highest income tax?',
      answer: [
        [
          stateLink(top),
          `, with a top marginal rate of ${pct(top.bracketRange![1])}. Its top bracket is 12.3%, and a 1% Behavioral Health Services Tax applies to taxable income over $1 million. Most wages are taxed at much lower rates: the brackets start at ${pct(top.bracketRange![0])}.`,
        ],
      ],
    },
    {
      question: 'Does my state tax tips and overtime?',
      answer: [
        [
          'It depends on the state. The federal deduction for qualified tips and overtime lowers only your federal income tax, and each state decides whether to follow it. Many states tax tips and overtime in full, some follow the federal deduction, and a few have their own break. ',
          { href: TIPS_OVERTIME_GUIDE_PATH, text: 'See how every state treats tips and overtime' },
          '.',
        ],
      ],
    },
  ];
}

/** Plain text of a paragraph, for FAQPage structured data. */
export const faqPlainText = (parts: FaqPart[]) => parts.map((p) => (typeof p === 'string' ? p : p.text)).join('');
