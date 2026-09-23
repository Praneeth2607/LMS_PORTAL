import crypto from 'node:crypto';

// No 0/O/1/I/L so codes are easy to read aloud and type.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');

export const randomCode = (length = 6) =>
  Array.from({ length }, () => CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)]).join('');

// Constant-time string comparison for tokens.
export const safeEqual = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
};
