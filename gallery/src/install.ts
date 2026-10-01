// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The direct-install dialog: one release's manifest URL (from the module's
 * `module.json`, by way of the index) in a read-only field with a Copy
 * button, and its archive to download. Which release is shown follows two
 * checkboxes: Everything (other open licences too, the box being the
 * acknowledgement that any use of an asset is governed by its own licence)
 * and Exclude AI Generated Assets. Neither ticked is the default, CC0 with
 * AI art. It says what no release holds (music, character art and tokens),
 * then the steps to paste a manifest into Foundry VTT's installer.
 */
import type { GalleryInstall } from './catalog';
import { type Channel, channelFor } from './channels';
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

/** The Everything box's label: ticking it acknowledges that each asset's own licence governs its use. */
export const EVERYTHING_ACKNOWLEDGEMENT =
    'Everything: include assets under other open licences too. I acknowledge that any use of the Everything release is governed by the licence of each individual asset, and I will follow each one’s terms.';

/** The AI-free box's label. */
export const AI_FREE_LABEL = 'Exclude AI Generated Assets: leave out every AI-generated asset, keeping only work made by people.';

/** What no release holds, said on the dialog: the gallery-only classes (`GALLERY_ONLY`). */
export const GALLERY_ONLY_NOTE =
    'Not in any release: music, character art and tokens. This is a cartography module, not a character one; download those one at a time from their tabs.';

/** What each release is, as the dialog names it. */
const RELEASE_NAMES: Readonly<Record<Channel, string>> = {
    'cc0': 'CC0: only CC0 assets, AI art included. Use them for anything, with no conditions.',
    'everything': 'Everything: every asset, AI art included, each under its own open licence (CC0, CC BY, MIT, GPL…), whose terms apply to it.',
    'cc0-ai-free': 'CC0, AI-free: only CC0 assets made by people. Use them for anything, with no conditions.',
    'everything-ai-free': 'Everything, AI-free: every asset made by people, each under its own open licence, whose terms apply to it.',
};

/** A labelled checkbox; its box and its label. */
function checkbox(doc: Document, id: string, label: string): { readonly box: HTMLInputElement; readonly label: HTMLLabelElement } {
    const box = el(doc, 'input', '');
    box.type = 'checkbox';
    box.id = id;
    return { box, label: el(doc, 'label', 'acknowledge', '', box, doc.createTextNode(` ${label}`)) };
}

/** Build the install dialog for `install` (closed); `copy` puts the manifest URL on the clipboard. */
export function buildInstallDialog(doc: Document, install: GalleryInstall, copy: CopyText): HTMLDialogElement {
    const everything = checkbox(doc, 'install-everything', EVERYTHING_ACKNOWLEDGEMENT);
    const aiFree = checkbox(doc, 'install-ai-free', AI_FREE_LABEL);

    const field = el(doc, 'input', 'manifest');
    field.id = 'install-manifest';
    field.type = 'url';
    field.readOnly = true;
    field.addEventListener('focus', () => {
        field.select();
    });
    const caption = el(doc, 'label', '', 'Manifest URL');
    caption.htmlFor = field.id;
    const said = el(doc, 'span', 'copied');
    said.setAttribute('role', 'status');
    const copier = el(doc, 'button', 'button primary', 'Copy');
    copier.type = 'button';
    const zip = el(doc, 'a', 'zip', 'Download this release’s zip');
    const named = el(doc, 'p', 'release-name');
    named.setAttribute('aria-live', 'polite');

    /** The release the boxes choose. */
    const chosen = (): Channel => channelFor({ everything: everything.box.checked, aiFree: aiFree.box.checked });
    /** Show the chosen release's manifest and archive. */
    const show = (): void => {
        const channel = chosen();
        field.value = install.releases[channel].manifest;
        zip.href = install.releases[channel].download;
        named.textContent = RELEASE_NAMES[channel];
        said.textContent = '';
    };
    everything.box.addEventListener('change', show);
    aiFree.box.addEventListener('change', show);

    /** Copy the address and say so, or select it for a manual copy where the browser blocks the clipboard. */
    const copyManifest = async (): Promise<void> => {
        try {
            await copy(field.value);
            said.textContent = 'Copied.';
        } catch {
            field.select();
            said.textContent = 'Copying was blocked: the address is selected, copy it with Ctrl+C (⌘C).';
        }
    };
    copier.addEventListener('click', () => {
        void copyManifest();
    });
    show();

    return buildModal(
        doc,
        'install',
        'install-heading',
        'Install directly in Foundry VTT',
        el(doc, 'p', 'facts', `${install.id}, version ${install.version}. Foundry installs a release from its address, and updates it from there too.`),
        el(doc, 'section', 'release', '', everything.label, aiFree.label),
        el(doc, 'p', 'gallery-only', GALLERY_ONLY_NOTE),
        el(doc, 'div', 'manifest-row', '', caption, named, el(doc, 'div', 'manifest-copy', '', field, copier), said, zip),
        el(doc, 'ol', 'steps', '', ...STEPS.map((step) => el(doc, 'li', '', step))),
    );
}
