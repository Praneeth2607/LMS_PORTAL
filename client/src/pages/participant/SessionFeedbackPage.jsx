import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAsync } from '../../hooks/useAsync.js';
import { useAction, useDocumentTitle } from '../../hooks/useUtils.js';
import { getSessionFeedback, submitSessionFeedback } from '../../services/feedbackService.js';
import { Page } from '../../layouts/AppLayout.jsx';
import { BackLink, EmptyState, ErrorState, Eyebrow, LoadingBlock, Notice, Spinner } from '../../components/ui.jsx';
import { TextAreaField } from '../../components/Form.jsx';
import { LikertQuestion } from '../../components/feedback.jsx';
import { formatDate, formatDateTime, formatTime } from '../../utils/format.js';

// /participant/sessions/:id/feedback: rate the session (one response, anonymous
// to the organizer) after it has ended.
export default function SessionFeedbackPage() {
  const { id } = useParams();
  const { data, error, loading, reload } = useAsync(() => getSessionFeedback(id), [id]);
  const [ratings, setRatings] = useState({});
  const [comment, setComment] = useState('');
  const [missing, setMissing] = useState([]);
  const [sentAt, setSentAt] = useState(null);
  const action = useAction();
  useDocumentTitle(data ? `Feedback · ${data.session.title}` : 'Session feedback');

  const back = data ? `/participant/workshops/${data.session.workshopId}` : '/participant/workshops';

  const onSubmit = async (e) => {
    e.preventDefault();
    const unanswered = data.questions.filter((q) => !ratings[q.id]).map((q) => q.id);
    setMissing(unanswered);
    if (unanswered.length) {
      document.getElementById(`question-${unanswered[0]}`)?.scrollIntoView({ block: 'center' });
      return;
    }
    const result = await action.run(() =>
      submitSessionFeedback(id, {
        answers: data.questions.map((q) => ({ questionId: q.id, rating: ratings[q.id] })),
        comment: comment.trim() || null,
      }),
    );
    if (result.ok) {
      setSentAt(result.data.submittedAt);
      window.scrollTo({ top: 0 });
    }
  };

  return (
    <Page>
      <BackLink to={back}>Back to workshop</BackLink>
      {loading && <LoadingBlock rows={4} label="Loading feedback form" />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && (
        <div className="mx-auto max-w-3xl">
          <header className="mb-10">
            <Eyebrow>Session feedback</Eyebrow>
            <h1 className="page-title mt-4">{data.session.title}</h1>
            <p className="mt-3 text-[18px] text-charcoal">
              {data.session.workshopTitle} · {formatDate(data.session.sessionDate)} · {formatTime(data.session.startTime)} –{' '}
              {formatTime(data.session.endTime)}
            </p>
          </header>

          {(sentAt || data.submitted) && (
            <EmptyState
              icon="check"
              title={sentAt ? 'Thanks! Your feedback was sent' : 'You already gave feedback for this session'}
              action={
                <Link to={back} className="btn btn-primary">
                  Back to workshop
                </Link>
              }
            >
              Sent {formatDateTime(sentAt || data.submittedAt)}. The organizer only sees combined results, and your
              written feedback without your name.
            </EmptyState>
          )}

          {!sentAt && !data.submitted && !data.eligible && (
            <Notice title="Feedback isn’t available">{data.reason}</Notice>
          )}

          {!sentAt && !data.submitted && data.eligible && (
            <form onSubmit={onSubmit} noValidate className="panel bg-white space-y-8">
              <p className="text-charcoal">
                How far do you agree with each statement? Your answers are anonymous: the organizer only sees averages
                for the whole session.
              </p>
              {data.questions.map((q, index) => (
                <div key={q.id} id={`question-${q.id}`}>
                  <LikertQuestion
                    index={index}
                    question={q}
                    scale={data.scale}
                    value={ratings[q.id]}
                    error={missing.includes(q.id) && !ratings[q.id] ? 'Please choose an answer' : null}
                    onChange={(value) => setRatings((r) => ({ ...r, [q.id]: value }))}
                  />
                </div>
              ))}
              <div className="border-t rule pt-6">
                <TextAreaField
                  label="Anything else you’d like to tell the organizer?"
                  hint="Optional. What worked, what was unclear, what you’d like next time. Shown without your name."
                  rows={5}
                  maxLength={2000}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
              </div>
              {missing.length > 0 && missing.some((qid) => !ratings[qid]) && (
                <Notice tone="error">Please answer every question.</Notice>
              )}
              {action.error && <Notice tone="error">{action.error.message}</Notice>}
              <button type="submit" className="btn btn-primary btn-lg" disabled={action.pending}>
                {action.pending && <Spinner />} Send feedback
              </button>
            </form>
          )}
        </div>
      )}
    </Page>
  );
}
