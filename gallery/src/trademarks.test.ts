// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { coinedWordsIn } from './trademarks';

describe('coinedWordsIn', () => {
    it('finds each coined word in names, tags and snake- or kebab-cased file names, whatever the case', () => {
        expect(coinedWordsIn('Necron Stasis Sarcophagus')).toEqual(['necron']);
        expect(coinedWordsIn('setting-tau')).toEqual(['tau']);
        expect(coinedWordsIn('stamps/interior/chaos_cogitator_console_01.png')).toEqual(['chaos', 'cogitator']);
        expect(coinedWordsIn('floor.worn-rockcrete')).toEqual(['rockcrete']);
        expect(coinedWordsIn('Mechanicus Shrine with a servo-skull and a Servo Skull')).toEqual(['mechanicus', 'servo-skull', 'servo skull']);
        expect(coinedWordsIn('Agri World Region')).toEqual(['agri']);
        expect(coinedWordsIn('Blackstone Crypt Floor, Webway Arch, spirit_stone_plinth')).toEqual(['blackstone', 'webway', 'spirit_stone']);
        expect(coinedWordsIn('Forge World Region, death_world_region, Hab Window')).toEqual(['forge world', 'death_world', 'hab']);
        expect(coinedWordsIn('Cracked Data-Slate, Recaf Mugs, Auspex Console')).toEqual(['data-slate', 'recaf', 'auspex']);
        expect(coinedWordsIn('warp_drive_core, Warpfire Brazier, Daemonic Tome Lectern')).toEqual(['warp', 'warpfire', 'daemonic']);
        expect(coinedWordsIn('Imperial Altar, plasteel, plastek, armourglass, purity-seal-draped')).toEqual([
            'imperial',
            'plasteel',
            'plastek',
            'armourglass',
            'purity-seal',
        ]);
    });

    it('passes the renamed words, and words that only contain a coined one', () => {
        expect(coinedWordsIn('Grimdark Communist Bunk Pod')).toEqual([]);
        expect(coinedWordsIn('setting-grimdark-undead')).toEqual([]);
        expect(coinedWordsIn('Taunting Statue, Pork Barrel, Beehive, Workbench, Archive')).toEqual([]);
        expect(coinedWordsIn('Farming World Region, Hell Drive Core, Hellfire Brazier, warped planks, Agriculture, Tablet')).toEqual([]);
        expect(coinedWordsIn('Grimdark Undead Stone Crypt Floor, Portal Arch, Soul Gem Plinth, Black Stone Wall')).toEqual([]);
        expect(coinedWordsIn('Forge Sprawl, Industrial World Region, Habitat Dome, Grimdark Residence Block')).toEqual([]);
    });
});
