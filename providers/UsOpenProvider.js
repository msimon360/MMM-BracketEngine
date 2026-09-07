/**
 * US Open draw provider.
 * Data source: https://www.usopen.org/en_US/scores/feeds/{year}/draws/{drawCode}.json
 *
 * drawCode: MS, WS, MD, WD, XD, BS, GS
 *
 * The feed shares its format with Wimbledon's, so the parsing lives in
 * SlamDrawProvider; only the host, the draw codes and the name differ. Note
 * the women's draws are WS/WD here, not Wimbledon's LS/LD.
 */
const SlamDrawProvider = require("./SlamDrawProvider");

const DRAW_LABELS = {
  MS: "Men's Singles",
  WS: "Women's Singles",
  MD: "Men's Doubles",
  WD: "Women's Doubles",
  XD: "Mixed Doubles",
  BS: "Junior Boys' Singles",
  GS: "Junior Girls' Singles",
};

class UsOpenProvider extends SlamDrawProvider {
  get name() {
    return "usopen";
  }

  get tournamentName() {
    return "US Open";
  }

  get drawLabels() {
    return DRAW_LABELS;
  }

  // No per-draw starting round: mixed doubles was a 32-team draw in 2024 and a
  // 16-team draw from 2025, so a fixed starting round would be wrong for one of
  // them. Showing the latest rounds that fit adapts to whatever the feed holds.

  feedUrl(drawCode, year) {
    return `https://www.usopen.org/en_US/scores/feeds/${year}/draws/${drawCode}.json`;
  }
}

module.exports = UsOpenProvider;
