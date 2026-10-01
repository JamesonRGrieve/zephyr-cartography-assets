// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The one function of Foundry's own packer (`@foundryvtt/foundryvtt-cli`,
 * which ships no types) the release build uses: compile a folder of JSON
 * documents, each filed under its collection by its `_key`, into a LevelDB
 * compendium as Foundry reads one.
 */
declare module '@foundryvtt/foundryvtt-cli' {
    export function compilePack(src: string, dest: string, options?: { readonly log?: boolean; readonly recursive?: boolean }): Promise<void>;
}
