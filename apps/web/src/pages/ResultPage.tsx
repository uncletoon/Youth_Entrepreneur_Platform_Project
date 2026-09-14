import { CheckCircle2, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { useAuth } from '../features/auth/AuthContext';
import { entrepreneurApi } from '../features/entrepreneur/entrepreneur-api';
import type { ReadinessResultPayload } from '../features/entrepreneur/entrepreneur-api';

export const ResultPage = ({ sessionId }: { sessionId: string }) => {
  const { accessToken } = useAuth();
  const [data, setData] = useState<ReadinessResultPayload | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (accessToken && sessionId)
      entrepreneurApi
        .result(accessToken, sessionId)
        .then(setData)
        .catch((reason) =>
          setError(reason instanceof Error ? reason.message : 'Could not load result.'),
        );
  }, [accessToken, sessionId]);
  if (error)
    return (
      <AppShell title="Assessment result">
        <div className="workflow-card form-error">{error}</div>
      </AppShell>
    );
  if (!data)
    return (
      <AppShell title="Assessment result">
        <div className="workflow-card">Loading result...</div>
      </AppShell>
    );
  const label = String(data.result.readinessLevel).replaceAll('_', ' ');
  return (
    <AppShell title="Your readiness result">
      <section className="result-grid">
        <article className="score-card">
          <span>Overall readiness score</span>
          <strong>
            {Math.round(data.result.overallScore)}
            <small>/100</small>
          </strong>
          <h2>{label}</h2>
          <p>Risk level: {String(data.result.riskLevel).replaceAll('_', ' ')}</p>
        </article>
        <article className="workflow-card">
          <h2>Domain breakdown</h2>
          {data.result.domainScores.map((domain) => (
            <div className="domain-score" key={domain.code}>
              <span>{domain.name}</span>
              <strong>{domain.score}%</strong>
              <i>
                <b style={{ width: `${domain.score}%` }} />
              </i>
            </div>
          ))}
        </article>
        {data.result.supplementalScores.length ? (
          <article className="workflow-card">
            <h2>Expert field percentages</h2>
            <p>
              These sector-specific percentages are calculated separately and do not change the
              mandatory readiness score.
            </p>
            {data.result.supplementalScores.map((score) => (
              <div className="domain-score" key={`${score.name}-${score.sector}`}>
                <span>
                  {score.name} · {score.sector}
                </span>
                <strong>{score.score}%</strong>
                <i>
                  <b style={{ width: `${score.score}%` }} />
                </i>
                <small>{score.questionCount} Expert questions</small>
              </div>
            ))}
          </article>
        ) : null}
        <article className="workflow-card">
          <h2>
            <CheckCircle2 /> Strengths
          </h2>
          {data.result.strengths.length ? (
            <ul>
              {data.result.strengths.map((item: string) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p>
              Complete another assessment after improving your plan to build recognized strengths.
            </p>
          )}
        </article>
        <article className="workflow-card">
          <h2>
            <TriangleAlert /> Recommended next actions
          </h2>
          {data.recommendations.length ? (
            data.recommendations.map((item) => (
              <div className="recommendation" key={item.id}>
                <strong>{item.title}</strong>
                <p>{item.description}</p>
              </div>
            ))
          ) : (
            <p>Keep validating your assumptions and monitoring business performance.</p>
          )}
        </article>
      </section>
      <p className="result-disclaimer">{data.result.disclaimer}</p>
    </AppShell>
  );
};
