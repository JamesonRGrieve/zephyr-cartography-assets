// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineConfig } from 'vite';

// Relative asset URLs, so the built site works from a GitHub Pages project path (/<repo>/) as well as a domain's root.
export default defineConfig({
    base: './',
    build: { outDir: 'dist', emptyOutDir: true },
});
