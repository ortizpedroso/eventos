import { createHmac } from "node:crypto";

const STEP_SECONDS = 30;
const DIGITS = 6;
const WINDOW = 1; // tolera +/- 1 passo (30s) de deriva de relógio

function base32Decode(input: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = input.trim().toUpperCase().replace(/=+$/, "").replace(/\s+/g, "");
  let bits = "";
  for (const char of clean) {
    const idx = alphabet.indexOf(char);
    if (idx === -1) continue;
    bits += idx.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function hotp(secretB32: string, counter: number): string {
  const key = base32Decode(secretB32);
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(counter));
  const digest = createHmac("sha1", key).update(buf).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(code % 10 ** DIGITS).padStart(DIGITS, "0");
}

/** Verifica um código TOTP de 6 dígitos, tolerando deriva de +/- 1 passo (30s). */
export function verificarCodigoTotp(secretB32: string, codigo: string, when: number = Date.now()): boolean {
  const clean = (codigo || "").trim().replace(/\s+/g, "");
  if (!/^\d{6}$/.test(clean)) return false;
  const baseCounter = Math.floor(when / 1000 / STEP_SECONDS);
  for (let delta = -WINDOW; delta <= WINDOW; delta++) {
    if (hotp(secretB32, baseCounter + delta) === clean) return true;
  }
  return false;
}
