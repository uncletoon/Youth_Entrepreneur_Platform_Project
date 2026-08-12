import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from '../routing/router';
import { AppShell } from '../components/AppShell';
import { useAuth } from '../features/auth/AuthContext';
import { entrepreneurApi } from '../features/entrepreneur/entrepreneur-api';

interface Question {
  id: string;
  prompt: string;
  helpText?: string;
  domain: { name: string };
}
interface AssessmentData {
  session: { id: string };
  questions: Question[];
  responses: { questionId: string; answer: number }[];
}

interface DomainGroup {
  name: string;
  questions: Question[];
}

const RATING_LABELS = ['Not yet', 'A little', 'Partly', 'Mostly', 'Confidently'];

export const AssessmentPage = () => {
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<AssessmentData | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle',
  );
  const [currentDomainIndex, setCurrentDomainIndex] = useState(0);
  const businessId = new URLSearchParams(window.location.search).get('businessId') ?? undefined;

  useEffect(() => {
    if (!accessToken) return;
    entrepreneurApi
      .startAssessment(accessToken, businessId)
      .then((loaded) => {
        const value = loaded as AssessmentData;
        setData(value);
        setAnswers(
          Object.fromEntries(value.responses.map((item) => [item.questionId, Number(item.answer)])),
        );
      })
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : 'Could not start assessment.'),
      );
  }, [accessToken, businessId]);

  useEffect(() => {
    if (!data || !accessToken || Object.keys(answers).length === 0) return;
    setAutosaveStatus('saving');
    const timeout = window.setTimeout(async () => {
      try {
        const responses = Object.entries(answers).map(([questionId, value]) => ({
          questionId,
          value,
        }));
        await entrepreneurApi.saveResponses(accessToken, data.session.id, responses);
        setAutosaveStatus('saved');
      } catch {
        setAutosaveStatus('error');
      }
    }, 900);
    return () => window.clearTimeout(timeout);
  }, [accessToken, answers, data]);

  // Group questions by domain
  const domains: DomainGroup[] = data
    ? data.questions.reduce<DomainGroup[]>((groups, question) => {
        const existing = groups.find((g) => g.name === question.domain.name);
        if (existing) {
          existing.questions.push(question);
        } else {
          groups.push({ name: question.domain.name, questions: [question] });
        }
        return groups;
      }, [])
    : [];

  const currentDomain = domains[currentDomainIndex];
  const totalDomains = domains.length;

  const isDomainComplete = (domain: DomainGroup | undefined) =>
    domain ? domain.questions.every((q) => answers[q.id] !== undefined) : false;

  const allComplete = domains.every((d) => isDomainComplete(d));
  const answeredTotal = Object.keys(answers).length;
  const totalQuestions = data?.questions.length ?? 0;
  const overallProgress =
    totalQuestions > 0 ? Math.round((answeredTotal / totalQuestions) * 100) : 0;

  const handleNext = () => {
    if (!currentDomain || !isDomainComplete(currentDomain)) {
      setError(
        `Please answer all questions in "${currentDomain?.name ?? 'this domain'}" before continuing.`,
      );
      return;
    }
    setError('');
    setCurrentDomainIndex((prev) => Math.min(prev + 1, totalDomains - 1));
  };

  const handlePrev = () => {
    setError('');
    setCurrentDomainIndex((prev) => Math.max(prev - 1, 0));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!data || !allComplete) {
      setError('Please answer all questions across all domains before submitting.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const responses = Object.entries(answers).map(([questionId, value]) => ({
        questionId,
        value,
      }));
      await entrepreneurApi.saveResponses(accessToken as string, data.session.id, responses);
      await entrepreneurApi.submitAssessment(accessToken as string, data.session.id);
      navigate(`/app/results/${data.session.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not submit assessment.');
    } finally {
      setSaving(false);
    }
  };

  const saveProgress = async () => {
    if (!data || Object.keys(answers).length === 0) return;
    try {
      setAutosaveStatus('saving');
      const responses = Object.entries(answers).map(([questionId, value]) => ({
        questionId,
        value,
      }));
      await entrepreneurApi.saveResponses(accessToken as string, data.session.id, responses);
      setAutosaveStatus('saved');
    } catch {
      setAutosaveStatus('error');
    }
  };

  return (
    <AppShell title="Business readiness assessment">
      {!data ? (
        <div className="workflow-card assessment-loading">
          <div className="assessment-loading-spinner" />
          <p>Loading your assessment questions…</p>
        </div>
      ) : (
        <form className="assessment-form" onSubmit={submit}>
          {/* Overall progress bar */}
          <div className="assessment-progress-header">
            <div className="assessment-progress-info">
              <span className="eyebrow">Readiness assessment</span>
              <p>
                {answeredTotal} of {totalQuestions} questions answered
              </p>
            </div>
            <div className="assessment-overall-progress">
              <div className="assessment-progress-track">
                <div
                  className="assessment-progress-fill"
                  style={{ width: `${overallProgress}%` }}
                />
              </div>
              <span>{overallProgress}%</span>
            </div>
          </div>

          {/* Domain navigation */}
          <div className="domain-stepper">
            {domains.map((domain, index) => (
              <button
                key={domain.name}
                type="button"
                className={`domain-step ${index === currentDomainIndex ? 'active' : ''} ${isDomainComplete(domain) ? 'complete' : ''}`}
                onClick={() => {
                  void saveProgress();
                  setCurrentDomainIndex(index);
                  setError('');
                }}
              >
                <span className="domain-step__number">
                  {isDomainComplete(domain) ? 'Done' : index + 1}
                </span>
                <span className="domain-step__name">{domain.name}</span>
                <span className="domain-step__count">
                  {domain.questions.filter((q) => answers[q.id] !== undefined).length}/
                  {domain.questions.length}
                </span>
              </button>
            ))}
          </div>

          {/* Current domain questions */}
          {currentDomain && (
            <div className="workflow-card domain-question-block">
              <div className="domain-question-header">
                <div>
                  <span className="eyebrow">{`Domain ${currentDomainIndex + 1} of ${totalDomains}`}</span>
                  <h2>{currentDomain.name}</h2>
                  <p>
                    Choose the answer that honestly reflects your position today. Your result is
                    explainable and can be improved over time.
                  </p>
                </div>
                <div className="domain-completion-badge">
                  <span>
                    {currentDomain.questions.filter((q) => answers[q.id] !== undefined).length}
                  </span>
                  <small>of {currentDomain.questions.length} answered</small>
                </div>
              </div>

              {currentDomain.questions.map((question, index) => (
                <fieldset key={question.id} className={answers[question.id] ? 'answered' : ''}>
                  <legend>
                    <small>{currentDomain.name}</small>
                    {index + 1}. {question.prompt}
                  </legend>
                  {question.helpText && <p className="question-help-text">{question.helpText}</p>}
                  <div className="rating-options">
                    {RATING_LABELS.map((label, option) => {
                      const value = option + 1;
                      return (
                        <label
                          key={label}
                          className={answers[question.id] === value ? 'selected' : ''}
                        >
                          <input
                            type="radio"
                            name={question.id}
                            value={value}
                            checked={answers[question.id] === value}
                            onChange={() =>
                              setAnswers((current) => ({ ...current, [question.id]: value }))
                            }
                          />
                          <strong>{value}</strong>
                          <span>{label}</span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
            </div>
          )}

          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="assessment-nav-actions">
            <button
              type="button"
              className="assessment-nav-btn"
              onClick={handlePrev}
              disabled={currentDomainIndex === 0}
            >
              ← Previous domain
            </button>
            <div className="assessment-nav-center">
              <span
                className={`autosave-status autosave-status--${autosaveStatus}`}
                aria-live="polite"
              >
                {autosaveStatus === 'saving'
                  ? 'Saving changes...'
                  : autosaveStatus === 'saved'
                    ? 'Progress saved'
                    : autosaveStatus === 'error'
                      ? 'Autosave failed. Use Save progress.'
                      : 'Changes save automatically'}
              </span>
              <button
                type="button"
                className="assessment-save-btn"
                onClick={() => void saveProgress()}
              >
                Save progress
              </button>
            </div>
            {currentDomainIndex < totalDomains - 1 ? (
              <button
                type="button"
                className="assessment-nav-btn assessment-nav-btn--next"
                onClick={handleNext}
              >
                Next domain →
              </button>
            ) : (
              <button
                className="primary-action assessment-submit-btn"
                type="submit"
                disabled={saving || !allComplete}
              >
                {saving ? 'Calculating your result…' : 'Submit and view result'}
              </button>
            )}
          </div>
        </form>
      )}
    </AppShell>
  );
};
