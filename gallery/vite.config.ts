// SPDX-License-Identifier: AGPL-3.0-or-later
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

/** The data files the page fetches, which keep their names from build to build. */
const DATA_FILES = ['public/stamps.json', 'public/more-assets.json'];
/** Hex digits of the data's hash kept in its version. */
const VERSION_LENGTH = 12;

/**
 * A hash of the data files as built, which the page puts on their URLs
 * (`stamps.json?v=…`). GitHub Pages lets browsers and its CDN reuse a file
 * for ten minutes, so without it, fresh code could read a cached index of an
 * older shape and refuse it.
 */
function dataVersion(): string {
    const hash = createHash('sha256');
    for (const file of DATA_FILES) {
        const path = resolve(import.meta.dirname, file);
        hash.update(existsSync(path) ? readFileSync(path) : '');
    }
    return hash.digest('hex').slice(0, VERSION_LENGTH);
}

// Relative asset URLs, so the built site works from a GitHub Pages project path (/<repo>/) as well as a domain's root.
export default defineConfig({
    base: './',
    build: { outDir: 'dist', emptyOutDir: true },
    define: { __DATA_VERSION__: JSON.stringify(dataVersion()) },
});
