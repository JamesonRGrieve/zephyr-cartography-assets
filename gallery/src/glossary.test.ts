// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { ALTAR, CHEST, CRATE, RESIDENCE, ITEMS } from './fixtures';
import { buildGlossaryDialog, examplesOf, orderedValues } from './glossary';

describe('examplesOf', () => {
    it('takes items of the value from different categories first, then the rest, up to the count', () => {
        expect(examplesOf(ITEMS, 'scale', 'interior').map((item) => item.id)).toEqual([CRATE.id, ALTAR.id, CHEST.id]);
        expect(examplesOf(ITEMS, 'scale', 'interior', 2).map((item) => item.id)).toEqual([CRATE.id, ALTAR.id]);
        expect(examplesOf(ITEMS, 'perspective', 'isometric')).toEqual([ALTAR]);
        expect(examplesOf(ITEMS, 'scale', 'planet')).toEqual([]);
    });
});

describe('orderedValues', () => {
    it('lists scales largest first and perspectives the usual one first, unknown values last in their given order', () => {
        expect(orderedValues('scale', ['city', 'interior', 'exterior', 'system'])).toEqual(['system', 'city', 'exterior', 'interior']);
        expect(orderedValues('perspective', ['central', 'front', 'isometric', 'orthographic'])).toEqual(['orthographic', 'isometric', 'front', 'central']);
        expect(orderedValues('scale', ['zeta', 'interior', 'alpha'])).toEqual(['interior', 'zeta', 'alpha']);
    });
});

describe('buildGlossaryDialog', () => {
    it('explains each value by its friendly label, with its example stamps’ thumbnails and names', () => {
        const dialog = buildGlossaryDialog(document, 'scale', ['city', 'interior'], ITEMS);
        document.body.replaceChildren(dialog);
        expect(dialog.querySelector('h2')?.textContent).toBe('Scales');
        expect(dialog.getAttribute('aria-labelledby')).toBe('glossary-scale-heading');
        const entries = [...dialog.querySelectorAll('.glossary-entry')];
        expect(entries.map((entry) => entry.querySelector('h3')?.textContent)).toEqual(['City', 'Interior']);
        expect(entries[0]?.querySelector('p')?.textContent).toMatch(/^City maps/u);
        expect([...(entries[0]?.querySelectorAll('figcaption') ?? [])].map((caption) => caption.textContent)).toEqual([RESIDENCE.name]);
        expect(entries[0]?.querySelector('img')?.getAttribute('src')).toBe(RESIDENCE.variants[0]?.thumb);
    });

    it('explains every perspective, and closes from its Close button', () => {
        const dialog = buildGlossaryDialog(document, 'perspective', ['orthographic', 'isometric', 'front', 'central'], ITEMS);
        document.body.replaceChildren(dialog);
        const notes = [...dialog.querySelectorAll('.glossary-entry > p')].map((p) => p.textContent);
        expect(notes).toHaveLength(4);
        expect(notes.every((note) => note.length > 0)).toBe(true);
        dialog.showModal();
        dialog.querySelector<HTMLButtonElement>('button.close')?.click();
        expect(dialog.open).toBe(false);
    });
});
