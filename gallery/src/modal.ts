// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The page's fixed popups: a closed dialog named by its heading, with a Close
 * button, its body appended. The install, help and report dialogs are each one.
 */
import { el } from './view';

/** A closed dialog of `className`, headed `title` (its heading's id is `id`), with a Close button and `body` below. */
export function buildModal(doc: Document, className: string, id: string, title: string, ...body: Node[]): HTMLDialogElement {
    const dialog = el(doc, 'dialog', className);
    const heading = el(doc, 'h2', '', title);
    heading.id = id;
    dialog.setAttribute('aria-labelledby', id);
    const closer = el(doc, 'button', 'close', 'Close');
    closer.type = 'button';
    closer.addEventListener('click', () => {
        dialog.close();
    });
    dialog.append(el(doc, 'header', '', '', heading, closer), ...body);
    return dialog;
}

/** The steps for reporting a problem with an asset: on the asset's own image, so the report names it exactly. */
const REPORT_STEPS = [
    'Find the asset in question: search for it, or browse its tab and category.',
    'Open it, and click “Report an issue” under the image with the problem.',
    'Fill out the form in GitHub Issues: it already names the asset and the image.',
];

/** The "Report Asset Issue" dialog (closed): how to report an asset, from the asset itself. */
export function buildReportDialog(doc: Document): HTMLDialogElement {
    return buildModal(
        doc,
        'report-help',
        'report-heading',
        'Report an asset issue',
        el(doc, 'p', 'facts', 'Reports are made from the asset itself, so they say exactly which asset and image are meant.'),
        el(doc, 'ol', 'steps', '', ...REPORT_STEPS.map((step) => el(doc, 'li', '', step))),
    );
}
