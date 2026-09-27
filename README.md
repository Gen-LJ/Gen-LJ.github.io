# Kaung L Joy · Portfolio

A World of Warcraft–style portfolio for **Kaung L Joy**, Senior Mobile Developer (Flutter · Kotlin · Jetpack Compose · SwiftUI · Go), in the same gold-and-stone look as the [GitHub profile](https://github.com/Gen-LJ).

Plain HTML, CSS and JavaScript. No framework, no build step, no dependencies.

## What's inside

- **Loading screen** with a gold loading bar and rotating tips, shown once per visit.
- **Login screen hero**: the carved "KAUNG L JOY" logo from the GitHub banner, twin moons, a rotating rune circle, a starfield with shooting stars, rising embers and parallax mountains.
- **Hall of Deeds**: achievement toasts with counters (3+ years, 6 apps, 50K+ downloads, 10 gateways, a team of 4).
- **The Chronicle**: a character sheet and the story so far.
- **The Armoury**: legendary main weapons with WoW item tooltips, a spellbook of skills, and a Treasury of spinning gold, silver and copper coins for the 10 payment gateways.
- **Realms Served**: the six production apps as item tooltips, with store links and a lightbox for the screens.
- **The Journey**: experience as a quest chain, plus professions (education).
- **Quest Log**: side projects on a parchment page, with objectives and rewards.
- **Mailbox**: a "Send Mail" form that opens the visitor's email app, plus LinkedIn, GitHub and CV seals.

The game UI works as navigation:

- **Action bar** (bottom): jump between zones, with cooldown sweeps. Keys `1`–`6`, or `C` `P` `J` `M` `L` like WoW.
- **XP bar**: fills as you scroll. Reach the end to level up.
- **Unit frame and minimap** (screens 1560px and wider): the minimap is a live map of the page.
- **Achievements**: 10 to earn. Press `Esc` for the Game Menu to see them, turn on sound effects (synthesised, off by default) or turn off animations.
- **Chat** (screens 1200px and wider): press `Enter` or `/`, then try `/help`, `/played`, `/roll`, `/dance` or `/hire`.
- A certain ancient code (↑ ↑ ↓ ↓ ← → ← → B A).

It respects `prefers-reduced-motion`, works with a keyboard, and still shows every word with JavaScript turned off.

## Run it locally

Open `index.html` in a browser. That's it.

The 404 page uses root paths (`/assets/...`), so preview it through a local server:

```sh
python3 -m http.server 8000
# then open http://localhost:8000/404.html
```

## Deploy to GitHub Pages

1. Create a public repository named `Gen-LJ.github.io` on GitHub.
2. Push this folder to its `main` branch.
3. In the repository, open **Settings ▸ Pages** and set the source to **Deploy from a branch**, branch `main`, folder `/ (root)`.

The site goes live at <https://gen-lj.github.io>. If you host it anywhere else, update the `canonical` and `og:` URLs in `index.html`, plus `robots.txt` and `sitemap.xml`.

## Where to change things

| To change | Edit |
| :-- | :-- |
| Text, apps, jobs, quests, links | `index.html` (each section is marked with a comment banner) |
| Tooltip text for the main weapons and action bar | the `tips` block at the end of `index.html` |
| Colours, fonts, layout | `assets/css/style.css` (design tokens at the top) |
| Loading tips, achievements, chat commands, "time played" start date | `assets/js/main.js` |
| App icons and screen covers | `assets/img/apps/` and `assets/img/covers/` (WebP, 16:9 covers) |
| CV | `assets/cv/Kaung_L_Joy_CV.pdf` |

The icon sprite (tech logos and fantasy glyphs) sits at the top of `<body>` in `index.html`. Tech logos come from [Simple Icons](https://simpleicons.org) (CC0); use one with `<svg class="ico"><use href="#si-flutter"/></svg>`.

## Credits

- Fonts: [Cinzel](https://fonts.google.com/specimen/Cinzel), [Marcellus](https://fonts.google.com/specimen/Marcellus) and [Spectral](https://fonts.google.com/specimen/Spectral) from Google Fonts (SIL Open Font License).
- Brand logos: [Simple Icons](https://simpleicons.org) (CC0). Each logo belongs to its owner.
- Styled after World of Warcraft®, a trademark of Blizzard Entertainment, Inc. This fan-made portfolio isn't affiliated with or endorsed by Blizzard.
