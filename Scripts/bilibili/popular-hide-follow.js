/*
 * Bilibili Popular/Index
 * Remove the pink "+ 关注" operation button from up recommendation cards.
 */

const FOLLOW_TEXT = utf8("+ 关注");
const FOLLOW_MARKERS = [utf8("up_follow"), utf8("up-follow")];

let body = toBytes(typeof $response.bodyBytes !== "undefined" ? $response.bodyBytes : $response.body);

try {
  body = patchGrpc(body);
  $done({ body, bodyBytes: body });
} catch (e) {
  console.log(`popular-hide-follow failed: ${e}`);
  $done({});
}

function patchGrpc(bytes) {
  if (bytes.length < 5) return bytes;

  const out = [];
  let offset = 0;
  let any = false;

  while (offset + 5 <= bytes.length) {
    const compressed = bytes[offset];
    const length =
      (bytes[offset + 1] << 24) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 8) |
      bytes[offset + 4];
    offset += 5;

    if (length < 0 || offset + length > bytes.length) return bytes;

    let payload = bytes.slice(offset, offset + length);
    offset += length;

    if (compressed === 1) payload = gunzip(payload);
    const patched = patchMessage(payload);

    if (patched !== payload) {
      any = true;
      payload = patched;
    }

    const framedPayload = compressed === 1 ? gzip(payload) : payload;
    out.push(compressed);
    out.push((framedPayload.length >>> 24) & 255);
    out.push((framedPayload.length >>> 16) & 255);
    out.push((framedPayload.length >>> 8) & 255);
    out.push(framedPayload.length & 255);
    pushBytes(out, framedPayload);
  }

  if (offset !== bytes.length || !any) return bytes;
  return Uint8Array.from(out);
}

function patchMessage(bytes) {
  const fields = [];
  let offset = 0;
  let any = false;

  while (offset < bytes.length) {
    const fieldStart = offset;
    const key = readVarint(bytes, offset);
    if (!key) return bytes;
    offset = key.next;

    const fieldNumber = key.value >>> 3;
    const wireType = key.value & 7;

    if (fieldNumber === 0) return bytes;

    if (wireType === 0) {
      const value = readVarint(bytes, offset);
      if (!value) return bytes;
      offset = value.next;
      fields.push(bytes.slice(fieldStart, offset));
      continue;
    }

    if (wireType === 1) {
      if (offset + 8 > bytes.length) return bytes;
      offset += 8;
      fields.push(bytes.slice(fieldStart, offset));
      continue;
    }

    if (wireType === 5) {
      if (offset + 4 > bytes.length) return bytes;
      offset += 4;
      fields.push(bytes.slice(fieldStart, offset));
      continue;
    }

    if (wireType !== 2) return bytes;

    const len = readVarint(bytes, offset);
    if (!len) return bytes;
    offset = len.next;
    if (offset + len.value > bytes.length) return bytes;

    const valueStart = offset;
    const valueEnd = offset + len.value;
    const value = bytes.slice(valueStart, valueEnd);
    offset = valueEnd;

    if (isFollowButtonField(value)) {
      any = true;
      continue;
    }

    const patchedValue = patchMessage(value);
    if (patchedValue !== value) {
      any = true;
      fields.push(encodeLengthDelimited(key.raw, patchedValue));
    } else {
      fields.push(bytes.slice(fieldStart, offset));
    }
  }

  if (!any) return bytes;

  const out = [];
  for (const field of fields) pushBytes(out, field);
  return Uint8Array.from(out);
}

function readVarint(bytes, offset) {
  let value = 0;
  let shift = 0;
  const start = offset;

  while (offset < bytes.length && shift <= 28) {
    const b = bytes[offset++];
    value |= (b & 127) << shift;
    if (b < 128) return { value: value >>> 0, next: offset, raw: bytes.slice(start, offset) };
    shift += 7;
  }

  return null;
}

function encodeVarint(value) {
  const out = [];
  value >>>= 0;
  while (value > 127) {
    out.push((value & 127) | 128);
    value >>>= 7;
  }
  out.push(value);
  return out;
}

function encodeLengthDelimited(keyRaw, value) {
  const out = [];
  pushBytes(out, keyRaw);
  pushBytes(out, encodeVarint(value.length));
  pushBytes(out, value);
  return Uint8Array.from(out);
}

function isFollowButtonField(value) {
  return (
    value.length <= 256 &&
    contains(value, FOLLOW_TEXT) &&
    FOLLOW_MARKERS.some((marker) => contains(value, marker))
  );
}

function contains(bytes, needle) {
  outer: for (let i = 0; i <= bytes.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (bytes[i + j] !== needle[j]) continue outer;
    }
    return true;
  }
  return false;
}

function utf8(text) {
  if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(text);
  const encoded = unescape(encodeURIComponent(text));
  const out = new Uint8Array(encoded.length);
  for (let i = 0; i < encoded.length; i++) out[i] = encoded.charCodeAt(i);
  return out;
}

function toBytes(body) {
  if (body instanceof Uint8Array) return body;
  if (body instanceof ArrayBuffer) return new Uint8Array(body);
  if (ArrayBuffer.isView(body)) return new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
  if (typeof body === "string") {
    const out = new Uint8Array(body.length);
    for (let i = 0; i < body.length; i++) out[i] = body.charCodeAt(i) & 255;
    return out;
  }
  return new Uint8Array(0);
}

function pushBytes(out, bytes) {
  for (let i = 0; i < bytes.length; i++) out.push(bytes[i]);
}

function gunzip(bytes) {
  if (typeof $utils !== "undefined" && $utils.ungzip) return toBytes($utils.ungzip(bytes));
  throw new Error("$utils.ungzip is unavailable");
}

function gzip(bytes) {
  if (typeof $utils !== "undefined" && $utils.gzip) return toBytes($utils.gzip(bytes));
  throw new Error("$utils.gzip is unavailable");
}
