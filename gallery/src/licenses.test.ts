// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { isOpenLicense, licenseUrl } from './licenses';

describe('isOpenLicense', () => {
    it('accepts public-domain, attribution, share-alike and permissive or copyleft software licences', () => {
        for (const id of ['CC0-1.0', 'CC-BY-4.0', 'CC-BY-3.0', 'CC-BY-SA-4.0', 'MIT', 'Apache-2.0', 'GPL-3.0-or-later', 'GPL-2.0-only', 'OFL-1.1']) {
            expect(isOpenLicense(id)).toBe(true);
        }
    });

    it('refuses non-commercial and no-derivatives licences, whatever the case, and anything not an SPDX id', () => {
        for (const id of ['CC-BY-NC-4.0', 'CC-BY-ND-4.0', 'CC-BY-NC-SA-4.0', 'cc-by-nc-nd-4.0', 'CC BY 4.0', '', 'see website']) {
            expect(isOpenLicense(id)).toBe(false);
        }
    });
});

describe('licenseUrl', () => {
    it('links the licence’s page in the SPDX list', () => {
        expect(licenseUrl('CC-BY-4.0')).toBe('https://spdx.org/licenses/CC-BY-4.0.html');
        expect(licenseUrl('GPL-3.0-or-later')).toBe('https://spdx.org/licenses/GPL-3.0-or-later.html');
    });
});
