import { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useAsync } from '../../hooks/useAsync.js';
import { useAction, useDocumentTitle } from '../../hooks/useUtils.js';
import { getAttendanceGrid, getAttendanceSummary, setManualAttendance } from '../../services/attendanceService.js';
import { generateCertificates, listWorkshopCertificates } from '../../services/certificateService.js';
import {
  EmptyState,
  ErrorState,
  LoadingBlock,
  Notice,
  SectionHeader,
  Spinner,
  StatTile,
  StatusBadge,
} from '../../components/ui.jsx';
import { SelectField } from '../../components/Form.jsx';
import { formatDate, formatDateTime, formatPercent, formatTime } from '../../utils/format.js';

async function loadAttendance(workshopId) {
  const [grid, summary, certificates] = await Promise.all([
    getAttendanceGrid(workshopId),
    getAttendanceSummary(workshopId),
    listWorkshopCertificates(workshopId),
  ]);
  return { grid, summary, certificates };
}

// ---------------------------------------------------------------- Per-session view with manual override
function SessionView({ grid, onChanged }) {
  const [sessionId, setSessionId] = useState(() => String(grid.sessions.find((s) => s.attendanceOpen)?.id || grid.sessions[0].id));
  const [busy, setBusy] = useState(null);
  const action = useAction();
  const session = grid.sessions.find((s) => String(s.id) === sessionId);

  const rows = grid.participants.map((p) => ({ ...p, record: p.sessions[sessionId] }));
  const presentCount = rows.filter((r) => r.record?.status === 'PRESENT').length;
  const absentCount = rows.filter((r) => r.record?.status === 'ABSENT').length;

  const setStatus = async (participantId, status) => {
    setBusy(`${participantId}-${status}`);
    const result = await action.run(() => setManualAttendance(session.id, participantId, status));
    setBusy(null);
    if (result.ok) onChanged();
  };

  return (
    <div>
      <SelectField
        label="Session"
        className="max-w-xl"
        value={sessionId}
        onChange={(e) => setSessionId(e.target.value)}
        options={grid.sessions.map((s, i) => ({
          value: String(s.id),
          label: `${i + 1}. ${s.title} · ${formatDate(s.sessionDate)} ${formatTime(s.startTime)}`,
        }))}
      />
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4">
        <StatTile label="Present" value={presentCount} />
        <StatTile label="Absent" value={absentCount} />
        <StatTile label="Not marked" value={rows.length - presentCount - absentCount} />
      </div>
      {action.error && (
        <Notice tone="error" className="mt-6">
          {action.error.message}
        </Notice>
      )}
      <table className="data-table mt-10">
        <thead>
          <tr>
            <th scope="col">Participant</th>
            <th scope="col">Status</th>
            <th scope="col">Marked</th>
            <th scope="col">Manual update</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.participantId}>
              <td data-label="">
                <p className="font-medium">{r.participantName}</p>
                <p className="text-[14px] text-slate">{r.participantEmail}</p>
              </td>
              <td data-label="Status">
                <StatusBadge status={r.record?.status || 'NOT_MARKED'} />
              </td>
              <td data-label="Marked">
                {r.record ? (
                  <span className="text-[15px]">
                    {formatDateTime(r.record.markedAt)}
                    <span className="text-slate"> · {r.record.method.toLowerCase()}</span>
                  </span>
                ) : (
                  <span className="text-slate">–</span>
                )}
              </td>
              <td data-label="Manual">
                <div className="flex gap-2">
                  {['PRESENT', 'ABSENT'].map((status) => (
                    <button
                      key={status}
                      type="button"
                      className={`btn px-4 ${r.record?.status === status ? 'btn-primary' : 'btn-secondary border-ink/20'}`}
                      aria-pressed={r.record?.status === status}
                      disabled={Boolean(busy)}
                      onClick={() => setStatus(r.participantId, status)}
                    >
                      {busy === `${r.participantId}-${status}` && <Spinner />}
                      {status === 'PRESENT' ? 'Present' : 'Absent'}
                      <span className="sr-only"> for {r.participantName}</span>
                    </button>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------- Page
export default function AttendanceOverviewPage() {
  const { workshop } = useOutletContext();
  useDocumentTitle(`Attendance · ${workshop.title}`);
  const { data, error, loading, reload } = useAsync(() => loadAttendance(workshop.id), [workshop.id]);
  const [view, setView] = useState('overall');
  const [generated, setGenerated] = useState(null);
  const generate = useAction();

  const onGenerate = async () => {
    setGenerated(null);
    const result = await generate.run(() => generateCertificates(workshop.id));
    if (result.ok) {
      setGenerated(result.data);
      reload({ silent: true });
    }
  };

  if (loading) return <LoadingBlock rows={4} label="Loading attendance" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const { grid, summary, certificates } = data;
  const issued = new Map(certificates.map((c) => [c.participantId, c]));

  return (
    <div className="space-y-20">
      <section>
        <SectionHeader eyebrow="Attendance" title="Who's been attending" />
        <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
          <StatTile label="Registered" value={summary.participants.length} />
          <StatTile label="Sessions" value={summary.totalSessions} />
          <StatTile label="Eligible" value={summary.eligibleCount} hint={`At least ${summary.threshold}% attendance`} />
          <StatTile label="Certificates issued" value={certificates.length} />
        </div>
      </section>

      {grid.sessions.length === 0 || grid.participants.length === 0 ? (
        <EmptyState title="No attendance records" icon="users">
          {grid.sessions.length === 0
            ? 'Add sessions to start taking attendance.'
            : 'Attendance will appear here once participants register.'}
        </EmptyState>
      ) : (
        <section>
          <div role="group" aria-label="Attendance view" className="mb-8 flex flex-wrap gap-2">
            {[
              ['overall', 'By participant'],
              ['session', 'By session'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={view === key}
                onClick={() => setView(key)}
                className={`btn px-5 ${view === key ? 'btn-primary' : 'btn-secondary border-ink/20'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {view === 'overall' ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Participant</th>
                  <th scope="col">Sessions attended</th>
                  <th scope="col">Attendance</th>
                  <th scope="col">Certificate</th>
                </tr>
              </thead>
              <tbody>
                {summary.participants.map((p) => {
                  const cert = issued.get(p.participantId);
                  return (
                    <tr key={p.participantId}>
                      <td data-label="">
                        <p className="font-medium">{p.participantName}</p>
                        <p className="text-[14px] text-slate">{p.participantEmail}</p>
                      </td>
                      <td data-label="Attended">
                        {p.attendedSessions} of {p.totalSessions}
                      </td>
                      <td data-label="Attendance">
                        <span className="text-[18px] font-medium">{formatPercent(p.percentage)}</span>
                      </td>
                      <td data-label="Certificate">
                        {cert ? (
                          <Link to={`/certificates/${cert.certificateId}`} className="inline-flex items-center gap-2">
                            <StatusBadge status="ISSUED" />
                            <span className="link-ink text-[14px]">{cert.certificateId}</span>
                          </Link>
                        ) : (
                          <StatusBadge status={p.eligible ? 'ELIGIBLE' : 'NOT_ELIGIBLE'} />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <SessionView grid={grid} onChanged={() => reload({ silent: true })} />
          )}
        </section>
      )}

      <section className="panel">
        <h2 className="card-title">Issue certificates</h2>
        <p className="mt-2 max-w-2xl text-charcoal">
          Issues a certificate to every registered participant with at least {summary.threshold}% attendance who
          doesn&rsquo;t have one yet. Safe to run again after more sessions.
        </p>
        <button
          type="button"
          className="btn btn-primary mt-6"
          disabled={generate.pending || workshop.status === 'DRAFT' || summary.totalSessions === 0}
          onClick={onGenerate}
        >
          {generate.pending && <Spinner />} Generate certificates
        </button>
        {generate.error && (
          <Notice tone="error" className="mt-6">
            {generate.error.message}
          </Notice>
        )}
        {generated && (
          <div className="mt-8 space-y-6" aria-live="polite">
            <Notice tone="success" title={generated.message} />
            <div className="grid gap-6 md:grid-cols-3">
              {[
                ['Generated', generated.data.generated],
                ['Already issued', generated.data.alreadyIssued],
                ['Not eligible', generated.data.notEligible],
              ].map(([label, list]) => (
                <div key={label}>
                  <p className="text-[14px] font-bold uppercase tracking-[0.06em] text-slate">
                    {label} · {list.length}
                  </p>
                  <ul className="mt-3 space-y-2">
                    {list.map((p) => (
                      <li key={p.participantId} className="text-[15px]">
                        <span className="font-medium">{p.participantName}</span>
                        <span className="text-slate"> · {formatPercent(p.attendancePercentage)}</span>
                      </li>
                    ))}
                    {list.length === 0 && <li className="text-slate">None</li>}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
