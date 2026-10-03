// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The gallery's page, built from nodes and text (never markup strings): a
 * Stamps tab (the search and its facets, the grid of items, and an item's
 * detail with every variant, its download and a link to report an issue
 * with it), Sound Effects and Music tabs (each played in the page) and a
 * Scenes tab, and a More Assets tab: a directory of packs that cannot be
 * shared here. The controls are built once, so typing keeps its
 * focus; the parts that change are redrawn from the state each time.
 */
import type { GalleryItem, GallerySound, MusicTrack, SoundEffect } from './catalog';
import { RELEASE_LABELS, releasesHolding } from './channels';
import { isExternal } from './external';
import { type Count, type Filters, isLook, isSetting, resolutionLabel, settingLabel, valueLabel } from './filter';
import type { Explained } from './glossary';
import { LISTING_URL, problemUrl, takesVariantRequests, variantRequestUrl } from './issues';
import { licenseUrl } from './licenses';
import { artStyleLabel, lookLabel } from './styles';

/** What the page does when used. */
export interface Handlers {
    readonly search: (query: string) => void;
    readonly category: (name: string | null) => void;
    readonly toggleTag: (tag: string) => void;
    readonly clearTags: () => void;
    readonly setting: (setting: string | null) => void;
    readonly scale: (scale: string | null) => void;
    readonly perspective: (perspective: string | null) => void;
    readonly license: (license: string | null) => void;
    readonly style: (style: string | null) => void;
    readonly look: (look: string | null) => void;
    readonly minResolution: (px: number | null) => void;
    readonly hideAi: (hide: boolean) => void;
    readonly open: (id: string) => void;
    readonly tab: (tab: Tab) => void;
    readonly explain: (facet: Explained) => void;
}

/** The page's tabs. */
export const TABS = ['stamps', 'tiles', 'tokens', 'characters', 'textures', 'particles', 'effects', 'music', 'scenes', 'more'] as const;
export type Tab = (typeof TABS)[number];

type Kind = GalleryItem['kind'];

/** The tabs that browse items, each of one kind, sharing the one browser panel. */
const KIND_OF_TAB: Readonly<Partial<Record<Tab, Kind>>> = {
    stamps: 'stamp',
    tiles: 'tile',
    tokens: 'token',
    characters: 'character',
    textures: 'texture',
    particles: 'particle',
    scenes: 'scene',
};

/** The kinds no release carries (`GALLERY_ONLY` in the channels): found and downloaded here alone. */
const GALLERY_ONLY_KINDS: ReadonlySet<Kind> = new Set(['token', 'character']);

/** The tabs offering the Look choice: the kinds whose pieces carry looks. */
const LOOK_TABS: ReadonlySet<Tab> = new Set(['tokens', 'characters']);

/** Each tab's label. */
const TAB_LABELS: Readonly<Record<Tab, string>> = {
    stamps: 'Stamps',
    tiles: 'Tiles',
    tokens: 'Tokens',
    characters: 'Character Art',
    textures: 'Textures',
    particles: 'Particle Effects',
    effects: 'Sound Effects',
    music: 'Music',
    scenes: 'Scenes',
    more: 'More Assets',
};

/** The search box's hint on each browsing tab. */
const SEARCH_HINTS: Readonly<Record<Kind, string>> = {
    stamp: 'crate, altar, lantern…',
    tile: 'corridor, junction, room…',
    token: 'guard, wolf, mage…',
    character: 'knight, merchant, priest…',
    texture: 'stone, grass, planks…',
    particle: 'smoke, ember, spark…',
    scene: 'manor, cave, vault…',
};

/** How a count of each kind is worded: one, many. */
const KIND_NOUNS: Readonly<Record<Kind, readonly [string, string]>> = {
    stamp: ['stamp', 'stamps'],
    tile: ['tile', 'tiles'],
    token: ['token', 'tokens'],
    character: ['character portrait', 'character portraits'],
    texture: ['texture', 'textures'],
    particle: ['particle effect', 'particle effects'],
    scene: ['scene', 'scenes'],
};

/** The kind of item `tab` browses; null for a tab that browses none (the audio tabs). */
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
    /** The Look choice: shown on the Tokens and Character Art tabs alone. */
    readonly lookChoice: HTMLElement;
    readonly search: HTMLInputElement;
    /** The audio tabs' lists: sound effects, and music. */
    readonly sounds: Readonly<Record<GallerySound['kind'], HTMLElement>>;
    /** The More Assets tab's list of packs. */
    readonly directory: HTMLElement;
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

