import { api } from './api.js';

// portal: 'PARTICIPANT' | 'ORGANIZER' (the sign-in tab); the server checks the role matches.
export const login = ({ email, password, portal }) => api.post('/auth/login', { email, password, portal });
export const register = ({ name, email, password }) => api.post('/auth/register', { name, email, password });
export const me = () => api.get('/auth/me');
// Public: ask an admin for an organizer account ({ name, email, password, designation, reason }).
export const requestOrganizerAccess = (data) => api.post('/auth/organizer-requests', data);
