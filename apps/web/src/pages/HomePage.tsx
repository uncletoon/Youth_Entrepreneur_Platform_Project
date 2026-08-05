import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Compass,
  FileText,
  HeartHandshake,
  Leaf,
  Lightbulb,
  LockKeyhole,
  MapPinned,
  Quote,
  Route,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Link } from '../routing/router';
import { Brand } from '../components/Brand';
import { SiteHeader } from '../components/SiteHeader';

const benefits = [
  {
    icon: ClipboardCheck,
    title: 'Assess with clarity',
    body: 'Answer practical questions about your mindset, market, money, operations, and business stage.',
  },
  {
    icon: Route,
    title: 'Follow the right path',
    body: 'Your business sector and current stage shape the questions you see—so every step stays relevant.',
  },
  {
    icon: TrendingUp,
    title: 'Turn gaps into action',
    body: 'See your readiness score, explainable risk factors, and a prioritized plan you can act on.',
  },
];

const steps = [
  [
    '01',
    'Tell us where you are',
    'Create a simple account, then complete your personal and business profile.',
  ],
  [
    '02',
    'Take your routed assessment',
    'Complete core, sector-specific, and business-stage questions at your pace.',
  ],
  [
    '03',
    'Get your readiness picture',
    'Understand strengths, gaps, risk factors, and the reasoning behind every result.',
  ],
  [
    '04',
    'Grow with a clear plan',
    'Follow recommendations, receive Admin feedback, and reassess to see progress.',
  ],
];