/** How a select shows its choices, and whether it has a (?) explaining them. */
interface SelectOptions {
    /** Each choice as shown. */
    readonly labelOf: (value: string) => string;
    /** Opens the explanation of the choices; none: no (?) button. */
    readonly onHelp: (() => void) | null;
}

/** A labelled select of `choices`, the empty choice "Any"; `onPick` gets the value, or null for any. */
function select(
    doc: Document,
    id: string,
    label: string,
    choices: readonly string[],
    onPick: (value: string | null) => void,
    options: SelectOptions,
): HTMLElement {
    const field = el(doc, 'div', 'field');
    const caption = el(doc, 'label', '', label);
    caption.htmlFor = id;
    const head = el(doc, 'div', 'field-head', '', caption);
    if (options.onHelp !== null) {
        const help = el(doc, 'button', 'help', '?');
        help.type = 'button';
        help.setAttribute('aria-label', `What each ${label.toLowerCase()} means`);
        help.title = `What each ${label.toLowerCase()} means`;
        help.addEventListener('click', options.onHelp);
        head.append(help);
    }
    const control = el(doc, 'select', '');
    control.id = id;
    const option = (text: string, value: string): HTMLOptionElement => Object.assign(el(doc, 'option', '', text), { value });
    control.append(option('Any', ''), ...choices.map((choice) => option(options.labelOf(choice), choice)));
    control.addEventListener('change', () => {
        onPick(control.value === '' ? null : control.value);
    });
    field.append(head, control);
    return field;
}

/**
 * Build the page's controls and empty parts inside `root`: the tab bar; on
 * the Stamps, Tiles, Tokens, Character Art, Textures and Particle Effects
 * tabs (one browser panel, of the tab's kind) the search box, the scale and perspective choices (stamps
 * only), the licence choice, the setting, category and tag rows, the status line, the grid and
 * the detail dialog; on the Sound Effects, Music and Scenes tabs their lists.
 */
