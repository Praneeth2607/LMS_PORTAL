import { verifyToken } from '../services/auth.service.js';
import * as userRepository from '../repositories/user.repository.js';
import { forbidden, unauthorized } from '../utils/httpError.js';

async function resolveUser(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return null;

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw unauthorized('Invalid or expired token');
  }

  // Load from the DB so deleted users and role changes take effect immediately.
  const user = await userRepository.findById(payload.sub);
  if (!user) throw unauthorized('Account no longer exists');
  return user;
}

// Requires a valid token; sets req.user = { id, name, email, role, ... }.
export async function authenticate(req, res, next) {
  const user = await resolveUser(req);
  if (!user) throw unauthorized();
  req.user = user;
  next();
}

// Sets req.user when a valid token is sent, otherwise continues as a guest.
export async function optionalAuthenticate(req, res, next) {
  req.user = (await resolveUser(req)) || null;
  next();
}

// Usage: authorize('ORGANIZER', 'ADMIN'). Must run after authenticate.
export const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!req.user) throw unauthorized();
    if (!roles.includes(req.user.role)) {
      throw forbidden(`This action requires role: ${roles.join(' or ')}`);
    }
    next();
  };
