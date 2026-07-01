const obj = JSON.parse($response.body || "{}");

if (obj.data) {
  const del = ["ipad_upper_sections", "rework_v1", "vip_section", "vip_section_v2"];
  for (const key of del) {
    delete obj.data[key];
  }

  if (obj.data.ipad_recommend_sections && obj.data.ipad_recommend_sections.length > 0) {
    const itemList = [789, 790];
    obj.data.ipad_recommend_sections = obj.data.ipad_recommend_sections.filter((item) => itemList.includes(item.id));
  }

  if (obj.data.ipad_more_sections && obj.data.ipad_more_sections.length > 0) {
    const itemList = [797, 798];
    obj.data.ipad_more_sections = obj.data.ipad_more_sections.filter((item) => itemList.includes(item.id));
  }

  if (obj.data.sections_v2 && obj.data.sections_v2.length > 0) {
    const newSections = [];

    for (const section of obj.data.sections_v2) {
      if (section.button) {
        delete section.button;
      }

      if (section.style) {
        if (section.style === 1 || section.style === 2) {
          if (section.title) {
            if (["推荐服务", "我的服务"].includes(section.title)) {
              continue;
            }

            if (section.title === "更多服务") {
              delete section.title;

              if (section.items && section.items.length > 0) {
                const newItems = [];

                for (const item of section.items) {
                  if (/user_center\/feedback/g.test(item.uri)) {
                    newItems.push(item);
                  } else if (/user_center\/setting/g.test(item.uri)) {
                    newItems.push(item);
                  }
                }

                section.items = newItems;
              }
            }
          }
        } else {
          continue;
        }
      }

      newSections.push(section);
    }

    obj.data.sections_v2 = newSections;
  }

  if (obj.data.vip && obj.data.vip.status === 0) {
    obj.data.vip_type = 2;
    obj.data.vip.type = 2;
    obj.data.vip.status = 1;
    obj.data.vip.due_date = 3818419199;
    obj.data.vip.label = {
      path: "",
      text: "年度大会员",
      label_theme: "annual_vip",
      text_color: "#FFFFFF",
      bg_style: 1,
      bg_color: "#FB7299",
      border_color: "",
      image: "https://i0.hdslb.com/bfs/vip/8d4f8bfc713826a5412a0a27eaaac4d6b9ede1d9.png",
    };
    obj.data.vip.nickname_color = "#FB7299";
    obj.data.vip.role = 3;
  }
}

$done({ body: JSON.stringify(obj) });
