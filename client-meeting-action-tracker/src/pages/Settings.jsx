import { useState, useEffect } from 'react';
import { Settings, Brain, GitMerge, Download, Calendar, Shield, Database, AlertTriangle, Save, RefreshCw, Palette } from 'lucide-react';
import { Button, Input, Select } from '../components/common/FormControls.jsx';
import { useToast } from '../components/common/ToastNotification.jsx';
import { MOCK_SETTINGS } from '../data/mockData.js';

const SETTINGS_KEY = 'cmtat_settings';

const SECTIONS = [
  { id: 'theme', label: 'Theme & Appearance', icon: Palette },
  { id: 'llm', label: 'AI / LLM Provider', icon: Brain },
  { id: 'duplicates', label: 'Duplicate Detection', icon: GitMerge },
  { id: 'export', label: 'Export Columns', icon: Download },
  { id: 'dates', label: 'Date Interpretation', icon: Calendar },
  { id: 'retention', label: 'Data Retention', icon: Database },
  { id: 'privacy', label: 'Privacy & Redaction', icon: Shield },
];

export default function SettingsPage() {
  const { addToast } = useToast();
  const [activeSection, setActiveSection] = useState('theme');
  const [settings, setSettings] = useState(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      if (stored) {
        return { ...MOCK_SETTINGS, theme: { appearance: 'dark', fontScale: 'default' }, ...JSON.parse(stored) };
      }
    } catch {}
    return { ...MOCK_SETTINGS, theme: { appearance: 'dark', fontScale: 'default' } };
  });
  const [saving, setSaving] = useState(false);

  function updateSetting(section, key, value) {
    setSettings(prev => ({
      ...prev,
      [section]: { ...prev[section], [key]: value },
    }));
  }

  async function handleSave() {
    setSaving(true);
    await new Promise(r => setTimeout(r, 400));
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {}
    setSaving(false);
    addToast('Settings saved successfully to browser storage', 'success');
  }

  function handleReset() {
    try {
      localStorage.removeItem(SETTINGS_KEY);
    } catch {}
    const defaultVal = { ...MOCK_SETTINGS, theme: { appearance: 'dark', fontScale: 'default' } };
    setSettings(defaultVal);
    addToast('Settings reset to system defaults', 'info');
  }

  return (
    <div className="page-container animate-fadeIn">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Configure extraction behaviour, duplicate detection, exports, and privacy preferences</p>
        </div>
        <div className="page-actions">
          <Button variant="ghost" icon={<RefreshCw size={14} />} onClick={handleReset}>Reset</Button>
          <Button variant="primary" icon={<Save size={14} />} onClick={handleSave} loading={saving}>
            Save changes
          </Button>
        </div>
      </div>

      {/* Backend notice */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 8,
        background: 'var(--color-info-bg)',
        border: '1px solid var(--color-info-border)',
        borderRadius: 'var(--radius-base)',
        padding: '10px 14px',
        marginBottom: 'var(--spacing-6)',
        fontSize: 'var(--font-size-sm)',
        color: 'var(--color-info)',
      }}>
        <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <strong>Frontend demonstration mode.</strong> Settings are stored in local state only. When the FastAPI backend is connected, these preferences will be persisted and applied to the AI extraction pipeline. Do not enter real API keys here.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 'var(--spacing-6)', alignItems: 'start' }}>
        {/* Sidebar nav */}
        <div className="card" style={{ padding: 'var(--spacing-2) 0' }}>
          {SECTIONS.map(section => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-3)',
                  width: '100%',
                  padding: 'var(--spacing-2) var(--spacing-4)',
                  background: activeSection === section.id ? 'var(--color-accent-light)' : 'transparent',
                  color: activeSection === section.id ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: activeSection === section.id ? 600 : 400,
                  textAlign: 'left',
                  borderRadius: 'var(--radius-base)',
                  margin: '1px var(--spacing-2)',
                  transition: 'all var(--transition-base)',
                }}
              >
                <Icon size={16} />
                {section.label}
              </button>
            );
          })}
        </div>

        {/* Content panel */}
        <div>
          {activeSection === 'theme' && <ThemeSection settings={settings.theme || { appearance: 'light', fontScale: 'default' }} update={(k, v) => updateSetting('theme', k, v)} />}
          {activeSection === 'llm' && <LLMSection settings={settings.llm} update={(k, v) => updateSetting('llm', k, v)} />}
          {activeSection === 'duplicates' && <DuplicatesSection settings={settings.duplicates} update={(k, v) => updateSetting('duplicates', k, v)} />}
          {activeSection === 'export' && <ExportSection settings={settings.export} update={(k, v) => updateSetting('export', k, v)} />}
          {activeSection === 'dates' && <DatesSection settings={settings.dates} update={(k, v) => updateSetting('dates', k, v)} />}
          {activeSection === 'retention' && <RetentionSection settings={settings.retention} update={(k, v) => updateSetting('retention', k, v)} />}
          {activeSection === 'privacy' && <PrivacySection settings={settings.privacy} update={(k, v) => updateSetting('privacy', k, v)} />}
        </div>
      </div>
    </div>
  );
}

