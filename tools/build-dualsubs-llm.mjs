import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const upstreamPluginUrl =
  "https://github.com/DualSubs/Universal/releases/latest/download/DualSubs.Universal.plugin";
const localScriptUrl =
  "https://raw.githubusercontent.com/zwjtano/loon-/master/Scripts/DualSubs/Translate.response.bundle.js";

async function load(url, fallbackPath) {
  if (fallbackPath) {
    try {
      return await readFile(fallbackPath, "utf8");
    } catch {}
  }

  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) throw new Error(`下载失败 ${response.status}: ${url}`);
  return response.text();
}

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`找不到补丁位置: ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`补丁位置不唯一: ${label}`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

function patchBundle(source) {
  source = replaceOnce(
    source,
    'Translate:{Settings:{Vendor:"Google",',
    'Translate:{Settings:{Vendor:"LLM",',
    "默认翻译器",
  );

  source = replaceOnce(
    source,
    'DeepLX:{Endpoint:"",Auth:""},URL:',
    'DeepLX:{Endpoint:"",Auth:""},LLM:{Endpoint:"https://api.openai.com/v1/chat/completions",Model:"gpt-4.1-mini",Auth:"",Temperature:.2,Timeout:120000},URL:',
    "LLM 默认配置",
  );

  const llmMethod = String.raw`async LLM(e=[],t=this.Source,a=this.Target,n=this.API){e=Array.isArray(e)?e:[e];let s=String(n?.Endpoint??"").trim(),i=String(n?.Model??"").trim();if(!s)throw Error("LLM Endpoint 未配置");if(!i)throw Error("LLM Model 未配置");s=s.replace(/\/+$/,"");/\/(chat\/completions|responses)$/i.test(s)||(s+=/\/v1$/i.test(s)?"/chat/completions":"/v1/chat/completions");let o={"Content-Type":"application/json",Accept:"application/json","User-Agent":"DualSubs-LLM"};n?.Auth&&(o.Authorization="Bearer "+n.Auth);if(n?.Headers)try{Object.assign(o,"string"==typeof n.Headers?JSON.parse(n.Headers):n.Headers)}catch(e){throw Error("LLM Headers 不是有效 JSON")};let u=e.map((e,t)=>({id:t,text:String(e??"")})),g="你是专业影视字幕翻译员。把源语言 "+t+" 翻译为目标语言 "+a+"。结合整批上下文消歧，译文自然简洁，保留人物语气、专有名词、数字和必要的格式信息。输入是 JSON 数组，每项包含 id 和 text。只返回严格 JSON 数组，每项格式为 {\"id\":数字,\"text\":\"译文\"}；id、数量、顺序必须与输入完全一致，不要输出 Markdown 或解释。",c={url:s,timeout:Number(n?.Timeout??120000),headers:o,body:JSON.stringify({model:i,messages:[{role:"system",content:g},{role:"user",content:JSON.stringify(u)}],temperature:Number(n?.Temperature??.2)})};return await l(c).then(t=>{if(!t?.ok)throw Error("LLM HTTP "+(t?.statusCode??t?.status)+": "+String(t?.body??"").slice(0,300));let a=JSON.parse(t.body??"{}"),n=a?.choices?.[0]?.message?.content??a?.output_text??a?.output?.[0]?.content?.[0]?.text;if(Array.isArray(n)&&(n=n.map(e=>e?.text??e?.content??"").join("")),"string"!=typeof n)throw Error("LLM 响应中没有文本内容");n=n.trim().replace(/^\x60\x60\x60(?:json)?\s*/i,"").replace(/\s*\x60\x60\x60$/,"");let s=n.indexOf("["),i=n.lastIndexOf("]");if(s<0||i<s)throw Error("LLM 未返回 JSON 数组");let o=JSON.parse(n.slice(s,i+1));Array.isArray(o?.translations)&&(o=o.translations);if(!Array.isArray(o)||o.length!==e.length)throw Error("LLM 返回行数错误: 期望 "+e.length+"，实际 "+(o?.length??0));let l=new Map(o.map((e,t)=>[Number(e?.id??t),e?.text]));return e.map((e,t)=>{let a=l.get(t);if("string"!=typeof a)throw Error("LLM 缺少第 "+t+" 行译文");return a.trim()})}).catch(e=>Promise.reject(e))}`;

  source = replaceOnce(
    source,
    '}}let I=Symbol.for("protobuf-ts/message-type")',
    `}${llmMethod}}let I=Symbol.for("protobuf-ts/message-type")`,
    "LLM 翻译方法",
  );

  source = replaceOnce(
    source,
    'case"DeepLX":g=20}',
    'case"DeepLX":g=20;break;case"LLM":g=40}',
    "LLM 分批大小",
  );

  source = replaceOnce(
    source,
    'r.info(`typeof Settings: ${typeof n}`,`Settings: ${JSON.stringify(n,null,2)}`)',
    'r.info(`typeof Settings: ${typeof n}`,`Settings: ${JSON.stringify({...n,LLM:n?.LLM?{...n.LLM,Auth:n.LLM.Auth?"***":""}:n?.LLM},null,2)}`)',
    "日志中的 API Key 脱敏",
  );

  return source;
}

function patchPlugin(source) {
  source = source
    .replace("#!name = 🍿️ DualSubs: 🔣 Universal", "#!name = 🍿️ DualSubs: 🔣 Universal LLM")
    .replace(
      /#!desc = .*/,
      "#!desc = DualSubs Universal 的大模型翻译版\\n支持 OpenAI 兼容的 Chat Completions API",
    );

  source = replaceOnce(
    source,
    'Vendor = select,"Google","Microsoft",tag=[翻译器] 服务商API,desc=请选择翻译器所使用的服务商API，更多翻译选项请使用BoxJs。',
    [
      'Vendor = select,"LLM","Google","Microsoft",tag=[翻译器] 服务商API,desc=LLM 支持 OpenAI 兼容的 Chat Completions API。',
      'LLM.Endpoint = input,"https://api.openai.com/v1/chat/completions",tag=[大模型] API 地址,desc=可填写完整 /v1/chat/completions 地址，也可填写以 /v1 结尾的基础地址。',
      'LLM.Model = input,"gpt-4.1-mini",tag=[大模型] 模型名称,desc=填写服务商支持的模型 ID。',
      'LLM.Auth = input,"",tag=[大模型] API Key,desc=仅保存在 Loon 插件配置中，请勿把填写密钥后的插件导出分享。',
      'LLM.Temperature = input,"0.2",tag=[大模型] 温度,desc=字幕翻译建议使用 0 到 0.3。',
      'LLM.Timeout = input,"120000",tag=[大模型] 超时毫秒,desc=默认 120 秒。',
      'LLM.Headers = input,"",tag=[大模型] 附加请求头,desc=可选 JSON 对象，例如 {"HTTP-Referer":"https://example.com"}。',
    ].join("\n"),
    "插件 LLM 参数",
  );

  const oldArgs =
    "argument=[{Types},{Languages[0]},{Languages[1]},{Position},{Vendor},{ShowOnly},{LogLevel}]";
  const newArgs =
    "argument=[{Types},{Languages[0]},{Languages[1]},{Position},{Vendor},{LLM.Endpoint},{LLM.Model},{LLM.Auth},{LLM.Temperature},{LLM.Timeout},{LLM.Headers},{ShowOnly},{LogLevel}]";

  const translateScript =
    /https:\/\/github\.com\/DualSubs\/Universal\/releases\/download\/v[^/]+\/Translate\.response\.bundle\.js/g;
  if (!translateScript.test(source)) throw new Error("插件中找不到翻译脚本地址");
  source = source.replace(translateScript, localScriptUrl);

  let patchedTranslateLines = 0;
  source = source
    .split("\n")
    .map((line) => {
      if (!line.includes(localScriptUrl)) return line;
      if (!line.includes(oldArgs)) throw new Error("翻译脚本行缺少参数列表");
      patchedTranslateLines += 1;
      return line.replace(oldArgs, newArgs);
    })
    .join("\n");
  if (!patchedTranslateLines) throw new Error("没有翻译脚本行被加入 LLM 参数");

  return source;
}

const pluginSource = await load(upstreamPluginUrl, "/tmp/DualSubs.Universal.plugin");
const version = pluginSource.match(/^#!version\s*=\s*(.+)$/m)?.[1]?.trim();
if (!version) throw new Error("无法从插件中读取版本号");
const bundleUrl = `https://github.com/DualSubs/Universal/releases/download/v${version}/Translate.response.bundle.js`;
const bundleSource = await load(bundleUrl, "/tmp/Translate.response.bundle.js");

const outputs = [
  ["Plugins/DualSubs.Universal.LLM.plugin", patchPlugin(pluginSource)],
  ["Scripts/DualSubs/Translate.response.bundle.js", patchBundle(bundleSource)],
];

for (const [relativePath, content] of outputs) {
  const outputPath = resolve(root, relativePath);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, content);
  console.log(`已生成 ${relativePath}`);
}
