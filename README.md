# Zephyrex Cartography Assets

A Foundry VTT asset-pack module for
[Zephyrex Cartography](https://github.com/JamesonRGrieve/zephyrex-cartography).
It holds art only: stamp tiles, terrain texture sets and battlemaps. The module
has no code. The engine discovers the pack and does everything else.

## Contents

| Path | What |
|------|------|
| `zephyrex-pack.json` | The pack manifest: 549 stamps (1448 variants) and 2 texture sets |
| `stamps/` | Stamp images, referenced by the manifest's variants |
| `textures/` | Terrain texture sets (`polyhaven/`, `ambientcg/`), plus their `PACKS.json` source map and a per-set `CREDITS.md` |
| `battlemaps/` | Pre-built battlemap images |

## The pack contract

`module.json` advertises the manifest via `flags["zephyrex-cartography"].pack`.
Paths inside the manifest are relative to this module's root.

The manifest declares `"$schema"`, which points at the engine's published, versioned
[stamp pack schema](https://raw.githubusercontent.com/JamesonRGrieve/zephyrex-cartography/main/schema/stamp-pack.v1.schema.json),
and `"schemaVersion": 1`. That schema is owned by the engine repo. This repo only
conforms to it.

`pnpm validate` does the following, and runs in the pre-commit hook and in CI:

- fetches the schema from the `$schema` URL and validates the manifest with Ajv (2020-12);
- checks what JSON Schema cannot express: every referenced image, texture and credits file exists, stamp ids are unique, and `defaultVariant` is in range.

It fails closed if the schema cannot be fetched.

Stamp behaviour (occlusion walls, lights, doors, level transitions, enterable
submaps, containers) is declared per stamp in the manifest. The engine realises
it as native Foundry documents. The catalog migrated from the former
`dh-cartography` module carries identity, category, tags, scale, perspective and
variants. Behaviour annotations are authored deliberately; they are never guessed.

## Textures

Texture files are downloaded, not hand-edited. `pnpm assets:textures`
(`scripts/fetch-textures.mjs`) re-fetches every set from `textures/PACKS.json`
and regenerates each `CREDITS.md`:

- use `--pack <id>` to fetch one set;
- use `--force` to re-download files that are already present.

## Licences

- **Scripts** (`scripts/`): AGPL-3.0-or-later.
- **Terrain textures** (`textures/`): CC0-1.0 (public domain), from
  [Poly Haven](https://polyhaven.com) and [ambientCG](https://ambientcg.com).
  Per-asset credits are in each set's `CREDITS.md`.
- **Stamp and battlemap art** (`stamps/`, `battlemaps/`): no licence is granted yet.
  Until the owner declares one, all rights are reserved.
