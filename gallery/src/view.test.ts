// SPDX-License-Identifier: AGPL-3.0-or-later
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NO_FILTERS } from './filter';
import { CRATE, EMBER, FIRE, GRASS, ITEMS, MARCH, variant } from './fixtures';
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
        license: vi.fn<Handlers['license']>(),
        minResolution: vi.fn<Handlers['minResolution']>(),
        hideAi: vi.fn<Handlers['hideAi']>(),
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
    shell = buildShell(
        root,
        { scales: ['city', 'interior'], perspectives: ['orthographic'], licenses: ['CC-BY-4.0', 'CC0-1.0', 'GPL-3.0-or-later'], resolutions: [512, 1024] },
        handlers,
    );
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
    it('opens on the Stamps tab, and shows the Sound Effects or Music tab’s panel alone once it is chosen', () => {
        const [stamps, tiles, textures, particles, effects, music, scenes, more] = [...root.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
        expect([stamps, tiles, textures, particles, effects, music, scenes, more].map((tab) => tab?.textContent)).toEqual([
            'Stamps',
            'Tiles',
            'Textures',
            'Particle Effects',
            'Sound Effects',
            'Music',
            'Scenes',
            'More Assets',
        ]);
        expect(shell.tabs.scenes.panel.textContent).toContain('No scenes yet.');
        expect(shell.tabs.more.panel.querySelector('ul.directory')).toBe(shell.directory);
        expect(stamps?.getAttribute('aria-selected')).toBe('true');
        expect(shell.tabs.effects.panel.hidden).toBe(true);
        effects?.click();
        expect(handlers.tab).toHaveBeenCalledWith('effects');
        showTab(shell, 'effects');
        expect(shell.tabs.stamps.panel.hidden).toBe(true);
        expect(shell.tabs.effects.panel.hidden).toBe(false);
        expect(shell.tabs.music.panel.hidden).toBe(true);
        expect(effects?.getAttribute('aria-selected')).toBe('true');
        expect(effects?.getAttribute('aria-controls')).toBe(shell.tabs.effects.panel.id);
        showTab(shell, 'music');
        expect(shell.tabs.effects.panel.hidden).toBe(true);
        expect(shell.tabs.music.panel.hidden).toBe(false);
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
        expect(shell.tabs.effects.panel.hidden).toBe(true);
        expect(browser.getAttribute('aria-labelledby')).toBe(shell.tabs.textures.button.id);
        expect(shell.grid.getAttribute('aria-label')).toBe('Textures');
        expect(shell.search.placeholder).toBe('stone, grass, planks…');
        expect(shell.stampChoices.map((field) => field.hidden)).toEqual([true, true]);
        expect(scale?.value).toBe('');
        showTab(shell, 'stamps');
        expect(shell.stampChoices.map((field) => field.hidden)).toEqual([false, false]);
        expect(shell.grid.getAttribute('aria-label')).toBe('Stamps');
    });

    it('maps each browsing tab to its kind, and the audio tabs to none', () => {
        expect(TABS.map(kindOfTab)).toEqual(['stamp', 'tile', 'texture', 'particle', null, null, null, null]);
    });
});

