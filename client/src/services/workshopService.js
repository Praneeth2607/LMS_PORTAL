import { api, toQuery } from './api.js';

// params: { search, status, mode, mine }
export const listWorkshops = (params) => api.get(`/workshops${toQuery(params)}`);
export const getWorkshop = (id) => api.get(`/workshops/${id}`);
export const createWorkshop = (data) => api.post('/workshops', data);
export const updateWorkshop = (id, data) => api.put(`/workshops/${id}`, data);
export const deleteWorkshop = (id) => api.delete(`/workshops/${id}`);
export const publishWorkshop = (id) => api.patch(`/workshops/${id}/publish`);
export const closeWorkshop = (id) => api.patch(`/workshops/${id}/close`);
