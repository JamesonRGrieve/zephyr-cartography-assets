// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The gallery's page, built from nodes and text (never markup strings): a
 * Stamps tab (the search and its facets, the grid of items, and an item's
 * detail with every variant, its download and a link to report an issue
 * with it) and an Audio tab (each ambient sound, played in the page). The controls are built once, so typing keeps its
 * focus; the parts that change are redrawn from the state each time.
 */
import type { GalleryItem, GallerySound } from './catalog';
import { type Count, type Filters, isSetting, settingLabel, valueLabel } from './filter';
import type { Explained } from './glossary';
import { problemUrl } from './issues';

/** What the page does when used. */
export interface Handlers {
    readonly search: (query: string) => void;
    readonly category: (name: string | null) => void;
    readonly toggleTag: (tag: string) => void;
    readonly clearTags: () => void;
    readonly setting: (setting: string | null) => void;
    readonly scale: (scale: string | null) => void;
    readonly perspective: (perspective: string | null) => void;
    readonly open: (id: string) => void;
    readonly tab: (tab: Tab) => void;
    readonly explain: (facet: Explained) => void;
}

/** The page's tabs. */
export const TABS = ['stamps', 'textures', 'particles', 'audio'] as const;
export type Tab = (typeof TABS)[number];

type Kind = GalleryItem['kind'];

/** The tabs that browse items, each of one kind, sharing the one browser panel. */
const KIND_OF_TAB: Readonly<Partial<Record<Tab, Kind>>> = { stamps: 'stamp', textures: 'texture', particles: 'particle' };

/** Each tab's label. */
const TAB_LABELS: Readonly<Record<Tab, string>> = { stamps: 'Stamps', textures: 'Textures', particles: 'Particle Effects', audio: 'Audio' };

/** The search box's hint on each browsing tab. */
const SEARCH_HINTS: Readonly<Record<Kind, string>> = {
    stamp: 'crate, altar, lantern…',
    texture: 'stone, grass, planks…',
    particle: 'smoke, ember, spark…',
};

/** How a count of each kind is worded: one, many. */
const KIND_NOUNS: Readonly<Record<Kind, readonly [string, string]>> = {
    stamp: ['stamp', 'stamps'],
    texture: ['texture', 'textures'],
    particle: ['particle image', 'particle images'],
};

/** The kind of item `tab` browses; null for a tab that browses none (Audio). */
export const kindOfTab = (tab: Tab): Kind | null => KIND_OF_TAB[tab] ?? null;

/** The page's parts that are redrawn. */
export interface Shell {
    readonly settings: HTMLElement;
    readonly categories: HTMLElement;
    readonly tags: HTMLElement;
    readonly status: HTMLElement;
    readonly grid: HTMLElement;
    readonly dialog: HTMLDialogElement;
    readonly tabs: Readonly<Record<Tab, { readonly button: HTMLButtonElement; readonly panel: HTMLElement }>>;
    /** The scale and perspective choices: stamps alone carry them, so the other tabs hide them. */
    readonly stampChoices: readonly HTMLElement[];
    readonly search: HTMLInputElement;
    readonly sounds: HTMLElement;
}

/** An element of `tag` with its class and text, its children appended. */
export function el<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, className: string, text = '', ...children: Node[]): HTMLElementTagNameMap[K] {
    const node = doc.createElement(tag);
    if (className !== '') {
        node.className = className;
    }
    if (text !== '') {
        node.textContent = text;
    }
    node.append(...children);
    return node;
}

/**
 * A labelled select of `choices`, each shown by its friendly label, the empty
 * choice "Any"; `onPick` gets the value, or null for any. Its (?) button
 * calls `onHelp`, to explain what each choice means.
 */
function select(doc: Document, id: string, label: string, choices: readonly string[], onPick: (value: string | null) => void, onHelp: () => void): HTMLElement {
    const field = el(doc, 'div', 'field');
    const caption = el(doc, 'label', '', label);
    caption.htmlFor = id;
    const help = el(doc, 'button', 'help', '?');
    help.type = 'button';
    help.setAttribute('aria-label', `What each ${label.toLowerCase()} means`);
    help.title = `What each ${label.toLowerCase()} means`;
    help.addEventListener('click', onHelp);
    const control = el(doc, 'select', '');
    control.id = id;
    const option = (text: string, value: string): HTMLOptionElement => Object.assign(el(doc, 'option', '', text), { value });
    control.append(option('Any', ''), ...choices.map((choice) => option(valueLabel(choice), choice)));
    control.addEventListener('change', () => {
        onPick(control.value === '' ? null : control.value);
    });
    field.append(el(doc, 'div', 'field-head', '', caption, help), control);
    return field;
}

