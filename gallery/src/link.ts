// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The gallery's address: what is shown, written in the query string so any
 * view can be linked to and a link opens it again. The tab, the search, every
 * filter and the piece open in the detail dialog, each only when it differs
 * from the page's start (a bare address is the Stamps tab, nothing chosen):
 *
 *     ?tab=scenes&item=scene-wreck-field
 *     ?q=crate&setting=setting-fantasy&tag=wood&tag=barrel
 *
 * A piece's link (`?item=<id>`) needs no tab: the piece's own kind picks it.
 * Anything not understood is ignored rather than refused, so an old or mistyped
 * link still opens the gallery. Pure.
 */
import { type Filters, NO_FILTERS } from './filter';
import { TABS, type Tab } from './view';

/** What the address says to show. */
export interface View {
    readonly tab: Tab;
    readonly filters: Filters;
    /** The id of the piece open in the detail dialog; null for none. */
    readonly item: string | null;
}

export const START: View = { tab: 'stamps', filters: NO_FILTERS, item: null };

/** Each single-valued filter and the query parameter it is written to. */
const SINGLE = {
    category: 'category',
    setting: 'setting',
    scale: 'scale',
    perspective: 'perspective',
    license: 'license',
    style: 'style',
    look: 'look',
} as const satisfies Partial<Record<keyof Filters, string>>;

const TAB = 'tab';
const QUERY = 'q';
const TAG = 'tag';
const RESOLUTION = 'res';
const AI = 'ai';
const AI_HIDDEN = 'hide';
const ITEM = 'item';

const isTab = (value: string): value is Tab => (TABS as readonly string[]).includes(value);

/** The view the query string `search` (with or without its `?`) asks for, over `kind`, the kind its tab browses. */
export function viewOf(search: string, kindOf: (tab: Tab) => Filters['kind'] | null): View {
    const params = new URLSearchParams(search);
    const asked = params.get(TAB);
    const tab = asked !== null && isTab(asked) ? asked : START.tab;
    const value = (key: string): string | null => {
        const got = params.get(key);
        return got === null || got === '' ? null : got;
    };
    const resolution = Number(value(RESOLUTION));
    const single = Object.fromEntries(Object.entries(SINGLE).map(([filter, key]) => [filter, value(key)]));
    return {
        tab,
        filters: {
            ...NO_FILTERS,
            ...single,
            kind: kindOf(tab) ?? NO_FILTERS.kind,
            query: params.get(QUERY) ?? '',
            tags: [...new Set(params.getAll(TAG).filter((tag) => tag !== ''))],
            minResolution: Number.isInteger(resolution) && resolution > 0 ? resolution : null,
            hideAi: params.get(AI) === AI_HIDDEN,
        },
        item: value(ITEM),
    };
}

/** The query string (with its `?`, or empty for the page's start) that shows `view`. */
export function searchOf(view: View): string {
    const params = new URLSearchParams();
    if (view.tab !== START.tab) {
        params.set(TAB, view.tab);
    }
    if (view.filters.query !== '') {
        params.set(QUERY, view.filters.query);
    }
    for (const [filter, key] of Object.entries(SINGLE) as [keyof typeof SINGLE, string][]) {
        const chosen = view.filters[filter];
        if (chosen !== null) {
            params.set(key, chosen);
        }
    }
    for (const tag of view.filters.tags) {
        params.append(TAG, tag);
    }
    if (view.filters.minResolution !== null) {
        params.set(RESOLUTION, String(view.filters.minResolution));
    }
    if (view.filters.hideAi) {
        params.set(AI, AI_HIDDEN);
    }
    if (view.item !== null) {
        params.set(ITEM, view.item);
    }
    const text = params.toString();
    return text === '' ? '' : `?${text}`;
}

/** The address of the piece `id` alone, on the page at `page` (its origin and path). */
export const itemLink = (page: string, id: string): string => `${page}${searchOf({ ...START, item: id })}`;
