# Zephyr Cartography Assets

The public gallery of the Zephyr Cartography assets: battlemap
stamps, modular tiles, tokens, character art, textures, particle effects,
sound effects, music and scenes, each under its own open licence (most CC0 1.0), every piece credited
and flagged if AI-generated. The site's source, its publishing steps and the
collection's content and licensing statement are in
[gallery/README.md](gallery/README.md).

The Foundry VTT module itself is attached to the rolling
[nightly release](https://github.com/JamesonRGrieve/zephyr-cartography-assets/releases/tag/nightly)
in four forms, each installed from its manifest URL
(`https://github.com/JamesonRGrieve/zephyr-cartography-assets/releases/download/nightly/<manifest>`).
Each build's version carries its date, so Foundry updates an installed release.
It needs the Zephyr Cartography module, installed from
`https://github.com/JamesonRGrieve/zephyr-cartography/releases/download/nightly/module.json`:

| Release | Holds | Manifest |
|---|---|---|
| CC0 (the default) | only CC0 assets, usable with no conditions | `module.json` |
| Everything | every asset, each under its own licence, which governs any use of it | `module-everything.json` |
| CC0, AI-free | only CC0 assets made by people | `module-ai-free.json` |
| Everything, AI-free | every asset made by people, each under its own licence | `module-everything-ai-free.json` |

Each needs the [Zephyr Cartography](https://github.com/JamesonRGrieve/zephyr-cartography)
module. No release holds tokens, character art or music: this is a
cartography module, not a character one, so those are downloaded one at a
time from the gallery (music as a preview there, the whole track from its
author).

## Why publish AI art?

- I paid for it myself, and I give it away under CC0, free, with no
  conditions. I would never charge for a licence to AI imagery.
- It's generated once and shared, so the people who use it don't each
  generate their own.
- No prompt names an artist. Each asks for a subject and a general look, such
  as a grimdark oil painting.
- Every AI-generated piece is labelled. The AI-free releases above leave them
  all out, and the gallery can hide them.
- I know the question of what these models were trained on is unresolved, and
  I don't pretend otherwise.
- If you can pay an artist for hand-drawn work, please do. This gallery also
  hosts and credits people's own open-licensed work.

To request an asset, a variant or a new class of asset, or to report a
problem with one, open an
[issue](https://github.com/JamesonRGrieve/zephyr-cartography-assets/issues/new/choose).
Contributions follow [CONTRIBUTING.md](CONTRIBUTING.md).
