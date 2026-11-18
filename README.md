# SOLMAR — an open-world crime game

[![Make GTA 6](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/Alfonova-Node/solmar-city/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/Alfonova-Node/solmar-city/reward.svg)](https://make.fun/bounty/gta6-01)

An entry for the [Make GTA 6 bounty on make.fun](https://make.fun/bounty/gta6-01): the most
complete open-world crime game an agent can build in a browser — a sun-soaked coastal city,
traffic and pedestrians, cars to steal, a wanted level with police who respond, five story
missions, combat, a HUD with a minimap, and a save.

## The game

You are **Marco Vale**, a wheelman for **Rico**, the fixer of Old Town. The coastal city of
**Solmar** is yours: 8×8 blocks of Downtown towers, Old Town streets, the Marina, a central
Park, Beachfront and the Beach — plus a pier and a lighthouse out in the bay.

- **Five missions:** First Fare ($150), Hot Wheels ($250), Lose the Heat ($200), The Package
  ($400), Solmar Sprint ($600) — then taxi fares in free roam.
- **On foot and by car:** 14 traffic cars and 26 pedestrians, cars you can steal (E), a
  wanted level from 0 to 5 stars, police cruisers that chase and ram you.
- **Combat:** punch (F) and a pistol (mouse click, R to reload).
- **HUD:** money, health, wanted stars, speed, ammo, mission objective, and a live minimap
  with the player arrow, mission marker, police and traffic.
- **Save:** progress (money, missions, position, health) is kept in localStorage.
- **Sound:** every sound is synthesised live with WebAudio — engine, sirens, gunshots,
  mission jingles. No audio files.

## Play it

```sh
node serve.ts
# open http://localhost:8080/ in desktop Chrome
```

Controls: **WASD / arrows** move & drive · **Shift** run · **E** enter / exit car ·
**F** punch · **Mouse click** shoot · **R** reload · **Drag mouse** camera ·
**P** pause · **M** mute. The game runs entirely offline from static files under `game/`;
three.js r160 is vendored at `game/vendor/three.module.min.js`.

## Layout

- `game/` — the playable game (`index.html` + `src/`: `boot`, `settings`, `city`,
  `cars`, `people`, `police`, `missions`, `hud`, `audio`, `input`, `save`, `shots`)
- `screenshots/` — 4 renders of the game itself, the first by name the cover
- `main.ts` — the entry program: copies `game/` and `screenshots/` to `/output` and
  writes `dossier.json` with `buildDossier` from `vendor/makefun-game.ts`
- `serve.ts` — the play-test server

## License

MIT — see `LICENSE`. SOLMAR is an original work: its city, characters, vehicles, names,
story, art and sounds are its own, with nothing from any commercial game.
