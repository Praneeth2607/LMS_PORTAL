import * as statsRepository from '../repositories/stats.repository.js';
import * as userRepository from '../repositories/user.repository.js';
import { createUser } from './auth.service.js';
import { camelize } from '../utils/case.js';
import { badRequest, notFound } from '../utils/httpError.js';

export async function getStats() {
  const [totals, workshops] = await Promise.all([statsRepository.portalTotals(), statsRepository.workshopBreakdown()]);

  return {
    totals: camelize(totals),
    workshops: workshops.map((w) => {
      const possible = w.registeredCount * w.sessionCount;
      return {
        ...w,
        // Average attendance across all registered participants and sessions.
        averageAttendance: possible > 0 ? Math.round((w.presentCount * 10000) / possible) / 100 : 0,
      };
    }),
  };
}

export const listUsers = (filters) => userRepository.list(filters);

export const createUserAccount = (data) => createUser(data);

export async function changeRole(userId, role, currentUser) {
  if (userId === currentUser.id) throw badRequest('You cannot change your own role');
  const user = await userRepository.updateRole(userId, role);
  if (!user) throw notFound('User not found');
  return user;
}
