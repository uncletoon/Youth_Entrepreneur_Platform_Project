import { ArrowLeft, Save } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { AdminWorkspaceShell } from '../components/AdminWorkspaceShell';
import { adminApi, type AdminConfiguration, type QuestionRow } from '../features/admin/admin-api';
import { useAuth } from '../features/auth/AuthContext';
import { Link, useNavigate } from '../routing/router';

export const AdminQuestionFormPage = ({ questionId }: { questionId?: string }) => {
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const [configuration, setConfiguration] = useState<AdminConfiguration>({
    sectors: [],
    domains: [],
  });
  const [question, setQuestion] = useState<QuestionRow | null>(null);
  const [scope, setScope] = useState('CORE');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!accessToken) return;
    Promise.all([
      adminApi.configuration(accessToken),
      questionId ? adminApi.question(accessToken, questionId) : Promise.resolve(null),
    ])
      .then(([config, loaded]) => {
        setConfiguration(config);
        setQuestion(loaded);
        if (loaded) setScope(loaded.scope);
      })
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : 'Could not load question editor.'),
      );
  }, [accessToken, questionId]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    const values = new FormData(event.currentTarget);
    const input = {
      code: String(values.get('code')).trim().toUpperCase().replace(/\s+/g, '_'),
      prompt: String(values.get('prompt')),
      helpText: String(values.get('helpText')) || undefined,
      type: 'LIKERT',
      scope,
      domainId: String(values.get('domainId')),
      sectorId: scope === 'SECTOR' ? String(values.get('sectorId')) : null,
      stage: scope === 'STAGE' ? String(values.get('stage')) : null,
      required: values.get('required') === 'on',
      weight: Number(values.get('weight')),
      displayOrder: Number(values.get('displayOrder')),
      active: values.get('active') === 'on',
    };
    try {
      if (questionId) await adminApi.updateQuestion(accessToken as string, questionId, input);
      else await adminApi.createQuestion(accessToken as string, input);
      navigate('/admin/questions', { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save question.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminWorkspaceShell>
      <Link className="back-link" to="/admin/questions">
        <ArrowLeft /> Back to question bank
      </Link>
      <div className="admin-title">
        <div>
          <span className="eyebrow">Assessment content</span>
          <h1>{questionId ? 'Edit question' : 'Add a question'}</h1>
          <p>
            Questions are presented domain by domain. Use a clear statement that entrepreneurs can
            answer consistently on the five-point readiness scale.
          </p>
        </div>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      <form key={question?.id ?? 'new'} className="admin-panel question-editor" onSubmit={submit}>
        <div className="form-grid">
          <label>
            Question code
            <input
              name="code"
              defaultValue={question?.code}
              placeholder="CORE_MARKET_06"
              required
            />
          </label>
          <label>
            Readiness domain
            <select name="domainId" defaultValue={question?.domain.id} required>
              {configuration.domains.map((domain) => (
                <option key={domain.id} value={domain.id}>
                  {domain.name} ({domain._count.questions} active)
                </option>
              ))}
            </select>
          </label>
          <label>
            Scope
            <select value={scope} onChange={(event) => setScope(event.target.value)}>
              <option value="CORE">Core for everyone</option>
              <option value="SECTOR">Sector specific</option>
              <option value="STAGE">Business-stage specific</option>
            </select>
          </label>
          {scope === 'SECTOR' ? (
            <label>
              Business sector
              <select name="sectorId" defaultValue={question?.sector?.id} required>
                {configuration.sectors
                  .filter((sector) => sector.active)
                  .map((sector) => (
                    <option key={sector.id} value={sector.id}>
                      {sector.name}
                    </option>
                  ))}
              </select>
            </label>
          ) : null}
          {scope === 'STAGE' ? (
            <label>
              Business stage
              <select name="stage" defaultValue={question?.stage ?? 'IDEA'}>
                <option value="IDEA">Idea</option>
                <option value="PREPARATION">Preparation</option>
                <option value="STARTUP">Startup</option>
                <option value="OPERATING">Operating</option>
                <option value="GROWTH">Growth</option>
              </select>
            </label>
          ) : null}
          <label className="wide">
            Question statement
            <textarea name="prompt" minLength={10} defaultValue={question?.prompt} required />
          </label>
          <label className="wide">
            Helpful explanation
            <textarea
              name="helpText"
              defaultValue={question?.helpText ?? ''}
              placeholder="Optional context that helps the entrepreneur answer accurately."
            />
          </label>
          <label>
            Display order
            <input
              name="displayOrder"
              type="number"
              min="1"
              defaultValue={question?.displayOrder ?? 1}
              required
            />
          </label>
          <label>
            Scoring weight
            <input
              name="weight"
              type="number"
              min="0.1"
              max="100"
              step="0.1"
              defaultValue={question?.weight ?? 1}
              required
            />
          </label>
          <label className="inline-check">
            <input name="required" type="checkbox" defaultChecked={question?.required ?? true} />{' '}
            Required question
          </label>
          <label className="inline-check">
            <input name="active" type="checkbox" defaultChecked={question?.active ?? true} />{' '}
            Available to entrepreneurs
          </label>
        </div>
        <div className="question-scale-preview">
          <span>Response scale</span>
          {['1 Not yet', '2 A little', '3 Partly', '4 Mostly', '5 Confidently'].map((label) => (
            <strong key={label}>{label}</strong>
          ))}
        </div>
        <button className="primary-action" disabled={saving}>
          <Save /> {saving ? 'Saving...' : 'Save question'}
        </button>
      </form>
    </AdminWorkspaceShell>
  );
};
