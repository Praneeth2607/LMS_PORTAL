import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import { withTransaction } from '../db/pool.js';
import * as userRepository from '../repositories/user.repository.js';
import * as organizerRequestRepository from '../repositories/organizerRequest.repository.js';
import { conflict, forbidden, unauthorized } from '../utils/httpError.js';

// Pre-computed hash so failed logins for unknown emails take as long as real ones.
const DUMMY_HASH = '$2b$10$N4PnxXshRSw.ob2xu7ieaut1XkAGy5M469b8e7J2PDyyIu.3.TQIW';

export const SUSPENDED_MESSAGE = 'Your account has been suspended. Please contact the CICT admin.';
export const BLOCKED_SIGNUP_MESSAGE = "This email can't be used to create an account. Please contact the CICT admin.";
const PENDING_REQUEST_MESSAGE = 'Your organizer request is waiting for admin approval. You can sign in once it is approved.';
const REJECTED_REQUEST_MESSAGE = 'Your organizer request was not approved. Please contact the CICT admin.';

export const signToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role }, env.jwt.secret, { expiresIn: env.jwt.expiresIn });

export const verifyToken = (token) => jwt.verify(token, env.jwt.secret);

export const hashPassword = (password) => bcrypt.hash(password, env.bcryptSaltRounds);

// Used by admins (POST /api/admin/users). Admins may reuse a blocked email;
// creating the account lifts the block.
export async function createUser({ name, email, password, role }) {
  const existing = await userRepository.findByEmailWithPassword(email);
  if (existing?.suspendedAt) {
    throw conflict('A suspended account already uses this email. Reactivate it instead of creating a new one.');
  }
  if (existing) throw conflict('An account with this email already exists');
  if (await organizerRequestRepository.findPendingByEmail(email)) {
    throw conflict('This email has a pending organizer request. Approve or reject it first.');
  }

  const passwordHash = await hashPassword(password);
  return withTransaction(async (db) => {
    await userRepository.unblockEmail(email, db);
    return userRepository.create({ name, email, passwordHash, role }, db);
  });
}

// Public self sign-up always creates a PARTICIPANT. Organizers are created by
// an admin, either directly or by approving an organizer request.
// Emails of suspended accounts (or of suspended accounts an admin deleted)
// cannot self-register; only an admin can create them.
export async function register({ name, email, password }) {
  const existing = await userRepository.findByEmailWithPassword(email);
  if (existing?.suspendedAt || (await userRepository.isEmailBlocked(email))) {
    throw forbidden(BLOCKED_SIGNUP_MESSAGE);
  }
  if (existing) throw conflict('An account with this email already exists');
  if (await organizerRequestRepository.findPendingByEmail(email)) {
    throw conflict('An organizer request for this email is waiting for admin approval. Please wait for the decision.');
  }

  const passwordHash = await hashPassword(password);
  const user = await userRepository.create({ name, email, passwordHash, role: 'PARTICIPANT' });
  return { token: signToken(user), user };
}

// Accounts each sign-in portal accepts: participants use the Participant
// sign-in; organizers and admins use the Organizer sign-in.
const PORTAL_ROLES = { PARTICIPANT: ['PARTICIPANT'], ORGANIZER: ['ORGANIZER', 'ADMIN'] };

function portalMismatchMessage(role) {
  if (role === 'PARTICIPANT') return 'This is a participant account. Please use the Participant sign-in.';
  return `This is ${role === 'ADMIN' ? 'an admin' : 'an organizer'} account. Please use the Organizer sign-in.`;
}

// portal (optional): which sign-in tab was used. When given, the role must
// match it, and no token is issued otherwise.
export async function login({ email, password, portal }) {
  const record = await userRepository.findByEmailWithPassword(email);
  if (!record) {
    // No account yet: if this person has an organizer request, say where it
    // stands (only when their password matches, so emails can't be probed).
    const request = await organizerRequestRepository.findLatestUnapprovedWithPassword(email);
    if (request && (await bcrypt.compare(password, request.passwordHash))) {
      throw forbidden(request.status === 'PENDING' ? PENDING_REQUEST_MESSAGE : REJECTED_REQUEST_MESSAGE);
    }
    await bcrypt.compare(password, DUMMY_HASH); // same timing as a real check
    throw unauthorized('Invalid email or password');
  }

  const valid = await bcrypt.compare(password, record.passwordHash);
  if (!valid) throw unauthorized('Invalid email or password');
  // Only revealed after a correct password, so it can't be used to probe accounts.
  if (record.suspendedAt) throw forbidden(SUSPENDED_MESSAGE);
  if (portal && !PORTAL_ROLES[portal].includes(record.role)) throw forbidden(portalMismatchMessage(record.role));

  const { passwordHash, ...user } = record;
  return { token: signToken(user), user };
}
