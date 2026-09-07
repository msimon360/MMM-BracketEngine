# MMM-BracketEngine

A [MagicMirror²](https://github.com/MichMich/MagicMirror) module that displays a mirrored knockout tournament bracket for any sport. Providers fetch data from external APIs and normalize it into a common format; the engine renders it with a CSS Grid layout. You can also use a static bracket that you edit so you can display a tournament that has no online data.

Seeded from [MMM-FIFAWorldCup](https://github.com/msimon360/mmm-fifaworldcup) and generalized for multi-sport support.

---
## Screenshots
Wimbledon Mens Singles
<img width="1527" height="952" alt="Wimbledon" src="https://github.com/user-attachments/assets/628fee65-9779-4c0a-9027-8c964eff2828" />
FIFA World Cup
<img width="1743" height="1044" alt="FIFA_WorldCup" src="https://github.com/user-attachments/assets/3f09de51-9c33-4ea0-848e-cecb5192bf50" />
US Open Men's Singles
<img width="1920" height="1080" alt="usopen" src="https://github.com/user-attachments/assets/9eeb1eb2-d703-40ba-bf07-2bff3464251d" />



---
## Installation

```bash
cd ~/MagicMirror/modules
git clone https://github.com/msimon360/MMM-BracketEngine
cd MMM-BracketEngine
npm install
```

Add to your `config/config.js`:

```js
{
  module: "MMM-BracketEngine",
  position: "bottom_bar",
  config: {
    provider: "fifa",
    providerConfig: {
      seasonId: "285023",
      language: "en"
    },
    updateInterval: 3 * 60 * 1000,
    colored: true,
    showDates: true,
    showPenalties: false,
    showFlags: true,
    showLastUpdated: true
  }
}
```

Restart MagicMirror after installing: `pm2 restart mm`

---

## Configuration

| Option | Default | Description |
|---|---|---|
| `provider` | `"fifa"` | Data provider name (`fifa`, `usopen`, `wimbledon`, `static`) |
| `providerConfig` | `{}` | Provider-specific settings (see below) |
| `updateInterval` | `180000` | Milliseconds between data refreshes |
| `animationSpeed` | `1000` | DOM update fade speed in ms |
| `header` | `null` | Override module header; `null` uses provider `meta.title` |
| `colored` | `true` | Highlight match winners in green |
| `showDates` | `true` | Show match dates under each card |
| `showPenalties` | `false` | Show penalty shootout scores |
| `showFlags` | `true` | Show team flag emojis |
| `showLastUpdated` | `true` | Show last-updated timestamp |

### FIFA provider

```js
provider: "fifa",
providerConfig: {
  seasonId: "285023",   // FIFA season ID
  language: "en",
  title: "FIFA World Cup 2026"  // optional header override in payload
}
```

Data source: `https://api.fifa.com/api/v3/seasonbracket/season/{seasonId}`

### Wimbledon provider

```js
provider: "wimbledon",
providerConfig: {
  year: "2025",           // championship year, defaults to the current one
  drawCode: "MS",         // MS, LS, MD, LD, or XD
  fromRoundCode: "4",     // optional: 1, 2, 3, 4, Q, S, F — default depends on draw
  title: "Wimbledon 2025 Gentlemen's Singles"  // optional
}
```

Data source: `https://www.wimbledon.com/en_GB/scores/feeds/{year}/draws/{drawCode}.json`

Defaults: Gentlemen's/Ladies' singles start at the Third Round (`3`, 16 players); doubles draws start at the Second Round (`2`). Use `fromRoundCode: "4"` for a compact singles view (Round of 16 through Final).

### US Open provider

```js
provider: "usopen",
providerConfig: {
  year: "2026",           // tournament year, defaults to the current one
  drawCode: "MS",         // MS, WS, MD, WD, XD, BS, or GS
  fromRoundCode: "4",     // optional: 1, 2, 3, 4, Q, S, F
  title: "US Open 2026 Men's Singles"  // optional
}
```

Data source: `https://www.usopen.org/en_US/scores/feeds/{year}/draws/{drawCode}.json`

The women's draws are `WS` and `WD`, not Wimbledon's `LS` and `LD`. `BS` and `GS` are the junior singles draws. Any other code the feed serves still works — the header falls back to the event name the feed reports.

Without a `fromRoundCode` the provider shows the latest rounds that fit, whatever the draw size: the Round of 32 onwards for a 128-player singles draw, and the Round of 16 onwards for the 16-team mixed doubles draw. That matters because mixed doubles was a 32-team draw in 2024 and a 16-team draw from 2025, so no single starting round is right for both.

### Round trimming

The engine renders at most five stages (Round of 32 through the Final). Draws that supply more — a 128-player singles draw, or `fromRoundCode: "1"` — have their earliest rounds dropped so the latest five are shown. Smaller draws simply render the stages they have.

### Match states

Both tennis providers read each match's state from the feed's status code:

| Feed status | Rendered as |
|---|---|
| `Completed` | Final, with the set score |
| `Retired` | Final, with the set score reached before the retirement |
| `Walkover` | Final, winner highlighted, no score — nobody took the court |
| *(empty)* | Scheduled, with the match date when the feed carries one |
| `In Progress` | Live, with the running set score |

A match that names a winner under any other status code is treated as final, so an unfamiliar code cannot leave a decided match looking like an upcoming one.

### Static provider (offline tournament / testing)

```js
provider: "static",
providerConfig: {
  filePath: "modules/MMM-BracketEngine/data/placeholder-bracket.json"
}
```

Or pass inline data:

```js
providerConfig: {
  bracketData: { meta: { ... }, rounds: [ ... ] }
}
```

---

## Layout

The bracket is mirrored left/right with the trophy in the centre:

```
[R32][R16][QF][SF]  🏆  [SF][QF][R16][R32]
```

Smaller brackets (e.g. 16-team) omit earlier rounds and adjust column count automatically.

---

## Common Data Schema

All providers must return this shape:

```js
{
  meta: {
    title: "Tournament Name",   // required
    sport: "soccer",            // required
    icon: "⚽",                 // optional
    updatedAt: "2026-07-06T..." // optional
  },
  rounds: [
    {
      id: "R16",                // R32, R16, QF, SF, 3RD, F
      name: "Round of 16",
      matches: [
        {
          id: 1,
          status: "final",      // scheduled | live | final
          teamA: { name: "Germany", abbr: "GER" },
          teamB: { name: "France", abbr: "FRA" },
          // optional:
          date: "Jul 6",
          scoreA: 2, scoreB: 1,
          penA: 4, penB: 3,
          winner: "GER"
        }
      ]
    }
  ]
}
```

### Flags

A team may carry its own `flag` emoji. Without one, the engine derives a flag from `abbr` using the lookup in `lib/country-flags.js`, which understands IOC codes (`ALG`, `GER`, `SUI`), ISO alpha-3 codes (`DZA`, `DEU`, `CHE`) and FIFA spellings (`TRI`, `SIN`, `EQG`). Codes it does not recognise render no flag rather than a guess — truncating a three-letter code to two letters produces a different country's flag more often than not.

Validation runs in `node_helper.js` before data reaches the frontend. Invalid payloads trigger `BE_BRACKET_ERROR`.

After validation, `layoutRoundsForMirroredBracket()` reorders side-round matches for the mirrored renderer. Bracket **results** flow outside-in (R32 → R16 → QF → …). **Layout** walks the other way for sorting only: when QF lists its teams, the engine reorders the R16 match list so winners line up with the correct QF slot — it does not imply QF feeds R16.

Uses each match's **teams and winners** to infer feeder links when the next stage already lists its participants. No extra provider fields required. Optional `sources: [parentIdA, parentIdB]` can override inference when an API exposes explicit parent ids.

---

## Writing a Provider

1. Create `providers/MyProvider.js` extending `BaseProvider`
2. Implement `async fetchBracket()` returning the schema above
3. Register in `node_helper.js`:

```js
const MyProvider = require("./providers/MyProvider");
const PROVIDERS = { fifa: FifaProvider, static: StaticProvider, mysport: MyProvider };
```

Provider-specific match ordering (e.g. FIFA R32 reorder) belongs in the provider, not the engine.

---

## Architecture

```
MMM-BracketEngine.js  ←→  node_helper.js  ←→  providers/
     (render)              (router)            (fifa, static, …)
         ↕                                          ↕
                        lib/  (shared browser + node helpers)
```

Wimbledon and the US Open publish the same draw feed, so both extend
`providers/SlamDrawProvider.js` and supply only their host, draw labels and
tournament name.

```
```

Socket notifications: `BE_GET_BRACKET`, `BE_BRACKET_RESULT`, `BE_BRACKET_ERROR`

`MMM-BracketEngine` and `MMM-FIFAWorldCup` can coexist on the same mirror (different socket prefixes).

---

## Testing

```bash
npm test                # offline: schema, layout, flags, draw parsing, rendering
npm run test:order      # live FIFA feed: mirrored bracket ordering
npm run test:wimbledon  # live Wimbledon feed: draw parsing
npm run test:usopen     # live US Open feed: draw parsing
```

`npm test` needs no network. It validates the placeholder bracket against the schema, checks mirrored-bracket ordering, checks country-code to flag resolution, checks the Grand Slam draw parsing shared by the Wimbledon and US Open providers (round ids, match states, feed URLs), and renders `getDom()` against a stub DOM to confirm the bracket grid and the error states.

---

## Troubleshooting

- **"No bracket data yet." with a red message** — the provider failed. The message is the provider's error; check `pm2 logs mm` for the full `[MMM-BracketEngine]` stack. Confirm network access for the FIFA and Wimbledon providers.
- **"Loading bracket…" forever** — the module has not heard back from `node_helper` at all. Confirm the module directory name matches the module name in `config.js`.
- **Stale data after error** — expected: the module keeps the last good bracket and shows a dimmed error message beneath it.
- **A team shows no flag** — its `abbr` is not a country code the lookup recognises. Add it to `lib/country-flags.js`, or set `flag` on the team in the provider.
- **Layout looks wrong** — full restart required (`pm2 restart mm`), not just a browser refresh.

---

## License

MIT
