/**
 * AdSlot: responsive Google AdSense unit.
 *
 * - With a `slotId` (the ad unit ID from the AdSense dashboard), renders a live
 *   <ins class="adsbygoogle"> for `client` (defaults to ADSENSE_CLIENT) and asks
 *   AdSense to fill it once mounted. In Astro pages it needs a client:* directive
 *   so that push runs (client:visible is ideal).
 * - Without a `slotId`, renders a dashed placeholder in development only, and
 *   nothing in production, so the live site never shows empty ad boxes.
 *
 * The loader script (adsbygoogle.js?client=…) is included once in BaseLayout's <head>.
 * Each format reserves its final height so the page does not shift when ads load (CLS).
 *
 * Policy note for the `export-interstitial` placement (ExportPrepModal): AdSense program
 * policies do not allow manually placed ad units inside pop-ups or dialogs, and a wait
 * imposed only to show an ad can be treated as an interstitial violation. Never give that
 * placement a slotId; use a direct sponsor / house ad there, or remove it and enable Auto
 * ads "vignette" interstitials, the Google-managed, policy-compliant format.
 */
import { useEffect, useRef } from 'react';
import { ADSENSE_CLIENT } from '../lib/site';

export type AdFormat = 'leaderboard' | 'rectangle';

interface Props {
  format: AdFormat;
  /** AdSense ad unit ID (data-ad-slot). Omit until the unit exists in the AdSense dashboard. */
  slotId?: string;
  /** AdSense publisher ID; override only for testing. */
  client?: string;
  /** Short placement name, exposed as data-ad-placement for reporting/QA. */
  placement: string;
  className?: string;
}

declare global {
  interface Window {
    adsbygoogle?: Record<string, unknown>[];
  }
}

/** Placeholders help lay out pages locally; production shows only real, filled units. */
const SHOW_PLACEHOLDERS = import.meta.env.DEV;

// Reserved sizes match the standard IAB units AdSense serves in each format.
const FORMAT_CLASSES: Record<AdFormat, string> = {
  // 320×100 on phones, 728×90 from md up.
  leaderboard: 'h-[100px] w-full max-w-[728px] md:h-[90px]',
  // 300×250 medium rectangle.
  rectangle: 'h-[250px] w-[300px] max-w-full',
};

const ADSENSE_FORMAT: Record<AdFormat, string> = {
  leaderboard: 'horizontal',
  rectangle: 'rectangle',
};

export default function AdSlot({ format, slotId, client = ADSENSE_CLIENT, placement, className = '' }: Props) {
  const live = Boolean(slotId);
  const pushed = useRef(false);

  // Ask AdSense to fill this unit once (a second push for the same <ins> throws).
  useEffect(() => {
    if (!live || pushed.current) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (err) {
      console.warn('AdSense push failed', err);
    }
  }, [live]);

  if (!live && !SHOW_PLACEHOLDERS) return null;

  return (
    <aside
      aria-label="Advertisement"
      data-ad-container=""
      data-ad-format={format}
      data-ad-placement={placement}
      className={`mx-auto flex w-full flex-col items-center print:hidden ${className}`}
    >
      {live ? (
        <ins
          className={`adsbygoogle block ${FORMAT_CLASSES[format]}`}
          data-ad-client={client}
          data-ad-slot={slotId}
          data-ad-format={ADSENSE_FORMAT[format]}
          data-full-width-responsive={format === 'leaderboard' ? 'true' : 'false'}
        />
      ) : (
        <div
          className={`flex items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50/60 text-center dark:border-slate-700 dark:bg-slate-900/40 ${FORMAT_CLASSES[format]}`}
        >
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
            Advertisement / Sponsor Space
          </span>
        </div>
      )}
    </aside>
  );
}
