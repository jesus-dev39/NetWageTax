/// <reference types="vitest/config" />
// getViteConfig lets tests compile .astro files, so a test can render a whole page with the
// Astro Container API (src/lib/guide-2027-brackets.test.ts).
import { getViteConfig } from 'astro/config';

export default getViteConfig({ test: {} });
