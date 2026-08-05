import type { BusinessProfileInput, BusinessStage } from '@yersps/contracts';
import { ArrowRight, Building2, Plus } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from '../routing/router';
import { AppShell } from '../components/AppShell';
import { useAuth } from '../features/auth/AuthContext';
import { entrepreneurApi, type BusinessSummary } from '../features/entrepreneur/entrepreneur-api';

interface Sector {
  id: string;
  name: string;
}

export const BusinessPage = () => {
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [businesses, setBusinesses] = useState<BusinessSummary[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (accessToken)
      Promise.all([entrepreneurApi.sectors(accessToken), entrepreneurApi.businesses(accessToken)])
        .then(([sectorRows, businessRows]) => {
          setSectors(sectorRows as Sector[]);
          setBusinesses(businessRows);
          setShowForm(businessRows.length === 0);
        })
        .catch((reason) =>
          setError(reason instanceof Error ? reason.message : 'Could not load innovations.'),
        );
  }, [accessToken]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    const form = new FormData(event.currentTarget);
    const input: BusinessProfileInput = {
      name: String(form.get('name')),
      description: String(form.get('description')),
      problemSolved: String(form.get('problemSolved')),
      productOrService: String(form.get('productOrService')),
      targetCustomers: String(form.get('targetCustomers')),
      location: String(form.get('location')),
      stage: String(form.get('stage')) as BusinessStage,
      revenueModel: String(form.get('revenueModel')),
      estimatedStartupCapital: Number(form.get('estimatedStartupCapital')),
      availableCapital: Number(form.get('availableCapital')),
      teamSize: Number(form.get('teamSize')),
      registrationStatus: String(form.get('registrationStatus')),
      salesChannel: String(form.get('salesChannel')),
      mainRisks: String(form.get('mainRisks')),
      selectedSectorId: String(form.get('selectedSectorId')) || undefined,
    };
    try {
      await entrepreneurApi.saveBusiness(accessToken as string, input);
      setBusinesses(await entrepreneurApi.businesses(accessToken as string));
      setShowForm(false);
      setNotice('Your innovation has been added. You can add another or begin its assessment.');
      event.currentTarget.reset();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save business.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell title="Businesses and innovations">
      <section className="workspace-section-heading">
        <div>
          <span className="eyebrow">Innovation portfolio</span>
          <h2>
            {businesses.length} {businesses.length === 1 ? 'innovation' : 'innovations'} recorded
          </h2>
          <p>
            Each idea keeps its own sector classification, assessment, result, and expert feedback
            context.
          </p>
        </div>
        <button
          className="primary-action"
          type="button"
          onClick={() => setShowForm((current) => !current)}
        >
          <Plus /> {showForm ? 'Close form' : 'Add innovation'}
        </button>
      </section>
      {notice ? <p className="form-message workspace-notice">{notice}</p> : null}
      {businesses.length ? (
        <section className="innovation-grid">
          {businesses.map((business) => (
            <article key={business.id} className="innovation-card">
              <span>
                <Building2 />
              </span>
              <small>
                {business.sector?.name ?? 'Sector pending'} · {business.stage.replaceAll('_', ' ')}
              </small>
              <h3>{business.name}</h3>
              <p>{business.description}</p>
              <dl>
                <div>
                  <dt>Location</dt>
                  <dd>{business.location || 'Not specified'}</dd>
                </div>
                <div>
                  <dt>Latest assessment</dt>
                  <dd>
                    {business.assessmentSessions[0]?.result
                      ? `${business.assessmentSessions[0].result.overallScore}/100`
                      : 'Not submitted'}
                  </dd>
                </div>
              </dl>
              <button
                type="button"
                onClick={() => navigate(`/app/assessment?businessId=${business.id}`)}
              >
                Assess this innovation <ArrowRight />
              </button>
            </article>
          ))}
        </section>
      ) : null}
      {showForm ? (
        <form className="workflow-card workflow-form" onSubmit={submit}>
          <h2>Add a business or innovation</h2>
          <p>YERSPS uses this information to suggest a sector and tailor its assessment.</p>
          <div className="form-grid">
            <label>
              Business name
              <input name="name" required minLength={2} />
            </label>
            <label>
              Current stage
              <select name="stage">
                <option value="IDEA">Idea</option>
                <option value="PREPARATION">Preparation</option>
                <option value="STARTUP">Startup</option>
                <option value="OPERATING">Operating</option>
                <option value="GROWTH">Growth</option>
              </select>
            </label>
            <label className="wide">
              Business description
              <textarea name="description" required minLength={20} />
            </label>
            <label className="wide">
              Problem being solved
              <textarea name="problemSolved" required />
            </label>
            <label className="wide">
              Product or service
              <textarea name="productOrService" required />
            </label>
            <label>
              Target customers
              <input name="targetCustomers" required />
            </label>
            <label>
              Location
              <input name="location" required />
            </label>
            <label>
              Broad sector
              <select name="selectedSectorId">
                <option value="">Let YERSPS suggest</option>
                {sectors.map((sector) => (
                  <option key={sector.id} value={sector.id}>
                    {sector.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Revenue model
              <input name="revenueModel" required />
            </label>
            <label>
              Estimated capital (RWF)
              <input
                name="estimatedStartupCapital"
                type="number"
                min="0"
                defaultValue="0"
                required
              />
            </label>
            <label>
              Available capital (RWF)
              <input name="availableCapital" type="number" min="0" defaultValue="0" required />
            </label>
            <label>
              Team size
              <input name="teamSize" type="number" min="1" defaultValue="1" required />
            </label>
            <label>
              Registration status
              <select name="registrationStatus">
                <option>Not registered</option>
                <option>In progress</option>
                <option>Registered</option>
              </select>
            </label>
            <label>
              Primary sales channel
              <input name="salesChannel" required />
            </label>
            <label>
              Main risks
              <input name="mainRisks" required />
            </label>
          </div>
          {error ? <p className="form-error">{error}</p> : null}
          <button className="primary-action" disabled={saving}>
            {saving ? 'Saving...' : 'Save innovation'}
          </button>
        </form>
      ) : null}
    </AppShell>
  );
};
