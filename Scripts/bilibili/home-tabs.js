function readArgument() {
  if (typeof $argument === "undefined") return "";
  if (typeof $argument === "string") return $argument;
  if ($argument && typeof $argument === "object") {
    return $argument.homeTopTabs || "";
  }
  return "";
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
let allowedNames = parseAllowedNames(readArgument());

if (body.data) {
  body.data.tab = filterByName(body.data.tab, allowedNames);

  if (Array.isArray(body.data.top)) {
    body.data.top = body.data.top.filter((item) => item.name !== "游戏中心");
    fixPosition(body.data.top);
  }

  if (Array.isArray(body.data.bottom)) {
    body.data.bottom = body.data.bottom.filter(
      (item) => item.name !== "发布" && item.name !== "会员购" && item.tab_id !== "会员购Bottom",
    );
    fixPosition(body.data.bottom);
  }
}

$done({ body: JSON.stringify(body) });
