/**
 * AdSlot: responsive ad container, currently rendering a placeholder while the
 * site is pre-approval. Each format reserves its final height so the page does
 * not shift when real ads load (CLS).
 *
 * Going live with Google AdSense:
 * 1. Add the loader once in BaseLayout's <head>:
 *      <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX" crossorigin="anonymous"></script>
 * 2. Replace the placeholder markup marked below with the ad unit from the AdSense dashboard:
 *      <ins class="adsbygoogle"
 *           style="display:block"
 *           data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
 *           data-ad-slot="{slotId}"
 *           data-ad-format="auto"            // leaderboard; use "rectangle" for the rectangle format
 *           data-full-width-responsive="true"></ins>
 *    and call `(window.adsbygoogle = window.adsbygoogle || []).push({})` once after mount
 *    (this component then needs a client:* directive in Astro pages).
 *
 * Policy note for the `export-interstitial` placement (ExportPrepModal): AdSense program
 * policies do not allow manually placed ad units inside pop-ups or dialogs, and a
 * wait imposed only to show an ad can be treated as an interstitial violation.
 * Before approval, either fill that slot with a direct sponsor / house ad, or remove
 * it and enable AdSense Auto ads "vignette" interstitials, which are the
 * Google-managed, policy-compliant way to show full-screen ads between actions.
 */

export type AdFormat = 'leaderboard' | 'rectangle';

interface Props {
  format: AdFormat;
  /** AdSense ad unit ID (data-ad-slot) for this placement, once approved. */
  slotId?: string;
  /** Short placement name, exposed as data-ad-placement for reporting/QA. */
  placement: string;
  className?: string;
}

// Reserved sizes match the standard IAB units AdSense serves in each format.
const FORMAT_CLASSES: Record<AdFormat, string> = {
  // 320×100 on phones, 728×90 from md up.
  leaderboard: 'h-[100px] w-full max-w-[728px] md:h-[90px]',
  // 300×250 medium rectangle.
  rectangle: 'h-[250px] w-[300px] max-w-full',
};

export default function AdSlot({ format, slotId, placement, className = '' }: Props) {
  return (
    <aside
      aria-label="Advertisement"
      data-ad-container=""
      data-ad-format={format}
      data-ad-placement={placement}
      data-ad-slot={slotId}
      className={`mx-auto flex w-full flex-col items-center print:hidden ${className}`}
    >
      {/* ── AdSense: paste the <ins class="adsbygoogle"> unit here, replacing the placeholder div below. ── */}
      <div
        className={`flex items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50/60 text-center dark:border-slate-700 dark:bg-slate-900/40 ${FORMAT_CLASSES[format]}`}
      >
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
          Advertisement / Sponsor Space
        </span>
      </div>
      {/* ── End AdSense unit ── */}
    </aside>
  );
}
