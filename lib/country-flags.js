/**
 * Country code → flag emoji for MMM-BracketEngine.
 *
 * Sports feeds identify nations with IOC-style three-letter codes (ALG, GER,
 * SUI), which frequently disagree with the ISO 3166-1 alpha-2 codes that flag
 * emoji are built from. Truncating a code to its first two letters looks like
 * it works but silently produces a different country's flag — ALG becomes
 * Albania, GER becomes Georgia, RSA becomes Serbia. Unknown codes therefore
 * resolve to no flag rather than a wrong one.
 *
 * Loaded in the browser by getScripts() and required directly by providers.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.BracketCountryFlags = api;
  }
})(typeof self !== "undefined" ? self : this, function () {
  /**
   * Three-letter code → ISO 3166-1 alpha-2. Keyed primarily on IOC codes, with
   * ISO alpha-3 and FIFA spellings added as aliases where they differ.
   *
   * BRN is the one genuinely ambiguous key (IOC Bahrain, ISO alpha-3 Brunei).
   * It resolves to Bahrain because the bundled providers emit IOC-style codes;
   * Brunei is still reachable via its own IOC code, BRU.
   */
  const CODE_TO_ISO2 = {
    AFG: "AF", ALB: "AL", ALG: "DZ", AND: "AD", ANG: "AO", ANT: "AG",
    ARG: "AR", ARM: "AM", ARU: "AW", ASA: "AS", AUS: "AU", AUT: "AT",
    AZE: "AZ", BAH: "BS", BAN: "BD", BAR: "BB", BDI: "BI", BEL: "BE",
    BEN: "BJ", BER: "BM", BHU: "BT", BIH: "BA", BIZ: "BZ", BLR: "BY",
    BOL: "BO", BOT: "BW", BRA: "BR", BRN: "BH", BRU: "BN", BUL: "BG",
    BUR: "BF", CAF: "CF", CAM: "KH", CAN: "CA", CAY: "KY", CGO: "CG",
    CHA: "TD", CHI: "CL", CHN: "CN", CIV: "CI", CMR: "CM", COD: "CD",
    COK: "CK", COL: "CO", COM: "KM", CPV: "CV", CRC: "CR", CRO: "HR",
    CUB: "CU", CUW: "CW", CYP: "CY", CZE: "CZ", DEN: "DK", DJI: "DJ",
    DMA: "DM", DOM: "DO", ECU: "EC", EGY: "EG", ERI: "ER", ESA: "SV",
    ESP: "ES", EST: "EE", ETH: "ET", FIJ: "FJ", FIN: "FI", FRA: "FR",
    FSM: "FM", GAB: "GA", GAM: "GM", GBR: "GB", GBS: "GW", GEO: "GE",
    GEQ: "GQ", GER: "DE", GHA: "GH", GRE: "GR", GRN: "GD", GUA: "GT",
    GUI: "GN", GUM: "GU", GUY: "GY", HAI: "HT", HKG: "HK", HON: "HN",
    HUN: "HU", INA: "ID", IND: "IN", IRI: "IR", IRL: "IE", IRQ: "IQ",
    ISL: "IS", ISR: "IL", ISV: "VI", ITA: "IT", IVB: "VG", JAM: "JM",
    JOR: "JO", JPN: "JP", KAZ: "KZ", KEN: "KE", KGZ: "KG", KIR: "KI",
    KOR: "KR", KSA: "SA", KUW: "KW", LAO: "LA", LAT: "LV", LBA: "LY",
    LBN: "LB", LBR: "LR", LCA: "LC", LES: "LS", LIE: "LI", LTU: "LT",
    LUX: "LU", MAD: "MG", MAR: "MA", MAS: "MY", MAW: "MW", MDA: "MD",
    MDV: "MV", MEX: "MX", MGL: "MN", MKD: "MK", MLI: "ML", MLT: "MT",
    MNE: "ME", MON: "MC", MOZ: "MZ", MRI: "MU", MTN: "MR", MYA: "MM",
    NAM: "NA", NCA: "NI", NED: "NL", NEP: "NP", NGR: "NG", NIG: "NE",
    NOR: "NO", NRU: "NR", NZL: "NZ", OMA: "OM", PAK: "PK", PAN: "PA",
    PAR: "PY", PER: "PE", PHI: "PH", PLE: "PS", PLW: "PW", PNG: "PG",
    POL: "PL", POR: "PT", PRK: "KP", PUR: "PR", QAT: "QA", ROU: "RO",
    RSA: "ZA", RUS: "RU", RWA: "RW", SAM: "WS", SEN: "SN", SEY: "SC",
    SGP: "SG", SKN: "KN", SLE: "SL", SLO: "SI", SMR: "SM", SOL: "SB",
    SOM: "SO", SRB: "RS", SRI: "LK", SSD: "SS", STP: "ST", SUD: "SD",
    SUI: "CH", SUR: "SR", SVK: "SK", SWE: "SE", SWZ: "SZ", SYR: "SY",
    TAN: "TZ", TGA: "TO", THA: "TH", TJK: "TJ", TKM: "TM", TLS: "TL",
    TOG: "TG", TPE: "TW", TTO: "TT", TUN: "TN", TUR: "TR", TUV: "TV",
    UAE: "AE", UGA: "UG", UKR: "UA", URU: "UY", USA: "US", UZB: "UZ",
    VAN: "VU", VEN: "VE", VIE: "VN", VIN: "VC", YEM: "YE", ZAM: "ZM",
    ZIM: "ZW",

    // ISO alpha-3 spellings that differ from the IOC code above.
    ARE: "AE", BFA: "BF", BGD: "BD", BGR: "BG", BHR: "BH", BHS: "BS",
    BRB: "BB", BTN: "BT", BWA: "BW", CHE: "CH", CHL: "CL", CRI: "CR",
    DEU: "DE", DNK: "DK", DZA: "DZ", GIN: "GN", GNB: "GW", GNQ: "GQ",
    GRC: "GR", GTM: "GT", HRV: "HR", HTI: "HT", IDN: "ID", IRN: "IR",
    KHM: "KH", LKA: "LK", LVA: "LV", LBY: "LY", MMR: "MM", MNG: "MN",
    MYS: "MY", NER: "NE", NGA: "NG", NIC: "NI", NLD: "NL", NPL: "NP",
    OMN: "OM", PHL: "PH", PRT: "PT", PRY: "PY", ROM: "RO", SAU: "SA",
    SDN: "SD", SLV: "SV", SVN: "SI", TCD: "TD", TWN: "TW", URY: "UY",
    VNM: "VN", WSM: "WS", ZAF: "ZA", ZMB: "ZM", ZWE: "ZW",

    // FIFA/confederation spellings that match neither of the above.
    AIA: "AI", ATG: "AG", BLZ: "BZ", CTA: "CF", EQG: "GQ", FRO: "FO",
    GIB: "GI", LIB: "LB", MAC: "MO", MSR: "MS", MWI: "MW", NCL: "NC",
    SIN: "SG", SMA: "SX", SXM: "SX", TAH: "PF", TCA: "TC", TRI: "TT",
    VGB: "VG", VIR: "VI",

    // FIFA/UEFA home nations have no flag emoji of their own on most displays,
    // so they fall back to the Union Flag rather than a missing glyph.
    ENG: "GB", NIR: "GB", SCO: "GB", WAL: "GB",
  };

  const ISO2_CODES = new Set(Object.values(CODE_TO_ISO2));

  function toEmoji(iso2) {
    return [...iso2]
      .map(c => String.fromCodePoint(0x1f1e6 - 65 + c.charCodeAt(0)))
      .join("");
  }

  /**
   * @param {string} code IOC / ISO alpha-3 / ISO alpha-2 country code.
   * @returns {string} Flag emoji, or "" when the code is unknown.
   */
  function countryFlag(code) {
    if (typeof code !== "string") return "";

    const key = code.trim().toUpperCase();
    if (!/^[A-Z]{2,3}$/.test(key)) return "";

    if (key.length === 2) {
      return ISO2_CODES.has(key) ? toEmoji(key) : "";
    }

    const iso2 = CODE_TO_ISO2[key];
    return iso2 ? toEmoji(iso2) : "";
  }

  return { countryFlag, CODE_TO_ISO2 };
});
