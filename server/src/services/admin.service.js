import * as statsRepository from '../repositories/stats.repository.js';
import * as userRepository from '../repositories/user.repository.js';
import { createUser } from './auth.service.js';
import { camelize } from '../utils/case.js';
import { withTransaction } from '../db/pool.js';
import { badRequest, conflict, notFound } from '../utils/httpError.js';

export async function getStats() {
  const [totals, workshops] = await Promise.all([statsRepository.portalTotals(), statsRepository.workshopBreakdown()]);

  return {
    totals: camelize(totals),
    workshops: workshops.map((w) => {
      const possible = w.registeredCount * w.completedSessionCount;
      return {
        ...w,
        // Average attendance across registered participants and completed sessions.
        averageAttendance: possible > 0 ? Math.round((w.presentCount * 10000) / possible) / 100 : 0,
      };
    }),
  };
}

export const listUsers = (filters) => userRepository.list(filters);

export const createUserAccount = (data) => createUser(data);

async function getOtherUser(userId, currentUser, action) {
  if (userId === currentUser.id) throw badRequest(`You cannot ${action} your own account`);
  const user = await userRepository.findById(userId);
  if (!user) throw notFound('User not found');
  return user;
}

// Suspended users cannot sign in, and their existing sessions stop working.
export async function suspendUser(userId, currentUser) {
  await getOtherUser(userId, currentUser, 'suspend');
  return userRepository.setSuspended(userId, true);
}

export async function reactivateUser(userId, currentUser) {
  await getOtherUser(userId, currentUser, 'reactivate');
  return userRepository.setSuspended(userId, false);
}

// Permanently deletes the account (its registrations, attendance and
// certificates cascade). Deleting a SUSPENDED user blocks their email from
// self sign-up; only an admin can create an account with it again.
export async function deleteUser(userId, currentUser) {
  const user = await getOtherUser(userId, currentUser, 'delete');
  const organized = await userRepository.countOrganizedWorkshops(userId);
  if (organized > 0) {
    throw conflict(
      `${user.name} organizes ${organized} workshop${organized === 1 ? '' : 's'}. ` +
        'Delete those workshops first, or suspend the account instead.',
    );
  }
  await withTransaction(async (db) => {
    if (user.suspendedAt) await userRepository.blockEmail(user.email, currentUser.id, db);
    await userRepository.remove(userId, db);
  });
  return { id: user.id, email: user.email, emailBlocked: Boolean(user.suspendedAt) };
}
