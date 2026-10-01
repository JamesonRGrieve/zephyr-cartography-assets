// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { buildModal, buildReportDialog } from './modal';

describe('buildModal', () => {
    it('builds a closed dialog named by its heading, its body below, closed by its Close button', () => {
        const body = document.createElement('p');
        body.textContent = 'Body';
        const dialog = buildModal(document, 'kind', 'kind-heading', 'Title', body);
        document.body.replaceChildren(dialog);
        expect(dialog.open).toBe(false);
        expect(dialog.className).toBe('kind');
        expect(dialog.getAttribute('aria-labelledby')).toBe('kind-heading');
        expect(dialog.querySelector('#kind-heading')?.textContent).toBe('Title');
        expect(dialog.lastElementChild).toBe(body);
        dialog.showModal();
        dialog.querySelector<HTMLButtonElement>('button.close')?.click();
        expect(dialog.open).toBe(false);
    });
});

describe('buildReportDialog', () => {
    it('says to find the asset, use its "Report an issue" link, and fill out the GitHub Issues form', () => {
        const dialog = buildReportDialog(document);
        expect(dialog.querySelector('h2')?.textContent).toBe('Report an asset issue');
        const steps = [...dialog.querySelectorAll('.steps li')].map((li) => li.textContent).join(' ');
        expect(steps).toMatch(/Find the asset.*Report an issue.*GitHub Issues/su);
    });
});
