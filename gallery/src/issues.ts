// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Links that open a GitHub issue on the asset pack's repository, pre-filled
 * from the issue forms there (`.github/ISSUE_TEMPLATE/`): a problem with one
 * image of a stamp, a request for a new one, for more variants of one, for a
 * new class of asset, or to list a free pack in the More Assets directory.
 * Pure.
 */
import type { GalleryItem, GalleryVariant } from './catalog';

/** The repository the issues go to: the asset pack's own. */
const REPOSITORY = 'https://github.com/JamesonRGrieve/zephyr-cartography-assets';

/** A new issue from the form `template`, its fields pre-filled from `fields` (each value URL-encoded). */
function newIssue(template: string, fields: Readonly<Record<string, string>>): string {
    const query = new URLSearchParams({ template, ...fields });
    return `${REPOSITORY}/issues/new?${query.toString()}`;
}

/** A report of a problem with `variant`, an image of `item`: titled "Problem with <name>", its image's path filled in. */
export function problemUrl(item: GalleryItem, variant: GalleryVariant): string {
    return newIssue('stamp-problem.yml', { title: `Problem with ${item.name}`, stamp: item.name, image: variant.file });
}

/**
 * Whether variants of `item` can be requested here: only of the pack's own
 * art, credited to its repository. Other authors' work (CC0, CC BY and the
 * rest) is theirs to extend, never this pack's.
 */
export const takesVariantRequests = (item: Pick<GalleryItem, 'credit'>): boolean => item.credit.source === REPOSITORY;

/** A request for more variants of `item`: titled "Variants of <name>", the variants it has filled in. */
export function variantRequestUrl(item: GalleryItem): string {
    return newIssue('variant-request.yml', {
        title: `Variants of ${item.name}`,
        asset: item.name,
        existing: [...new Set(item.variants.map((variant) => variant.state))].join('\n'),
    });
}

/** A request for a new stamp. */
export const REQUEST_URL = newIssue('stamp-request.yml', {});

/** A request to list a free asset pack, one that cannot be shared here, in the More Assets directory. */
export const LISTING_URL = newIssue('listing-request.yml', {});

/** A request for a new class of asset: a perspective, setting, media type, scale or the like. */
export const ASSET_CLASS_URL = newIssue('asset-class-request.yml', {});
