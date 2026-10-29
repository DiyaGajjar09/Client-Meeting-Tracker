import { useState } from 'react';
import { Eye, ArrowRight, ClipboardList, Lightbulb, AlertTriangle, HelpCircle } from 'lucide-react';
import Stepper, { Step } from './Stepper';

export default function InteractivePreview() {
  const [selectedEvidence, setSelectedEvidence] = useState(null);

  const previewTasks = [
    {
      id: 1,
      desc: 'Finalize the data migration plan and technical milestones',
      owner: 'Tom Hargreaves',
      ownerStatus: 'stated',
      due: '15 Nov 2026',
      dueStatus: 'stated',
      status: 'accepted',
      confidence: 'high',
      evidence: '"Sure, I\'ll handle the migration plan and have it ready by November 15th."',
      speaker: 'Tom Hargreaves (PM)',
    },
    {
      id: 2,
      desc: 'Follow up with vendor regarding the API rate-limit issue',
      owner: 'Emily Starks',
      ownerStatus: 'stated',
      due: 'this week (unresolved)',
      dueStatus: 'not_stated',
      status: 'needs_review',
      confidence: 'medium',
      evidence: '"Emily, can you follow up with the vendor this week?" ... "I\'ll reach out to them soon."',
      speaker: 'Sarah Chen / Emily Starks',
    },
    {
      id: 3,
      desc: 'Draft the user acceptance testing (UAT) rollout plan',
      owner: 'Not stated',
      ownerStatus: 'not_stated',
      due: 'Not stated',
      dueStatus: 'not_stated',
      status: 'needs_review',
      confidence: 'low',
      evidence: '"Who is going to draft the user acceptance testing plan?" ... "That hasn\'t been assigned yet. We need someone to own it."',
      speaker: 'Sarah Chen (Acme)',
    },
  ];

  const previewDecisions = [
    {
      id: 4,
      desc: 'Legacy reporting module removed from v1.0 scope',
      status: 'accepted',
      confidence: 'high',
      evidence: '"Confirmed. Legacy reporting is out of v1.0 scope. That\'s a decision we\'re all aligned on."',
      speaker: 'Dev Lead / Sarah Chen',
    },
  ];

  const previewRisks = [
    {
      id: 5,
      desc: 'Vendor API rate-limit issue is unresolved — risk to launch timeline',
      status: 'needs_review',
      confidence: 'high',
      evidence: '"We\'re waiting on the vendor response. It\'s a risk to the launch timeline."',
      speaker: 'Dev Lead',
    },
  ];

  const previewQuestions = [
    {
      id: 6,
      desc: 'Who will own the UAT plan? Pending clarification in next sync.',
      status: 'needs_review',
      confidence: 'high',
      evidence: '"Let\'s revisit that in the next meeting. For now, let\'s keep it open."',
      speaker: 'Sarah Chen',
    },
  ];

  return (
    <div className="hero-preview-wrapper animate-fadeIn">
      <div className="hero-preview-window">
        {/* Top window chrome */}
        <div className="preview-top-bar">
          <div className="preview-dots">
            <span className="preview-dot red"></span>
            <span className="preview-dot yellow"></span>
            <span className="preview-dot green"></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="preview-tab-pill">Q4 Product Review — Acme Corp</span>
            <span style={{ fontSize: '11px', color: '#a1a1aa' }}>Interactive Live Preview</span>
          </div>
          <div style={{ fontSize: '12px', color: '#818cf8', fontWeight: 600 }}>
            Traceable to Evidence
          </div>
        </div>

        {/* Meeting metadata bar */}
        <div style={{
          padding: '12px 20px',
          background: 'rgba(255, 255, 255, 0.02)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#f4f4f5' }}>
              Acme Corporation · 15 Oct 2026
            </div>
            <span className="badge badge-info" style={{ fontSize: '11px' }}>
              Reviewed
            </span>
          </div>

          <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#a1a1aa' }}>
            <span><strong style={{ color: '#f4f4f5' }}>3</strong> Tasks</span>
            <span style={{ color: '#fbbf24' }}><strong>1</strong> Missing Owner</span>
            <span style={{ color: '#f87171' }}><strong>1</strong> Open Risk</span>
          </div>
        </div>

        {/* Stepper with Dark Theme */}
        <div style={{ padding: '16px 20px 8px' }}>
          <Stepper
            initialStep={1}
            indicator="numbers"
            orientation="horizontal"
            transition="slide"
            theme="dark"
            width="100%"
            radius={16}
            frame={false}
            backButtonText="Back"
            nextButtonText="Continue"
            completeButtonText="Try Full Review →"
            onFinalStepCompleted={() => {
              window.location.href = '/app/review/m1';
            }}
          >
            {/* Step 1: Tasks */}
            <Step title="Tasks" icon={<ClipboardList size={13} />}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '6px' }}>
                {previewTasks.map(t => (
                  <div
                    key={t.id}
                    style={{
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '8px',
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      background: selectedEvidence?.id === t.id ? 'rgba(99, 102, 241, 0.14)' : 'rgba(255, 255, 255, 0.03)',
                      transition: 'all 0.2s ease',
                      boxShadow: selectedEvidence?.id === t.id ? '0 0 15px rgba(99, 102, 241, 0.2)' : 'none',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13.5px', fontWeight: 500, color: '#f4f4f5', marginBottom: '4px' }}>
                        {t.desc}
                      </div>
                      <div style={{ display: 'flex', gap: '16px', fontSize: '11.5px', color: '#a1a1aa' }}>
                        <span>
                          Owner:{' '}
                          {t.ownerStatus === 'not_stated' ? (
                            <strong style={{ color: '#fbbf24', fontStyle: 'italic' }}>Not stated</strong>
                          ) : (
                            <strong style={{ color: '#e4e4e7' }}>{t.owner}</strong>
                          )}
                        </span>
                        <span>
                          Due:{' '}
                          {t.dueStatus === 'not_stated' ? (
                            <strong style={{ color: '#fbbf24', fontStyle: 'italic' }}>{t.due}</strong>
                          ) : (
                            <strong style={{ color: '#e4e4e7' }}>{t.due}</strong>
                          )}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                      <span className={`badge ${t.status === 'accepted' ? 'badge-accepted' : 'badge-needs-review'}`}>
                        {t.status === 'accepted' ? 'Accepted' : 'Needs Review'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedEvidence(selectedEvidence?.id === t.id ? null : t)}
                        className="btn btn-ghost btn-sm"
                        style={{
                          fontSize: '11.5px',
                          padding: '5px 9px',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          color: '#e4e4e7',
                        }}
                      >
                        <Eye size={12} /> Evidence
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Step>

            {/* Step 2: Decisions */}
            <Step title="Decisions" icon={<Lightbulb size={13} />}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '6px' }}>
                {previewDecisions.map(d => (
                  <div
                    key={d.id}
                    style={{
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '8px',
                      padding: '12px 16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: selectedEvidence?.id === d.id ? 'rgba(99, 102, 241, 0.14)' : 'rgba(255, 255, 255, 0.03)',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '13.5px', fontWeight: 500, color: '#f4f4f5' }}>{d.desc}</div>
                      <div style={{ fontSize: '11.5px', color: '#a1a1aa', marginTop: '4px' }}>Speaker: {d.speaker}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span className="badge badge-accepted">Confirmed</span>
                      <button
                        type="button"
                        onClick={() => setSelectedEvidence(selectedEvidence?.id === d.id ? null : d)}
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: '11.5px', padding: '5px 9px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', color: '#e4e4e7' }}
                      >
                        <Eye size={12} /> Evidence
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Step>

            {/* Step 3: Risks */}
            <Step title="Risks" icon={<AlertTriangle size={13} />}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '6px' }}>
                {previewRisks.map(r => (
                  <div
                    key={r.id}
                    style={{
                      border: '1px solid rgba(248, 113, 113, 0.25)',
                      background: 'rgba(239, 68, 68, 0.08)',
                      borderRadius: '8px',
                      padding: '12px 16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#fca5a5' }}>{r.desc}</div>
                      <div style={{ fontSize: '11.5px', color: '#a1a1aa', marginTop: '4px' }}>Speaker: {r.speaker}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span className="badge badge-needs-review">High Impact</span>
                      <button
                        type="button"
                        onClick={() => setSelectedEvidence(selectedEvidence?.id === r.id ? null : r)}
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: '11.5px', padding: '5px 9px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', color: '#e4e4e7' }}
                      >
                        <Eye size={12} /> Evidence
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Step>

            {/* Step 4: Open Questions */}
            <Step title="Open Questions" icon={<HelpCircle size={13} />}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '6px' }}>
                {previewQuestions.map(q => (
                  <div
                    key={q.id}
                    style={{
                      border: '1px solid rgba(56, 189, 248, 0.25)',
                      background: 'rgba(14, 165, 233, 0.08)',
                      borderRadius: '8px',
                      padding: '12px 16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#7dd3fc' }}>{q.desc}</div>
                      <div style={{ fontSize: '11.5px', color: '#a1a1aa', marginTop: '4px' }}>Speaker: {q.speaker}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span className="badge badge-info">Needs Sign-off</span>
                      <button
                        type="button"
                        onClick={() => setSelectedEvidence(selectedEvidence?.id === q.id ? null : q)}
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: '11.5px', padding: '5px 9px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', color: '#e4e4e7' }}
                      >
                        <Eye size={12} /> Evidence
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Step>
          </Stepper>

          {/* Interactive Evidence Quote Callout */}
          {selectedEvidence && (
            <div style={{
              marginTop: '16px',
              padding: '12px 16px',
              background: 'rgba(99, 102, 241, 0.12)',
              borderLeft: '3px solid #6366f1',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              borderRadius: '0 8px 8px 0',
              animation: 'fadeIn 0.2s ease',
            }}>
              <div style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', color: '#a5b4fc', letterSpacing: '0.05em', marginBottom: '4px' }}>
                Verbatim Transcript Evidence Quote ({selectedEvidence.speaker})
              </div>
              <div style={{ fontSize: '12.5px', fontStyle: 'italic', color: '#f4f4f5', lineHeight: 1.5 }}>
                {selectedEvidence.evidence}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Banner */}
        <div style={{
          padding: '12px 20px',
          background: 'rgba(255, 255, 255, 0.02)',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '12px',
          color: '#a1a1aa'
        }}>
          <span>
            Demonstration mode: No guessed owners or fabricated due dates. Unknown values remain transparently unresolved.
          </span>
          <a href="/app/new-meeting" style={{ color: '#818cf8', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
            Try with your meeting <ArrowRight size={13} />
          </a>
        </div>
      </div>
    </div>
  );
}
