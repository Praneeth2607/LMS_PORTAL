import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import { withTransaction } from '../db/pool.js';
import * as userRepository from '../repositories/user.repository.js';
import { conflict, forbidden, unauthorized } from '../utils/httpError.js';

// Pre-computed hash so failed logins for unknown emails take as long as real ones.
const DUMMY_HASH = '$2b$10$N4PnxXshRSw.ob2xu7ieaut1XkAGy5M469b8e7J2PDyyIu.3.TQIW';

export const SUSPENDED_MESSAGE = 'Your account has been suspended. Please contact the CICT admin.';
const BLOCKED_SIGNUP_MESSAGE = "This email can't be used to create an account. Please contact the CICT admin.";

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

  const passwordHash = await hashPassword(password);
  return withTransaction(async (db) => {
    await userRepository.unblockEmail(email, db);
    return userRepository.create({ name, email, passwordHash, role }, db);
  });
}

// Institute staff sign up with their institute email (ORGANIZER_EMAIL_DOMAIN,
// default cict.in). Email is already validated and lowercased.
export const isInstituteEmail = (email) => email.endsWith(`@${env.organizerEmailDomain}`);

// Public self sign-up: institute emails become ORGANIZER, everyone else
// PARTICIPANT. Emails of suspended accounts (or of suspended accounts an
// admin deleted) cannot self-register; only an admin can create them.
export async function register({ name, email, password }) {
  const existing = await userRepository.findByEmailWithPassword(email);
  if (existing?.suspendedAt || (await userRepository.isEmailBlocked(email))) {
    throw forbidden(BLOCKED_SIGNUP_MESSAGE);
  }
  if (existing) throw conflict('An account with this email already exists');

  const role = isInstituteEmail(email) ? 'ORGANIZER' : 'PARTICIPANT';
  const passwordHash = await hashPassword(password);
  const user = await userRepository.create({ name, email, passwordHash, role });
  return { token: signToken(user), user };
}

export async function login({ email, password }) {
  const record = await userRepository.findByEmailWithPassword(email);
  const valid = await bcrypt.compare(password, record?.passwordHash || DUMMY_HASH);
  if (!record || !valid) throw unauthorized('Invalid email or password');
  // Only revealed after a correct password, so it can't be used to probe accounts.
  if (record.suspendedAt) throw forbidden(SUSPENDED_MESSAGE);

  const { passwordHash, ...user } = record;
  return { token: signToken(user), user };
}
