// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { keyedScene } from './compendium';

describe('keyedScene', () => {
    it('keys a scene and every document embedded in it, region behaviours included, as Foundry’s packer files them', () => {
        const scene = {
            _id: 'sc',
            name: 'Inn',
            walls: [{ _id: 'w1', c: [0, 0, 1, 0] }],
            levels: [{ _id: 'g', name: 'Ground' }],
            regions: [{ _id: 'r1', behaviors: [{ _id: 'b1', type: 'changeLevel' }] }],
            tiles: [],
        };
        const keyed = keyedScene(scene);
        expect(keyed['_key']).toBe('!scenes!sc');
        expect(keyed['walls']).toEqual([{ _id: 'w1', c: [0, 0, 1, 0], _key: '!scenes.walls!sc.w1' }]);
        expect(keyed['levels']).toEqual([{ _id: 'g', name: 'Ground', _key: '!scenes.levels!sc.g' }]);
        expect(keyed['regions']).toEqual([
            { _id: 'r1', _key: '!scenes.regions!sc.r1', behaviors: [{ _id: 'b1', type: 'changeLevel', _key: '!scenes.regions.behaviors!sc.r1.b1' }] },
        ]);
        expect(keyed['tiles']).toEqual([]);
        expect(scene).not.toHaveProperty('_key');
    });

    it('refuses a scene or an embedded document with no id, naming where it is', () => {
        expect(() => keyedScene({ name: 'x' })).toThrow(/a scene has no _id/u);
        expect(() => keyedScene({ _id: 'sc', walls: [{ c: [] }] })).toThrow(/scene sc's walls has no _id/u);
    });
});
