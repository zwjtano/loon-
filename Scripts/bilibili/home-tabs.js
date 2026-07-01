function parseArguments() {
  const defaults = {
    homeTopTabs: "推荐,热门,影视,动画,足球季",
    customizeHomeTabs: true,
    hideHomeTopGameCenter: true,
    hideHomeBottomPublish: true,
    hideHomeBottomMall: true,
  };

  if (typeof $argument === "undefined") return defaults;

  if (Array.isArray($argument)) {
    const keys = [
      "homeTopTabs",
      "customizeHomeTabs",
      "hideHomeTopGameCenter",
      "hideHomeBottomPublish",
      "hideHomeBottomMall",
    ];
    return $argument.reduce((config, value, index) => {
      if (keys[index]) config[keys[index]] = value;
      return config;
    }, { ...defaults });
  }

  if (typeof $argument === "string") {
    const raw = $argument.trim();
    if (!raw) return defaults;

    try {
      return { ...defaults, ...JSON.parse(raw) };
    } catch (_) {
      if (raw.includes("=")) {
        return raw.split(/[&;]/).reduce((config, item) => {
          const [key, ...valueParts] = item.split("=");
          const value = valueParts.join("=");
          if (key && value) config[key.trim()] = decodeURIComponent(value.trim());
          return config;
        }, { ...defaults });
      }
      return { ...defaults, homeTopTabs: raw };
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

function parseAllowedNames(value) {
  const raw = String(value || "推荐,热门,影视,动画,足球季");
  return raw
    .split(/[,，|/、\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeName(value) {
  return String(value || "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function fixPosition(items) {
  if (!Array.isArray(items)) return;
  items.forEach((item, index) => {
    item.pos = index + 1;
  });
}

function filterByName(items, allowedNames) {
  if (!Array.isArray(items)) return items;
  const allowed = new Set(allowedNames.map(normalizeName));
  const filtered = items.filter((item) => allowed.has(normalizeName(item.name)));
  fixPosition(filtered);
  return filtered.length > 0 ? filtered : items;
}

let body = JSON.parse($response.body || "{}");
let config = parseArguments();
let allowedNames = parseAllowedNames(config.homeTopTabs);

if (body.data) {
  if (isEnabled(config.customizeHomeTabs)) {
    body.data.tab = filterByName(body.data.tab, allowedNames);
  }

  if (isEnabled(config.hideHomeTopGameCenter) && Array.isArray(body.data.top)) {
    body.data.top = body.data.top.filter((item) => item.name !== "游戏中心");
    fixPosition(body.data.top);
  }

  if (Array.isArray(body.data.bottom)) {
    if (isEnabled(config.hideHomeBottomPublish)) {
      body.data.bottom = body.data.bottom.filter((item) => item.name !== "发布");
    }
    if (isEnabled(config.hideHomeBottomMall)) {
      body.data.bottom = body.data.bottom.filter((item) => item.name !== "会员购" && item.tab_id !== "会员购Bottom");
    }
    fixPosition(body.data.bottom);
  }
}

$done({ body: JSON.stringify(body) });
