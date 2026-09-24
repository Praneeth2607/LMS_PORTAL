import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAsync } from '../../hooks/useAsync.js';
import { useAction, useDocumentTitle } from '../../hooks/useUtils.js';
import { getFeedbackQuestions, getWorkshopFeedback, saveFeedbackQuestions } from '../../services/feedbackService.js';
import {
  Badge,
  EmptyState,
  ErrorState,
  Eyebrow,
  LoadingBlock,
  Notice,
  SectionHeader,
  Spinner,
  StatTile,
} from '../../components/ui.jsx';
import { SelectField } from '../../components/Form.jsx';
import Icon from '../../components/Icon.jsx';
import { Distribution, ScaleLegend, formatScore } from '../../components/feedback.jsx';
import { formatDate, formatDateTime, formatPercent } from '../../utils/format.js';

const MAX_QUESTIONS = 10;

// ---------------------------------------------------------------- results
function QuestionResult({ index, question, result, scale }) {
  return (
    <li className="grid gap-4 py-6 md:grid-cols-[minmax(0,1fr)_220px] md:items-center md:gap-10">
      <div className="min-w-0">
        <p className="text-[18px] font-medium tracking-[-0.01em]">
          <span className="mr-2 text-slate">{String(index + 1).padStart(2, '0')}</span>
          {question.text}
        </p>
        {!question.isActive && (
          <Badge tone="muted" className="mt-2">
            Retired question
          </Badge>
        )}
        <div className="mt-4">
          <Distribution counts={result.counts} scale={scale} label={`Answers to: ${question.text}`} />
        </div>
      </div>
      <div className="flex items-baseline gap-5 md:justify-end">
        <p>
          <span className="text-[40px] font-medium leading-none tracking-[-0.03em]">{formatScore(result.average)}</span>
          <span className="text-slate"> / 5</span>
        </p>
        <p className="text-[14px] text-slate">
          {result.agreePercent === null ? 'No answers' : `${formatPercent(result.agreePercent)} agree`}
          <br />
          {result.responses} {result.responses === 1 ? 'answer' : 'answers'}
        </p>
      </div>
    </li>
  );
}

