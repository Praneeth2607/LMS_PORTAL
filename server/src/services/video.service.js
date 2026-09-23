// Video provider for live sessions inside the portal.
//
// - jitsi (default): Jitsi as a Service (JaaS, 8x8.vc). Rooms exist on demand;
//   entry requires a personal JWT signed with our JaaS private key, which this
//   server only issues to registered participants and the workshop's managers.
// - daily: Daily.co private rooms + meeting tokens (needs a Daily plan with a
//   payment method).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import { HttpError } from '../utils/httpError.js';

// Relative key paths are resolved from the server folder (server/).
const SERVER_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const unixSeconds = (date) => Math.floor(new Date(date).getTime() / 1000);

// ---------------------------------------------------------------- JaaS (Jitsi)
let jaasKeyCache = null;
function jaasPrivateKey() {
  if (jaasKeyCache) return jaasKeyCache;
  const file = path.resolve(SERVER_DIR, env.jaas.privateKeyPath);
  try {
    jaasKeyCache = fs.readFileSync(file, 'utf8');
  } catch {
    throw new HttpError(503, 'Live video is not set up on the server yet (the JaaS private key file could not be read).');
  }
  return jaasKeyCache;
}

function assertJaasConfigured() {
  const missing = [
    !env.jaas.appId && 'JAAS_APP_ID',
    !env.jaas.keyId && 'JAAS_KEY_ID',
    !env.jaas.privateKeyPath && 'JAAS_PRIVATE_KEY_PATH',
  ].filter(Boolean);
  if (missing.length) {
    throw new HttpError(503, `Live video is not set up on the server yet (${missing.join(', ')} missing).`);
  }
  jaasPrivateKey();
}

// JaaS room tokens: https://developer.8x8.com/jaas/docs/api-keys-jwt
function jaasToken({ roomName, userId, userName, userEmail, isOwner, expiresAt }) {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      aud: 'jitsi',
      iss: 'chat',
      sub: env.jaas.appId,
      room: roomName,
      nbf: now - 10,
      exp: unixSeconds(expiresAt),
      context: {
        user: { id: String(userId), name: userName, email: userEmail || '', moderator: isOwner ? 'true' : 'false' },
        features: { livestreaming: 'false', recording: 'false', transcription: 'false', 'outbound-call': 'false' },
      },
    },
    jaasPrivateKey(),
    { algorithm: 'RS256', keyid: env.jaas.keyId },
  );
}

// ---------------------------------------------------------------- Daily.co
async function dailyPost(apiPath, body) {
  if (!env.daily.apiKey) {
    throw new HttpError(503, 'Live video is not set up on the server yet (DAILY_API_KEY is missing).');
  }
  let res;
  try {
    res = await fetch(`${env.daily.apiBase}${apiPath}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.daily.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new HttpError(502, 'Could not reach the video service. Please try again.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`Daily API ${apiPath} failed (${res.status}):`, data);
    throw new HttpError(502, 'The video service could not set up the live room. Please try again.');
  }
  return data;
}

// ---------------------------------------------------------------- public API
export const provider = () => env.videoProvider;

// Returns { name, url } for a new room that closes at expiresAt (Daily) or
// simply names one (JaaS creates rooms when the first person joins).
export async function createRoom({ name, expiresAt }) {
  if (provider() === 'jitsi') {
    assertJaasConfigured();
    return { name, url: `https://${env.jaas.domain}/${env.jaas.appId}/${name}` };
  }
  const data = await dailyPost('/rooms', {
    name,
    privacy: 'private',
    properties: { exp: unixSeconds(expiresAt), eject_at_room_exp: true, enable_prejoin_ui: true },
  });
  return { name: data.name, url: data.url };
}

// Personal, expiring join token. Owners (organizer/admin) moderate the call.
export async function createMeetingToken({ roomName, userId, userName, userEmail, isOwner, expiresAt }) {
  if (provider() === 'jitsi') {
    assertJaasConfigured();
    return jaasToken({ roomName, userId, userName, userEmail, isOwner, expiresAt });
  }
  const data = await dailyPost('/meeting-tokens', {
    properties: {
      room_name: roomName,
      user_id: String(userId),
      user_name: userName,
      is_owner: isOwner,
      exp: unixSeconds(expiresAt),
    },
  });
  return data.token;
}

// What the browser needs to embed the call.
export function clientCallInfo(room) {
  if (provider() === 'jitsi') {
    return {
      provider: 'jitsi',
      domain: env.jaas.domain,
      roomName: `${env.jaas.appId}/${room.name}`,
      scriptUrl: `https://${env.jaas.domain}/${env.jaas.appId}/external_api.js`,
    };
  }
  return { provider: 'daily' };
}
