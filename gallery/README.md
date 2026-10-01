# Cartography Stamps gallery

The `gallery/` folder of the asset pack's repository: a static web gallery of
the Zephyr Cartography assets. Search them, see every variant at full
resolution, play the sounds, and install or download the ready-to-install
Foundry VTT module in the release that suits you. Each piece of art is under
its own open licence, most CC0 1.0 (see [LICENSE-ART.md](LICENSE-ART.md));
this site's code is AGPL-3.0-or-later ([LICENSE](LICENSE)).

## What it shows

Seven tabs, one per class of asset: **Stamps**, **Tiles** (modular
battlemap tiles), **Textures**, **Particle Effects**, **Sound Effects**,
**Music** and **Scenes**.

- **Browsing** (Stamps, Tiles, Textures, Particle Effects): search by name, category
  and tags; filter by setting, category, tags, licence, minimum resolution
  (512 px+, 1K+, 2K+, 4K+, met by every image of a piece, read from each
  image's recorded closest-match resolution step) and, for stamps, scale and
  perspective (each with a (?) explaining its values, with example stamps).
  "Hide AI-generated" hides AI-generated pieces (and sounds).
- **Each piece** shows its images at full size, whether it is AI-generated,
  who made it with a link to its source (the asset pack's repository for art
  made for it), and its licence as a tag linking to the licence's text. Each
  image has a "Report an issue" link; each piece a "Request variant" button.
- **Sound Effects and Music**: each sound played in the page, with (for an
  effect) the tags whose stamps play it, how many stamps carry them and its
  reach, and its credit and licence.
- **Scenes**: full scenes with their walls, doors and lights, as Universal VTT
  files to download and in the module's scene compendium.
- **The header**: Direct Foundry Install (Manifest) with the archive download
  beside it, Request Asset(s), Request New Asset Class and Report Asset Issue,
  the requests opening the issue forms on the asset pack's repository.

Where each piece came from, its licence (an SPDX id) and whether it is
AI-generated (its own `ai` flag, apart from its source, since work brought in
from elsewhere can be AI-generated too) are read from the pack's `provenance`,
its credit else from its CREDITS tables. A piece with no provenance, no `ai`,
no credit or no licence fails the build, as does any licence that is not open
(non-commercial or no-derivatives). The private pack is never read. Every
published name, tag, file name and string, and the module manifest, is
checked against publishers' coined terms (`src/trademarks.ts`): the build
fails, listing them, if any slips back in.

## Contributions

Pull requests follow [CONTRIBUTING.md](../CONTRIBUTING.md): work under an open
licence it is marked with, with no one else's trademarks, text or iconography.
The PR guard workflow (`scripts/check-pr.ts`) fails a pull request whose
title, changed paths or changed text carry a protected term, or whose
description leaves any of the template's three statements unticked. The
issue forms (asset request, variant request, new asset class, asset problem)
apply their labels, declared in `.github/labels.yml` and synced by the Labels
workflow, which also labels pull requests by the files they change.

## How it is hosted

GitHub Pages serves the site: its index (`public/stamps.json`), a 256 px WebP
thumbnail and a full-resolution WebP preview of every image the pack carries,
and its sound files, well under Pages' 1 GB site limit. An asset the pack
links on the web (an http(s) address) is shown, played and downloaded from
its own address, never copied onto the site.

The exact files are in four releases of the one module,
`zephyr-cartography-assets`, attached to the asset pack's GitHub release:

| Release | Holds | Files |
|---|---|---|
| CC0 (the default) | only CC0 assets | `module.json`, `zephyr-cartography-assets.zip` |
| Everything | every asset, each under its own licence | `module-everything.json`, `zephyr-cartography-assets-everything.zip` |
| CC0, AI-free | only CC0 assets made by people | `module-ai-free.json`, `zephyr-cartography-assets-ai-free.zip` |
| Everything, AI-free | every asset made by people | `module-everything-ai-free.json`, `zephyr-cartography-assets-everything-ai-free.zip` |

There is no AI-only release. Each release's pack manifest leaves out what it
does not carry (`src/channels.ts`), so it names no missing file, and its
`module.json` names its own manifest and archive, so Foundry keeps updating
the release installed. The Everything releases' `LICENSE-ART.md` opens with
the acknowledgement that any use of an asset is governed by its own licence;
an AI-free release's opens with a note that it leaves out every AI-generated
asset. A linked asset is downloaded once at build time and bundled inside the
archive at `external/<host>/<path>`, its manifest pointing there.

The header's archive button downloads the CC0 release. Its "Direct Foundry
Install (Manifest)" dialog shows one release's manifest URL and archive, chosen
by two boxes: "Everything" (its label is the licence acknowledgement) and
"Exclude AI Generated Assets"; neither ticked is the CC0 release. A release is
installed by pasting its manifest URL into Foundry's installer, or by unzipping
it into `Data/modules`. It needs the Zephyr Cartography module.

## Publishing

1. `pnpm index`: build the index, thumbnails, previews and audio from the
   canonical asset module, `.foundry-cartography-assets` in the campaign
   workspace this repository sits in (`--assets` and `--curator` override the
   defaults).
2. `pnpm zip`: build the four releases into `release/`, each archive checked
   to fit GitHub Releases' 2 GiB limit on one file (linked assets are cached in
   `release/.linked/`).
3. Tag a release `v<version>` of the asset pack's repository and attach all
   eight files as built (four manifests, four archives), so each manifest URL
   (`releases/latest/download/module<suffix>.json`) and its `download` resolve.
4. Commit and push to `main`: the Pages workflow (`.github/workflows/pages.yml`)
   runs `pnpm check` in `gallery/` and deploys the site whenever `gallery/`
   changes. Until an index is committed under `public/`, it builds without
   deploying.

## Content and licensing

This is an independent, unofficial collection. It is not affiliated with,
endorsed by, sponsored by or licensed by any game publisher, studio or other
rights holder, and makes no claim of association with any of them.

### What this repository contains

- **Art and sound under open licences.** AI-generated stamps and painted
  textures (no human author; CC0 1.0), and other authors' own work (photo
  textures, particle images, sound loops) under the licence each was published
  with, most CC0 1.0, every piece credited to its author and source and
  flagged if AI-generated. See [LICENSE-ART.md](LICENSE-ART.md).
- **Descriptive names only.** Every name, tag and file name describes what
  the piece looks like in plain words. Setting tags ("Grimdark: Human",
  "Fantasy") are generic genre labels.
- **The site's code**, original work under AGPL-3.0-or-later ([LICENSE](LICENSE)).

### What this repository does NOT contain

- **No trademarked or coined names.** No faction, race, place, product,
  technology or invented word of any game or publisher appears in a name,
  tag, file name or page. The build and the pull-request check both fail on
  a known one (`src/trademarks.ts`).
- **No copyrighted text.** No rules text, lore, quotes, item descriptions or
  stat blocks from any game, book or film.
- **No logos, emblems or iconography.** No publisher's symbols, insignia,
  heraldry or recognisable character or equipment designs are drawn here.
  Pieces that came too close have been moved out of the collection.
- **No copyrighted artwork.** Nothing is traced, copied or derived from any
  publication's art.

Spotted something that should not be here? Use "Report Asset Issue" on the
site, or open an issue: it will be renamed or removed.

## Developing

`pnpm dev` (in `gallery/`) serves the site locally; `pnpm check` runs
everything a commit must pass (format, ESLint, Biome, types, tests with
coverage, build). The repository's pre-commit hook runs it for any commit
touching `gallery/`.
