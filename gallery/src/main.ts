// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The gallery's entry: fetch the index, point the header's buttons at the
 * download, the direct-install dialog and the request form, build the page, and redraw it as the
 * filters change.
 */
import './style.css';
import { type GalleryItem, parseGalleryIndex } from './catalog';
import { parseDirectory, renderDirectory } from './directory';
import {
    categoryCounts,
    choicesOf,
    type Filters,
    lookChoices,
    narrow,
    NO_FILTERS,
    resolutionChoices,
    settingCounts,
    tagCounts,
    toggledTag,
    visibleSounds,
} from './filter';
import { buildGlossaryDialog, EXPLAINED, type Explained, orderedValues } from './glossary';
import { buildInstallDialog } from './install';
import { ASSET_CLASS_URL, REQUEST_URL } from './issues';
import { buildReportDialog } from './modal';
import { buildShell, type Handlers, kindOfTab, renderCategories, renderDetail, renderGrid, renderSettings, renderSounds, renderTags, showTab } from './view';

/** Fetch `url` as parsed JSON; null where it is missing (an index not built, links not yet made). */
// eslint-disable-next-line no-restricted-syntax -- boundary: fetched JSON of any shape, validated by the caller
async function fetchJson(url: string): Promise<unknown> {
    const response = await fetch(url);
    return response.ok ? response.json() : null;
}

/** Show `message` in place of the gallery. */
function fail(container: HTMLElement, message: string): void {
    const p = container.ownerDocument.createElement('p');
    p.className = 'error';
    p.setAttribute('role', 'alert');
    p.textContent = message;
    container.replaceChildren(p);
}

async function start(container: HTMLElement): Promise<void> {
    const index = parseGalleryIndex(await fetchJson(`./stamps.json?v=${__DATA_VERSION__}`));
    if (!index.ok) {
        fail(container, 'The gallery’s index could not be read.');
        console.error('stamps.json', index.issues);
        return;
    }
    const { items } = index.value;
    const byId = new Map<string, GalleryItem>(items.map((item) => [item.id, item]));
    let filters: Filters = NO_FILTERS;
    const totals = new Map<GalleryItem['kind'], number>();
    for (const item of items) {
        totals.set(item.kind, (totals.get(item.kind) ?? 0) + 1);
    }

    const curator = document.getElementById('curator');
    if (curator !== null) {
        curator.textContent = index.value.curator;
    }
    const request = document.getElementById('request');
    if (request instanceof HTMLAnchorElement) {
        request.href = REQUEST_URL;
    }
    const assetClass = document.getElementById('asset-class');
    if (assetClass instanceof HTMLAnchorElement) {
        assetClass.href = ASSET_CLASS_URL;
    }
    const zipLink = document.getElementById('zip');
    if (zipLink instanceof HTMLAnchorElement) {
        zipLink.href = index.value.install.download;
    }
    const reportButton = document.getElementById('report');
    if (reportButton instanceof HTMLButtonElement) {
        const reportDialog = buildReportDialog(document);
        document.body.append(reportDialog);
        reportButton.hidden = false;
        reportButton.addEventListener('click', () => {
            reportDialog.showModal();
        });
    }
    const installButton = document.getElementById('install');
    if (installButton instanceof HTMLButtonElement) {
        const installDialog = buildInstallDialog(document, index.value.install, async (text) => navigator.clipboard.writeText(text));
        document.body.append(installDialog);
        installButton.hidden = false;
        installButton.addEventListener('click', () => {
            installDialog.showModal();
        });
    }

    const update = (next: Filters): void => {
        filters = next;
        renderSettings(shell, settingCounts(items, filters), filters, handlers);
        renderCategories(shell, categoryCounts(items, filters), filters, handlers);
        renderTags(shell, tagCounts(items, filters), filters, handlers);
        renderSounds(shell, visibleSounds(index.value.sounds, filters));
        renderGrid(shell, narrow(items, filters), totals.get(filters.kind) ?? 0, filters.kind, handlers);
    };
    const handlers: Handlers = {
        search: (query) => {
            update({ ...filters, query });
        },
        category: (category) => {
            update({ ...filters, category, tags: [] });
        },
        toggleTag: (tag) => {
            update(toggledTag(filters, tag));
        },
        clearTags: () => {
            update({ ...filters, tags: [] });
        },
        setting: (setting) => {
            update({ ...filters, setting });
        },
        scale: (scale) => {
            update({ ...filters, scale });
        },
        perspective: (perspective) => {
            update({ ...filters, perspective });
        },
        license: (license) => {
            update({ ...filters, license });
        },
        style: (style) => {
            update({ ...filters, style });
        },
        look: (look) => {
            update({ ...filters, look });
        },
        minResolution: (minResolution) => {
            update({ ...filters, minResolution });
        },
        hideAi: (hideAi) => {
            update({ ...filters, hideAi });
        },
        open: (id) => {
            const item = byId.get(id);
            if (item !== undefined) {
                renderDetail(shell, item);
            }
        },
        tab: (tab) => {
            showTab(shell, tab);
            const kind = kindOfTab(tab);
            if (kind !== null) {
                update({
                    ...NO_FILTERS,
                    query: filters.query,
                    license: filters.license,
                    style: filters.style,
                    minResolution: filters.minResolution,
                    hideAi: filters.hideAi,
                    kind,
                });
            }
        },
        explain: (facet) => {
            glossaries[facet].showModal();
        },
    };
    const choices: Readonly<Record<Explained, readonly string[]>> = {
        scale: orderedValues('scale', choicesOf(items, 'scale')),
        perspective: orderedValues('perspective', choicesOf(items, 'perspective')),
    };
    const shell = buildShell(
        container,
        {
            scales: choices.scale,
            perspectives: choices.perspective,
            licenses: choicesOf(items, 'license'),
            styles: choicesOf(items, 'style'),
            looks: [...new Set([...lookChoices(items, 'token'), ...lookChoices(items, 'character')])].sort(),
            resolutions: resolutionChoices(items),
        },
        handlers,
    );
    const glossaryOf = (facet: Explained): HTMLDialogElement => buildGlossaryDialog(document, facet, choices[facet], items);
    const glossaries: Readonly<Record<Explained, HTMLDialogElement>> = { scale: glossaryOf('scale'), perspective: glossaryOf('perspective') };
    document.body.append(...EXPLAINED.map((facet) => glossaries[facet]));
    update(filters);
    // No directory file yet is an empty directory, not an error.
    const directory = parseDirectory((await fetchJson(`./more-assets.json?v=${__DATA_VERSION__}`)) ?? { packs: [] });
    if (directory.ok) {
        renderDirectory(shell.directory, directory.value);
    } else {
        fail(shell.directory, 'The list of more assets could not be read.');
        console.error('more-assets.json', directory.issues);
    }
}

const gallery = document.getElementById('gallery');
if (gallery !== null) {
    start(gallery).catch((error: Error) => {
        fail(gallery, 'The gallery could not be loaded.');
        console.error(error);
    });
}
