function base64ToUint8Array(base64) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const clean = base64.replace(/=+$/, "");
  const bytes = [];
  let buffer = 0;
  let bits = 0;

  for (let i = 0; i < clean.length; i++) {
    const value = alphabet.indexOf(clean[i]);
    if (value < 0) continue;
    buffer = (buffer << 6) | value;
    bits += 6;

    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }

  return new Uint8Array(bytes);
}

const body = base64ToUint8Array(
  "AAAAACkaHeaQnOe0ouinhumikeOAgeeVquWJp+aIlnVw5Li7IgAoAToAQgBKAA==",
);

$done({ body });
