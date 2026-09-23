#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Validate zephyrex-pack.json against the stamp pack JSON Schema it declares in
 * "$schema" (the engine's public, versioned schema — the single source of truth
 * lives in the zephyrex-cartography repo), then check what JSON Schema cannot
 * express: every referenced file exists, stamp ids are unique, defaultVariant is
 * in range, and module.json advertises this manifest. Fails closed if the schema
 * cannot be fetched.
 *
 *   node scripts/validate-pack.mjs
 */
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_FILE = 'zephyrex-pack.json';
const ENGINE_MODULE_ID = 'zephyrex-cartography';
const FETCH_TIMEOUT_MS = 20_000;

function fail(message) {
    console.error(`[validate] FAIL: ${message}`);
    process.exit(1);
}

const pack = JSON.parse(await readFile(resolve(ROOT, MANIFEST_FILE), 'utf8'));
const moduleJson = JSON.parse(await readFile(resolve(ROOT, 'module.json'), 'utf8'));

if (typeof pack.$schema !== 'string') {
    fail(`${MANIFEST_FILE} declares no "$schema" URL`);
}
let response;
try {
    response = await fetch(pack.$schema, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
} catch (err) {
    fail(`could not fetch schema ${pack.$schema}: ${err.message}`);
}
if (!response.ok) {
    fail(`could not fetch schema ${pack.$schema}: HTTP ${response.status}`);
}
const schema = await response.json();

const problems = [];
const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
if (!validate(pack)) {
    for (const e of validate.errors) {
        problems.push(`${e.instancePath || '/'} ${e.message}`);
    }
}

// Checks JSON Schema cannot express.
if (moduleJson.flags?.[ENGINE_MODULE_ID]?.pack !== MANIFEST_FILE) {
    problems.push(`module.json flags.${ENGINE_MODULE_ID}.pack must be "${MANIFEST_FILE}"`);
}
const ids = new Set();
let variants = 0;
for (const [i, stamp] of (pack.stamps ?? []).entries()) {
    if (ids.has(stamp.id)) {
        problems.push(`/stamps/${i}/id duplicate stamp id "${stamp.id}"`);
    }
    ids.add(stamp.id);
    const count = stamp.variants?.length ?? 0;
    variants += count;
    if (Number.isInteger(stamp.defaultVariant) && stamp.defaultVariant >= count) {
        problems.push(`/stamps/${i}/defaultVariant ${stamp.defaultVariant} is out of range (${count} variants)`);
    }
    for (const [j, variant] of (stamp.variants ?? []).entries()) {
        if (!existsSync(resolve(ROOT, variant.image))) {
            problems.push(`/stamps/${i}/variants/${j}/image missing file ${variant.image}`);
        }
    }
}
for (const [i, set] of (pack.textureSets ?? []).entries()) {
    for (const [role, path] of Object.entries(set.textures ?? {})) {
        if (!existsSync(resolve(ROOT, path))) {
            problems.push(`/textureSets/${i}/textures/${role} missing file ${path}`);
        }
    }
    if (set.credits && !existsSync(resolve(ROOT, set.credits))) {
        problems.push(`/textureSets/${i}/credits missing file ${set.credits}`);
    }
}

if (problems.length > 0) {
    console.error(`[validate] FAIL: ${problems.length} problem(s):`);
    for (const p of problems.slice(0, 50)) {
        console.error(`  ${p}`);
    }
    process.exit(1);
}
console.log(`[validate] OK: ${ids.size} stamps, ${variants} variants, ${pack.textureSets?.length ?? 0} texture sets against ${pack.$schema}`);
