# Contributing

Everything published here is dedicated to the public domain under
[CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/), so
anyone can use it for anything without asking. A contribution has to keep that
true. To request a stamp rather than contribute one, open a
[stamp request](../../issues/new?template=stamp-request.yml).

## What you may contribute

Only work you have the legal right to release under CC0 1.0:

- **Your own work**, drawn, painted, photographed or recorded by you.
- **AI-generated work you made**, from a tool whose terms let you publish its
  output with no restriction.
- **Someone else's CC0 or public-domain work**, already published by its author
  under CC0 (or verifiably in the public domain). Credit the author and link to
  where it is published as CC0, in the pull request and in the pack's credits.

Not allowed: anything under another licence (CC BY, CC BY-SA, "free for
personal use", royalty-free stock and the like), anything traced or copied from
someone else's art, and anything you are unsure about. If in doubt, leave it
out.

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
   CC0 1.0;
2. it contains no trademarked or copyrighted names, text, logos, emblems or
   other iconography belonging to anyone else; and
3. you dedicate your contribution to the public domain under CC0 1.0
   Universal.

The pull-request check fails until all three are ticked and no protected term
is found. Ticking them is your own legal declaration: a contribution found to
break them is removed.

Before pushing, run the same check locally:

    node gallery/scripts/check-pr.ts --base origin/main
