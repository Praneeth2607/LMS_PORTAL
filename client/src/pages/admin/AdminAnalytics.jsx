import { useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAsync } from '../../hooks/useAsync.js';
import { getAnalytics } from '../../services/adminService.js';
import { EmptyState, ErrorState, LoadingBlock, SectionHeader, StatTile } from '../../components/ui.jsx';
import { toQuery } from '../../services/api.js';
import { SelectField } from '../../components/Form.jsx';
import { DataTable, DotPlot, Legend, LineChart, Meter } from '../../components/charts.jsx';
import DownloadButton from '../../components/DownloadButton.jsx';
import { formatDate, formatPercent } from '../../utils/format.js';
import { manageWorkshopPath } from '../../utils/roles.js';

const pct = (v) => `${Math.round(v)}%`;
const score = (v) => (v === null || v === undefined ? '–' : v.toFixed(1));

function ChartCard({ title, subtitle, children, id }) {
  return (
    <section className="panel bg-white" aria-labelledby={id}>
      <h3 id={id} className="card-title">
        {title}
      </h3>
      {subtitle && <p className="mt-2 text-[15px] text-slate">{subtitle}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------- 1. session by session
function sessionInsight(sessions) {
  if (sessions.length < 2) return null;
  let drop = { size: 0, at: 0 };
  for (let i = 1; i < sessions.length; i++) {
    const size = sessions[i - 1].rate - sessions[i].rate;
    if (size > drop.size) drop = { size, at: i };
  }
  if (drop.size >= 10) {
    return `Biggest drop: session ${drop.at} → ${drop.at + 1} (−${Math.round(drop.size)} points)`;
  }
  const rates = sessions.map((s) => s.rate);
  return `Attendance held between ${pct(Math.min(...rates))} and ${pct(Math.max(...rates))}`;
}

function SessionAttendance({ workshops }) {
  const [selected, setSelected] = useState(workshops[0]?.workshopId ?? null);
  if (!workshops.length) {
    return (
      <ChartCard id="chart-sessions" title="Attendance session by session">
        <EmptyState title="No completed sessions yet">Attendance appears here once a workshop&rsquo;s first session has ended.</EmptyState>
      </ChartCard>
    );
  }
  const workshop = workshops.find((w) => w.workshopId === selected) || workshops[0];
  const sessions = workshop.sessions;
  const rates = sessions.map((s) => s.rate);
  const lowest = rates.indexOf(Math.min(...rates));
  const average = rates.reduce((a, b) => a + b, 0) / rates.length;
  return (
    <ChartCard
      id="chart-sessions"
      title="Attendance session by session"
      subtitle="Share of registered participants marked present at each completed session. A falling line shows where interest drops."
    >
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <SelectField
          label="Workshop"
          className="sm:w-96"
          value={String(workshop.workshopId)}
          onChange={(e) => setSelected(Number(e.target.value))}
          options={workshops.map((w) => ({ value: String(w.workshopId), label: w.title }))}
        />
        <p className="text-[15px] text-charcoal">
          Average <span className="font-semibold">{pct(average)}</span>
          {sessionInsight(sessions) && <span className="block text-slate">{sessionInsight(sessions)}</span>}
        </p>
      </div>
      <LineChart
        ariaLabel="Attendance by session"
        labels={sessions.map((s) => String(s.number))}
        series={[{ key: 'rate', label: 'present', color: 'var(--chart-1)', values: rates }]}
        yTicks={[0, 25, 50, 75, 100]}
        yFormat={pct}
        tooltipTitle={(i) => (
          <>
            Session {sessions[i].number} · <span>{sessions[i].title}</span>
          </>
        )}
        tooltipExtra={(i) => (
          <>
            {sessions[i].present} of {sessions[i].registered} registered · <span>{formatDate(sessions[i].sessionDate)}</span>
          </>
        )}
        directLabels={() => (lowest > 0 && rates[lowest] < rates[rates.length - 1] ? [lowest, rates.length - 1] : [rates.length - 1])}
      />
      <p className="mt-2 text-center text-[13px] text-slate">Session</p>
      <DataTable
        caption="Attendance by session"
        columns={['Session', 'Title', 'Date', 'Present', 'Attendance']}
        rows={sessions.map((s) => [s.number, s.title, formatDate(s.sessionDate), `${s.present} / ${s.registered}`, pct(s.rate)])}
      />
    </ChartCard>
  );
}

// ---------------------------------------------------------------- 2. activity over time
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const UNIT_TEXT = { day: 'per day', week: 'per week', month: 'per month' };

// Axis label for a bucket: weeks "13 Jul", months "Jan" (or "Jul '25" across years), days "1".."31".
function bucketLabel(isoDate, unit, spansYears) {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (unit === 'day') return String(d);
  if (unit === 'week') return `${d} ${MONTHS[m - 1]}`;
  return spansYears ? `${MONTHS[m - 1]} '${String(y).slice(2)}` : MONTHS[m - 1];
}

function bucketTitle(isoDate, unit) {
  const [y, m] = isoDate.split('-').map(Number);
  if (unit === 'month') return `${MONTH_NAMES[m - 1]} ${y}`;
  if (unit === 'week') return (
    <>
      Week of <span>{formatDate(isoDate)}</span>
    </>
  );
  return formatDate(isoDate);
}

function ActivityChart({ activity, scope, summary }) {
  const spansYears = new Set(activity.map((b) => b.start.slice(0, 4))).size > 1;
  const series = [
    { key: 'registrations', label: 'Registrations', color: 'var(--chart-1)', values: activity.map((b) => b.registrations) },
    { key: 'checkIns', label: 'Check-ins', color: 'var(--chart-2)', values: activity.map((b) => b.checkIns) },
  ];
  return (
    <ChartCard
      id="chart-activity"
      title="Activity over time"
      subtitle={`Registrations and attendance check-ins ${UNIT_TEXT[scope.unit]} · ${scope.label}: ${summary.registrations} registrations, ${summary.checkIns} check-ins.`}
    >
      <div className="mb-4">
        <Legend series={series} />
      </div>
      <LineChart
        ariaLabel={`Registrations and check-ins ${UNIT_TEXT[scope.unit]}`}
        labels={activity.map((b) => bucketLabel(b.start, scope.unit, spansYears))}
        series={series}
        tooltipTitle={(i) => bucketTitle(activity[i].start, scope.unit)}
      />
      <DataTable
        caption="Registrations and check-ins over time"
        columns={[scope.unit === 'month' ? 'Month' : scope.unit === 'week' ? 'Week of' : 'Day', 'Registrations', 'Check-ins']}
        rows={activity.map((b) => [
          scope.unit === 'month' ? `${MONTH_NAMES[Number(b.start.slice(5, 7)) - 1]} ${b.start.slice(0, 4)}` : formatDate(b.start),
          b.registrations,
          b.checkIns,
        ])}
      />
    </ChartCard>
  );
}

// ---------------------------------------------------------------- 3. feedback
function FeedbackSatisfaction({ feedback }) {
  const { workshops, lowestStatements } = feedback;
  return (
    <ChartCard
      id="chart-feedback"
      title="Feedback satisfaction"
      subtitle="Average rating per workshop (1 = Strongly disagree, 5 = Strongly agree) and the share who agreed."
    >
      {workshops.length === 0 ? (
        <EmptyState title="No feedback yet">Ratings appear here once participants give feedback after a session.</EmptyState>
      ) : (
        <>
          <DotPlot
            ariaLabel="Average feedback score per workshop"
            rows={workshops.map((w) => ({
              key: w.workshopId,
              label: w.title,
              sublabel: `${formatPercent(w.agreePercent)} agree · ${w.responses} responses`,
              value: w.average,
            }))}
          />
          <div className="mt-10">
            <h4 className="text-[18px] font-medium">Lowest-rated statements</h4>
            <p className="mt-1 text-[14px] text-slate">Across all workshops, with at least 3 answers. Worth a look first.</p>
            {lowestStatements.length === 0 ? (
              <p className="mt-4 text-slate">Not enough answers yet.</p>
            ) : (
              <ol className="mt-4 divide-y divide-ink/10 border-y rule">
                {lowestStatements.map((q) => (
                  <li key={q.questionId} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{q.text}</p>
                      <p className="text-[14px] text-slate">
                        <Link to={manageWorkshopPath(q.workshopId, 'feedback')} className="link-ink">
                          {q.workshopTitle}
                        </Link>{' '}
                        · {q.answers} answers · {formatPercent(q.agreePercent)} agree
                      </p>
                    </div>
                    <p className="text-[20px] font-medium tabular-nums">
                      {score(q.average)}
                      <span className="text-[14px] text-slate"> / 5</span>
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </>
      )}
    </ChartCard>
  );
}

// ---------------------------------------------------------------- 4. organizers
function OrganizerComparison({ organizers }) {
  return (
    <ChartCard
      id="chart-organizers"
      title="Organizer comparison"
      subtitle="Attendance counts completed sessions of published workshops; feedback is the average rating out of 5."
    >
      {organizers.length === 0 ? (
        <EmptyState title="No organizers yet" icon="users" />
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Organizer</th>
              <th scope="col">Workshops</th>
              <th scope="col">Sessions held</th>
              <th scope="col">Avg. attendance</th>
              <th scope="col">Avg. feedback</th>
              <th scope="col">Certificates</th>
            </tr>
          </thead>
          <tbody>
            {organizers.map((o) => (
              <tr key={o.id}>
                <td data-label="">
                  <span className="font-medium">{o.name}</span>
                </td>
                <td data-label="Workshops">{o.workshops}</td>
                <td data-label="Sessions held">{o.completedSessions}</td>
                <td data-label="Avg. attendance">
                  <div className="min-w-28">
                    <p className="tabular-nums">{o.attendanceRate === null ? '–' : formatPercent(o.attendanceRate)}</p>
                    <div className="mt-1.5">
                      <Meter value={o.attendanceRate} label="Average attendance" />
                    </div>
                  </div>
                </td>
                <td data-label="Avg. feedback">
                  <div className="min-w-28">
                    <p className="tabular-nums">
                      {score(o.feedbackAverage)}
                      {o.feedbackAverage !== null && <span className="text-slate"> / 5</span>}
                    </p>
                    <div className="mt-1.5">
                      <Meter value={o.feedbackAverage} max={5} label="Average feedback" />
                    </div>
                  </div>
                </td>
                <td data-label="Certificates">{o.certificates}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </ChartCard>
  );
}

// ---------------------------------------------------------------- filters
// Kept in the URL (?workshop=&year=&month=) so a filtered view can be shared.
function AnalyticsFilters({ filters, options, onChange }) {
  const set = (patch) => onChange({ ...filters, ...patch });
  return (
    <div role="group" aria-label="Analytics filters" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
      <SelectField
        label="Workshop"
        value={filters.workshop}
        onChange={(e) =>
          // A single workshop usually ran earlier than the last 12 weeks: widen the period.
          set({ workshop: e.target.value, ...(e.target.value && !filters.year ? { year: 'all' } : {}) })
        }
        options={[{ value: '', label: 'All workshops' }, ...options.workshops.map((w) => ({ value: String(w.id), label: w.title }))]}
      />
      <SelectField
        label="Year"
        value={filters.year}
        onChange={(e) => set({ year: e.target.value, month: /^\d{4}$/.test(e.target.value) ? filters.month : '' })}
        options={[
          { value: '', label: 'Last 12 weeks' },
          { value: 'all', label: 'All time' },
          ...options.years.map((y) => ({ value: String(y), label: String(y) })),
        ]}
      />
      <SelectField
        label="Month"
        value={filters.month}
        disabled={!/^\d{4}$/.test(filters.year)}
        onChange={(e) => set({ month: e.target.value })}
        options={[
          { value: '', label: /^\d{4}$/.test(filters.year) ? 'Whole year' : 'Pick a year first' },
          ...MONTH_NAMES.map((name, i) => ({ value: String(i + 1), label: name })),
        ]}
      />
      <button
        type="button"
        className="btn btn-quiet lg:mb-0.5"
        disabled={!filters.workshop && !filters.year && !filters.month}
        onClick={() => onChange({ workshop: '', year: '', month: '' })}
      >
        Reset
      </button>
    </div>
  );
}

function ScopeSummary({ summary }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-5">
      <StatTile label="Registrations" value={summary.registrations} hint="new sign-ups" />
      <StatTile label="Check-ins" value={summary.checkIns} hint={`${summary.sessionsHeld} finished sessions`} />
      <StatTile label="Avg. attendance" value={summary.attendanceRate === null ? '–' : formatPercent(summary.attendanceRate)} hint="present ÷ registered" />
      <StatTile
        label="Avg. feedback"
        value={summary.feedbackAverage === null ? '–' : `${summary.feedbackAverage.toFixed(1)}`}
        hint={`out of 5 · ${summary.feedbackResponses} responses`}
      />
      <StatTile label="Certificates" value={summary.certificates} hint="issued" />
    </div>
  );
}

// ---------------------------------------------------------------- section
export default function AdminAnalytics() {
  const [params, setParams] = useSearchParams();
  const filters = { workshop: params.get('workshop') || '', year: params.get('year') || '', month: params.get('month') || '' };
  const query = { workshopId: filters.workshop, year: filters.year, month: filters.month };
  const key = toQuery(query);
  const { data, error, loading, reload } = useAsync(() => getAnalytics(query), [key]);
  // Keep showing the previous result (dimmed) while a new filter loads.
  const last = useRef(null);
  if (data) last.current = data;
  const shown = data || last.current;

  const onChange = (next) =>
    setParams(
      (p) => {
        const out = new URLSearchParams(p);
        for (const [k, v] of Object.entries(next)) (v ? out.set(k, v) : out.delete(k));
        return out;
      },
      { replace: true, preventScrollReset: true },
    );

  return (
    <section aria-labelledby="analytics-title">
      <SectionHeader
        eyebrow="Analytics"
        title="How the portal is doing"
        action={<DownloadButton path={`/admin/analytics/report${key}`} filename="cict-analytics.pdf" label="Download PDF report" />}
      />
      {!shown && loading && <LoadingBlock rows={4} label="Loading analytics" />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {shown && (
        <div className="space-y-6">
          <div className="panel bg-white">
            <AnalyticsFilters filters={filters} options={shown.options} onChange={onChange} />
            <p className="mt-4 text-[15px] text-slate" aria-live="polite">
              Showing <span className="font-medium text-ink">{shown.scope.label}</span>
              {' · '}
              <span className="font-medium text-ink">{shown.scope.workshopTitle || 'All workshops'}</span>
              {loading && ' · updating…'}
            </p>
          </div>
          <div className={`space-y-6 transition-opacity ${loading ? 'opacity-50' : ''}`} aria-busy={loading}>
            <ScopeSummary summary={shown.summary} />
            <div className="grid gap-6 xl:grid-cols-2">
              <SessionAttendance workshops={shown.sessionAttendance} />
              <ActivityChart activity={shown.activity} scope={shown.scope} summary={shown.summary} />
            </div>
            <FeedbackSatisfaction feedback={shown.feedback} />
            <OrganizerComparison organizers={shown.organizers} />
          </div>
        </div>
      )}
    </section>
  );
}
