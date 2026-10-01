// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineConfig } from 'vitest/config';

export default defineConfig({
    // The tests read the repository's issue forms, labels and PR template, which live above gallery/.
    server: { fs: { allow: ['..'] } },
    test: {
        environment: 'happy-dom',
        include: ['src/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            include: ['src/**/*.ts'],
            // The entry wires fetched data to the DOM; everything it calls is tested on its own.
            exclude: ['src/**/*.test.ts', 'src/main.ts'],
            thresholds: { lines: 95, branches: 90, functions: 95, statements: 95 },
        },
    },
});