export const HomePage = () => (
  <div className="page">
    <SiteHeader />
    <main>
      <section className="hero">
        <div className="shell hero__grid">
          <div className="hero__copy">
            <span className="eyebrow">
              <Sparkles size={15} /> Built for young entrepreneurs
            </span>
            <h1>
              Know where your business stands. <span>Build what comes next.</span>
            </h1>
            <p>
              YERSPS gives you a practical readiness assessment, an explainable risk picture, and
              personalized next steps—before you invest more time and money.
            </p>
            <div className="hero__actions">
              <Link className="button" to="/register">
                Start your free assessment <ArrowRight size={18} />
              </Link>
              <a className="text-link" href="#how-it-works">
                See how it works <ChevronDown size={17} />
              </a>
            </div>
            <div className="hero__trust" aria-label="Product assurances">
              <span>
                <CheckCircle2 /> Save and continue later
              </span>
              <span>
                <ShieldCheck /> Private by design
              </span>
            </div>
          </div>
          <div className="hero__visual">
            <div className="hero__image-wrap">
              <img
                src="/yersps-readiness-hero.png"
                alt="Young entrepreneur reviewing business readiness insights on a laptop"
              />
            </div>
            <div className="floating-card floating-card--score">
              <span>Readiness snapshot</span>
              <strong>Clear. Practical.</strong>
              <small>Built around your stage</small>
            </div>
          </div>
        </div>
      </section>

      <section className="confidence-strip" aria-label="YERSPS audiences">
        <div className="shell confidence-strip__inner">
          <p>One readiness journey, shared by the people helping your business grow.</p>
          <div>
            <span>
              <Lightbulb /> Entrepreneurs
            </span>
            <span>
              <HeartHandshake /> Mentors &amp; Admins
            </span>
            <span>
              <Users /> Incubators &amp; Universities
            </span>
            <span>
              <LockKeyhole /> System Administrators
            </span>
          </div>
        </div>
      </section>

      <section className="section" id="benefits">
        <div className="shell">
          <header className="section-heading section-heading--center">
            <span className="eyebrow">A better place to begin</span>
            <h2>Readiness is more than a score.</h2>
            <p>YERSPS connects what you know now with what your business needs next.</p>
          </header>
          <div className="benefit-grid">
            {benefits.map(({ icon: Icon, title, body }) => (
              <article className="benefit-card" key={title}>
                <span className="icon-box">
                  <Icon />
                </span>
                <h3>{title}</h3>
                <p>{body}</p>
                <a href="#how-it-works">
                  Learn more <ArrowRight size={16} />
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--tint" id="how-it-works">
        <div className="shell process-grid">
          <div className="process-visual" aria-hidden="true">
            <div className="readiness-card">
              <div className="readiness-card__top">
                <span>My readiness</span>
                <BarChart3 />
              </div>
              <div className="readiness-ring">
                <strong>72</strong>
                <span>Moderately ready</span>
              </div>
              <div className="mini-bars">
                <i style={{ '--value': '82%' } as React.CSSProperties} />
                <i style={{ '--value': '65%' } as React.CSSProperties} />
                <i style={{ '--value': '48%' } as React.CSSProperties} />
              </div>
              <div className="readiness-card__note">
                <Target /> Next focus: financial readiness
              </div>
            </div>
            <span className="orbit orbit--one">
              <Compass />
            </span>
            <span className="orbit orbit--two">
              <Leaf />
            </span>
          </div>
          <div>
            <span className="eyebrow">How it works</span>
            <h2>A guided journey from idea to informed action.</h2>
            <p className="section-lead">
              No dense forms and no unexplained labels. You move through a clear path and can save
              progress whenever life gets busy.
            </p>
            <div className="step-list">
              {steps.map(([number, title, body]) => (
                <article key={number}>
                  <span>{number}</span>
                  <div>
                    <h3>{title}</h3>
                    <p>{body}</p>
                  </div>
                </article>
              ))}
            </div>
            <Link className="button button--outline" to="/register">
              See your starting point <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      <section className="impact" id="who-it-helps">
        <div className="shell impact__grid">
          <div>
            <span className="eyebrow eyebrow--light">Built for progress</span>
            <h2>A clearer conversation between entrepreneurs and support teams.</h2>
            <p>
              Entrepreneurs own their journey. Authorized Admins can review submitted results,
              validate evidence, and add meaningful feedback without changing the story behind the
              score.
            </p>
          </div>
          <div className="stat-grid">
            <article>
              <MapPinned />
              <strong>13</strong>
              <span>business sectors</span>
            </article>
            <article>
              <Compass />
              <strong>5</strong>
              <span>business stages</span>
            </article>
            <article>
              <BarChart3 />
              <strong>10</strong>
              <span>core readiness domains</span>
            </article>
            <article>
              <FileText />
              <strong>1</strong>
              <span>personal action plan</span>
            </article>
          </div>
        </div>
      </section>

      <section className="section testimonial">
        <div className="shell testimonial__card">
          <div className="testimonial__portrait" aria-hidden="true">
            <Quote />
          </div>
          <blockquote>
            <p>
              “A useful assessment should not judge the person. It should make the next decision
              easier, show where support matters, and preserve the reasoning behind the result.”
            </p>
            <footer>
              <strong>The YERSPS design principle</strong>
              <span>Explainable readiness, human support</span>
            </footer>
          </blockquote>
        </div>
      </section>

      <section className="section faq" id="faq">
        <div className="shell faq__grid">
          <div>
            <span className="eyebrow">Frequently asked</span>
            <h2>Honest answers, before you begin.</h2>
            <p>
              YERSPS supports better decisions. It does not promise funding or guarantee success.
            </p>
          </div>
          <div className="faq__list">
            <details open>
              <summary>
                Does YERSPS predict whether my business will succeed?
                <ChevronDown />
              </summary>
              <p>
                No. It provides an explainable estimated preparedness-risk level using your
                readiness, stage, sector, and critical gaps.
              </p>
            </details>
            <details>
              <summary>
                Can I stop and continue later?
                <ChevronDown />
              </summary>
              <p>
                Yes. Your onboarding and assessment progress can be saved before final submission.
              </p>
            </details>
            <details>
              <summary>
                Who can see my results?
                <ChevronDown />
              </summary>
              <p>
                You can see your own results. Only authorized support staff can review them within
                their assigned scope.
              </p>
            </details>
          </div>
        </div>
      </section>

      <section className="cta-band">
        <div className="shell cta-band__inner">
          <span className="eyebrow">Your next step can be clearer</span>
          <h2>Start with readiness. Grow with purpose.</h2>
          <p>Create your account in a few minutes. Complete the rest at your own pace.</p>
          <Link className="button button--light" to="/register">
            Start your assessment <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </main>

    <footer className="footer">
      <div className="shell footer__grid">
        <div>
          <Brand light />
          <p>Practical, explainable readiness support for youth entrepreneurship.</p>
        </div>
        <div>
          <h3>Explore</h3>
          <a href="#how-it-works">How it works</a>
          <a href="#benefits">What you get</a>
          <a href="#faq">FAQ</a>
        </div>
        <div>
          <h3>Account</h3>
          <Link to="/register">Register</Link>
          <Link to="/login">Log in</Link>
          <a href="#privacy">Privacy</a>
        </div>
        <div>
          <h3>Stay informed</h3>
          <p>Product updates and entrepreneurship resources.</p>
          <form>
            <label className="sr-only" htmlFor="footer-email">
              Email address
            </label>
            <div className="footer__input">
              <input id="footer-email" type="email" placeholder="Email address" />
              <button type="submit" aria-label="Subscribe">
                <ArrowRight />
              </button>
            </div>
          </form>
        </div>
      </div>
      <div className="shell footer__bottom">
        <span>© 2026 YERSPS. Academic project.</span>
        <span>Readiness insights are not professional financial or legal advice.</span>
      </div>
    </footer>
  </div>
);
