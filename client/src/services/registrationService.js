import { api, toQuery } from './api.js';

export const registerForWorkshop = (workshopId, formData) => api.post(`/workshops/${workshopId}/register`, { formData });
export const cancelRegistration = (workshopId) => api.delete(`/workshops/${workshopId}/register`);
export const listRegistrations = (workshopId, status) =>
  api.get(`/workshops/${workshopId}/registrations${toQuery({ status })}`);
// Participants: registrations with attendance + certificate. Organizers/admins: workshops they created.
export const myWorkshops = () => api.get('/my-workshops');
