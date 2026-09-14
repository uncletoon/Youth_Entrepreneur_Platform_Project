import { ArrowLeft, Plus, Save, X } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AdminWorkspaceShell } from '../components/AdminWorkspaceShell';
import { adminApi, type AdminConfiguration, type QuestionRow } from '../features/admin/admin-api';
import { useAuth } from '../features/auth/AuthContext';
import { Link, useNavigate } from '../routing/router';

interface QuestionDraft {
  id?: string;
  prompt: string;
  helpText: string;
}

const emptyQuestionSlots = (): QuestionDraft[] =>
  Array.from({ length: 10 }, () => ({ prompt: '', helpText: '' }));

export const AdminQuestionFormPage = ({ questionId }: { questionId?: string }) => {
  const { accessToken, user } = useAuth();
  const navigate = useNavigate();
  const isSystem = user?.role === 'SYSTEM_ADMIN';
  const isExpertSetCreator = !isSystem && !questionId;
  const [configuration, setConfiguration] = useState<AdminConfiguration>({
    sectors: [],
    domains: [],
  });
  const [question, setQuestion] = useState<QuestionRow | null>(null);
  const [expertQuestions, setExpertQuestions] = useState<QuestionRow[]>([]);
  const [questionSlots, setQuestionSlots] = useState<QuestionDraft[]>(emptyQuestionSlots);
  const [selectedSectorIds, setSelectedSectorIds] = useState<string[]>([]);
  const [selectedDomainId, setSelectedDomainId] = useState('');
  const [showDomainCreator, setShowDomainCreator] = useState(false);
  const [domainName, setDomainName] = useState('');
  const [domainDescription, setDomainDescription] = useState('');
  const [creatingDomain, setCreatingDomain] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const isMandatoryQuestion = question ? question.source === 'SYSTEM_MANDATORY' : isSystem;
  const availableDomains = useMemo(
    () =>
      configuration.domains.filter((domain) =>
        isMandatoryQuestion
          ? domain.source === 'SYSTEM_MANDATORY'
          : domain.source === 'EXPERT_SUPPLEMENTAL',
      ),
    [configuration.domains, isMandatoryQuestion],
  );
  const selectedDomain = availableDomains.find((domain) => domain.id === selectedDomainId);
  const completedSlotCount = questionSlots.filter((slot) => slot.prompt.trim()).length;

  useEffect(() => {
    if (!accessToken) return;
    Promise.all([
      adminApi.configuration(accessToken),
      questionId ? adminApi.question(accessToken, questionId) : Promise.resolve(null),
      isExpertSetCreator ? adminApi.questions(accessToken) : Promise.resolve([]),
    ])
      .then(([config, loaded, questions]) => {
        setConfiguration(config);
        setQuestion(loaded);
        setExpertQuestions(
          questions.filter((item) => item.source === 'EXPERT_SUPPLEMENTAL' && item.active),
        );
        const expectedSource =
          loaded?.source ?? (isSystem ? 'SYSTEM_MANDATORY' : 'EXPERT_SUPPLEMENTAL');
        setSelectedDomainId(
          loaded?.domain.id ??
            config.domains.find((domain) => domain.source === expectedSource)?.id ??
            '',
        );
      })
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : 'Could not load question editor.'),
      );
  }, [accessToken, isExpertSetCreator, isSystem, questionId]);

  useEffect(() => {
    if (!isExpertSetCreator) return;
    const domainQuestions = expertQuestions
      .filter((item) => item.domain.id === selectedDomainId)
      .sort((left, right) => left.displayOrder - right.displayOrder)
      .slice(0, 10);
    const slots = emptyQuestionSlots();
    domainQuestions.forEach((item, index) => {
      slots[index] = {
        id: item.id,
        prompt: item.prompt,
        helpText: item.helpText ?? '',
      };
    });
    setQuestionSlots(slots);
    setSelectedSectorIds([
      ...new Set(domainQuestions.flatMap((item) => item.sectors.map(({ sector }) => sector.id))),
    ]);
  }, [expertQuestions, isExpertSetCreator, selectedDomainId]);

  const createDomain = async () => {
    if (!accessToken || domainName.trim().length < 2 || domainDescription.trim().length < 5) {
      setError('Enter a domain name and a short description before creating the domain.');
      return;
    }
    setCreatingDomain(true);
    setError('');
    try {
      const domain = await adminApi.createDomain(accessToken, {
        name: domainName.trim(),
        description: domainDescription.trim(),
      });
      const config = await adminApi.configuration(accessToken);
      setConfiguration(config);
      setSelectedDomainId(domain.id);
      setDomainName('');
      setDomainDescription('');
      setShowDomainCreator(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not create the Expert domain.');
    } finally {
      setCreatingDomain(false);
    }
  };

  const updateQuestionSlot = (index: number, field: 'prompt' | 'helpText', value: string) => {
    setQuestionSlots((current) =>
      current.map((slot, slotIndex) => (slotIndex === index ? { ...slot, [field]: value } : slot)),
    );
  };

  const toggleSector = (sectorId: string) => {
    setSelectedSectorIds((current) =>
      current.includes(sectorId)
        ? current.filter((currentId) => currentId !== sectorId)
        : [...current, sectorId],
    );
  };

  const saveExpertSet = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const completedQuestions = questionSlots
      .filter((slot) => slot.prompt.trim())
      .map((slot) => ({
        ...(slot.id ? { id: slot.id } : {}),
        prompt: slot.prompt.trim(),
        ...(slot.helpText.trim() ? { helpText: slot.helpText.trim() } : {}),
      }));
    if (!selectedDomainId) {
      setError('Choose or create an Expert domain.');
      return;
    }
    if (!selectedSectorIds.length) {
      setError('Choose at least one innovation field or business sector.');
      return;
    }
    if (completedQuestions.length < 5) {
      setError('Complete at least 5 question slots before saving this Expert question set.');
      return;
    }
    if (completedQuestions.some((item) => item.prompt.length < 10)) {
      setError('Every completed question must contain at least 10 characters.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await adminApi.saveQuestionSet(accessToken as string, selectedDomainId, {
        sectorIds: selectedSectorIds,
        questions: completedQuestions,
      });
      navigate('/admin/questions', { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save the question set.');
    } finally {
      setSaving(false);
    }
  };

  const submitSingleQuestion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    const values = new FormData(event.currentTarget);
    const sectorIds = values.getAll('sectorIds').map(String);
    const input = isMandatoryQuestion
      ? {
          code: String(values.get('code')).trim().toUpperCase().replace(/\s+/g, '_'),
          prompt: String(values.get('prompt')),
          helpText: String(values.get('helpText')) || undefined,
          type: 'LIKERT',
          scope: 'CORE',
          domainId: selectedDomainId,
          sectorId: null,
          stage: null,
          required: true,
          weight: 1,
          displayOrder: Number(values.get('displayOrder')),
          active: values.get('active') === 'on',
        }
      : {
          prompt: String(values.get('prompt')),
          helpText: String(values.get('helpText')) || undefined,
          type: 'LIKERT',
          scope: 'SECTOR',
          domainId: selectedDomainId,
          sectorIds,
          stage: null,
          required: true,
          active: question?.active ?? true,
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

  const domainControl = (
    <>
      <label className={!isMandatoryQuestion ? 'wide' : undefined}>
        Readiness domain <span className="field-required">Required</span>
        <div className="domain-select-row">
          <select
            name="domainId"
            value={selectedDomainId}
            onChange={(event) => setSelectedDomainId(event.target.value)}
            required
          >
            <option value="">Choose a domain</option>
            {availableDomains.map((domain) => (
              <option key={domain.id} value={domain.id}>
                {domain.name} ({domain._count.questions}/10 questions,{' '}
                {domain.active ? 'Active' : 'Draft'})
              </option>
            ))}
          </select>
          {!isMandatoryQuestion && !isSystem ? (
            <button
              className="secondary-action compact-action"
              type="button"
              onClick={() => setShowDomainCreator((current) => !current)}
            >
              {showDomainCreator ? <X /> : <Plus />}
              {showDomainCreator ? 'Cancel' : 'Add domain'}
            </button>
          ) : null}
        </div>
        {!isMandatoryQuestion && selectedDomain ? (
          <small className="field-hint">
            {selectedDomain.active
              ? 'This domain is active. Saving this page updates its complete question set.'
              : 'This domain becomes active when at least 5 question slots are completed and saved.'}
          </small>
        ) : null}
      </label>
      {!isMandatoryQuestion && showDomainCreator ? (
        <div className="wide inline-domain-creator">
          <div>
            <label>
              New domain name <span className="field-required">Required</span>
              <input
                value={domainName}
                onChange={(event) => setDomainName(event.target.value)}
                maxLength={150}
              />
            </label>
            <label>
              Domain description <span className="field-required">Required</span>
              <textarea
                value={domainDescription}
                onChange={(event) => setDomainDescription(event.target.value)}
                maxLength={1000}
              />
            </label>
          </div>
          <button
            className="secondary-action"
            type="button"
            disabled={creatingDomain}
            onClick={() => void createDomain()}
          >
            <Plus /> {creatingDomain ? 'Creating...' : 'Create domain'}
          </button>
        </div>
      ) : null}
    </>
  );

  const responseScale = (
    <div className="question-scale-preview" aria-label="Response scale">
      <span>Response scale</span>
      {['1 Not yet', '2 A little', '3 Partly', '4 Mostly', '5 Confidently'].map((label) => (
        <strong key={label}>{label}</strong>
      ))}
    </div>
  );

  return (
    <AdminWorkspaceShell>
      <Link className="back-link" to="/admin/questions">
        <ArrowLeft /> Back to question bank
      </Link>
      <div className="admin-title">
        <div>
          <span className="eyebrow">Assessment content</span>
          <h1>
            {isExpertSetCreator
              ? 'Create Expert question set'
              : `${questionId ? 'Edit' : 'Add'} ${isMandatoryQuestion ? 'mandatory question' : 'Expert supplemental question'}`}
          </h1>
          <p>
            {isExpertSetCreator
              ? 'Complete 5 to 10 questions together. The selected domain and sectors apply to the whole set.'
              : isMandatoryQuestion
                ? 'Mandatory questions belong to the official five-class readiness framework and are included in the core score.'
                : 'The system manages the internal code, order, and equal percentage automatically.'}
          </p>
        </div>
      </div>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      {isExpertSetCreator ? (
        <form className="admin-panel question-editor" onSubmit={saveExpertSet}>
          <div className="question-policy-notice question-set-progress">
            <div>
              <strong>Complete at least 5 of the 10 question slots.</strong>
              <p>
                All saved questions use the same sectors and contribute equally to the separate
                Expert percentage.
              </p>
            </div>
            <span>{completedSlotCount}/10 completed</span>
          </div>
          <div className="form-grid">
            {domainControl}
            <label>
              Question category
              <input value="Expert supplemental question" disabled readOnly />
            </label>
            <fieldset className="sector-multi-select wide">
              <legend>
                Shared innovation fields / business sectors{' '}
                <span className="field-required">Required</span>
              </legend>
              <p>These selections apply automatically to every question in this set.</p>
              <div className="sector-choice-grid">
                {configuration.sectors
                  .filter((sector) => sector.active)
                  .map((sector) => (
                    <label key={sector.id}>
                      <input
                        type="checkbox"
                        checked={selectedSectorIds.includes(sector.id)}
                        onChange={() => toggleSector(sector.id)}
                      />
                      <span>{sector.name}</span>
                    </label>
                  ))}
              </div>
            </fieldset>
          </div>

          <section className="expert-question-slots" aria-label="Expert question slots">
            <div className="question-slot-heading">
              <div>
                <span className="eyebrow">Question set</span>
                <h2>10 available question slots</h2>
              </div>
              <p>Questions are displayed and scored in the order shown below.</p>
            </div>
            {questionSlots.map((slot, index) => (
              <article
                className={`expert-question-slot ${slot.prompt.trim() ? 'completed' : ''}`}
                key={index}
              >
                <div className="question-slot-number">
                  <span>{index + 1}</span>
                  <small>
                    {slot.prompt.trim()
                      ? 'Completed'
                      : index < 5
                        ? 'Required for minimum'
                        : 'Optional'}
                  </small>
                </div>
                <div className="question-slot-fields">
                  <label>
                    Question statement
                    <textarea
                      aria-label={`Question ${index + 1} statement`}
                      value={slot.prompt}
                      minLength={10}
                      maxLength={1000}
                      placeholder={`Enter Expert supplemental question ${index + 1}`}
                      onChange={(event) => updateQuestionSlot(index, 'prompt', event.target.value)}
                    />
                  </label>
                  <label>
                    Helpful explanation <span className="field-optional">Optional</span>
                    <textarea
                      aria-label={`Question ${index + 1} helpful explanation`}
                      value={slot.helpText}
                      maxLength={1000}
                      placeholder="Add context only when it helps the entrepreneur answer accurately."
                      onChange={(event) =>
                        updateQuestionSlot(index, 'helpText', event.target.value)
                      }
                    />
                  </label>
                </div>
              </article>
            ))}
          </section>
          {responseScale}
          <div className="question-set-save-bar">
            <p>
              {completedSlotCount < 5
                ? `${5 - completedSlotCount} more question${5 - completedSlotCount === 1 ? '' : 's'} required before saving.`
                : `Ready to save ${completedSlotCount} equally weighted questions.`}
            </p>
            <button
              className="primary-action"
              disabled={
                saving || completedSlotCount < 5 || !selectedDomainId || !selectedSectorIds.length
              }
            >
              <Save />{' '}
              {saving ? 'Saving question set...' : `Save question set (${completedSlotCount}/10)`}
            </button>
          </div>
        </form>
      ) : (
        <form
          key={question?.id ?? 'new'}
          className="admin-panel question-editor"
          onSubmit={submitSingleQuestion}
        >
          <div className="form-grid">
            {isMandatoryQuestion ? (
              <label>
                Question code
                <input
                  name="code"
                  defaultValue={question?.code}
                  placeholder="MANDATORY_MARKET_11"
                  required
                />
              </label>
            ) : null}
            {domainControl}
            <label>
              Question category
              <input
                value={
                  isMandatoryQuestion ? 'Mandatory core question' : 'Expert supplemental question'
                }
                disabled
                readOnly
              />
            </label>
            {!isMandatoryQuestion ? (
              <fieldset className="sector-multi-select wide">
                <legend>
                  Innovation fields / business sectors{' '}
                  <span className="field-required">Required</span>
                </legend>
                <p>Select every sector where this question applies.</p>
                <div className="sector-choice-grid">
                  {configuration.sectors
                    .filter((sector) => sector.active)
                    .map((sector) => (
                      <label key={sector.id}>
                        <input
                          name="sectorIds"
                          type="checkbox"
                          value={sector.id}
                          defaultChecked={question?.sectors.some(
                            (item) => item.sector.id === sector.id,
                          )}
                        />
                        <span>{sector.name}</span>
                      </label>
                    ))}
                </div>
              </fieldset>
            ) : null}
            <label className="wide">
              Question statement <span className="field-required">Required</span>
              <textarea name="prompt" minLength={10} defaultValue={question?.prompt} required />
            </label>
            <label className="wide">
              Helpful explanation <span className="field-optional">Optional</span>
              <textarea
                name="helpText"
                defaultValue={question?.helpText ?? ''}
                placeholder="Add context only when it will help the entrepreneur answer accurately."
              />
            </label>
            {isMandatoryQuestion ? (
              <>
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
                <label className="inline-check">
                  <input name="active" type="checkbox" defaultChecked={question?.active ?? true} />
                  Available to entrepreneurs
                </label>
              </>
            ) : null}
          </div>
          {responseScale}
          <button className="primary-action" disabled={saving || !selectedDomainId}>
            <Save /> {saving ? 'Saving...' : 'Save question'}
          </button>
        </form>
      )}
    </AdminWorkspaceShell>
  );
};
