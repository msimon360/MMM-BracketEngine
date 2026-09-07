# Changelog

## 1.1.0

### Added

- **US Open provider** (`provider: "usopen"`), reading `usopen.org/en_US/scores/feeds/{year}/draws/{drawCode}.json`. Covers men's and women's singles and doubles (`MS`, `WS`, `MD`, `WD`), mixed doubles (`XD`) and junior singles (`BS`, `GS`); an unlisted draw code falls back to the event name the feed reports.
- `providers/SlamDrawProvider.js`, the draw-feed parser now shared by the Wimbledon and US Open providers, which publish the same format.
- `lib/country-flags.js`, a shared country-code to flag-emoji lookup used by both the browser module and the providers.
- Offline test suites for flag resolution, Grand Slam draw parsing and `getDom()` rendering, plus `npm run test:usopen` as a live-feed smoke test.

### Fixed

- **Wrong country flags.** Three-letter IOC and FIFA codes were truncated to two letters, so `ALG` showed Albania's flag instead of Algeria's and `GER` showed Georgia's instead of Germany's. Codes are now mapped through a lookup table, and unknown codes render no flag rather than a wrong one.
- **Missing Wimbledon rounds.** Draws starting earlier than the Round of 32 produced rounds with an `undefined` id. The provider now keeps the latest rounds the renderer can fit.
- **Invisible fetch errors.** A failed first fetch left the module on "Loading bracket…" forever with nothing explaining why. Errors now reach the screen, either alongside the last good bracket or on their own.
- **Bracket grid alignment.** The round-title row consumed a full match row and the last match fell into an implicit, differently sized row, so connector lines missed their matches and vertical space was wasted.
- **Retired and walkover matches shown as unplayed.** Only status code `D` counted as finished, so retirements and walkovers rendered with a highlighted winner and no score at all. Both now render as finished — retirements with the set score reached, walkovers without one, since nobody took the court.

### Changed

- The tennis providers default to the current calendar year instead of a pinned `2025`. Set `providerConfig.year` explicitly to render a past edition.

## 1.0.0

Initial release: mirrored knockout bracket renderer with FIFA, Wimbledon and static providers.