/**
 * Build the page's controls and empty parts inside `root`: the tab bar; on
 * the Stamps, Textures and Particle Effects tabs (one browser panel, of the
 * tab's kind) the search box, the scale and perspective choices (stamps
 * only), the setting, category and tag rows, the status line, the grid and
 * the detail dialog; on the Audio tab the list of sounds.
 */
export function buildShell(
    root: HTMLElement,
    choices: { readonly scales: readonly string[]; readonly perspectives: readonly string[] },
    handlers: Handlers,
): Shell {
    const doc = root.ownerDocument;
    const search = el(doc, 'input', '');
    search.type = 'search';
    search.id = 'search';
    search.placeholder = SEARCH_HINTS.stamp;
    search.autocomplete = 'off';
    search.addEventListener('input', () => {
        handlers.search(search.value);
    });
    const searchLabel = el(doc, 'label', '', 'Search');
    searchLabel.htmlFor = 'search';
    const stampChoices = [
        select(doc, 'scale', 'Scale', choices.scales, handlers.scale, () => {
            handlers.explain('scale');
        }),
        select(doc, 'perspective', 'Perspective', choices.perspectives, handlers.perspective, () => {
            handlers.explain('perspective');
        }),
    ];
    const controls = el(doc, 'div', 'controls', '', el(doc, 'div', 'field search', '', searchLabel, search), ...stampChoices);
    const settings = el(doc, 'nav', 'settings');
    settings.setAttribute('aria-label', 'Settings');
    const categories = el(doc, 'nav', 'categories');
    categories.setAttribute('aria-label', 'Categories');
    const tags = el(doc, 'div', 'tags');
    tags.setAttribute('role', 'group');
    tags.setAttribute('aria-label', 'Tags');
    const statusLine = el(doc, 'p', 'status');
    statusLine.setAttribute('role', 'status');
    const grid = el(doc, 'ul', 'grid');
    const dialog = el(doc, 'dialog', 'detail');
    const row = (label: string, part: HTMLElement): HTMLElement => el(doc, 'div', 'facet', '', el(doc, 'span', 'facet-label', label), part);
    const sounds = el(doc, 'ul', 'sounds');
    sounds.setAttribute('aria-label', 'Sounds');
    const browser = el(doc, 'section', 'panel', '', controls, row('Setting', settings), row('Category', categories), row('Tags', tags), statusLine, grid);
    browser.id = 'panel-browse';
    const panels: Readonly<Record<Tab, HTMLElement>> = {
        stamps: browser,
        textures: browser,
        particles: browser,
        audio: el(
            doc,
            'section',
            'panel',
            '',
            el(doc, 'p', 'status', 'Ambient sound loops: a stamp carrying one of a sound’s tags plays it in Foundry.'),
            sounds,
        ),
    };
    const tablist = el(doc, 'div', 'tabs');
    tablist.setAttribute('role', 'tablist');
    const tabOf = (tab: Tab, label: string): { button: HTMLButtonElement; panel: HTMLElement } => {
        const button = el(doc, 'button', 'tab', label);
        button.type = 'button';
        button.id = `tab-${tab}`;
        button.setAttribute('role', 'tab');
        const panel = panels[tab];
        if (panel.id === '') {
            panel.id = `panel-${tab}`;
        }
        panel.setAttribute('role', 'tabpanel');
        button.setAttribute('aria-controls', panel.id);
        button.addEventListener('click', () => {
            handlers.tab(tab);
        });
        tablist.append(button);
        return { button, panel };
    };
    const tabs = {
        stamps: tabOf('stamps', TAB_LABELS.stamps),
        textures: tabOf('textures', TAB_LABELS.textures),
        particles: tabOf('particles', TAB_LABELS.particles),
        audio: tabOf('audio', TAB_LABELS.audio),
    };
    root.replaceChildren(tablist, browser, panels.audio, dialog);
    const shell = { settings, categories, tags, status: statusLine, grid, dialog, tabs, sounds, stampChoices, search };
    showTab(shell, 'stamps');
    return shell;
}

/**
 * Show `tab`'s panel and hide the others, marking its button selected and
 * naming the panel by it. The scale and perspective choices show on the
 * Stamps tab alone, and go back to "Any" on any change of tab (the filters
 * start afresh).
 */
export function showTab(shell: Pick<Shell, 'tabs' | 'grid' | 'stampChoices' | 'search'>, tab: Tab): void {
    const shown = shell.tabs[tab];
    for (const each of TABS) {
        const { button, panel } = shell.tabs[each];
        button.setAttribute('aria-selected', String(each === tab));
        panel.hidden = panel !== shown.panel;
    }
    shown.panel.setAttribute('aria-labelledby', shown.button.id);
    shell.grid.setAttribute('aria-label', TAB_LABELS[tab]);
    const kind = kindOfTab(tab);
    if (kind !== null) {
        shell.search.placeholder = SEARCH_HINTS[kind];
    }
    for (const field of shell.stampChoices) {
        field.hidden = tab !== 'stamps';
        const control = field.querySelector('select');
        if (control !== null) {
            control.value = '';
        }
    }
}

