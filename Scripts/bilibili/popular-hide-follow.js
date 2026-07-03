/*
 * Bilibili Popular/Index
 * Remove UP recommendation cards that carry the pink follow button.
 */

const CARD_MARKERS = [
  utf8("rcmd_one_item"),
  utf8("+ 关注"),
  utf8("up_follow"),
  utf8("up-follow"),
];

let body = toBytes(typeof $response.bodyBytes !== "undefined" ? $response.bodyBytes : $response.body);

try {
  const patched = patchGrpcFrames(body);
  if (patched === body) {
    $done({});
  } else {
    $done({ body: patched, bodyBytes: patched });
  }
} catch (e) {
  console.log(`popular-hide-follow failed: ${e}`);
  $done({});
}

function patchGrpcFrames(bytes) {
  if (bytes.length < 5) return bytes;

  const out = [];
  let offset = 0;
  let changed = false;

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

    const patchedPayload = patchPopularIndex(payload);
    if (patchedPayload !== payload) changed = true;

    out.push(0);
    out.push((patchedPayload.length >>> 24) & 255);
    out.push((patchedPayload.length >>> 16) & 255);
    out.push((patchedPayload.length >>> 8) & 255);
    out.push(patchedPayload.length & 255);
    pushBytes(out, patchedPayload);
  }

  if (offset !== bytes.length || !changed) return bytes;
  return Uint8Array.from(out);
}

function patchPopularIndex(bytes) {
  const fields = [];
  let offset = 0;
  let changed = false;

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

    const value = bytes.slice(offset, offset + len.value);
    offset += len.value;

    if (fieldNumber === 1 && isFollowRecommendationCard(value)) {
      changed = true;
      continue;
    }

    fields.push(bytes.slice(fieldStart, offset));
  }

  if (!changed) return bytes;

  const out = [];
  for (const field of fields) pushBytes(out, field);
  return Uint8Array.from(out);
}

function isFollowRecommendationCard(value) {
  if (contains(value, CARD_MARKERS[0])) return true;
  return contains(value, CARD_MARKERS[1]) && (contains(value, CARD_MARKERS[2]) || contains(value, CARD_MARKERS[3]));
}

function readVarint(bytes, offset) {
  let value = 0;
  let shift = 0;

  while (offset < bytes.length && shift <= 28) {
    const b = bytes[offset++];
    value |= (b & 127) << shift;
    if (b < 128) return { value: value >>> 0, next: offset };
    shift += 7;
  }

  return null;
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
