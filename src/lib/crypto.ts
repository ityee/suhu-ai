// AES-GCM client-side encryption using Web Crypto API

const ALGO = "AES-GCM";

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase) as unknown as ArrayBuffer,
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as unknown as ArrayBuffer, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: ALGO, length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptMessage(plaintext: string, passphrase: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGO, iv },
    key,
    enc.encode(plaintext)
  );
  // Pack: salt(16) + iv(12) + ciphertext → base64
  const packed = new Uint8Array(salt.length + iv.length + new Uint8Array(ciphertext).length);
  packed.set(salt, 0);
  packed.set(iv, salt.length);
  packed.set(new Uint8Array(ciphertext), salt.length + iv.length);
  return btoa(String.fromCharCode(...packed));
}

export async function decryptMessage(encoded: string, passphrase: string): Promise<string> {
  try {
    const packed = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
    const salt = packed.slice(0, 16);
    const iv = packed.slice(16, 28);
    const ciphertext = packed.slice(28);
    const key = await deriveKey(passphrase, salt);
    const decrypted = await crypto.subtle.decrypt(
      { name: ALGO, iv },
      key,
      ciphertext
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    return "🔒 Unable to decrypt (wrong passphrase)";
  }
}