export function buildShell(
    root: HTMLElement,
    choices: {
        readonly scales: readonly string[];
        readonly perspectives: readonly string[];
        readonly licenses: readonly string[];
        readonly styles: readonly string[];
        readonly looks: readonly string[];
        readonly resolutions: readonly number[];
    },
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
        select(doc, 'scale', 'Scale', choices.scales, handlers.scale, {
            labelOf: valueLabel,
            onHelp: () => {
                handlers.explain('scale');
            },
        }),
        select(doc, 'perspective', 'Perspective', choices.perspectives, handlers.perspective, {
            labelOf: valueLabel,
            onHelp: () => {
                handlers.explain('perspective');
            },
        }),
    ];
    // Licences show as their SPDX ids, which are the names their own texts go by.
    const licenseChoice = select(doc, 'license', 'License', choices.licenses, handlers.license, { labelOf: (license) => license, onHelp: null });
    const hideAiBox = el(doc, 'input', '');
    hideAiBox.type = 'checkbox';
    hideAiBox.id = 'hide-ai';
    hideAiBox.addEventListener('change', () => {
        handlers.hideAi(hideAiBox.checked);
    });
    const hideAiChoice = el(doc, 'label', 'field toggle', '', hideAiBox, doc.createTextNode(' Hide AI-generated'));
    const styleChoice = select(doc, 'style', 'Art style', choices.styles, handlers.style, { labelOf: artStyleLabel, onHelp: null });
    const lookChoice = select(doc, 'look', 'Look', choices.looks, handlers.look, { labelOf: lookLabel, onHelp: null });
    const resolutionChoice = select(
        doc,
        'resolution',
        'Minimum resolution',
        choices.resolutions.map(String),
        (value) => {
            handlers.minResolution(value === null ? null : Number(value));
        },
        { labelOf: (value) => resolutionLabel(Number(value)), onHelp: null },
    );
    const controls = el(
        doc,
        'div',
        'controls',
        '',
        el(doc, 'div', 'field search', '', searchLabel, search),
        ...stampChoices,
        licenseChoice,
        styleChoice,
        lookChoice,
        resolutionChoice,
        hideAiChoice,
    );
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
    const soundList = (label: string): HTMLElement => {
        const list = el(doc, 'ul', 'sounds');
        list.setAttribute('aria-label', label);
        return list;
    };
    const sounds = { effect: soundList('Sound effects'), music: soundList('Music') };
    const directory = el(doc, 'ul', 'directory');
    directory.setAttribute('aria-label', 'More assets');
    const browser = el(doc, 'section', 'panel', '', controls, row('Setting', settings), row('Category', categories), row('Tags', tags), statusLine, grid);
    browser.id = 'panel-browse';
    const panels: Readonly<Record<Tab, HTMLElement>> = {
        stamps: browser,
        tiles: browser,
        tokens: browser,
        characters: browser,
        textures: browser,
        particles: browser,
        effects: el(
            doc,
            'section',
            'panel',
            '',
            el(doc, 'p', 'status', 'Ambient loops (a stamp carrying one of a loop’s tags plays it in Foundry) and sound effects to play by hand.'),
            sounds.effect,
        ),
        music: el(
            doc,
            'section',
            'panel',
            '',
            el(doc, 'p', 'status', 'Music to play over a scene: a preview of each track here, the whole track from its author. Music is in no release.'),
            sounds.music,
        ),
        scenes: browser,
        more: el(
            doc,
            'section',
            'panel',
            '',
            el(doc, 'p', 'status', 'Other people’s packs not bundled here (each says why: most licences forbid sharing them): get them from their authors.'),
            Object.assign(el(doc, 'a', 'button listing', 'Request Listing of a Free Asset Pack'), { href: LISTING_URL, rel: 'noopener', target: '_blank' }),
            directory,
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
        tiles: tabOf('tiles', TAB_LABELS.tiles),
        tokens: tabOf('tokens', TAB_LABELS.tokens),
        characters: tabOf('characters', TAB_LABELS.characters),
        textures: tabOf('textures', TAB_LABELS.textures),
        particles: tabOf('particles', TAB_LABELS.particles),
        effects: tabOf('effects', TAB_LABELS.effects),
        music: tabOf('music', TAB_LABELS.music),
        scenes: tabOf('scenes', TAB_LABELS.scenes),
        more: tabOf('more', TAB_LABELS.more),
    };
    root.replaceChildren(tablist, browser, panels.effects, panels.music, panels.more, dialog);
    const shell = { settings, categories, tags, status: statusLine, grid, dialog, tabs, sounds, directory, stampChoices, lookChoice, search };
    showTab(shell, 'stamps');
    return shell;
}

/**
 * Show `tab`'s panel and hide the others, marking its button selected and
 * naming the panel by it. The scale and perspective choices show on the
 * Stamps tab alone, the Look choice on the Tokens and Character Art tabs
 * alone; each goes back to "Any" on any change of tab (the filters start
 * afresh).
 */
