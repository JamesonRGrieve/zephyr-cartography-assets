// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Assets the pack links on the web rather than carries: an asset path that
 * is an absolute http(s) URL. The gallery shows, plays and links them where
 * they are (nothing is copied onto the site, which keeps it within its size
 * quota); a release bundles each one at a fixed path inside the module and
 * points its pack manifest there, so an installed module needs no one
 * else's server. Pure.
 */

/** Whether an asset path is a web link rather than a file in the module. */
export const isExternal = (path: string): boolean => /^https?:\/\//iu.test(path);

/** Characters kept as they are in a bundled path's segments; anything else becomes `_`. */
const SAFE_SEGMENT = /[^A-Za-z0-9._-]/gu;

/**
 * Where a release bundles the linked asset at `url`, relative to the module:
 * `external/<host>/<path>`, each segment reduced to safe characters, the
 * query (if any) folded into the file name so two links never share a path.
 */
export function bundledPath(url: string): string {
    const parsed = new URL(url);
    const segments = parsed.pathname
        .split('/')
        .filter((segment) => segment !== '')
        .map((segment) => decodeURIComponent(segment).replace(SAFE_SEGMENT, '_'));
    const last = segments.pop() ?? 'index';
    const query = parsed.search === '' ? '' : `_${parsed.search.slice(1).replace(SAFE_SEGMENT, '_')}`;
    const dot = last.lastIndexOf('.');
    const named = dot > 0 ? `${last.slice(0, dot)}${query}${last.slice(dot)}` : `${last}${query}`;
    return ['external', parsed.host.replace(SAFE_SEGMENT, '_'), ...segments, named].join('/');
}

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/**
 * Manifest keys whose web addresses are records, not assets: where a piece
 * came from (`provenance`, a texture set's per-role `sources`) and the
 * schema the manifest follows. They are never downloaded or rewritten.
 */
const RECORD_KEYS: ReadonlySet<string> = new Set(['provenance', 'sources', '$schema']);

/** Every linked asset `json` names (a web address outside its records), once each, however deep. */
export function linkedAssets(json: Json): string[] {
    const found = new Set<string>();
    const walk = (node: Json): void => {
        if (typeof node === 'string') {
            if (isExternal(node)) {
                found.add(node);
            }
        } else if (Array.isArray(node)) {
            node.forEach(walk);
        } else if (node !== null && typeof node === 'object') {
            for (const [key, value] of Object.entries(node)) {
                if (!RECORD_KEYS.has(key)) {
                    walk(value);
                }
            }
        }
    };
    walk(json);
    return [...found];
}

/** `json` with every asset string that is a key of `paths` replaced by its value, however deep; its records left as they are. */
export function relinked(json: Json, paths: ReadonlyMap<string, string>): Json {
    if (typeof json === 'string') {
        return paths.get(json) ?? json;
    }
    if (Array.isArray(json)) {
        return json.map((entry) => relinked(entry, paths));
    }
    if (json !== null && typeof json === 'object') {
        return Object.fromEntries(Object.entries(json).map(([key, value]) => [key, RECORD_KEYS.has(key) ? value : relinked(value, paths)]));
    }
    return json;
}