/** A toggle button, pressed or not. */
function toggle(doc: Document, text: string, pressed: boolean, onClick: () => void): HTMLButtonElement {
    const button = el(doc, 'button', 'chip', text);
    button.type = 'button';
    button.setAttribute('aria-pressed', String(pressed));
    button.addEventListener('click', onClick);
    return button;
}

/** The setting row: All settings, then each by its friendly name with its count, the chosen one pressed. */
export function renderSettings(shell: Shell, counts: readonly Count[], filters: Filters, handlers: Handlers): void {
    const doc = shell.settings.ownerDocument;
    shell.settings.replaceChildren(
        toggle(doc, 'All settings', filters.setting === null, () => {
            handlers.setting(null);
        }),
        ...counts.map((c) =>
            toggle(doc, `${settingLabel(c.name)} (${c.count})`, filters.setting === c.name, () => {
                handlers.setting(c.name);
            }),
        ),
    );
}

/** The category row: All, then each category with its count, the chosen one pressed. */
export function renderCategories(shell: Shell, counts: readonly Count[], filters: Filters, handlers: Handlers): void {
    const doc = shell.categories.ownerDocument;
    const total = counts.reduce((sum, c) => sum + c.count, 0);
    shell.categories.replaceChildren(
        toggle(doc, `All (${total})`, filters.category === null, () => {
            handlers.category(null);
        }),
        ...counts.map((c) =>
            toggle(doc, `${c.name} (${c.count})`, filters.category === c.name, () => {
                handlers.category(c.name);
            }),
        ),
    );
}

/** The tag row: each chosen tag as a removable chip, then those to add, and a clear button while any are chosen. */
export function renderTags(shell: Shell, counts: readonly Count[], filters: Filters, handlers: Handlers): void {
    const doc = shell.tags.ownerDocument;
    const chosen = filters.tags.map((tag) =>
        toggle(doc, `${tag} ×`, true, () => {
            handlers.toggleTag(tag);
        }),
    );
    const offered = counts.map((c) =>
        toggle(doc, `${c.name} (${c.count})`, false, () => {
            handlers.toggleTag(c.name);
        }),
    );
    const clear = el(doc, 'button', 'clear', 'Clear tags');
    clear.type = 'button';
    clear.addEventListener('click', handlers.clearTags);
    shell.tags.replaceChildren(...chosen, ...offered, ...(filters.tags.length > 0 ? [clear] : []));
}

/** An image, lazily loaded. */
export function image(doc: Document, src: string, alt: string): HTMLImageElement {
    const img = el(doc, 'img', '');
    img.src = src;
    img.alt = alt;
    img.loading = 'lazy';
    img.decoding = 'async';
    return img;
}

/** The grid of `total` items of `kind`, `items` of them shown: each a button showing its first image, its name and its variant count, that opens its detail. */
export function renderGrid(shell: Shell, items: readonly GalleryItem[], total: number, kind: Kind, handlers: Handlers): void {
    const doc = shell.grid.ownerDocument;
    const [one, many] = KIND_NOUNS[kind];
    shell.status.textContent = items.length === total ? `${total} ${total === 1 ? one : many}` : `${items.length} of ${total} ${many} shown`;
    shell.grid.replaceChildren(
        ...items.map((item) => {
            const [first] = item.variants;
            const button = el(
                doc,
                'button',
                'card',
                '',
                ...(first === undefined ? [] : [image(doc, first.thumb, '')]),
                el(doc, 'span', 'name', item.name),
                el(doc, 'span', 'meta', `${item.category} · ${item.variants.length} ${item.variants.length === 1 ? 'image' : 'images'}`),
            );
            button.type = 'button';
            button.addEventListener('click', () => {
                handlers.open(item.id);
            });
            return el(doc, 'li', '', '', button);
        }),
    );
}

/**
 * One variant in the detail: its preview, its label and full size, a
 * download of the preview, and where the full-size image is in the archive.
 */
