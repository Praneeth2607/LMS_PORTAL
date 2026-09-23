import { Link, useParams } from 'react-router-dom';
import { useAsync } from '../../hooks/useAsync.js';
import { useDocumentTitle } from '../../hooks/useUtils.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { getCertificate } from '../../services/certificateService.js';
import { BackLink, ErrorState, Eyebrow, LoadingBlock, Orbit, StatusBadge } from '../../components/ui.jsx';
import { CertificateActions } from '../../components/workshop.jsx';
import { formatDateRange, formatDateTime, formatPercent } from '../../utils/format.js';
import { homeFor } from '../../utils/roles.js';

// /certificates/:id — visible to the certificate holder, the workshop organizer and admins.
export default function CertificatePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data: cert, error, loading, reload } = useAsync(() => getCertificate(id), [id]);
  useDocumentTitle(cert ? `Certificate ${cert.certificateId}` : 'Certificate');
  const back = user?.role === 'PARTICIPANT' ? '/participant/certificates' : homeFor(user);

  return (
    <div className="mx-auto max-w-5xl px-4 pt-12 md:px-8 md:pt-20">
      <BackLink to={back}>{user?.role === 'PARTICIPANT' ? 'My certificates' : 'Back'}</BackLink>
      {loading && <LoadingBlock rows={4} label="Loading certificate" />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {cert && (
        <>
          <section className="relative overflow-hidden rounded-panel bg-white px-6 py-12 text-center shadow-lift md:px-16 md:py-20">
            <Orbit variant="wide" className="absolute inset-x-0 top-8 h-24 w-full opacity-70" />
            <div className="relative">
              <Eyebrow>Certificate of completion</Eyebrow>
              <p className="mt-10 text-slate">This certifies that</p>
              <h1 className="display mt-4">{cert.participantName}</h1>
              <p className="mt-8 text-slate">has successfully completed</p>
              <p className="mx-auto mt-3 max-w-2xl text-[26px] font-medium leading-tight tracking-[-0.02em]">
                {cert.workshopTitle}
              </p>
              <p className="mt-3 text-charcoal">{formatDateRange(cert.startDate, cert.endDate)}</p>
              <div className="mt-8 flex justify-center">
                <StatusBadge status="ISSUED" />
              </div>
            </div>
          </section>

          <section className="mt-12 grid gap-10 md:grid-cols-[1fr_auto] md:items-start">
            <dl className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
              {[
                ['Certificate ID', cert.certificateId],
                ['Attendance', formatPercent(cert.attendancePercentage)],
                ['Issued', formatDateTime(cert.issuedAt)],
                ['Organizer', cert.organizerName],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-slate">{label}</dt>
                  <dd className="mt-1 text-[18px] font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="mt-12 border-t rule pt-10">
            <h2 className="card-title mb-6">Download or share</h2>
            <CertificateActions certificate={cert} />
            <p className="mt-6 text-slate">
              The PDF includes a QR code linking to the public{' '}
              <Link to={`/verify/${cert.certificateId}`} className="link">
                verification page
              </Link>
              .
            </p>
          </section>
        </>
      )}
    </div>
  );
}
