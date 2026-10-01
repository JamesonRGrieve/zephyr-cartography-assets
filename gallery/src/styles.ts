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

/** A style as shown; any other value as it is. */
export const artStyleLabel = (style: string): string => ((ART_STYLES as readonly string[]).includes(style) ? ART_STYLE_LABELS[style as ArtStyle] : style);
