function parseArguments() {
  const defaults = {
    keepMineUploadCenter: true,
  };

  if (typeof $argument === "undefined") return defaults;

  if (Array.isArray($argument)) {
    return { ...defaults, keepMineUploadCenter: $argument[0] };
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
      return { ...defaults, keepMineUploadCenter: raw };
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

function getLabel(item) {
  if (!item || typeof item !== "object") return "";
  return String(item.title || item.name || item.label || item.desc || item.subtitle || "");
}

function getSearchText(value) {
  if (!value || typeof value !== "object") return String(value || "");
  if (Array.isArray(value)) return value.map(getSearchText).join(" ");

  return Object.keys(value)
    .map((key) => {
      const item = value[key];
      if (typeof item === "string" || typeof item === "number") return String(item);
      if (item && typeof item === "object") return getSearchText(item);
      return "";
    })
    .join(" ");
}

function containsUploadCenter(value) {
  const text = getSearchText(value);
  return [
    "投稿中心",
    "创作中心",
    "创作者中心",
    "投稿管理",
    "稿件管理",
    "创作首页",
    "uper",
    "upload",
    "creative",
  ].some((keyword) => text.includes(keyword));
}

function shouldDropItem(item, config) {
  const label = getLabel(item);
  if (isEnabled(config.keepMineUploadCenter) && containsUploadCenter(item)) {
    return false;
  }

  return [
    "个性装扮",
    "直播中心",
    "推荐服务",
    "我的课程",
    "我的直播",
    "课堂模式",
    "青少年守护",
    "联系客服",
    "有奖调研",
    "邀好友赚红包",
    "免流量服务",
    "会员购中心",
    "工房",
    "能量加油站",
  ].some((keyword) => label.includes(keyword));
}

function filterArray(items, config) {
  if (!Array.isArray(items)) return items;

  return items
    .map((item) => {
      if (item && typeof item === "object") {
        return filterObject(item, config);
      }
      return item;
    })
    .filter((item) => !(item && typeof item === "object" && shouldDropItem(item, config)));
}

function filterObject(value, config) {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return filterArray(value, config);

  for (const key of Object.keys(value)) {
    if (Array.isArray(value[key])) {
      value[key] = filterArray(value[key], config);
    } else if (value[key] && typeof value[key] === "object") {
      value[key] = filterObject(value[key], config);
    }
  }

  return value;
}

const config = parseArguments();
const body = filterObject(JSON.parse($response.body || "{}"), config);

$done({ body: JSON.stringify(body) });