describe('renderSounds', () => {
    it('lists each sound effect with a looping player, the tags it plays for, its reach, its credit and its download', () => {
        renderSounds(shell, [FIRE, { ...FIRE, id: 'sound-hum', name: 'Hum', stamps: 1, ai: true }]);
        const [fire, hum] = [...shell.sounds.effect.querySelectorAll('li')];
        const player = fire?.querySelector('audio');
        expect(player?.getAttribute('src')).toBe('audio/cc0/sounds/fire.ogg');
        expect(player?.loop).toBe(true);
        expect(player?.getAttribute('aria-label')).toBe('Play Fire');
        expect(fire?.querySelector('.facts')?.textContent).toBe('Plays for stamps tagged brazier, campfire (9 stamps) · heard within 5 squares');
        expect(fire?.querySelector('.origin')?.textContent).toBe('By PagDev (source) · CC0-1.0');
        expect(fire?.querySelector('.origin a.license')?.getAttribute('href')).toBe('https://spdx.org/licenses/CC0-1.0.html');
        expect(fire?.querySelector('a.download')?.getAttribute('href')).toBe('audio/cc0/sounds/fire.ogg');
        expect(fire?.querySelector('.in-archive code')?.textContent).toBe('zephyr-cartography-assets/cc0/sounds/fire.ogg');
        expect(hum?.querySelector('.facts')?.textContent).toContain('(1 stamp)');
    });

    it('plays and downloads a linked sound from its own address', () => {
        const url = 'https://example.com/fire.ogg';
        renderSounds(shell, [{ ...FIRE, audio: url }]);
        const [fire] = [...shell.sounds.effect.querySelectorAll('li')];
        expect(fire?.querySelector('audio')?.getAttribute('src')).toBe(url);
        expect(fire?.querySelector('a.download')?.textContent).toBe('Download from its source');
        expect(fire?.querySelector('a.download')?.hasAttribute('download')).toBe(false);
    });

    it('lists music on its own tab, without an effect’s facts, and says when a list is empty', () => {
        renderSounds(shell, [MARCH]);
        const [march] = [...shell.sounds.music.querySelectorAll('li')];
        expect(march?.querySelector('h3')?.textContent).toBe('Slow March');
        expect(march?.querySelector('audio')?.getAttribute('src')).toBe('audio/cc0/music/slow-march.ogg');
        expect(march?.querySelector('.facts')).toBeNull();
        expect(march?.querySelector('.in-archive code')?.textContent).toBe('zephyr-cartography-assets/cc0/music/slow-march.ogg');
        expect(shell.sounds.effect.textContent).toBe('No sound effects yet.');
        renderSounds(shell, [FIRE]);
        expect(shell.sounds.music.textContent).toBe('No music yet.');
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
        // Licences show as their SPDX ids, with no (?) of their own.
        const license = root.querySelector<HTMLSelectElement>('#license');
        expect([...(license?.options ?? [])].map((o) => o.textContent)).toEqual(['Any', 'CC-BY-4.0', 'CC0-1.0', 'GPL-3.0-or-later']);
        expect(root.querySelector('button[aria-label="What each license means"]')).toBeNull();
        if (license !== null) {
            license.value = 'CC-BY-4.0';
            license.dispatchEvent(new Event('change'));
        }
        expect(handlers.license).toHaveBeenCalledWith('CC-BY-4.0');
        const resolution = root.querySelector<HTMLSelectElement>('#resolution');
        expect(root.querySelector('label[for="resolution"]')?.textContent).toBe('Minimum resolution');
        expect([...(resolution?.options ?? [])].map((o) => o.textContent)).toEqual(['Any', '512 px+', '1K+']);
        if (resolution !== null) {
            resolution.value = '1024';
            resolution.dispatchEvent(new Event('change'));
            resolution.value = '';
            resolution.dispatchEvent(new Event('change'));
        }
        expect(handlers.minResolution.mock.calls).toEqual([[1024], [null]]);
        const hideAi = root.querySelector<HTMLInputElement>('#hide-ai');
        expect(hideAi?.closest('label')?.textContent.trim()).toBe('Hide AI-generated');
        if (hideAi !== null) {
            hideAi.checked = true;
            hideAi.dispatchEvent(new Event('change'));
        }
        expect(handlers.hideAi).toHaveBeenCalledWith(true);
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
        expect(shell.dialog.querySelector('.origin')?.textContent).toBe('By Rob Tuytel (source) · CC0-1.0');
        expect(shell.dialog.querySelector('.origin a')?.getAttribute('href')).toBe('https://polyhaven.com/a/grass');
        expect(shell.dialog.textContent).toContain('Full size 100×100px');
        expect(shell.dialog.querySelector('.facts')?.textContent).toBe('Category: Textures (Poly Haven)');
    });

    it('shows and downloads a linked image from its own address, at its source’s size', () => {
        const url = 'https://example.com/ember.png';
        renderDetail(shell, { ...EMBER, variants: [{ ...variant('ember', 'x.png'), thumb: url, preview: url, width: null, height: null }] });
        expect(shell.dialog.querySelector('figure img')?.getAttribute('src')).toBe(url);
        expect(shell.dialog.querySelector('.size')?.textContent).toBe('Full size at its source');
        const download = shell.dialog.querySelector<HTMLAnchorElement>('a.download');
        expect(download?.textContent).toBe('Download from its source');
        expect(download?.getAttribute('href')).toBe(url);
        expect(download?.hasAttribute('download')).toBe(false);
    });

    it('offers a Request variant button that opens the variant form for the asset', () => {
        renderDetail(shell, CRATE);
        const button = shell.dialog.querySelector<HTMLAnchorElement>('a.request-variant');
        expect(button?.textContent).toBe('Request variant');
        expect(button?.getAttribute('href')).toContain('template=variant-request.yml');
        expect(button?.getAttribute('href')).toContain('asset=Wooden+Crate');
        expect(button?.getAttribute('target')).toBe('_blank');
    });

    it('tags each piece with its own licence, linked to the licence’s text', () => {
        renderDetail(shell, EMBER);
        const tag = shell.dialog.querySelector<HTMLAnchorElement>('.origin a.license');
        expect(tag?.textContent).toBe('CC-BY-4.0');
        expect(tag?.getAttribute('href')).toBe('https://spdx.org/licenses/CC-BY-4.0.html');
        expect(tag?.getAttribute('rel')).toBe('license noopener');
        expect(shell.dialog.querySelector('.origin')?.textContent).toBe('By Someone (source) · CC-BY-4.0');
        renderDetail(shell, CRATE);
        expect(shell.dialog.querySelector('.origin')?.textContent).toBe('AI-generated · By Jameson Grieve (source) · CC0-1.0');
        expect(shell.dialog.querySelector('.origin a')?.getAttribute('href')).toBe('https://github.com/JamesonRGrieve/zephyr-cartography-assets');
    });
});
