import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Zap, ArrowRight, CheckCircle2, Shield, FileSpreadsheet,
  Copy, History, HelpCircle, FileText, Menu, X, Sparkles,
  ChevronRight, Database, Search, Check, AlertTriangle
} from 'lucide-react';
import InteractivePreview from '../components/landing/InteractivePreview.jsx';
import FeatureCard from '../components/landing/FeatureCard.jsx';
import Accordion from '../components/landing/Accordion.jsx';
import DecryptedText from '../components/landing/DecryptedText.jsx';
import TechText from '../components/common/TechText.jsx';
import AnimatedContent from '../components/common/AnimatedContent.jsx';
import '../styles/landing.css';

export default function LandingPage() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const scrollTo = (id) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const featureList = [
    {
      icon: Sparkles,
      title: 'AI-Powered Extraction',
      description: 'Automatically extracts action items, decisions, risks, and questions directly from raw transcripts.',
      tag: 'Core Engine',
    },
    {
      icon: CheckCircle2,
      title: 'Evidence-Based Review',
      description: 'Every extracted item links directly to verbatim transcript quotes with speaker names and line numbers.',
      tag: 'Trust & Audit',
    },
    {
      icon: AlertTriangle,
      title: 'Missing Owner & Date Alerts',
      description: 'Zero hallucinated owners or imaginary deadlines. Unknown facts are explicitly flagged as "Not stated".',
      tag: 'Integrity',
    },
    {
      icon: Copy,
      title: 'Duplicate Task Detection',
      description: 'Intelligently compares tasks against earlier client meetings to prevent repetitive work and duplicate tracking.',
      tag: 'Deduplication',
    },
    {
      icon: FileSpreadsheet,
      title: 'Multi-Format Export',
      description: 'Download ready-to-share Excel (.xlsx), Word (.docx) meeting minutes, CSV, or structured JSON trackers.',
      tag: 'Exports',
    },
    {
      icon: History,
      title: 'Meeting History & Archive',
      description: 'Search, filter, and inspect past meetings and their outstanding action items in one place.',
      tag: 'Records',
    },
    {
      icon: HelpCircle,
      title: 'Clarification Assistant',
      description: 'Generates ready-to-copy follow-up questions for stakeholders when critical project owners or dates are missing.',
      tag: 'Follow-ups',
    },
    {
      icon: Shield,
      title: 'Privacy & Retention Controls',
      description: 'Configurable PII redaction, name masking, and customizable data retention periods for client security.',
      tag: 'Compliance',
    },
  ];

  const workflowSteps = [
    {
      number: '01',
      title: 'Upload or Paste Transcript',
      desc: 'Paste text from Zoom, Teams, or Google Meet, or upload TXT, DOCX, VTT, or SRT files (up to 10 MB).',
    },
    {
      number: '02',
      title: 'Inspect & Verify Evidence',
      desc: 'Review identified tasks, split composite actions, merge duplicates, and verify supporting transcript quotes.',
    },
    {
      number: '03',
      title: 'Accept & Export Tracker',
      desc: 'Verify reviewed items and instantly generate Excel sheets, Word minutes, or CSV trackers for your team.',
    },
  ];

  const benefits = [
    {
      title: 'Reduce Manual Meeting Notes',
      desc: 'Save 30–60 minutes per meeting by converting transcripts into structured trackers in seconds.',
    },
    {
      title: 'Absolute Fact Integrity',
      desc: 'Our non-negotiable rule: the system never guesses a person or deadline. Unknown facts remain "Not stated".',
    },
    {
      title: 'Complete Traceability',
      desc: 'Every commitment is tied to verbatim quotes so team leads can verify exactly who agreed to what.',
    },
    {
      title: 'Resolve Missing Information Fast',
      desc: 'Surface open questions and missing deadlines immediately with generated copy-ready follow-up questions.',
    },
    {
      title: 'Eliminate Duplicated Commitments',
      desc: 'Review potential duplicates side-by-side with similarity scores before merging or discarding.',
    },
    {
      title: 'FastAPI Backend Ready',
      desc: 'Built with clean service boundaries ready for effortless integration with a production Python FastAPI backend.',
    },
  ];

  const faqItems = [
    {
      question: 'What file formats are supported for meeting transcripts?',
      answer: 'The system accepts pasted text as well as uploaded files in TXT, DOCX, text-based PDF, VTT, and SRT transcript formats up to 10 MB.',
    },
    {
      question: 'Can I edit extracted tasks, owners, and dates?',
      answer: 'Yes. The Review Items page allows you to edit descriptions, assign or change owners, adjust due dates, merge related tasks, and split multi-part action items.',
    },
    {
      question: 'What happens when a meeting mentions a task without an owner?',
      answer: 'The application strictly flags the owner as "Not stated". It will never invent or guess an assignee. The task is routed to the Clarification queue so you can follow up with your team.',
    },
    {
      question: 'Can I export the action items to Excel and Word?',
      answer: 'Yes! You can export verified items to formatted Excel (.xlsx) workbooks, structured Word (.docx) meeting minutes, plain CSV files, and machine-readable JSON trackers.',
    },
    {
      question: 'Does the application automatically assign due dates?',
      answer: 'No. If a deadline was not spoken in the meeting, it remains "Not stated". If relative wording like "next Friday" or "by end of month" was used, the original phrasing is preserved alongside resolved dates.',
    },
    {
      question: 'Can I review possible duplicate tasks across meetings?',
      answer: 'Yes. The Duplicate Detection screen flags possible duplicate tasks side by side with similarity scores, allowing you to choose whether to Keep Both, Merge, or Discard.',
    },
  ];

  return (
    <div className="landing-page">
      {/* Subtle ReactBits ambient background */}
      <div className="landing-grid-bg" />
      <div className="landing-spotlight" />

      {/* SECTION A: NAVBAR */}
      <header className="landing-navbar">
        <div className="landing-container">
          <div className="landing-nav-inner">
            <Link to="/" className="landing-logo">
              <div className="landing-logo-badge">
                <Zap size={18} />
              </div>
              <span>Client Meeting-to-Action Tracker</span>
            </Link>

            <nav>
              <ul className="landing-nav-links">
                <li><button onClick={() => scrollTo('features')} className="btn-ghost landing-nav-link" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>Features</button></li>
                <li><button onClick={() => scrollTo('how-it-works')} className="btn-ghost landing-nav-link" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>How It Works</button></li>
                <li><button onClick={() => scrollTo('benefits')} className="btn-ghost landing-nav-link" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>Benefits</button></li>
                <li><button onClick={() => scrollTo('faq')} className="btn-ghost landing-nav-link" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>FAQ</button></li>
              </ul>
            </nav>

            <div className="landing-nav-actions">
              <Link to="/login" className="btn-landing-ghost">
                Sign In
              </Link>
              <Link to="/signup" className="btn-landing-primary">
                Get Started <ArrowRight size={14} />
              </Link>
            </div>

            <button
              className="mobile-nav-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>

          {/* Mobile dropdown */}
          <div className={`mobile-nav-menu ${mobileMenuOpen ? 'open' : ''}`}>
            <ul className="landing-nav-links">
              <li><button onClick={() => scrollTo('features')} className="landing-nav-link" style={{ background: 'none', border: 'none' }}>Features</button></li>
              <li><button onClick={() => scrollTo('how-it-works')} className="landing-nav-link" style={{ background: 'none', border: 'none' }}>How It Works</button></li>
              <li><button onClick={() => scrollTo('benefits')} className="landing-nav-link" style={{ background: 'none', border: 'none' }}>Benefits</button></li>
              <li><button onClick={() => scrollTo('faq')} className="landing-nav-link" style={{ background: 'none', border: 'none' }}>FAQ</button></li>
            </ul>
            <div className="landing-nav-actions">
              <Link to="/login" className="btn-landing-ghost">
                Sign In
              </Link>
              <Link to="/signup" className="btn-landing-primary">
                Get Started <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* SECTION B: HERO */}
      <section className="landing-hero">
        <div className="landing-container">
          <AnimatedContent
            distance={50}
            direction="vertical"
            duration={0.85}
            ease="power3.out"
            blur={0}
            stagger={0.12}
            trigger="mount"
          >
            <div className="landing-pill">
              <span className="landing-pill-dot"></span>
              <span>Minimalist SaaS for High-Stakes Client Syncs</span>
            </div>

            {/* ReactBits TechText Interactive Hero Headline */}
            <div
              className="landing-techtext-wrapper"
              style={{
                width: '100%',
                maxWidth: '960px',
                margin: '0 auto 1.5rem',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div style={{ width: '100%', height: 'clamp(75px, 12vw, 115px)', position: 'relative' }}>
                <TechText
                  text="Turn Every Meeting"
                  fontWeight={700}
                  fontSize={88}
                  reveal="letter"
                  dashLength={4}
                  dashGap={2}
                  specks={15}
                  intro="none"
                  introDuration={2}
                  clickKick
                  guides={false}
                  fontFamily="Inter, system-ui, sans-serif"
                  letterSpacing={-0.03}
                  accentColor="#818cf8"
                  reach={200}
                  softness={0.7}
                  lineStyle="dashed"
                  strokeWidth={1.5}
                  speed={1}
                  bounce={0.4}
                  selection
                  labels
                  color="#ffffff"
                  align="center"
                  draggable
                  sweep
                />
              </div>
              <div style={{ width: '100%', height: 'clamp(75px, 12vw, 115px)', position: 'relative', marginTop: '-6px' }}>
                <TechText
                  text="Into Clear Action."
                  fontWeight={700}
                  fontSize={88}
                  reveal="letter"
                  dashLength={4}
                  dashGap={2}
                  specks={15}
                  intro="none"
                  introDuration={2}
                  clickKick
                  guides={false}
                  fontFamily="Inter, system-ui, sans-serif"
                  letterSpacing={-0.03}
                  accentColor="#6366f1"
                  reach={200}
                  softness={0.7}
                  lineStyle="dashed"
                  strokeWidth={1.5}
                  speed={1}
                  bounce={0.4}
                  selection
                  labels
                  color="#c7d2fe"
                  align="center"
                  draggable
                  sweep
                />
              </div>
            </div>

            <p className="landing-subtitle">
              Convert client meeting transcripts into verified tasks, decisions, and risks — with zero hallucinations.
            </p>

            <div className="landing-hero-actions">
              <Link to="/app/new-meeting" className="btn-landing-primary btn-landing-lg">
                Start a Meeting <ArrowRight size={16} />
              </Link>
              <Link to="/app/dashboard" className="btn-landing-ghost btn-landing-lg">
                Explore Dashboard
              </Link>
            </div>
          </AnimatedContent>

          {/* SECTION C: PRODUCT PREVIEW IN HERO */}
          <div id="preview">
            <AnimatedContent distance={50} duration={0.9} threshold={0.15}>
              <InteractivePreview />
            </AnimatedContent>
          </div>
        </div>
      </section>

      {/* SECTION D: FEATURES */}
      <section id="features" className="landing-section">
        <div className="landing-container">
          <AnimatedContent distance={40} duration={0.8} threshold={0.15}>
            <div className="landing-section-header">
              <span className="section-tag">Powerful Capabilities</span>
              <h2 className="section-title">Designed for Uncompromising Accuracy</h2>
              <p className="section-desc">
                Generic summaries miss commitments. Our tracker enforces uncertainty rules,
                never invents facts, and backs every single task with transcript evidence.
              </p>
            </div>
          </AnimatedContent>

          <AnimatedContent distance={40} stagger={0.06} duration={0.8} threshold={0.1}>
            <div className="features-grid">
              {featureList.map((f, i) => (
                <FeatureCard
                  key={i}
                  icon={f.icon}
                  title={f.title}
                  description={f.description}
                  tag={f.tag}
                />
              ))}
            </div>
          </AnimatedContent>
        </div>
      </section>

      {/* SECTION E: HOW IT WORKS */}
      <section id="how-it-works" className="landing-section" style={{ background: 'rgba(255, 255, 255, 0.015)', borderTop: '1px solid rgba(255, 255, 255, 0.05)', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
        <div className="landing-container">
          <AnimatedContent distance={40} duration={0.8} threshold={0.15}>
            <div className="landing-section-header">
              <span className="section-tag">Simple 3-Step Flow</span>
              <h2 className="section-title">From Raw Audio Transcript to Verified Tracker</h2>
              <p className="section-desc">
                A transparent, human-in-the-loop workflow that guarantees high confidence and zero hallucinations.
              </p>
            </div>
          </AnimatedContent>

          <AnimatedContent distance={50} stagger={0.12} duration={0.8} threshold={0.15}>
            <div className="workflow-grid">
              {workflowSteps.map((step, idx) => (
                <div key={idx} className="workflow-card">
                  <div className="workflow-number">{step.number}</div>
                  <h3 className="workflow-title">{step.title}</h3>
                  <p className="workflow-desc">{step.desc}</p>
                </div>
              ))}
            </div>
          </AnimatedContent>
        </div>
      </section>

      {/* SECTION F: BENEFITS */}
      <section id="benefits" className="landing-section">
        <div className="landing-container">
          <AnimatedContent distance={40} duration={0.8} threshold={0.15}>
            <div className="landing-section-header">
              <span className="section-tag">Why It Matters</span>
              <h2 className="section-title">Built for Account Managers, PMs & Engineers</h2>
              <p className="section-desc">
                Eliminate lost client requests, unassigned responsibilities, and awkward follow-up delays.
              </p>
            </div>
          </AnimatedContent>

          <AnimatedContent distance={40} stagger={0.06} duration={0.8} threshold={0.15}>
            <div className="benefits-grid">
              {benefits.map((b, i) => (
                <div key={i} className="benefit-card">
                  <div className="benefit-icon-wrapper">
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <h4 className="benefit-title">{b.title}</h4>
                    <p className="benefit-desc">{b.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </AnimatedContent>
        </div>
      </section>

      {/* SECTION G: FAQ ACCORDION */}
      <section id="faq" className="landing-section" style={{ background: 'rgba(255, 255, 255, 0.015)', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
        <div className="landing-container">
          <AnimatedContent distance={40} duration={0.8} threshold={0.15}>
            <div className="landing-section-header">
              <span className="section-tag">Frequently Asked Questions</span>
              <h2 className="section-title">Everything You Need to Know</h2>
              <p className="section-desc">
                Learn how Client Meeting-to-Action Tracker handles ambiguity, exports, and data integrity.
              </p>
            </div>

            <Accordion items={faqItems} />
          </AnimatedContent>
        </div>
      </section>

      {/* SECTION H: FINAL CTA & FOOTER */}
      <section className="landing-cta">
        <div className="landing-container">
          <AnimatedContent distance={50} scale={0.96} duration={0.85} threshold={0.15}>
            <div className="cta-box">
              <span className="section-tag" style={{ color: '#c7d2fe' }}>Get Started Today</span>
              <h2 className="section-title" style={{ marginTop: '0.5rem', marginBottom: '1.25rem' }}>
                Make Every Meeting Actionable.
              </h2>
              <p className="section-desc" style={{ maxWidth: '580px', margin: '0 auto 2.5rem' }}>
                Experience the clarity of verified tasks, tracked decisions, and zero-hallucination action items.
              </p>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link to="/app/new-meeting" className="btn-landing-primary btn-landing-lg">
                  Start a Meeting <ArrowRight size={16} />
                </Link>
                <Link to="/app/dashboard" className="btn-landing-ghost btn-landing-lg">
                  Open Dashboard
                </Link>
              </div>
            </div>
          </AnimatedContent>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="landing-footer">
        <div className="landing-container">
          <div className="footer-grid">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ffffff', fontWeight: 600, marginBottom: '1rem' }}>
                <div className="landing-logo-badge" style={{ width: 24, height: 24 }}>
                  <Zap size={14} />
                </div>
                <span>Client Meeting-to-Action Tracker</span>
              </div>
              <p style={{ fontSize: '0.84375rem', color: '#71717a', maxWidth: '320px', lineHeight: 1.6 }}>
                Minimalist, evidence-traceable action tracker that turns spoken discussions into structured, high-accountability client deliverables.
              </p>
            </div>

            <div>
              <h4 className="footer-col-title">Navigation</h4>
              <ul className="footer-links">
                <li><button onClick={() => scrollTo('features')} className="footer-link" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>Features</button></li>
                <li><button onClick={() => scrollTo('how-it-works')} className="footer-link" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>How It Works</button></li>
                <li><button onClick={() => scrollTo('benefits')} className="footer-link" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>Benefits</button></li>
                <li><button onClick={() => scrollTo('faq')} className="footer-link" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>FAQ</button></li>
              </ul>
            </div>

            <div>
              <h4 className="footer-col-title">Application</h4>
              <ul className="footer-links">
                <li><Link to="/app/dashboard" className="footer-link">Dashboard</Link></li>
                <li><Link to="/app/new-meeting" className="footer-link">New Meeting</Link></li>
                <li><Link to="/app/review/m1" className="footer-link">Review Items</Link></li>
                <li><Link to="/app/history" className="footer-link">Meeting History</Link></li>
                <li><Link to="/app/export" className="footer-link">Export Tracker</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="footer-col-title">System</h4>
              <ul className="footer-links">
                <li><Link to="/app/settings" className="footer-link">Settings</Link></li>
                <li><Link to="/app/profile" className="footer-link">User Profile</Link></li>
                <li><Link to="/app/clarification" className="footer-link">Clarifications</Link></li>
                <li><Link to="/app/duplicates" className="footer-link">Duplicate Detection</Link></li>
              </ul>
            </div>
          </div>

          <div className="footer-bottom">
            <span>© 2026 Client Meeting-to-Action Tracker. Production React Frontend.</span>
            <span>Designed with ReactBits inspiration · Clean architecture ready for FastAPI</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

