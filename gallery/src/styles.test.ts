// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { ART_STYLES, artStyleLabel } from './styles';

describe('artStyleLabel', () => {
    it('names each of the six styles, and passes anything else through', () => {
        expect(ART_STYLES.map(artStyleLabel)).toEqual(['Painted', 'Photorealistic', 'Hand-drawn', 'Flat', 'Pixel art', 'Line art']);
        expect(artStyleLabel('watercolour')).toBe('watercolour');
    });
});
