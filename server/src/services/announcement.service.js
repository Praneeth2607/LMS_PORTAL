import * as announcementRepository from '../repositories/announcement.repository.js';
import { getManageableWorkshop, getVisibleWorkshop } from './workshop.service.js';

export async function listAnnouncements(workshopId, user) {
  await getVisibleWorkshop(workshopId, user);
  return announcementRepository.listByWorkshop(workshopId);
}

export async function createAnnouncement(workshopId, data, user) {
  await getManageableWorkshop(workshopId, user);
  return announcementRepository.create(workshopId, user.id, data);
}
