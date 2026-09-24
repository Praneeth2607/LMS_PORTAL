import { api, request, toQuery } from './api.js';

export const getStats = () => api.get('/admin/stats');
// params: { workshopId, year ('all' | YYYY), month (1–12) }
export const getAnalytics = (params) => api.get(`/admin/analytics${toQuery(params)}`);
// params: { role, search }
export const listUsers = (params) => api.get(`/admin/users${toQuery(params)}`);
export const createUser = (data) => api.post('/admin/users', data);
export const suspendUser = (userId) => api.patch(`/admin/users/${userId}/suspend`);
export const reactivateUser = (userId) => api.patch(`/admin/users/${userId}/reactivate`);
export const listOrganizerRequests = (status) => api.get(`/admin/organizer-requests${toQuery({ status })}`);
// Full envelopes, so the backend's confirmation message can be shown.
export const approveOrganizerRequest = (id) => request(`/admin/organizer-requests/${id}/approve`, { method: 'POST' });
export const rejectOrganizerRequest = (id) => request(`/admin/organizer-requests/${id}/reject`, { method: 'POST' });
// Full envelope: the message says whether the email was blocked.
export const deleteUser = (userId) => request(`/admin/users/${userId}`, { method: 'DELETE' });