export function showTab(shell: Pick<Shell, 'tabs' | 'grid' | 'stampChoices' | 'lookChoice' | 'search'>, tab: Tab): void {
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
    const reset = (field: HTMLElement, visible: boolean): void => {
        field.hidden = !visible;
        const control = field.querySelector('select');
        if (control !== null) {
            control.value = '';
        }
    };
    for (const field of shell.stampChoices) {
        reset(field, tab === 'stamps');
    }
    reset(shell.lookChoice, LOOK_TABS.has(tab));
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

/** What a card counts: a scene's levels, an effect's animations, else its images. */
function countOf(item: GalleryItem): string {
    const n = item.variants.length;
    if (item.kind === 'scene') {
        return `${n} ${n === 1 ? 'level' : 'levels'}`;
    }
    if (item.variants.some((variant) => variant.video !== undefined)) {
        return `${n} ${n === 1 ? 'animation' : 'animations'}`;
    }
    return `${n} ${n === 1 ? 'image' : 'images'}`;
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
                el(doc, 'span', 'meta', `${item.category} · ${countOf(item)}`),
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
    // A linked image is shown and downloaded from its own address, at its own size.
    const linked = isExternal(variant.preview);
    const galleryOnly = GALLERY_ONLY_KINDS.has(item.kind);
    const size = variant.width === null || variant.height === null ? 'Full size at its source' : `Full size ${variant.width}×${variant.height}px`;
    const download =
        variant.video !== undefined
            ? Object.assign(el(doc, 'a', 'download', 'Download video'), { href: variant.video, download: '' })
            : linked
            ? Object.assign(el(doc, 'a', 'download', 'Download from its source'), { href: variant.preview, rel: 'noopener', target: '_blank' })
            : Object.assign(el(doc, 'a', 'download', galleryOnly ? 'Download' : 'Download preview'), { href: variant.preview, download: '' });
    const uvtt =
        variant.uvtt === undefined
            ? []
            : [Object.assign(el(doc, 'a', 'download uvtt', 'Download Universal VTT (.dd2vtt)'), { href: variant.uvtt, download: '' })];
    // Tokens and character art are in no release: this page is where they are downloaded, at full size.
    const where = galleryOnly
        ? el(doc, 'span', 'in-archive', 'In no release: download it here.')
        : el(doc, 'span', 'in-archive', '', doc.createTextNode('Full size in the archive: '), el(doc, 'code', '', variant.file));
    const report = Object.assign(el(doc, 'a', 'report', 'Report an issue'), { href: problemUrl(item, variant), rel: 'noopener', target: '_blank' });
    return el(
        doc,
        'figure',
        'variant',
        '',
        variant.video === undefined
            ? image(doc, variant.preview, `${item.name}, ${label}`)
            : video(doc, variant.video, variant.preview, `${item.name}, ${label}`),
        el(
            doc,
            'figcaption',
            '',
            '',
            el(doc, 'span', 'state', label),
            el(doc, 'span', 'size', size),
            // A variant from another source (a colourway sold apart) is credited to its own.
            ...(variant.origin === undefined ? [] : [originNote(doc, variant.origin)]),
            download,
            ...uvtt,
            where,
            report,
        ),
    );
}

/** An animated effect's video: looping, muted, played inline, its still shown until it plays. */
function video(doc: Document, src: string, poster: string, label: string): HTMLVideoElement {
    const player = el(doc, 'video', '');
    player.src = src;
    player.setAttribute('poster', poster);
    player.loop = true;
    player.muted = true;
    player.autoplay = true;
    player.playsInline = true;
    player.controls = true;
    player.preload = 'metadata';
    player.setAttribute('aria-label', label);
    return player;
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

/** A licence's tag: its SPDX id, linking to its full text. */
function licenseTag(doc: Document, license: string): HTMLElement {
    return Object.assign(el(doc, 'a', 'license', license), {
        href: licenseUrl(license),
        rel: 'license noopener',
        target: '_blank',
        title: `${license}: read the licence`,
    });
}

/**
 * Where something comes from and how it may be used: whether it is
 * AI-generated, who made it with a link to its source (the pack's repository
 * for art made for it), and its licence, as a tag linking to the licence's
 * text.
 */
function originNote(doc: Document, piece: Pick<GalleryItem, 'ai' | 'credit' | 'license'>): HTMLElement {
    const source = Object.assign(el(doc, 'a', '', 'source'), { href: piece.credit.source, rel: 'noopener', target: '_blank' });
    return el(
        doc,
        'p',
        'origin',
        '',
        doc.createTextNode(`${piece.ai ? 'AI-generated · ' : ''}By ${piece.credit.author} (`),
        source,
        doc.createTextNode(') · '),
        licenseTag(doc, piece.license),
    );
}

/** What an audio list says when it has nothing yet. */
const NO_SOUNDS: Readonly<Record<GallerySound['kind'], string>> = { effect: 'No sound effects yet.', music: 'No music yet.' };

/** What a sound's entry says about it beyond its name: an ambient loop's tags, stamps and reach, a library effect's group and whether it loops, music's group. */
function soundFacts(sound: SoundEffect | MusicTrack): string {
    if (sound.kind === 'music') {
        return `${sound.category} · a 30-second preview: the whole track is at its author’s page`;
    }
    if (sound.triggers.length === 0 || sound.radius === null) {
        return [sound.category, sound.loop ? 'Loops' : 'Plays once'].filter((part) => part !== undefined).join(' · ');
    }
    const stamps = `${sound.stamps} ${sound.stamps === 1 ? 'stamp' : 'stamps'}`;
    return `Plays for stamps tagged ${sound.triggers.join(', ')} (${stamps}) · heard within ${sound.radius} squares`;
}

/** One sound's entry: its name, a looping player, its facts, its credit, where it is in the archive, and its download. */
function soundEntry(doc: Document, sound: GallerySound): HTMLElement {
    const player = el(doc, 'audio', '');
    player.controls = true;
    player.loop = sound.kind === 'effect' && sound.loop;
    player.preload = 'none';
    player.src = sound.audio;
    player.setAttribute('aria-label', `Play ${sound.name}`);
    // Music is in no release and only previewed here: its whole track is from its author.
    const download =
        sound.kind === 'music'
            ? Object.assign(el(doc, 'a', 'download', 'Get the whole track from its author'), { href: sound.credit.source, rel: 'noopener', target: '_blank' })
            : isExternal(sound.audio)
            ? Object.assign(el(doc, 'a', 'download', 'Download from its source'), { href: sound.audio, rel: 'noopener', target: '_blank' })
            : Object.assign(el(doc, 'a', 'download', 'Download'), { href: sound.audio, download: '' });
    return el(
        doc,
        'li',
        'sound',
        '',
        el(doc, 'h3', '', sound.name),
        player,
        el(doc, 'p', 'facts', soundFacts(sound)),
        originNote(doc, sound),
        ...(sound.kind === 'music' ? [] : [el(doc, 'p', 'in-archive', '', doc.createTextNode('In the archive: '), el(doc, 'code', '', sound.file))]),
        download,
    );
}

/**
 * The Sound Effects and Music tabs: each sound with its player, an effect's
 * tags (and how many stamps carry them) and reach, its credit and its
 * download; a list with none says so.
 */
export function renderSounds(shell: Shell, sounds: readonly GallerySound[]): void {
    for (const kind of ['effect', 'music'] as const) {
        const list = shell.sounds[kind];
        const doc = list.ownerDocument;
        const ofKind = sounds.filter((sound) => sound.kind === kind);
        list.replaceChildren(...(ofKind.length === 0 ? [el(doc, 'li', 'empty', NO_SOUNDS[kind])] : ofKind.map((sound) => soundEntry(doc, sound))));
    }
}

/** Which releases hold `item` (a scene in their Scenes compendium), or that none does. */
function releasesNote(item: GalleryItem): string {
    const held = releasesHolding(item, GALLERY_ONLY_KINDS.has(item.kind)).map((channel) => RELEASE_LABELS[channel]);
    if (held.length === 0) {
        return 'In no release';
    }
    return `${item.kind === 'scene' ? 'In the Scenes compendium of releases' : 'In releases'}: ${held.join(', ')}`;
}

/** A detail tag's class: a setting's, a look's, or none. */
const tagClass = (tag: string): string => (isSetting(tag) ? 'setting' : isLook(tag) ? 'look' : '');

/** A detail tag as shown: a setting or a look by its label, any other as it is. */
const tagText = (tag: string): string => (isSetting(tag) ? settingLabel(tag) : isLook(tag) ? lookLabel(tag) : tag);

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
        `Art style: ${artStyleLabel(item.style)}`,
        ...(item.scale === null ? [] : [`Scale: ${valueLabel(item.scale)}`]),
        ...(item.perspective === null ? [] : [`Perspective: ${valueLabel(item.perspective)}`]),
        ...(item.grid === undefined ? [] : [`${item.grid.w}×${item.grid.h} squares at ${item.grid.size} px a square`]),
        releasesNote(item),
    ].join(' · ');
    const heading = el(doc, 'h2', '', item.name);
    heading.id = 'detail-heading';
    shell.dialog.setAttribute('aria-labelledby', heading.id);
    shell.dialog.replaceChildren(
        el(doc, 'header', '', '', heading, closer),
        el(doc, 'p', 'facts', facts),
        originNote(doc, item),
        // Variants are asked of the pack's own art only, never of other authors' work.
        ...(takesVariantRequests(item)
            ? [Object.assign(el(doc, 'a', 'button request-variant', 'Request variant'), { href: variantRequestUrl(item), rel: 'noopener', target: '_blank' })]
            : []),
        el(doc, 'ul', 'item-tags', '', ...item.tags.map((tag) => el(doc, 'li', tagClass(tag), tagText(tag)))),
        el(doc, 'div', 'variants', '', ...zipLabels(item.variants).map(([variant, label]) => variantFigure(doc, item, variant, label))),
    );
    if (!shell.dialog.open) {
        shell.dialog.showModal();
    }
}
