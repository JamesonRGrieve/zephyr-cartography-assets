// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * A Scene document keyed for Foundry's packer (`@foundryvtt/foundryvtt-cli`),
 * which files every document, embedded ones included, under its `_key`: a
 * scene `!scenes!<id>`, its walls `!scenes.walls!<scene>.<wall>`, a region's
 * behaviours `!scenes.regions.behaviors!<scene>.<region>.<behaviour>`, and
 * so on through Foundry's own embedded collections. Pure.
 */
// The .ts extension lets Node run the build scripts that import this without a build.
import type { Json, JsonObject } from './channels.ts';

/** A Scene's embedded collections (Foundry v14), and the collections embedded in each. */
const SCENE_EMBEDDED: Readonly<Record<string, readonly string[]>> = {
    drawings: [],
    tokens: [],
    levels: [],
    lights: [],
    notes: [],
    regions: ['behaviors'],
    sounds: [],
    templates: [],
    tiles: [],
    walls: [],
};

const isObject = (value: Json): value is JsonObject => typeof value === 'object' && value !== null && !Array.isArray(value);

/** `doc`'s id, or an error naming where a document without one is. */
function idOf(doc: JsonObject, where: string): string {
    const id = doc['_id'];
    if (typeof id !== 'string' || id === '') {
        throw new Error(`${where} has no _id: a compendium document needs one`);
    }
    return id;
}

/** `scene` with its `_key` and every embedded document's, however deep Foundry nests them. */
export function keyedScene(scene: JsonObject): JsonObject {
    const sceneId = idOf(scene, 'a scene');
    const keyed: JsonObject = { ...scene, _key: `!scenes!${sceneId}` };
    for (const [collection, inner] of Object.entries(SCENE_EMBEDDED)) {
        const docs = scene[collection];
        if (!Array.isArray(docs)) {
            continue;
        }
        keyed[collection] = docs.filter(isObject).map((doc) => {
            const id = idOf(doc, `scene ${sceneId}'s ${collection}`);
            const child: JsonObject = { ...doc, _key: `!scenes.${collection}!${sceneId}.${id}` };
            for (const nested of inner) {
                const grand = doc[nested];
                if (Array.isArray(grand)) {
                    child[nested] = grand.filter(isObject).map((g) => ({
                        ...g,
                        _key: `!scenes.${collection}.${nested}!${sceneId}.${id}.${idOf(g, `scene ${sceneId}'s ${collection} ${id} ${nested}`)}`,
                    }));
                }
            }
            return child;
        });
    }
    return keyed;
}
