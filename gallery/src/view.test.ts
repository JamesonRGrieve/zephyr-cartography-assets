// SPDX-License-Identifier: AGPL-3.0-or-later
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NO_FILTERS } from './filter';
import { CRATE, FIRE, GRASS, ITEMS, variant } from './fixtures';
import {
    buildShell,
    type Handlers,
    kindOfTab,
    renderCategories,
    renderDetail,
    renderGrid,
    renderSettings,
    renderSounds,
    renderTags,
    type Shell,
    showTab,
    TABS,
    variantLabels,
} from './view';

function handlersSpy() {
    return {
        search: vi.fn<Handlers['search']>(),
        category: vi.fn<Handlers['category']>(),
        toggleTag: vi.fn<Handlers['toggleTag']>(),
        clearTags: vi.fn<Handlers['clearTags']>(),
        setting: vi.fn<Handlers['setting']>(),
        scale: vi.fn<Handlers['scale']>(),
        perspective: vi.fn<Handlers['perspective']>(),
        open: vi.fn<Handlers['open']>(),
        tab: vi.fn<Handlers['tab']>(),
        explain: vi.fn<Handlers['explain']>(),
    };
}

let root: HTMLElement;
let handlers: ReturnType<typeof handlersSpy>;
let shell: Shell;

beforeEach(() => {
    document.body.innerHTML = '';
    root = document.createElement('main');
    document.body.append(root);
    handlers = handlersSpy();
    shell = buildShell(root, { scales: ['city', 'interior'], perspectives: ['orthographic'] }, handlers);
});

describe('filter help', () => {
    it('gives the scale and perspective choices a labelled (?) button that asks for their explanation', () => {
        const scaleHelp = root.querySelector<HTMLButtonElement>('button[aria-label="What each scale means"]');
        const perspectiveHelp = root.querySelector<HTMLButtonElement>('button[aria-label="What each perspective means"]');
        expect(scaleHelp?.textContent).toBe('?');
        scaleHelp?.click();
        perspectiveHelp?.click();
        expect(handlers.explain.mock.calls).toEqual([['scale'], ['perspective']]);
    });
});

