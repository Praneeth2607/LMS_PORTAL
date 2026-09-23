import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import AppLayout from './layouts/AppLayout.jsx';
import ManageWorkshopLayout from './layouts/ManageWorkshopLayout.jsx';
import RequireAuth from './components/RequireAuth.jsx';

import LandingPage from './pages/public/LandingPage.jsx';
import WorkshopsPage from './pages/public/WorkshopsPage.jsx';
import WorkshopDetailPage from './pages/public/WorkshopDetailPage.jsx';
import { LoginPage, OrganizerRequestPage, RegisterPage } from './pages/public/AuthPages.jsx';
import VerifyPage from './pages/public/VerifyPage.jsx';
import AttendancePage from './pages/public/AttendancePage.jsx';
import CertificatePage from './pages/public/CertificatePage.jsx';
import NotFoundPage from './pages/public/NotFoundPage.jsx';
import SessionLivePage from './pages/SessionLivePage.jsx';

import {
  MyCertificatesPage,
  MyWorkshopDetailPage,
  MyWorkshopsPage,
  ParticipantDashboard,
  ProfilePage,
} from './pages/participant/ParticipantPages.jsx';

import {
  AnnouncementsPage,
  CreateWorkshopPage,
  EditWorkshopPage,
  OrganizerDashboard,
  OrganizerWorkshopsPage,
  ParticipantsPage,
  WorkshopOverviewPage,
} from './pages/organizer/OrganizerPages.jsx';
import SessionsPage from './pages/organizer/SessionsPage.jsx';
import AttendanceOverviewPage from './pages/organizer/AttendanceOverviewPage.jsx';

import {
  AdminCertificatesPage,
  AdminDashboard,
  AdminOrganizersPage,
  AdminParticipantsPage,
  AdminWorkshopsPage,
} from './pages/admin/AdminPages.jsx';

// Scroll to top on navigation (but not when only the query string changes).
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<AppLayout />}>
          {/* Public */}
          <Route index element={<LandingPage />} />
          <Route path="workshops" element={<WorkshopsPage />} />
          <Route path="workshops/:id" element={<WorkshopDetailPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="request-organizer-access" element={<OrganizerRequestPage />} />
          <Route path="verify" element={<VerifyPage />} />
          <Route path="verify/:certificateId" element={<VerifyPage />} />
          {/* Opened from the session QR code; handles sign-in itself so the token survives. */}
          <Route path="attendance/:sessionId" element={<AttendancePage />} />

          {/* Any signed-in user (backend checks ownership) */}
          <Route element={<RequireAuth />}>
            <Route path="certificates/:id" element={<CertificatePage />} />
            {/* Live room inside the portal (online/hybrid); the server checks who may join. */}
            <Route path="sessions/:id/live" element={<SessionLivePage />} />
          </Route>

          {/* Participant */}
          <Route path="participant" element={<RequireAuth roles={['PARTICIPANT']} />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<ParticipantDashboard />} />
            <Route path="workshops" element={<MyWorkshopsPage />} />
            <Route path="workshops/:id" element={<MyWorkshopDetailPage />} />
            <Route path="certificates" element={<MyCertificatesPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>

          {/* Organizer (admins can manage every workshop too) */}
          <Route path="organizer" element={<RequireAuth roles={['ORGANIZER', 'ADMIN']} />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<OrganizerDashboard />} />
            <Route path="workshops" element={<OrganizerWorkshopsPage />} />
            <Route path="workshops/create" element={<CreateWorkshopPage />} />
            <Route path="workshops/:id" element={<ManageWorkshopLayout />}>
              <Route index element={<WorkshopOverviewPage />} />
              <Route path="edit" element={<EditWorkshopPage />} />
              <Route path="participants" element={<ParticipantsPage />} />
              <Route path="sessions" element={<SessionsPage />} />
              <Route path="attendance" element={<AttendanceOverviewPage />} />
              <Route path="announcements" element={<AnnouncementsPage />} />
            </Route>
          </Route>

          {/* Admin */}
          <Route path="admin" element={<RequireAuth roles={['ADMIN']} />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="workshops" element={<AdminWorkshopsPage />} />
            <Route path="organizers" element={<AdminOrganizersPage />} />
            <Route path="participants" element={<AdminParticipantsPage />} />
            <Route path="certificates" element={<AdminCertificatesPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </>
  );
}
