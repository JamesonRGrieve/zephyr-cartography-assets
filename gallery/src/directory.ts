// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The More Assets tab: a directory of other people's asset packs whose
 * licences forbid redistributing them, so they cannot be in this collection.
 * One tile per pack: its name, with its licence and whether it is
 * AI-generated (as its author discloses) as chips beneath, each linking to
 * where the author states it, its author, what it
 * holds and which classes, and why it is only linked; and a link to get it from its author. Nothing of it is shown,
 * hosted or bundled here (no previews). Read from `public/more-assets.json`,
 * validated; `pnpm check` validates the file itself.
 */
import { z } from 'zod';
import type { Parsed } from './catalog';
import { el } from './view';

/** The collection's classes, as a pack in the directory names what it covers. */
export const PACK_CLASSES = ['stamps', 'tiles', 'tokens', 'character-art', 'textures', 'particle-effects', 'sound-effects', 'music', 'scenes'] as const;

/** Each class as shown. */
const CLASS_LABELS: Readonly<Record<(typeof PACK_CLASSES)[number], string>> = {
    'stamps': 'Stamps',
    'tiles': 'Tiles',
    'tokens': 'Tokens',
    'character-art': 'Character Art',
    'textures': 'Textures',
    'particle-effects': 'Particle Effects',
    'sound-effects': 'Sound Effects',
    'music': 'Music',
    'scenes': 'Scenes',
};

const packSchema = z
    .object({
        name: z.string().min(1),
        author: z.string().min(1),
        url: z.url().describe('Where to get it: the author’s own page.'),
        description: z.string().min(1).describe('What the pack holds, in plain words.'),
        classes: z.array(z.enum(PACK_CLASSES)).min(1).describe('The classes it covers.'),
        license: z.string().min(1).describe('Its licence: an SPDX id, or plain text ("Custom: no redistribution").'),
        licenseUrl: z.url().describe('Where its licence is stated: the licence’s text, or the author’s terms page.'),
        ai: z.boolean().nullable().describe('Whether it is AI-generated, as its author discloses; null where they do not say.'),
        aiUrl: z.url().nullable().describe('Where the author says whether it is AI-generated; null where they do not say.'),
        note: z.string().min(1).describe('Why it is only linked here, in one line.'),
    })
    .strict()
    .refine((pack) => (pack.ai === null) === (pack.aiUrl === null), {
        message: 'an AI disclosure links to where the author states it, and only a disclosure does',
        path: ['aiUrl'],
    });

const directorySchema = z.object({ packs: z.array(packSchema) }).strict();

export type DirectoryPack = z.infer<typeof packSchema>;

/** Read the directory (parsed JSON of any shape), or what is wrong with it. */
// eslint-disable-next-line no-restricted-syntax -- boundary: parsed JSON of any shape, validated here
export function parseDirectory(json: unknown): Parsed<readonly DirectoryPack[]> {
    const result = directorySchema.safeParse(json);
    return result.success ? { ok: true, value: result.data.packs } : { ok: false, issues: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) };
}

/** What a pack's author discloses about AI, as shown. */
const aiNote = (ai: boolean | null): string => (ai === null ? 'AI use: not disclosed' : ai ? 'AI-generated' : 'Not AI-generated');

/** A chip's text as a link to where it is stated. */
function chipLink(doc: Document, text: string, href: string): HTMLAnchorElement {
    return Object.assign(el(doc, 'a', '', text), { href, rel: 'noopener', target: '_blank' });
}

/** Fill `list` with one tile per pack, by name; a list with none says so. */
export function renderDirectory(list: HTMLElement, packs: readonly DirectoryPack[]): void {
    const doc = list.ownerDocument;
    if (packs.length === 0) {
        list.replaceChildren(el(doc, 'li', 'empty', 'No packs listed yet.'));
        return;
    }
    const sorted = [...packs].sort((a, b) => a.name.localeCompare(b.name));
    list.replaceChildren(
        ...sorted.map((pack) =>
            el(
                doc,
                'li',
                'pack',
                '',
                el(doc, 'h3', '', pack.name),
                el(
                    doc,
                    'ul',
                    'pack-chips',
                    '',
                    el(doc, 'li', 'license', '', chipLink(doc, pack.license, pack.licenseUrl)),
                    el(
                        doc,
                        'li',
                        pack.ai === true ? 'ai' : '',
                        '',
                        ...(pack.aiUrl === null ? [doc.createTextNode(aiNote(pack.ai))] : [chipLink(doc, aiNote(pack.ai), pack.aiUrl)]),
                    ),
                ),
                el(doc, 'p', 'facts', `By ${pack.author} · ${pack.classes.map((c) => CLASS_LABELS[c]).join(', ')}`),
                el(doc, 'p', '', pack.description),
                el(doc, 'p', 'terms', pack.note),
                Object.assign(el(doc, 'a', 'button', 'Get it from its author'), { href: pack.url, rel: 'noopener', target: '_blank' }),
            ),
        ),
    );
}
