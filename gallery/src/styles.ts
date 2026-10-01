// SPDX-License-Identifier: AGPL-3.0-or-later
/** How an asset's art is made, as the pack schema records it (its `style`), and how the gallery names each. Pure. */

export const ART_STYLES = ['painted', 'photorealistic', 'hand-drawn', 'flat', 'pixel-art', 'line-art'] as const;
export type ArtStyle = (typeof ART_STYLES)[number];

/** Each style as shown. */
export const ART_STYLE_LABELS: Readonly<Record<ArtStyle, string>> = {
    'painted': 'Painted',
    'photorealistic': 'Photorealistic',
    'hand-drawn': 'Hand-drawn',
    'flat': 'Flat',
    'pixel-art': 'Pixel art',
    'line-art': 'Line art',
};

/**
 * The looks: finer art styles, chiefly for character art and tokens, carried
 * as `style-` tags (several to a piece: `style-ink`, `style-cartoon`,
 * `style-monochrome`). Each as shown.
 */
export const LOOK_LABELS: Readonly<Record<string, string>> = {
    'style-ink': 'Ink',
    'style-woodcut': 'Woodcut',
    'style-engraving': 'Engraving',
    'style-stippled': 'Stippled',
    'style-sketch': 'Sketch',
    'style-doodle': 'Doodle',
    'style-cartoon': 'Cartoon',
    'style-comic': 'Comic',
    'style-anime': 'Anime',
    'style-chibi': 'Chibi',
    'style-watercolour': 'Watercolour',
    'style-digital-painting': 'Digital painting',
    'style-oil-painting': 'Oil painting',
    'style-cel-shaded': 'Cel-shaded',
    'style-vector': 'Vector',
    'style-pixel': 'Pixel',
    'style-3d-render': '3D render',
    'style-low-poly': 'Low poly',
    'style-photographic': 'Photographic',
    'style-silhouette': 'Silhouette',
    'style-top-down': 'Top-down',
    'style-colour': 'Colour',
    'style-greyscale': 'Greyscale',
    'style-monochrome': 'Black and white',
};

/** A look as shown: its label, else its words after `style-`. */
export const lookLabel = (look: string): string => LOOK_LABELS[look] ?? look.replace(/^style-/u, '').replaceAll('-', ' ');

/** A style as shown; any other value as it is. */
export const artStyleLabel = (style: string): string => ((ART_STYLES as readonly string[]).includes(style) ? ART_STYLE_LABELS[style as ArtStyle] : style);
