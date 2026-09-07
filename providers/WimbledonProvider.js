/**
 * Wimbledon draw provider.
 * Data source: https://www.wimbledon.com/en_GB/scores/feeds/{year}/draws/{drawCode}.json
 *
 * drawCode: MS, LS, MD, LD, XD
 */
const SlamDrawProvider = require("./SlamDrawProvider");

const DRAW_LABELS = {
  MS: "Gentlemen's Singles",
  LS: "Ladies' Singles",
  MD: "Gentlemen's Doubles",
  LD: "Ladies' Doubles",
  XD: "Mixed Doubles",
};

const DEFAULT_FROM_ROUND = {
  MS: "3",
  LS: "3",
  MD: "2",
  LD: "2",
  XD: "2",
};

class WimbledonProvider extends SlamDrawProvider {
  get name() {
    return "wimbledon";
  }

  get tournamentName() {
    return "Wimbledon";
  }

  get drawLabels() {
    return DRAW_LABELS;
  }

  get defaultFromRound() {
    return DEFAULT_FROM_ROUND;
  }

  feedUrl(drawCode, year) {
    return `https://www.wimbledon.com/en_GB/scores/feeds/${year}/draws/${drawCode}.json`;
  }
}

module.exports = WimbledonProvider;
