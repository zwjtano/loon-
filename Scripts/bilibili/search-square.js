const body = JSON.stringify({
  code: 0,
  message: "0",
  ttl: 1,
  data: {
    type: "history",
    title: "搜索历史",
    search_hotword_revision: 2,
  },
});

$done({ body });