function FeedbackResults({ data }) {
  const [selected, setSelected] = useState('all');
  const withResponses = data.sessions.filter((s) => s.responses > 0 || s.status === 'COMPLETED');
  const view = selected === 'all' ? data.overall : data.sessions.find((s) => String(s.id) === selected) || data.overall;
  const comments = selected === 'all' ? data.comments : data.comments.filter((c) => String(c.sessionId) === selected);
  const byId = new Map(view.questions.map((q) => [q.questionId, q]));
  // Retired questions only appear where they have answers.
  const questions = data.questions.filter((q) => q.isActive || byId.get(q.id)?.responses > 0);

  return (
    <div className="space-y-16">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <SelectField
          label="Show results for"
          className="sm:w-96"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          options={[
            { value: 'all', label: 'All sessions' },
            ...withResponses.map((s) => ({ value: String(s.id), label: `${formatDate(s.sessionDate)} · ${s.title}` })),
          ]}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <StatTile label="Average score" value={formatScore(view.average)} hint="out of 5 (5 = Strongly agree)" />
        <StatTile label="Agreement" value={view.agreePercent === null ? '–' : formatPercent(view.agreePercent)} hint="Agree or Strongly agree" />
        <StatTile label="Responses" value={view.responses} hint={`from ${view.attendees} ${view.attendees === 1 ? 'attendee' : 'attendees'}`} />
        <StatTile label="Response rate" value={view.responseRate === null ? '–' : formatPercent(view.responseRate)} />
      </div>

      <section aria-labelledby="questions-result-title">
        <SectionHeader eyebrow="Understanding" title="How participants rated each statement" />
        <ScaleLegend scale={data.scale} />
        {view.responses === 0 ? (
          <p className="mt-8 text-slate">No feedback yet{selected === 'all' ? '' : ' for this session'}.</p>
        ) : (
          <ol className="mt-6 divide-y divide-ink/10 border-y rule">
            {questions.map((q, index) => (
              <QuestionResult
                key={q.id}
                index={index}
                question={q}
                scale={data.scale}
                result={byId.get(q.id) || { counts: {}, responses: 0, average: null, agreePercent: null }}
              />
            ))}
          </ol>
        )}
      </section>

      {selected === 'all' && withResponses.length > 0 && (
        <section aria-labelledby="by-session-title">
          <SectionHeader eyebrow="Sessions" title="Session by session" />
          <ul className="divide-y divide-ink/10 border-y rule">
            {withResponses.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setSelected(String(s.id))}
                  className="flex w-full flex-wrap items-center gap-x-8 gap-y-2 py-5 text-left hover:bg-white/60"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{s.title}</span>
                    <span className="block text-[14px] text-slate">
                      {formatDate(s.sessionDate)} · {s.responses} of {s.attendees} responded
                    </span>
                  </span>
                  <span className="text-[24px] font-medium tracking-[-0.02em]">
                    {formatScore(s.average)}
                    <span className="text-[15px] text-slate"> / 5</span>
                  </span>
                  <Icon name="arrowRight" size={18} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="comments-title">
        <SectionHeader eyebrow="In their words" title={`Written feedback (${comments.length})`} />
        <p className="-mt-4 mb-6 text-[15px] text-slate">Shown without names so participants can be honest.</p>
        {comments.length === 0 ? (
          <p className="text-slate">No written feedback yet.</p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {comments.map((c) => (
              <li key={c.id} className="tile">
                <p className="whitespace-pre-line text-[17px] leading-[1.5]">&ldquo;{c.comment}&rdquo;</p>
                <p className="mt-4 text-[14px] text-slate">
                  {c.sessionTitle} · {formatDateTime(c.submittedAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------- questions editor
let draftKey = 0;
const toDraft = (questions) => questions.map((q) => ({ key: `q${q.id}`, id: q.id, text: q.text, hasAnswers: q.hasAnswers }));

function QuestionsEditor({ workshopId, onSaved }) {
  const { data, error, loading, reload } = useAsync(() => getFeedbackQuestions(workshopId), [workshopId]);
  const [draft, setDraft] = useState([]);
  const [saved, setSaved] = useState(false);
  const action = useAction();

  useEffect(() => {
    if (data) setDraft(toDraft(data.questions));
  }, [data]);

  const original = useMemo(() => JSON.stringify((data?.questions || []).map((q) => [q.id, q.text])), [data]);
  const dirty = JSON.stringify(draft.map((q) => [q.id ?? null, q.text.trim()])) !== original;

  const update = (key, patch) => setDraft((list) => list.map((q) => (q.key === key ? { ...q, ...patch } : q)));
  const move = (index, delta) =>
    setDraft((list) => {
      const next = [...list];
      [next[index], next[index + delta]] = [next[index + delta], next[index]];
      return next;
    });

  const onSave = async (e) => {
    e.preventDefault();
    setSaved(false);
    const result = await action.run(() =>
      saveFeedbackQuestions(
        workshopId,
        draft.map((q) => ({ id: q.id ?? null, text: q.text })),
      ),
    );
    if (result.ok) {
      setDraft(toDraft(result.data.questions));
      setSaved(true);
      reload({ silent: true });
      onSaved();
    }
  };

  if (loading) return <LoadingBlock rows={3} label="Loading questions" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  return (
    <form onSubmit={onSave} noValidate className="panel space-y-6">
      <div>
        <h2 className="card-title">Feedback questions</h2>
        <p className="mt-2 text-charcoal">
          Asked after every session of this workshop. Participants answer each statement from <em>Strongly agree</em> to{' '}
          <em>Strongly disagree</em>, and can add written feedback.
        </p>
      </div>
      <ol className="space-y-3">
        {draft.map((q, index) => (
          <li key={q.key} className="flex items-start gap-2">
            <span className="mt-3 w-7 shrink-0 text-slate">{String(index + 1).padStart(2, '0')}</span>
            <div className="min-w-0 flex-1">
              <label className="sr-only" htmlFor={`fq-${q.key}`}>
                Question {index + 1}
              </label>
              <input
                id={`fq-${q.key}`}
                className="input"
                maxLength={300}
                value={q.text}
                placeholder="e.g. I understood how to design a REST API."
                onChange={(e) => update(q.key, { text: e.target.value })}
              />
              {q.hasAnswers && (
                <p className="mt-1.5 text-[13px] text-slate">
                  Has answers: rewording or removing it keeps its past results as a retired question.
                </p>
              )}
            </div>
            <div className="flex shrink-0">
              <button
                type="button"
                className="btn-icon"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label={`Move question ${index + 1} up`}
              >
                <Icon name="chevronUp" size={18} />
              </button>
              <button
                type="button"
                className="btn-icon"
                onClick={() => move(index, 1)}
                disabled={index === draft.length - 1}
                aria-label={`Move question ${index + 1} down`}
              >
                <Icon name="chevronDown" size={18} />
              </button>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setDraft((list) => list.filter((x) => x.key !== q.key))}
                disabled={draft.length === 1}
                aria-label={`Remove question ${index + 1}`}
              >
                <Icon name="trash" size={18} />
              </button>
            </div>
          </li>
        ))}
      </ol>
      <button
        type="button"
        className="btn btn-secondary"
        disabled={draft.length >= MAX_QUESTIONS}
        onClick={() => setDraft((list) => [...list, { key: `new${(draftKey += 1)}`, id: null, text: '' }])}
      >
        <Icon name="plus" size={18} /> Add question
      </button>
      {action.error && (
        <Notice tone="error" title={action.error.message}>
          {action.error.errors?.map((e) => e.message).join(' ')}
        </Notice>
      )}
      {saved && !dirty && <Notice tone="success">Questions saved.</Notice>}
      <div className="flex flex-wrap gap-3 border-t rule pt-6">
        <button type="submit" className="btn btn-primary" disabled={action.pending || !dirty}>
          {action.pending && <Spinner />} Save questions
        </button>
        {dirty && (
          <button type="button" className="btn btn-quiet" onClick={() => setDraft(toDraft(data.questions))}>
            Discard changes
          </button>
        )}
      </div>
    </form>
  );
}

// ---------------------------------------------------------------- page
// /organizer/workshops/:id/feedback (organizer of the workshop, or an admin)
export default function FeedbackPage() {
  const { workshop } = useOutletContext();
  useDocumentTitle(`Feedback · ${workshop.title}`);
  const { data, error, loading, reload } = useAsync(() => getWorkshopFeedback(workshop.id), [workshop.id]);

  return (
    <div className="space-y-20">
      <section aria-labelledby="results-title">
        <Eyebrow>Feedback</Eyebrow>
        <h2 id="results-title" className="section-title mt-4 mb-10">
          How the sessions went
        </h2>
        {loading && <LoadingBlock rows={4} label="Loading feedback" />}
        {error && <ErrorState error={error} onRetry={reload} />}
        {data && data.overall.responses === 0 && data.sessions.every((s) => s.status !== 'COMPLETED') ? (
          <EmptyState title="No feedback yet" icon="megaphone">
            Participants who attend a session can give feedback once it&rsquo;s over. Results appear here.
          </EmptyState>
        ) : (
          data && <FeedbackResults data={data} />
        )}
      </section>
      <QuestionsEditor workshopId={workshop.id} onSaved={() => reload({ silent: true })} />
    </div>
  );
}
