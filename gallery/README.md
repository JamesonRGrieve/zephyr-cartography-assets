# Cartography Stamps gallery

The `gallery/` folder of the asset pack's repository: the pack (the Foundry
module) is the repository root, and this static site shows and links it.

A static web gallery of the Zephyr Cartography art: search it, see every
variant at full resolution, play its ambient sounds, and download everything
at once as the ready-to-install Foundry VTT module. The art is CC0 1.0 (see
[LICENSE-ART.md](LICENSE-ART.md)); this site's code is AGPL-3.0-or-later
([LICENSE](LICENSE)).

## What it shows

- **Stamps**: the asset module's stamps and painted textures (AI-generated,
  made available by Jameson Grieve) and its photo textures and particle images
  (other authors' CC0 work, each credited to its author and source); searched
  by name, setting, category, tags, scale and perspective (each of the last
  two with a (?) explaining its values, with example stamps). Every image has a
  "Report an issue" link and the header "Request Asset(s)", "Request New
  Asset Class" and "Report Asset Issue" buttons, the first two
  opening the issue forms on the asset pack's repository.
- **Audio**: each ambient sound loop, played in the page, with the tags whose
  stamps play it, its reach and its credit.

Where each piece came from is read from the pack's `provenance` fields, else
its CREDITS tables; another author's work with no credit fails the build.
The private pack is never read. Every published name, tag and file name, and
the module manifest, is checked against publishers' coined terms
(`src/trademarks.ts`): the build fails, listing them, if any slips back in.

## Contributions

Pull requests follow [CONTRIBUTING.md](../CONTRIBUTING.md): CC0-releasable work
only, with no one else's trademarks, text or iconography. The PR guard workflow
(`scripts/check-pr.ts`) fails a pull request whose title, changed paths or
changed text carry a protected term, or whose description leaves any of the
template's three CC0 statements unticked.

## How it is hosted

GitHub Pages serves the whole site: its index (`public/stamps.json`), a 256 px
WebP thumbnail of every image, a full-resolution WebP preview, and the sound
files, well under Pages' 1 GB site limit. Nothing is hotlinked. The exact
files are in one download: `zephyr-cartography-assets` as Foundry installs
it, attached to the asset pack's GitHub release. The header's download button
and its "Direct Foundry Install (Manifest)" dialog take their links from the
module's own `module.json` (`download` and `manifest`, copied into the index),
so a release is installed by unzipping it into `Data/modules` or by pasting the
manifest URL into Foundry's installer. It needs the Zephyr Cartography module.

## Publishing

1. `pnpm index`: build the index, thumbnails, previews and audio from the
   module at the repository root (`--assets` and `--curator` override the
   defaults).
2. `pnpm zip`: build `release/<module id>.zip`, the archive `module.json`'s
   `download` names, checked to fit GitHub Releases' 2 GiB limit on one file.
3. Tag a release `v<version>` of the asset pack's repository and attach the
   zip and the module's `module.json`, byte for byte, so the manifest URL
   (`releases/latest/download/module.json`) and its `download` both resolve.
4. Commit and push to `main`: the Pages workflow (`.github/workflows/pages.yml`)
   runs `pnpm check` in `gallery/` and deploys the site whenever `gallery/`
   changes. Until an index is committed under `public/`, it builds without
   deploying.

## Content and licensing

This is an independent, unofficial collection. It is not affiliated with,
endorsed by, sponsored by or licensed by any game publisher, studio or other
rights holder, and makes no claim of association with any of them.

### What this repository contains

- **Original art and sound, dedicated to the public domain.** AI-generated
  stamps and painted textures (no human author, CC0 1.0), and other authors'
  own CC0 1.0 work (photo textures, particle images, sound loops), each
  credited to its author and source. See [LICENSE-ART.md](LICENSE-ART.md).
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
site, or open an issue: it will be renamed or removed. Contributions follow
[CONTRIBUTING.md](../CONTRIBUTING.md).

## Developing

`pnpm dev` (in `gallery/`) serves the site locally; `pnpm check` runs
everything a commit must pass (format, ESLint, Biome, types, tests with
coverage, build). The repository's pre-commit hook runs it for any commit
touching `gallery/`.
