import { api } from './api.js';

export const listAnnouncements = (workshopId) => api.get(`/workshops/${workshopId}/announcements`);
export const createAnnouncement = (workshopId, data) => api.post(`/workshops/${workshopId}/announcements`, data);
