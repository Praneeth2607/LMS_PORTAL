import { withTransaction } from '../db/pool.js';
import * as organizerRequestRepository from '../repositories/organizerRequest.repository.js';
import * as userRepository from '../repositories/user.repository.js';
import { BLOCKED_SIGNUP_MESSAGE, hashPassword } from './auth.service.js';
import { conflict, forbidden, notFound } from '../utils/httpError.js';

// POST /api/auth/organizer-requests (public). The applicant's password is
// hashed now; on approval it becomes the organizer account's password.
export async function submitRequest({ name, email, password, designation, reason }) {
  if (await userRepository.findByEmailWithPassword(email)) {
    throw conflict('An account with this email already exists. Sign in instead, or contact the CICT admin.');
  }
  if (await userRepository.isEmailBlocked(email)) throw forbidden(BLOCKED_SIGNUP_MESSAGE);
  if (await organizerRequestRepository.findPendingByEmail(email)) {
    throw conflict('An organizer request for this email is already waiting for admin approval.');
  }

  const passwordHash = await hashPassword(password);
  return organizerRequestRepository.create({ name, email, passwordHash, designation, reason });
}

export const listRequests = (status) => organizerRequestRepository.list(status);

// Creates the ORGANIZER account from the request (with the password the
// applicant chose) and marks the request APPROVED, atomically.
export async function approveRequest(requestId, admin) {
  return withTransaction(async (db) => {
    const request = await organizerRequestRepository.lockById(requestId, db);
    if (!request) throw notFound('Request not found');
    if (request.status !== 'PENDING') throw conflict(`This request was already ${request.status.toLowerCase()}`);
    const existing = await userRepository.findByEmailWithPassword(request.email);
    if (existing) throw conflict('An account with this email already exists');

    // An admin approving is an explicit decision, like creating the account.
    await userRepository.unblockEmail(request.email, db);
    const user = await userRepository.create(
      { name: request.name, email: request.email, passwordHash: request.passwordHash, role: 'ORGANIZER' },
      db,
    );
    const reviewed = await organizerRequestRepository.markReviewed(requestId, 'APPROVED', admin.id, db);
    return { request: reviewed, user };
  });
}

export async function rejectRequest(requestId, admin) {
  return withTransaction(async (db) => {
    const request = await organizerRequestRepository.lockById(requestId, db);
    if (!request) throw notFound('Request not found');
    if (request.status !== 'PENDING') throw conflict(`This request was already ${request.status.toLowerCase()}`);
    return organizerRequestRepository.markReviewed(requestId, 'REJECTED', admin.id, db);
  });
}
