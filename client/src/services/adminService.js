import { api, toQuery } from './api.js';

export const getStats = () => api.get('/admin/stats');
// params: { role, search }
export const listUsers = (params) => api.get(`/admin/users${toQuery(params)}`);
export const createUser = (data) => api.post('/admin/users', data);
export const changeRole = (userId, role) => api.patch(`/admin/users/${userId}/role`, { role });
