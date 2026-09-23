import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAsync } from '../../hooks/useAsync.js';
import { useDocumentTitle } from '../../hooks/useUtils.js';
import { verifyCertificate } from '../../services/certificateService.js';
import { ErrorState, Eyebrow, LoadingBlock } from '../../components/ui.jsx';
import Icon from '../../components/Icon.jsx';
import { formatDateRange, formatDateTime, formatPercent } from '../../utils/format.js';

function LookupForm({ initial = '' }) {
  const [id, setId] = useState(initial);
  const navigate = useNavigate();
  return (
    <form
      className="flex flex-col gap-3 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        if (id.trim()) navigate(`/verify/${encodeURIComponent(id.trim())}`);
      }}
    >
      <div className="flex-1">
        <label htmlFor="verify-id" className="label">
          Certificate ID
        </label>
        <input
          id="verify-id"
          className="input"
          placeholder="e.g. CICT26-KB7F2E3U"
          autoCapitalize="characters"
          value={id}
          onChange={(e) => setId(e.target.value)}
        />
      </div>
      <button type="submit" className="btn btn-primary self-end">
        Verify
      </button>
    </form>
  );
}

function Result({ certificateId, token }) {
  const { data, error, loading, reload } = useAsync(() => verifyCertificate(certificateId, token), [certificateId, token]);

  if (loading) return <LoadingBlock rows={3} label="Checking certificate" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  if (!data.valid) {
    return (
      <section className="panel bg-white" aria-live="polite">
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-full border-[1.5px] border-clay text-clay" aria-hidden="true">
            <Icon name="close" size={22} />
          </span>
          <div>
            <Eyebrow>Verification</Eyebrow>
            <h2 className="section-title mt-2">Certificate not found</h2>
          </div>
        </div>
        <p className="mt-6 text-[18px] text-charcoal">{data.reason}</p>
        <p className="mt-2 text-slate">
          Checked ID: <span className="font-medium text-ink">{data.certificateId}</span>
        </p>
      </section>
    );
  }

  const rows = [
    ['Certificate ID', data.certificateId],
    ['Awarded to', data.participantName],
    ['Workshop', data.workshopTitle],
    ['Held', formatDateRange(data.workshopStartDate, data.workshopEndDate)],
    ['Attendance', formatPercent(data.attendancePercentage)],
    ['Issued', formatDateTime(data.issuedAt)],
    ['Organizer', data.organizerName],
  ];

  return (
    <section className="panel bg-white md:p-14" aria-live="polite">
      <div className="flex flex-wrap items-center gap-5">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-ink text-canvas" aria-hidden="true">
          <Icon name="check" size={26} strokeWidth={2} />
        </span>
        <div>
          <Eyebrow>Issued by CICT</Eyebrow>
          <h2 className="section-title mt-2">Certificate verified</h2>
        </div>
      </div>
      <p className="mt-6 text-charcoal">
        {data.tokenVerified
          ? 'This certificate was verified using the QR code printed on it.'
          : 'This certificate ID matches a certificate issued through the CICT Workshop Portal.'}
      </p>
      <dl className="mt-10 divide-y divide-ink/10 border-y rule">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-1 py-4 sm:grid-cols-[200px_1fr] sm:gap-6">
            <dt className="text-slate">{label}</dt>
            <dd className="font-medium">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default function VerifyPage() {
  const { certificateId } = useParams();
  const [params] = useSearchParams();
  const token = params.get('token') || undefined;
  useDocumentTitle('Verify a certificate');

  return (
    <div className="mx-auto max-w-3xl px-4 pt-12 md:px-8 md:pt-24">
      <Eyebrow>Certificate verification</Eyebrow>
      <h1 className="page-title mt-5">Verify a CICT certificate</h1>
      <p className="mt-4 text-[18px] text-charcoal">
        Confirm that a workshop certificate is genuine. Scan its QR code, or enter the certificate ID printed at the
        bottom.
      </p>
      <div className="mt-12 space-y-10">
        {certificateId && <Result certificateId={certificateId} token={token} />}
        <div className={certificateId ? 'border-t rule pt-10' : ''}>
          {certificateId && <h2 className="card-title mb-6">Check another certificate</h2>}
          <LookupForm key={certificateId} initial={certificateId ? '' : ''} />
        </div>
      </div>
    </div>
  );
}