function SectionCard({ title, description, children }) {
  return (
    <div className="card">
      <div style={{ marginBottom: 'var(--spacing-5)' }}>
        <div className="card-title">{title}</div>
        {description && (
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 4 }}>{description}</p>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
        {children}
      </div>
    </div>
  );
}

function Toggle({ checked, onChange, label, description }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--spacing-4)' }}>
      <div>
        <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--color-text-primary)' }}>{label}</div>
        {description && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 2 }}>{description}</div>}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        style={{
          width: 40,
          height: 22,
          borderRadius: 11,
          background: checked ? 'var(--color-accent)' : 'var(--color-border)',
          border: 'none',
          cursor: 'pointer',
          position: 'relative',
          flexShrink: 0,
          transition: 'background var(--transition-base)',
        }}
      >
        <div style={{
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: 'white',
          position: 'absolute',
          top: 3,
          left: checked ? 21 : 3,
          transition: 'left var(--transition-base)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }} />
      </button>
    </div>
  );
}

function ThemeSection({ settings, update }) {
  return (
    <SectionCard
      title="Theme & Visual Appearance"
      description="Select your preferred application interface theme and display scale."
    >
      <Select
        label="Interface Theme"
        value={settings.appearance || 'dark'}
        onChange={e => update('appearance', e.target.value)}
      >
        <option value="dark">Dark Charcoal (ReactBits Pro SaaS - Active)</option>
        <option value="midnight">Midnight Indigo (High Contrast)</option>
        <option value="system">Follow System Preference</option>
      </Select>
      <Select
        label="Density & Font Scale"
        value={settings.fontScale || 'default'}
        onChange={e => update('fontScale', e.target.value)}
      >
        <option value="compact">Compact (High density for large tables)</option>
        <option value="default">Default Balanced (Recommended)</option>
        <option value="spacious">Spacious (Accessible reading)</option>
      </Select>
    </SectionCard>
  );
}

function LLMSection({ settings, update }) {
  return (
    <SectionCard
      title="AI / LLM Provider"
      description="Configure the language model used for meeting transcript extraction. API keys are managed securely in the backend environment variables — never in the UI."
    >
      <Select label="Provider" value={settings.provider} onChange={e => update('provider', e.target.value)}>
        <option value="gemini">Google Gemini (default)</option>
        <option value="openai">OpenAI</option>
        <option value="anthropic">Anthropic</option>
        <option value="custom">Custom (OpenAI-compatible)</option>
      </Select>
      <Select label="Model" value={settings.model} onChange={e => update('model', e.target.value)}>
        <option value="gemini-1.5-pro">gemini-1.5-pro</option>
        <option value="gemini-1.5-flash">gemini-1.5-flash</option>
        <option value="gpt-4o">gpt-4o</option>
        <option value="gpt-4-turbo">gpt-4-turbo</option>
        <option value="claude-3-5-sonnet-20241022">claude-3-5-sonnet</option>
      </Select>
      <div className="form-group">
        <label className="form-label">Temperature</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)' }}>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.temperature}
            onChange={e => update('temperature', parseFloat(e.target.value))}
            style={{ flex: 1 }}
          />
          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, minWidth: 30 }}>
            {settings.temperature.toFixed(2)}
          </span>
        </div>
        <span className="form-hint">Lower values (0.0–0.2) produce more deterministic, consistent extractions</span>
      </div>
      <Input
        label="Max Tokens"
        type="number"
        value={settings.maxTokens}
        onChange={e => update('maxTokens', parseInt(e.target.value))}
        hint="Maximum tokens per extraction request"
      />
      <div style={{ background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning-border)', borderRadius: 'var(--radius-base)', padding: 'var(--spacing-3)', fontSize: 'var(--font-size-xs)', color: 'var(--color-warning)' }}>
        API keys are configured in the backend <code>.env</code> file, not in the UI. The API key field is intentionally absent from this settings panel.
      </div>
    </SectionCard>
  );
}

