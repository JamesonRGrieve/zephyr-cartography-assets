// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it, vi } from 'vitest';
import { INSTALL } from './fixtures';
import { buildInstallDialog, type CopyText, GALLERY_ONLY_NOTE } from './install';

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
        expect(dialog.querySelector<HTMLAnchorElement>('#install-manifest ~ a.zip, .manifest-row a.zip')?.getAttribute('href')).toBe(INSTALL.download);
        const steps = [...dialog.querySelectorAll('.steps li')].map((li) => li.textContent);
        expect(steps).toHaveLength(4);
        expect(steps.join(' ')).toMatch(/Add-on Modules.*Install Module.*Manifest URL.*Zephyr Cartography/su);
    });

    it('says no release holds music, character art or tokens', () => {
        const dialog = dialogWith(vi.fn<CopyText>(async () => Promise.resolve()));
        expect(dialog.querySelector('.gallery-only')?.textContent).toBe(GALLERY_ONLY_NOTE);
        expect(GALLERY_ONLY_NOTE).toMatch(/music, character art and tokens/u);
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

    it('shows the release its two boxes choose: CC0 by default, Everything once acknowledged, each also AI-free', () => {
        const copy = vi.fn<CopyText>(async () => Promise.resolve());
        const dialog = dialogWith(copy);
        const field = dialog.querySelector<HTMLInputElement>('#install-manifest');
        const zip = dialog.querySelector<HTMLAnchorElement>('.manifest-row a.zip');
        const everything = dialog.querySelector<HTMLInputElement>('#install-everything');
        const aiFree = dialog.querySelector<HTMLInputElement>('#install-ai-free');
        expect(everything?.closest('label')?.textContent).toContain('governed by the licence of each individual asset');
        expect(aiFree?.closest('label')?.textContent.trim()).toMatch(/^Exclude AI Generated Assets: /u);
        // What is being downloaded is said right above the address.
        expect(field?.parentElement?.previousElementSibling?.className).toBe('release-name');
        const tick = (box: HTMLInputElement | null, on: boolean): void => {
            if (box !== null) {
                box.checked = on;
                box.dispatchEvent(new Event('change'));
            }
        };
        const shown = (): [string | undefined, string | null | undefined, string | null | undefined] => [
            field?.value,
            zip?.getAttribute('href'),
            dialog.querySelector('.release-name')?.textContent,
        ];
        expect(shown()).toEqual([INSTALL.releases.cc0.manifest, INSTALL.releases.cc0.download, expect.stringMatching(/^CC0: /u)]);
        expect(INSTALL.releases.cc0.manifest).toBe(INSTALL.manifest);
        const dungeondraft = dialog.querySelector<HTMLAnchorElement>('.manifest-row a.dungeondraft');
        expect(dungeondraft?.getAttribute('href')).toMatch(/\/zephyr-cartography-assets\.dungeondraft_pack$/u);
        tick(everything, true);
        expect(dungeondraft?.getAttribute('href')).toMatch(/\/zephyr-cartography-assets-everything\.dungeondraft_pack$/u);
        expect(shown()).toEqual([INSTALL.releases.everything.manifest, INSTALL.releases.everything.download, expect.stringMatching(/^Everything: /u)]);
        tick(aiFree, true);
        expect(shown()[0]).toBe(INSTALL.releases['everything-ai-free'].manifest);
        expect(shown()[0]).toMatch(/module-everything-ai-free\.json$/u);
        tick(everything, false);
        expect(shown()).toEqual([
            INSTALL.releases['cc0-ai-free'].manifest,
            INSTALL.releases['cc0-ai-free'].download,
            expect.stringMatching(/^CC0, AI-free: /u),
        ]);
    });

    it('copies whichever release’s address is shown', async () => {
        const copy = vi.fn<CopyText>(async () => Promise.resolve());
        const dialog = dialogWith(copy);
        const aiFree = dialog.querySelector<HTMLInputElement>('#install-ai-free');
        if (aiFree !== null) {
            aiFree.checked = true;
            aiFree.dispatchEvent(new Event('change'));
        }
        dialog.querySelector<HTMLButtonElement>('button.primary')?.click();
        await settled();
        expect(copy).toHaveBeenCalledWith(INSTALL.releases['cc0-ai-free'].manifest);
    });

    it('closes from its Close button', () => {
        const dialog = dialogWith(vi.fn<CopyText>(async () => Promise.resolve()));
        dialog.showModal();
        dialog.querySelector<HTMLButtonElement>('button.close')?.click();
        expect(dialog.open).toBe(false);
    });
});