describe('tabs', () => {
    it('opens on the Stamps tab, and shows the Audio tab’s panel alone once it is chosen', () => {
        const [stamps, textures, particles, audio] = [...root.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
        expect([stamps, textures, particles, audio].map((tab) => tab?.textContent)).toEqual(['Stamps', 'Textures', 'Particle Effects', 'Audio']);
        expect(stamps?.getAttribute('aria-selected')).toBe('true');
        expect(shell.tabs.audio.panel.hidden).toBe(true);
        audio?.click();
        expect(handlers.tab).toHaveBeenCalledWith('audio');
        showTab(shell, 'audio');
        expect(shell.tabs.stamps.panel.hidden).toBe(true);
        expect(shell.tabs.audio.panel.hidden).toBe(false);
        expect(audio?.getAttribute('aria-selected')).toBe('true');
        expect(audio?.getAttribute('aria-controls')).toBe(shell.tabs.audio.panel.id);
    });

    it('browses stamps, textures and particles in the one panel, named by the tab, the scale and perspective choices on Stamps alone', () => {
        const browser = shell.tabs.stamps.panel;
        expect([shell.tabs.textures.panel, shell.tabs.particles.panel]).toEqual([browser, browser]);
        expect(shell.tabs.textures.button.getAttribute('aria-controls')).toBe(browser.id);
        const scale = root.querySelector<HTMLSelectElement>('#scale');
        if (scale !== null) {
            scale.value = 'city';
        }
        showTab(shell, 'textures');
        expect(browser.hidden).toBe(false);
        expect(shell.tabs.audio.panel.hidden).toBe(true);
        expect(browser.getAttribute('aria-labelledby')).toBe(shell.tabs.textures.button.id);
        expect(shell.grid.getAttribute('aria-label')).toBe('Textures');
        expect(shell.search.placeholder).toBe('stone, grass, planks…');
        expect(shell.stampChoices.map((field) => field.hidden)).toEqual([true, true]);
        expect(scale?.value).toBe('');
        showTab(shell, 'stamps');
        expect(shell.stampChoices.map((field) => field.hidden)).toEqual([false, false]);
        expect(shell.grid.getAttribute('aria-label')).toBe('Stamps');
    });

    it('maps each browsing tab to its kind, and Audio to none', () => {
        expect(TABS.map(kindOfTab)).toEqual(['stamp', 'texture', 'particle', null]);
    });
});

describe('renderSounds', () => {
    it('lists each sound with a looping player, the tags it plays for, its reach, its credit and its download', () => {
        renderSounds(shell, [FIRE, { ...FIRE, id: 'sound-hum', name: 'Hum', stamps: 1, credit: null }]);
        const [fire, hum] = [...shell.sounds.querySelectorAll('li')];
        const player = fire?.querySelector('audio');
        expect(player?.getAttribute('src')).toBe('audio/cc0/sounds/fire.ogg');
        expect(player?.loop).toBe(true);
        expect(player?.getAttribute('aria-label')).toBe('Play Fire');
        expect(fire?.querySelector('.facts')?.textContent).toBe('Plays for stamps tagged brazier, campfire (9 stamps) · heard within 5 squares');
        expect(fire?.querySelector('.origin')?.textContent).toBe('CC0 1.0 · by PagDev (source)');
        expect(fire?.querySelector('a.download')?.getAttribute('href')).toBe('audio/cc0/sounds/fire.ogg');
        expect(fire?.querySelector('.in-archive code')?.textContent).toBe('zephyr-cartography-assets/cc0/sounds/fire.ogg');
        expect(hum?.querySelector('.facts')?.textContent).toContain('(1 stamp)');
    });
});

describe('buildShell', () => {
    it('labels its search and choices, and calls back as they are used, any choice as null', () => {
        const search = root.querySelector<HTMLInputElement>('#search');
        expect(root.querySelector('label[for="search"]')?.textContent).toBe('Search');
        expect(search).not.toBeNull();
        if (search === null) {
            return;
        }
        search.value = 'crate';
        search.dispatchEvent(new Event('input'));
        expect(handlers.search).toHaveBeenCalledWith('crate');

        const scale = root.querySelector<HTMLSelectElement>('#scale');
        expect([...(scale?.options ?? [])].map((o) => o.value)).toEqual(['', 'city', 'interior']);
        expect([...(scale?.options ?? [])].map((o) => o.textContent)).toEqual(['Any', 'City', 'Interior']);
        if (scale === null) {
            return;
        }
        scale.value = 'city';
        scale.dispatchEvent(new Event('change'));
        scale.value = '';
        scale.dispatchEvent(new Event('change'));
        expect(handlers.scale.mock.calls).toEqual([['city'], [null]]);
        const perspective = root.querySelector<HTMLSelectElement>('#perspective');
        perspective?.dispatchEvent(new Event('change'));
        expect(handlers.perspective).toHaveBeenCalledWith(null);
    });
});

describe('renderSettings', () => {
    it('shows each setting by its friendly name with its count, the chosen one pressed, and picks one or all', () => {
        renderSettings(shell, [{ name: 'setting-grimdark-human', count: 3 }], { ...NO_FILTERS, setting: 'setting-grimdark-human' }, handlers);
        const buttons = [...shell.settings.querySelectorAll('button')];
        expect(buttons.map((b) => [b.textContent, b.getAttribute('aria-pressed')])).toEqual([
            ['All settings', 'false'],
            ['Grimdark: Human (3)', 'true'],
        ]);
        buttons.forEach((b) => {
            b.click();
        });
        expect(handlers.setting.mock.calls).toEqual([[null], ['setting-grimdark-human']]);
        expect(root.textContent).toContain('Setting');
    });
});

describe('variantLabels', () => {
    it('numbers a state only where several variants share it', () => {
        const labels = variantLabels([variant('lit', 'a/lamp_01.png'), variant('unlit', 'a/lamp_02.png'), variant('lit', 'a/lamp_03.png')]);
        expect(labels).toEqual(['lit 1', 'unlit', 'lit 2']);
    });
});

describe('renderCategories and renderTags', () => {
    it('presses the chosen category, and picks one or all', () => {
        renderCategories(shell, [{ name: 'Storage', count: 2 }], { ...NO_FILTERS, category: 'Storage' }, handlers);
        const buttons = [...shell.categories.querySelectorAll('button')];
        expect(buttons.map((b) => [b.textContent, b.getAttribute('aria-pressed')])).toEqual([
            ['All (2)', 'false'],
            ['Storage (2)', 'true'],
        ]);
        buttons.forEach((b) => {
            b.click();
        });
        expect(handlers.category.mock.calls).toEqual([[null], ['Storage']]);
    });

    it('shows chosen tags to remove, others to add, and a clear button only while any are chosen', () => {
        renderTags(shell, [{ name: 'wood', count: 2 }], { ...NO_FILTERS, tags: ['loot'] }, handlers);
        const buttons = [...shell.tags.querySelectorAll('button')];
        expect(buttons.map((b) => b.textContent)).toEqual(['loot ×', 'wood (2)', 'Clear tags']);
        buttons.forEach((b) => {
            b.click();
        });
        expect(handlers.toggleTag.mock.calls).toEqual([['loot'], ['wood']]);
        expect(handlers.clearTags).toHaveBeenCalledOnce();
        renderTags(shell, [], NO_FILTERS, handlers);
        expect(shell.tags.querySelectorAll('button')).toHaveLength(0);
    });
});

describe('renderGrid', () => {
    it('shows each item as a card opening its detail, and how many of all of its kind are shown', () => {
        renderGrid(shell, [CRATE], 4, 'stamp', handlers);
        expect(shell.status.textContent).toBe('1 of 4 stamps shown');
        const card = shell.grid.querySelector('button');
        expect(card?.querySelector('img')?.getAttribute('src')).toBe('thumbs/stamps/interior/crate_01.webp');
        expect(card?.textContent).toContain('Wooden Crate');
        expect(card?.textContent).toContain('Storage · 2 images');
        card?.click();
        expect(handlers.open).toHaveBeenCalledWith('crate');
        renderGrid(shell, ITEMS, ITEMS.length, 'stamp', handlers);
        expect(shell.status.textContent).toBe(`${ITEMS.length} stamps`);
        expect(shell.grid.textContent).toContain('1 image');
        renderGrid(shell, [GRASS], 1, 'texture', handlers);
        expect(shell.status.textContent).toBe('1 texture');
        renderGrid(shell, [], 2, 'particle', handlers);
        expect(shell.status.textContent).toBe('0 of 2 particle images shown');
    });
});

describe('renderDetail', () => {
    beforeEach(() => {
        // happy-dom's dialog: opening sets `open`, as a browser's does.
        HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement): void {
            this.open = true;
        };
    });

    it('shows every variant’s preview to download, its full size and where it is in the archive, and closes', () => {
        renderDetail(shell, CRATE);
        expect(shell.dialog.open).toBe(true);
        expect(shell.dialog.querySelector('h2')?.textContent).toBe('Wooden Crate');
        expect(shell.dialog.querySelector('.facts')?.textContent).toBe('Category: Storage · Scale: Interior · Perspective: Orthographic');
        expect(shell.dialog.getAttribute('aria-labelledby')).toBe('detail-heading');
        expect(shell.dialog.textContent).toContain('AI-generated');
        // A setting among the tags is shown by its friendly name.
        expect(shell.dialog.querySelector('.item-tags .setting')?.textContent).toBe('Fantasy');
        const figures = [...shell.dialog.querySelectorAll('figure')];
        expect(figures.map((f) => f.querySelector('.state')?.textContent)).toEqual(['shut', 'smashed']);
        expect(figures[0]?.querySelector('img')?.getAttribute('src')).toBe('previews/stamps/interior/crate_01.webp');
        const download = figures[0]?.querySelector('a.download');
        expect(download?.getAttribute('href')).toBe('previews/stamps/interior/crate_01.webp');
        expect(download?.hasAttribute('download')).toBe(true);
        expect(figures[1]?.querySelector('.in-archive')?.textContent).toBe('Full size in the archive: stamps/interior/crate_02.png');
        expect(figures[0]?.textContent).toContain('Full size 100×100px');
        expect(figures[0]?.querySelector('.in-archive code')).not.toBeNull();
        // Each image can be reported, on the asset pack's repository, by its own path.
        expect(figures[1]?.querySelector('a.report')?.getAttribute('href')).toContain('image=stamps%2Finterior%2Fcrate_02.png');
        shell.dialog.querySelector<HTMLButtonElement>('.close')?.click();
        expect(shell.dialog.open).toBe(false);
    });

    it('credits an external item’s author with a link to its source', () => {
        renderDetail(shell, GRASS);
        expect(shell.dialog.querySelector('.origin')?.textContent).toBe('CC0 1.0 · by Rob Tuytel (source)');
        expect(shell.dialog.querySelector('.origin a')?.getAttribute('href')).toBe('https://polyhaven.com/a/grass');
        expect(shell.dialog.textContent).toContain('Full size 100×100px');
        expect(shell.dialog.querySelector('.facts')?.textContent).toBe('Category: Textures (Poly Haven)');
    });
});
