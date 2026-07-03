/*
 * Bilibili Popular/Index
 * Remove the top-level UP recommendation card that contains the follow button.
 */

var body = toBytes(typeof $response.bodyBytes !== "undefined" ? $response.bodyBytes : $response.body);

try {
  var patched = patchGrpcFrames(body);
  if (patched === body) {
    $done({});
  } else {
    $done({ bodyBytes: patched });
  }
} catch (e) {
  console.log("popular-hide-follow failed: " + e);
  $done({});
}

function patchGrpcFrames(bytes) {
  if (bytes.length < 5) return bytes;

  var chunks = [];
  var offset = 0;
  var changed = false;

  while (offset + 5 <= bytes.length) {
    var compressed = bytes[offset];
    var length =
      (bytes[offset + 1] << 24) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 8) |
      bytes[offset + 4];
    offset += 5;

    if (length < 0 || offset + length > bytes.length) return bytes;

    var payload = bytes.slice(offset, offset + length);
    offset += length;

    if (compressed === 1) payload = gunzip(payload);

    var patchedPayload = patchPopularIndex(payload);
    if (patchedPayload !== payload) changed = true;

    chunks.push(makeFrame(patchedPayload));
  }

  if (offset !== bytes.length || !changed) return bytes;
  return concatBytes(chunks);
}

function patchPopularIndex(bytes) {
  var fields = [];
  var offset = 0;
  var changed = false;

  while (offset < bytes.length) {
    var fieldStart = offset;
    var key = readVarint(bytes, offset);
    if (!key) return bytes;
    offset = key.next;

    var fieldNumber = key.value >>> 3;
    var wireType = key.value & 7;
    if (fieldNumber === 0) return bytes;

    if (wireType === 0) {
      var scalar = readVarint(bytes, offset);
      if (!scalar) return bytes;
      offset = scalar.next;
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

    var len = readVarint(bytes, offset);
    if (!len) return bytes;
    offset = len.next;
    if (offset + len.value > bytes.length) return bytes;

    var value = bytes.slice(offset, offset + len.value);
    offset += len.value;

    if (fieldNumber === 1 && isFollowCard(value)) {
      changed = true;
      continue;
    }

    fields.push(bytes.slice(fieldStart, offset));
  }

  if (!changed) return bytes;
  return concatBytes(fields);
}

function isFollowCard(value) {
  return (
    containsText(value, "rcmd_one_item") ||
    containsText(value, "+ 关注") ||
    containsText(value, "up_follow") ||
    containsText(value, "up-follow")
  );
}

function readVarint(bytes, offset) {
  var value = 0;
  var shift = 0;

  while (offset < bytes.length && shift <= 28) {
    var b = bytes[offset++];
    value |= (b & 127) << shift;
    if (b < 128) return { value: value >>> 0, next: offset };
    shift += 7;
  }

  return null;
}

function makeFrame(payload) {
  var out = new Uint8Array(payload.length + 5);
  out[0] = 0;
  out[1] = (payload.length >>> 24) & 255;
  out[2] = (payload.length >>> 16) & 255;
  out[3] = (payload.length >>> 8) & 255;
  out[4] = payload.length & 255;
  out.set(payload, 5);
  return out;
}

function concatBytes(chunks) {
  var total = 0;
  for (var i = 0; i < chunks.length; i++) total += chunks[i].length;

  var out = new Uint8Array(total);
  var offset = 0;
  for (var j = 0; j < chunks.length; j++) {
    out.set(chunks[j], offset);
    offset += chunks[j].length;
  }
  return out;
}

function containsText(bytes, text) {
  return contains(bytes, utf8(text));
}

function contains(bytes, needle) {
  outer: for (var i = 0; i <= bytes.length - needle.length; i++) {
    for (var j = 0; j < needle.length; j++) {
      if (bytes[i + j] !== needle[j]) continue outer;
    }
    return true;
  }
  return false;
}

function utf8(text) {
  if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(text);
  var encoded = unescape(encodeURIComponent(text));
  var out = new Uint8Array(encoded.length);
  for (var i = 0; i < encoded.length; i++) out[i] = encoded.charCodeAt(i);
  return out;
}

function toBytes(body) {
  if (body instanceof Uint8Array) return body;
  if (typeof ArrayBuffer !== "undefined" && body instanceof ArrayBuffer) return new Uint8Array(body);
  if (typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView && ArrayBuffer.isView(body)) {
    return new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
  }
  if (typeof body === "string") {
    var out = new Uint8Array(body.length);
    for (var i = 0; i < body.length; i++) out[i] = body.charCodeAt(i) & 255;
    return out;
  }
  return new Uint8Array(0);
}

function gunzip(bytes) {
  if (typeof $utils !== "undefined" && $utils.ungzip) return toBytes($utils.ungzip(bytes));
  throw new Error("$utils.ungzip is unavailable");
}