function DuplicatesSection({ settings, update }) {
  return (
    <SectionCard
      title="Duplicate Detection"
      description="Configure the TF-IDF cosine similarity threshold used to flag possible duplicate tasks across meetings."
    >
      <div className="form-group">
        <label className="form-label">Similarity threshold: {(settings.similarityThreshold * 100).toFixed(0)}%</label>
        <input
          type="range"
          min={0.5}
          max={1}
          step={0.01}
          value={settings.similarityThreshold}
          onChange={e => update('similarityThreshold', parseFloat(e.target.value))}
          style={{ width: '100%', marginTop: 4 }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
          <span>50% (more matches)</span>
          <span>100% (exact only)</span>
        </div>
        <span className="form-hint">Items with a similarity score above this threshold are flagged for review. Default: 70%.</span>
      </div>
      <Select label="Algorithm" value={settings.algorithm} onChange={e => update('algorithm', e.target.value)}>
        <option value="tfidf_cosine">TF-IDF Cosine Similarity (default)</option>
        <option value="semantic">Semantic Embedding Similarity (Phase 2)</option>
      </Select>
    </SectionCard>
  );
}

function ExportSection({ settings, update }) {
  return (
    <SectionCard
      title="Export Column Mapping"
      description="Customise the column headers that appear in Excel and CSV exports."
    >
      <Select label="Default format" value={settings.defaultFormat} onChange={e => update('defaultFormat', e.target.value)}>
        <option value="xlsx">Excel (.xlsx)</option>
        <option value="csv">CSV</option>
        <option value="docx">Word (.docx)</option>
        <option value="json">JSON</option>
      </Select>
      <hr className="divider" />
      {Object.entries(settings.columnMapping).map(([key, label]) => (
        <Input
          key={key}
          label={`"${key}" column heading`}
          value={label}
          onChange={e => update('columnMapping', { ...settings.columnMapping, [key]: e.target.value })}
        />
      ))}
      <Toggle
        checked={settings.includeEvidence}
        onChange={v => update('includeEvidence', v)}
        label="Include evidence quotes in export"
        description="When enabled, an Evidence column is added with the supporting transcript quote"
      />
      <Toggle
        checked={settings.includeConfidence}
        onChange={v => update('includeConfidence', v)}
        label="Include confidence level"
        description="Add a Confidence column to exported files"
      />
    </SectionCard>
  );
}

function DatesSection({ settings, update }) {
  return (
    <SectionCard
      title="Date Interpretation"
      description="Control how relative dates like 'next Friday' or 'end of month' are resolved. These rules apply only when the meeting date is known."
    >
      <Select
        label='"Next Friday" convention'
        value={settings.relativeDateConvention}
        onChange={e => update('relativeDateConvention', e.target.value)}
      >
        <option value="next_business_week">Next business week (Mon–Fri following meeting)</option>
        <option value="next_calendar_week">Next calendar week</option>
        <option value="literal_next_day">Literal next occurrence of the weekday</option>
      </Select>
      <Select label="Timezone" value={settings.timezone} onChange={e => update('timezone', e.target.value)}>
        <option value="Europe/London">Europe/London</option>
        <option value="America/New_York">America/New_York</option>
        <option value="America/Chicago">America/Chicago</option>
        <option value="America/Los_Angeles">America/Los_Angeles</option>
        <option value="Asia/Kolkata">Asia/Kolkata</option>
        <option value="Asia/Singapore">Asia/Singapore</option>
        <option value="UTC">UTC</option>
      </Select>
      <Toggle
        checked={settings.preserveVagueDates}
        onChange={v => update('preserveVagueDates', v)}
        label="Preserve original date wording"
        description='When checked, the original phrase (e.g. "by end of month") is stored alongside any resolved date. This is required by product rules.'
      />
    </SectionCard>
  );
}

function RetentionSection({ settings, update }) {
  return (
    <SectionCard
      title="Data Retention"
      description="Configure how long meeting data is retained before automatic deletion."
    >
      <div className="form-group">
        <label className="form-label">Retain data for (days)</label>
        <input
          type="number"
          className="input"
          min={1}
          max={3650}
          value={settings.dataRetentionDays}
          onChange={e => update('dataRetentionDays', parseInt(e.target.value))}
        />
        <span className="form-hint">Default: 90 days. Meeting data older than this threshold will be scheduled for deletion.</span>
      </div>
      <Toggle
        checked={settings.autoDeleteAfterExport}
        onChange={v => update('autoDeleteAfterExport', v)}
        label="Auto-delete after successful export"
        description="Automatically schedule data deletion once a meeting has been exported. Requires explicit confirmation before deletion."
      />
    </SectionCard>
  );
}

function PrivacySection({ settings, update }) {
  return (
    <SectionCard
      title="Privacy & Name Redaction"
      description="Control how personally identifiable information is handled in extractions and exports."
    >
      <Toggle
        checked={settings.redactNames}
        onChange={v => update('redactNames', v)}
        label="Redact speaker names"
        description="Replace identified speaker names with generic labels (Speaker 1, Speaker 2) in stored transcripts."
      />
      <Toggle
        checked={settings.redactEmails}
        onChange={v => update('redactEmails', v)}
        label="Redact email addresses"
        description="Remove email addresses from stored transcript text before sending to the LLM provider."
      />
      <Toggle
        checked={settings.anonymizeTranscripts}
        onChange={v => update('anonymizeTranscripts', v)}
        label="Full anonymisation mode"
        description="Apply comprehensive PII redaction before LLM processing. Review redacted text before extraction."
      />
      <div style={{ background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning-border)', borderRadius: 'var(--radius-base)', padding: 'var(--spacing-3)', fontSize: 'var(--font-size-xs)', color: 'var(--color-warning)' }}>
        Sending meeting transcripts to an LLM provider requires approval for privacy, data retention, and no-training terms. Confirm this with your legal and compliance team before enabling.
      </div>
    </SectionCard>
  );
}

