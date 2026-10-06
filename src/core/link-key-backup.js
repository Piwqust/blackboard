const FORMAT = "BlackboardTextLinkKeys";
const ITERATIONS = 300_000;
function encode(bytes) {
  let text = "";
  for (const value of bytes) text += String.fromCharCode(value);
  return btoa(text);
}
function decode(text) {
  if (typeof text !== "string" || text.length > 3_000_000)
    throw new Error("Invalid link-key backup.");
  return Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
}
async function key(passphrase, salt) {
  if (typeof passphrase !== "string" || passphrase.length < 8)
    throw new Error("Use a passphrase with at least 8 characters.");
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
export async function exportLinkKeys(records, passphrase) {
  const salt = crypto.getRandomValues(new Uint8Array(16)),
    iv = crypto.getRandomValues(new Uint8Array(12));
  const payload = records.map(
    ({
      id,
      managementKey,
      endpoint,
      url,
      title,
      pageId,
      createdAt,
      state,
      revokedAt,
    }) => ({
      id,
      managementKey,
      endpoint,
      url,
      title,
      pageId,
      createdAt,
      state,
      revokedAt,
    }),
  );
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  if (bytes.length > 2_000_000)
    throw new Error("Too many link records for one backup.");
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await key(passphrase, salt),
    bytes,
  );
  return (
    JSON.stringify(
      {
        format: FORMAT,
        version: 1,
        iterations: ITERATIONS,
        salt: encode(salt),
        iv: encode(iv),
        ciphertext: encode(new Uint8Array(encrypted)),
      },
      null,
      2,
    ) + "\n"
  );
}
export async function importLinkKeys(text, passphrase, endpoint) {
  if (typeof text !== "string" || text.length > 3_000_000)
    throw new Error("This link-key backup is too large.");
  let file;
  try {
    file = JSON.parse(text);
  } catch {
    throw new Error("This is not a link-key backup.");
  }
  if (
    file?.format !== FORMAT ||
    file.version !== 1 ||
    file.iterations !== ITERATIONS
  )
    throw new Error("Unsupported link-key backup.");
  const salt = decode(file.salt),
    iv = decode(file.iv);
  if (salt.length !== 16 || iv.length !== 12)
    throw new Error("Invalid link-key backup.");
  let bytes;
  try {
    bytes = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      await key(passphrase, salt),
      decode(file.ciphertext),
    );
  } catch {
    throw new Error("The passphrase is incorrect or the file is damaged.");
  }
  if (bytes.byteLength > 2_000_000)
    throw new Error("This link-key backup is too large.");
  const records = JSON.parse(new TextDecoder().decode(bytes));
  if (!Array.isArray(records) || records.length > 10_000)
    throw new Error("Invalid link records.");
  const ids = new Set();
  for (const record of records) {
    if (
      !record ||
      !/^[-\w]{22}$/.test(record.id) ||
      !/^[-\w]{43}$/.test(record.managementKey) ||
      record.endpoint !== endpoint ||
      !["active", "revoked", "pending"].includes(record.state)
    )
      throw new Error(
        "This backup contains invalid records or belongs to a different sharing service.",
      );
    if (ids.has(record.id))
      throw new Error("This backup contains duplicate link records.");
    ids.add(record.id);
    const url = new URL(record.url);
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.hash !== "#" + record.id ||
      url.search ||
      !url.pathname.endsWith("/s/")
    )
      throw new Error("Invalid link address in backup.");
  }
  return records;
}
