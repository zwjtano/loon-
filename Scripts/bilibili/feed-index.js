function parseArguments() {
  const defaults = {
    customizeHomeFeed: true,
    filterVerticalVideo: false,
  };

  if (typeof $argument === "undefined") return defaults;

  if (Array.isArray($argument)) {
    return {
      ...defaults,
      customizeHomeFeed: $argument[0],
      filterVerticalVideo: $argument[1],
    };
  }

  if (typeof $argument === "string") {
    const raw = $argument.trim();
    if (!raw) return defaults;

    try {
      return { ...defaults, ...JSON.parse(raw) };
    } catch (_) {
      return raw.split(/[&;]/).reduce((config, item) => {
        const [key, ...valueParts] = item.split("=");
        const value = valueParts.join("=");
        if (key && value) config[key.trim()] = decodeURIComponent(value.trim());
        return config;
      }, { ...defaults });
    }
  }

  if ($argument && typeof $argument === "object") {
    return { ...defaults, ...$argument };
  }

  return defaults;
}

function isEnabled(value) {
  if (typeof value === "boolean") return value;
  return String(value).toLowerCase() !== "false";
}

function matchesValue(value, expectedValues) {
  const normalized = String(value || "").toLowerCase();
  return expectedValues.some((expected) => normalized === expected);
}

function isAdItem(item) {
  const cardType = String(item.card_type || "").toLowerCase();
  const cardGoto = String(item.card_goto || "").toLowerCase();
  const adCardGotos = [
    "ad_web_s",
    "ad_av",
    "ad_web_gif",
    "ad_player",
    "ad_inline_3d",
    "ad_inline_eggs",
  ];

  // iPad 9.3.0 uses cm_v1 while iPhone and other versions may use cm_v2.
  if (["cm_v1", "cm_v2"].includes(cardType) && adCardGotos.includes(cardGoto)) {
    return true;
  }

  // Keep compatibility with new card types when Bilibili still marks them as ads.
  if (item.ad_info && cardGoto.startsWith("ad_")) return true;

  if (["banner_v8", "banner_ipad_v8"].includes(cardType) && cardGoto === "banner") {
    return Array.isArray(item.banner_item) && item.banner_item.some((banner) => {
      return banner.type === "ad" || Boolean(banner.ad_info);
    });
  }

  if (cardType === "small_cover_v10" && cardGoto === "game") return true;
  if (cardType === "cm_double_v9" && cardGoto === "ad_inline_av") return true;

  return false;
}

function isVerticalVideo(item) {
  const verticalValues = ["vertical_av", "story"];

  return (
    matchesValue(item.goto, verticalValues) ||
    matchesValue(item.card_goto, verticalValues)
  );
}

let body = JSON.parse($response.body || "{}");
let config = parseArguments();
let shouldFilterAds = isEnabled(config.customizeHomeFeed);
let shouldFilterVerticalVideo = isEnabled(config.filterVerticalVideo);

if (body.data && Array.isArray(body.data.items)) {
  body.data.items = body.data.items.filter((item) => {
    if (shouldFilterAds && isAdItem(item)) return false;
    if (shouldFilterVerticalVideo && isVerticalVideo(item)) return false;
    return true;
  });
}

$done({ body: JSON.stringify(body) });
