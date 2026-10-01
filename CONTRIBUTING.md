# Contributing

Everything published here is free to use for anything, commercially or not,
and to change: each piece under its own open licence, shown with it. A
contribution has to keep that true. To request an asset rather than contribute
one, open an [asset request](../../issues/new?template=stamp-request.yml).

## What you may contribute

Only work you have the legal right to release under the licence you mark it
with, and only under an open licence:

- **Your own work**, drawn, painted, photographed or recorded by you, under
  CC0 1.0 or an open licence of your choice.
- **AI-generated work you made**, from a tool whose terms let you publish its
  output with no restriction, under CC0 1.0.
- **Someone else's work under an open licence**: CC0 or public domain, an
  attribution licence (CC BY, MIT, Apache, BSD), or a share-alike or copyleft
  one (CC BY-SA, GPL). Mark it with the licence its author published it under,
  and credit the author with a link to where it is published under that
  licence, in the pull request and in the pack's provenance.

Every piece is marked with its licence as an [SPDX id](https://spdx.org/licenses/)
(`CC0-1.0`, `CC-BY-4.0`, `MIT`, `Apache-2.0`, `GPL-3.0-or-later`…) in its
`provenance`. The gallery build fails on a piece with no licence, and on a
non-commercial (NC) or no-derivatives (ND) licence.

Not allowed: anything non-commercial, no-derivatives, "free for personal use",
royalty-free stock and the like; anything traced or copied from someone
else's art; and anything you are unsure about. If in doubt, leave it out.

## No trademarks, no one else's iconography

Nothing here may carry, in any name, tag, file name, text or image:

- **Trademarked or coined names**: a game's or publisher's factions, races,
  places, products, technologies or invented words. Describe the thing in
  plain words instead ("laser rifle", "telepath", "farming world").
- **Copyrighted text**: quotes, lore, rules text or descriptions from any
  game, book or film.
- **Logos, emblems and iconography**: a publisher's symbols, insignia,
  heraldry, faction marks or recognisable character and equipment designs.
  Generic shapes (a skull, a gear, a double-headed bird of no particular
  design) are fine; a specific owned design is not.

A guard checks every pull request for known protected terms, in changed file
paths and text and in the title. It catches the words it knows, not
everything: keeping these out is the contributor's responsibility.

## Opening a pull request

The pull-request template ends with three statements. Tick each one (change
`[ ]` to `[x]`) to declare that:

1. you have the legal right to release everything in the pull request under
   the licence each piece is marked with;
2. it contains no trademarked or copyrighted names, text, logos, emblems or
   other iconography belonging to anyone else; and
3. every piece is marked with an open licence, and any piece you did not
   make credits its author and source.

The pull-request check fails until all three are ticked and no protected term
is found. Ticking them is your own legal declaration: a contribution found to
break them is removed.

Before pushing, run the same check locally:

    node gallery/scripts/check-pr.ts --base origin/main
