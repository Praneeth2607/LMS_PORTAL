import { api, request, toQuery } from './api.js';

export const getStats = () => api.get('/admin/stats');
// params: { role, search }
export const listUsers = (params) => api.get(`/admin/users${toQuery(params)}`);
export const createUser = (data) => api.post('/admin/users', data);
export const suspendUser = (userId) => api.patch(`/admin/users/${userId}/suspend`);
export const reactivateUser = (userId) => api.patch(`/admin/users/${userId}/reactivate`);
// Full envelope: the message says whether the email was blocked.
export const deleteUser = (userId) => request(`/admin/users/${userId}`, { method: 'DELETE' });
