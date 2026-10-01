// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The direct-install dialog: the module's manifest URL (from its own
 * `module.json`, by way of the index) in a read-only field with a Copy button,
 * and the steps to paste it into Foundry VTT's installer.
 */
import type { GalleryInstall } from './catalog';
import { buildModal } from './modal';
import { el } from './view';

/** Copies text to the clipboard; rejects when the browser refuses. */
export type CopyText = (text: string) => Promise<void>;

/** The steps, in Foundry's own words for its screens and fields. */
const STEPS = [
    'Open Foundry VTT’s setup screen and go to Add-on Modules.',
    'Click Install Module.',
    'Paste the address into “Manifest URL” at the bottom, then click Install.',
    'Zephyr Cartography, the module that places these stamps, must be installed too.',
];

/** Build the install dialog for `install` (closed); `copy` puts the manifest URL on the clipboard. */
export function buildInstallDialog(doc: Document, install: GalleryInstall, copy: CopyText): HTMLDialogElement {
    const field = el(doc, 'input', 'manifest');
    field.id = 'install-manifest';
    field.type = 'url';
    field.readOnly = true;
    field.value = install.manifest;
    field.addEventListener('focus', () => {
        field.select();
    });
    const caption = el(doc, 'label', '', 'Manifest URL');
    caption.htmlFor = field.id;

    const said = el(doc, 'span', 'copied');
    said.setAttribute('role', 'status');
    const copier = el(doc, 'button', 'button primary', 'Copy');
    copier.type = 'button';
    /** Copy the address and say so, or select it for a manual copy where the browser blocks the clipboard. */
    const copyManifest = async (): Promise<void> => {
        try {
            await copy(install.manifest);
            said.textContent = 'Copied.';
        } catch {
            field.select();
            said.textContent = 'Copying was blocked: the address is selected, copy it with Ctrl+C (⌘C).';
        }
    };
    copier.addEventListener('click', () => {
        void copyManifest();
    });

    return buildModal(
        doc,
        'install',
        'install-heading',
        'Install directly in Foundry VTT',
        el(doc, 'p', 'facts', `${install.id}, version ${install.version}. Foundry installs it from this address, and updates it from there too.`),
        el(doc, 'div', 'manifest-row', '', caption, el(doc, 'div', 'manifest-copy', '', field, copier), said),
        el(doc, 'ol', 'steps', '', ...STEPS.map((step) => el(doc, 'li', '', step))),
    );
}