function variantFigure(doc: Document, item: GalleryItem, variant: GalleryItem['variants'][number], label: string): HTMLElement {
    const size = `Full size ${variant.width}×${variant.height}px`;
    const download = Object.assign(el(doc, 'a', 'download', 'Download preview'), { href: variant.preview, download: '' });
    const inArchive = el(doc, 'span', 'in-archive', '', doc.createTextNode('Full size in the archive: '), el(doc, 'code', '', variant.file));
    const report = Object.assign(el(doc, 'a', 'report', 'Report an issue'), { href: problemUrl(item, variant), rel: 'noopener', target: '_blank' });
    return el(
        doc,
        'figure',
        'variant',
        '',
        image(doc, variant.preview, `${item.name}, ${label}`),
        el(doc, 'figcaption', '', '', el(doc, 'span', 'state', label), el(doc, 'span', 'size', size), download, inArchive, report),
    );
}

/** Each variant's label: its state, numbered where several variants share it ("lit 1", "lit 2"). */
export function variantLabels(variants: GalleryItem['variants']): string[] {
    const total = new Map<string, number>();
    for (const { state } of variants) {
        total.set(state, (total.get(state) ?? 0) + 1);
    }
    const seen = new Map<string, number>();
    return variants.map(({ state }) => {
        const nth = (seen.get(state) ?? 0) + 1;
        seen.set(state, nth);
        return (total.get(state) ?? 1) > 1 ? `${state} ${nth}` : state;
    });
}

/** Each variant with its label. */
const zipLabels = (variants: GalleryItem['variants']): [GalleryItem['variants'][number], string][] => {
    const labels = variantLabels(variants);
    return variants.map((variant, i) => [variant, labels[i] ?? variant.state]);
};

/** Where something comes from: AI-generated and CC0, or another author's CC0 work credited to them with a link to its source. */
function originNote(doc: Document, credit: GalleryItem['credit']): HTMLElement {
    if (credit === null) {
        return el(doc, 'p', 'origin', 'AI-generated · CC0 1.0 (public domain)');
    }
    const source = Object.assign(el(doc, 'a', '', 'source'), { href: credit.source, rel: 'noopener', target: '_blank' });
    return el(doc, 'p', 'origin', '', doc.createTextNode(`CC0 1.0 · by ${credit.author} (`), source, doc.createTextNode(')'));
}

/**
 * The Audio tab: each sound with its player, the tags whose stamps play
 * it (and how many stamps carry them), how far it carries, its credit, and
 * its download.
 */
export function renderSounds(shell: Shell, sounds: readonly GallerySound[]): void {
    const doc = shell.sounds.ownerDocument;
    shell.sounds.replaceChildren(
        ...sounds.map((sound) => {
            const player = el(doc, 'audio', '');
            player.controls = true;
            player.loop = true;
            player.preload = 'none';
            player.src = sound.audio;
            player.setAttribute('aria-label', `Play ${sound.name}`);
            const download = Object.assign(el(doc, 'a', 'download', 'Download'), { href: sound.audio, download: '' });
            const stamps = `${sound.stamps} ${sound.stamps === 1 ? 'stamp' : 'stamps'}`;
            return el(
                doc,
                'li',
                'sound',
                '',
                el(doc, 'h3', '', sound.name),
                player,
                el(doc, 'p', 'facts', `Plays for stamps tagged ${sound.triggers.join(', ')} (${stamps}) · heard within ${sound.radius} squares`),
                originNote(doc, sound.credit),
                el(doc, 'p', 'in-archive', '', doc.createTextNode('In the archive: '), el(doc, 'code', '', sound.file)),
                download,
            );
        }),
    );
}

/** Fill and open the detail dialog with `item`: its name, category, origin, tags and every variant. */
export function renderDetail(shell: Shell, item: GalleryItem): void {
    const doc = shell.dialog.ownerDocument;
    const closer = el(doc, 'button', 'close', 'Close');
    closer.type = 'button';
    closer.addEventListener('click', () => {
        shell.dialog.close();
    });
    const facts = [
        `Category: ${item.category}`,
        ...(item.scale === null ? [] : [`Scale: ${valueLabel(item.scale)}`]),
        ...(item.perspective === null ? [] : [`Perspective: ${valueLabel(item.perspective)}`]),
    ].join(' · ');
    const heading = el(doc, 'h2', '', item.name);
    heading.id = 'detail-heading';
    shell.dialog.setAttribute('aria-labelledby', heading.id);
    shell.dialog.replaceChildren(
        el(doc, 'header', '', '', heading, closer),
        el(doc, 'p', 'facts', facts),
        originNote(doc, item.credit),
        el(doc, 'ul', 'item-tags', '', ...item.tags.map((tag) => el(doc, 'li', isSetting(tag) ? 'setting' : '', isSetting(tag) ? settingLabel(tag) : tag))),
        el(doc, 'div', 'variants', '', ...zipLabels(item.variants).map(([variant, label]) => variantFigure(doc, item, variant, label))),
    );
    if (!shell.dialog.open) {
        shell.dialog.showModal();
    }
}
