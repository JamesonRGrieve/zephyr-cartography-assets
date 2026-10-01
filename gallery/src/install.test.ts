// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it, vi } from 'vitest';
import { INSTALL } from './fixtures';
import { buildInstallDialog, type CopyText } from './install';

/** The dialog, built into the test document, with a copier that does what `copied` says. */
function dialogWith(copy: CopyText): HTMLDialogElement {
    const dialog = buildInstallDialog(document, INSTALL, copy);
    document.body.replaceChildren(dialog);
    return dialog;
}

/** Let the copier's promise settle. */
async function settled(): Promise<void> {
    await new Promise((resolve) => {
        setTimeout(resolve, 0);
    });
}

describe('buildInstallDialog', () => {
    it('shows the manifest URL read-only and labelled, the module and version, and the install steps', () => {
        const dialog = dialogWith(vi.fn<CopyText>(async () => Promise.resolve()));
        const field = dialog.querySelector<HTMLInputElement>('#install-manifest');
        expect(field?.value).toBe(INSTALL.manifest);
        expect(field?.readOnly).toBe(true);
        expect(dialog.querySelector('label[for="install-manifest"]')?.textContent).toBe('Manifest URL');
        expect(dialog.getAttribute('aria-labelledby')).toBe('install-heading');
        expect(dialog.querySelector('.facts')?.textContent).toContain('zephyr-cartography-assets, version 1.0.0');
        const steps = [...dialog.querySelectorAll('.steps li')].map((li) => li.textContent);
        expect(steps).toHaveLength(4);
        expect(steps.join(' ')).toMatch(/Add-on Modules.*Install Module.*Manifest URL.*Zephyr Cartography/su);
    });

    it('copies the manifest URL and says so', async () => {
        const copy = vi.fn<CopyText>(async () => Promise.resolve());
        const dialog = dialogWith(copy);
        dialog.querySelector<HTMLButtonElement>('button.primary')?.click();
        await settled();
        expect(copy).toHaveBeenCalledWith(INSTALL.manifest);
        expect(dialog.querySelector('[role="status"]')?.textContent).toBe('Copied.');
    });

    it('selects the address for a manual copy when the browser blocks the clipboard', async () => {
        const dialog = dialogWith(vi.fn<CopyText>(async () => Promise.reject(new Error('denied'))));
        const field = dialog.querySelector<HTMLInputElement>('#install-manifest');
        dialog.querySelector<HTMLButtonElement>('button.primary')?.click();
        await settled();
        expect(dialog.querySelector('[role="status"]')?.textContent).toMatch(/blocked/u);
        expect(field?.selectionStart).toBe(0);
        expect(field?.selectionEnd).toBe(INSTALL.manifest.length);
    });

    it('closes from its Close button', () => {
        const dialog = dialogWith(vi.fn<CopyText>(async () => Promise.resolve()));
        dialog.showModal();
        dialog.querySelector<HTMLButtonElement>('button.close')?.click();
        expect(dialog.open).toBe(false);
    });
});
