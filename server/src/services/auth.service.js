import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import * as userRepository from '../repositories/user.repository.js';
import { conflict, unauthorized } from '../utils/httpError.js';

// Pre-computed hash so failed logins for unknown emails take as long as real ones.
const DUMMY_HASH = '$2b$10$N4PnxXshRSw.ob2xu7ieaut1XkAGy5M469b8e7J2PDyyIu.3.TQIW';

export const signToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role }, env.jwt.secret, { expiresIn: env.jwt.expiresIn });

export const verifyToken = (token) => jwt.verify(token, env.jwt.secret);

export const hashPassword = (password) => bcrypt.hash(password, env.bcryptSaltRounds);

export async function createUser({ name, email, password, role }) {
  const existing = await userRepository.findByEmailWithPassword(email);
  if (existing) throw conflict('An account with this email already exists');
  const passwordHash = await hashPassword(password);
  return userRepository.create({ name, email, passwordHash, role });
}

// Institute staff sign up with their institute email (ORGANIZER_EMAIL_DOMAIN,
// default cict.in). Email is already validated and lowercased.
export const isInstituteEmail = (email) => email.endsWith(`@${env.organizerEmailDomain}`);

// Public self sign-up: institute emails become ORGANIZER, everyone else
// PARTICIPANT. Admins are only created by an admin (POST /api/admin/users).
export async function register({ name, email, password }) {
  const role = isInstituteEmail(email) ? 'ORGANIZER' : 'PARTICIPANT';
  const user = await createUser({ name, email, password, role });
  return { token: signToken(user), user };
}

export async function login({ email, password }) {
  const record = await userRepository.findByEmailWithPassword(email);
  const valid = await bcrypt.compare(password, record?.passwordHash || DUMMY_HASH);
  if (!record || !valid) throw unauthorized('Invalid email or password');

  const { passwordHash, ...user } = record;
  return { token: signToken(user), user };
}
