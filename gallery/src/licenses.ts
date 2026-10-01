// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The licences pieces are published under, as SPDX ids (`CC0-1.0`,
 * `CC-BY-4.0`, `MIT`, `Apache-2.0`, `GPL-3.0-or-later`): which the gallery
 * accepts, and where each one's text is. Pure.
 */

/** The licence of AI-generated art: no human author, any right there may be waived. */
export const AI_LICENSE = 'CC0-1.0';

/** An SPDX licence id: letters, digits, dots, pluses and hyphens. */
const SPDX_ID = /^[A-Za-z0-9][A-Za-z0-9.+-]*$/u;

/** The Creative Commons restrictions that make a licence not open: no commercial use, no modification. */
const NOT_OPEN = /(?:^|-)(?:NC|ND)(?:-|$)/u;

/**
 * Whether `license` is an SPDX id of an open licence: one that lets anyone
 * use the piece for anything, commercially or not, and change it (CC0, CC BY,
 * CC BY-SA, MIT, Apache, GPL…); a non-commercial or no-derivatives licence is
 * not.
 */
export function isOpenLicense(license: string): boolean {
    return SPDX_ID.test(license) && !NOT_OPEN.test(license.toUpperCase());
}

/** Where `license`'s full text is: its page in the SPDX licence list. */
export function licenseUrl(license: string): string {
    return `https://spdx.org/licenses/${encodeURIComponent(license)}.html`;
}
