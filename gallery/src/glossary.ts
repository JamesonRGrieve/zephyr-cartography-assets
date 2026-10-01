// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * What each scale and perspective means, for the filters' (?) help: a plain
 * explanation of every value, after the stamp schema's own definitions, and a
 * few real stamps of it as examples.
 */
import type { GalleryItem } from './catalog';
import { valueLabel } from './filter';
import { buildModal } from './modal';
import { el, image } from './view';

/** The filters that carry an explanation. */
export const EXPLAINED = ['scale', 'perspective'] as const;
export type Explained = (typeof EXPLAINED)[number];

/** Each filter's help: its title, an introduction, and a note per value, in the order the values are listed (largest scale first, the usual perspective first). */
const NOTES: Readonly<Record<Explained, { readonly title: string; readonly intro: string; readonly values: Readonly<Record<string, string>> }>> = {
    scale: {
        title: 'Scales',
        intro: 'The kind of map a stamp is drawn for, from a whole star system down to a single room.',
        values: {
            system: 'Star-system maps: planets, moons, gas giants and asteroid belts as discs and icons.',
            planet: 'Whole-planet maps: regions, belts and ice caps laid across a world.',
            regional: 'Regional maps across many miles: land, forest, hills, cliffs, coasts and defence lines.',
            city: 'City maps seen from high above: keeps, gatehouses, depots and landing fields, each a single tile.',
            exterior: 'Outdoor battlemaps at the scale of a figure: stairs, hatches, trees, ruins and vehicles.',
            interior: 'Indoor battlemaps at the scale of a figure: furniture, machines, doors and clutter.',
        },
    },
    perspective: {
        title: 'Perspectives',
        intro: 'How a stamp is drawn, which decides whether it can be turned on the map.',
        values: {
            orthographic: 'Straight down, as a plan view. It can be turned any way on the map; most stamps are drawn like this.',
            isometric:
                'A three-quarter view from above: the top and two sides, with depth but no vanishing point. Keep it upright: turned half round it stands upside down.',
            front: 'A level elevation, seen from the front or side, like a banner on a wall or a sign. Keep it upright.',
            central:
                'From above in one-point perspective: its sides lean in toward the middle, as if photographed from overhead. It can be turned like a plan view.',
        },
    },
};

/** `values` in the help's order, any value it does not know last, as given. */
export function orderedValues(facet: Explained, values: readonly string[]): string[] {
    const known = Object.keys(NOTES[facet].values);
    const rank = (value: string): number => {
        const at = known.indexOf(value);
        return at === -1 ? known.length : at;
    };
    return [...values].sort((a, b) => rank(a) - rank(b));
}

/** How many example stamps each value shows. */
const EXAMPLE_COUNT = 3;

/** Up to `count` items whose `facet` is `value`, each from a different category where there are enough, in index order. */
export function examplesOf(items: readonly GalleryItem[], facet: Explained, value: string, count = EXAMPLE_COUNT): GalleryItem[] {
    const matching = items.filter((item) => item[facet] === value);
    const seen = new Set<string>();
    const spread = matching.filter((item) => {
        if (seen.has(item.category)) {
            return false;
        }
        seen.add(item.category);
        return true;
    });
    const rest = matching.filter((item) => !spread.includes(item));
    return [...spread, ...rest].slice(0, count);
}

/** Build the help dialog for `facet` (closed): each of `values` explained, with example stamps from `items`. */
export function buildGlossaryDialog(doc: Document, facet: Explained, values: readonly string[], items: readonly GalleryItem[]): HTMLDialogElement {
    const notes = NOTES[facet];
    const entry = (value: string): HTMLElement => {
        const examples = examplesOf(items, facet, value).map((item) => {
            const [first] = item.variants;
            return el(doc, 'figure', 'example', '', ...(first === undefined ? [] : [image(doc, first.thumb, '')]), el(doc, 'figcaption', '', item.name));
        });
        return el(
            doc,
            'section',
            'glossary-entry',
            '',
            el(doc, 'h3', '', valueLabel(value)),
            el(doc, 'p', '', notes.values[value] ?? ''),
            el(doc, 'div', 'examples', '', ...examples),
        );
    };
    return buildModal(doc, 'glossary', `glossary-${facet}-heading`, notes.title, el(doc, 'p', 'facts', notes.intro), ...values.map(entry));
}
