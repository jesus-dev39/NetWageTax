/** Site-wide constants shared by the legal and informational pages. */

export const SITE_DOMAIN = 'netwagetax.com';

/** Public contact address. Make sure this mailbox exists before launch. */
export const CONTACT_EMAIL = 'contact@netwagetax.com';

/** Promised reply time shown on /contact/. Keep it realistic. */
export const CONTACT_RESPONSE_TIME = 'within 3 business days';

/** Date the current Privacy Policy, Terms, and Disclaimer took effect. */
export const LEGAL_EFFECTIVE_DATE = 'September 26, 2026';

/** Google Search Console ownership verification (HTML tag method). */
export const GOOGLE_SITE_VERIFICATION = 'wsUBDuevEMNFehs9RrqctiaYyFcYrO5Z6jmswIbCg_0';

/** Google AdSense publisher ID, used by the account meta tag, the loader script, and AdSlot units. */
export const ADSENSE_CLIENT = 'ca-pub-2086612186107816';

/** Tax year the site's calculators and state pages describe (shown in the status strip). */
export const SITE_TAX_YEAR = 2026;

/** "2026-09-27" → "September 27, 2026". Noon avoids the date shifting a day in time zones west of UTC. */
export function formatLongDate(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}
