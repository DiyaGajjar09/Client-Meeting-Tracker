import { useState, useEffect } from 'react';
import { User, Mail, Briefcase, Building, Shield, Check, Save, X, Edit2, ArrowLeft } from 'lucide-react';
import { Button, Input } from '../components/common/FormControls.jsx';
import { useToast } from '../components/common/ToastNotification.jsx';
import { useNavigate } from 'react-router-dom';
import { getUserProfile, saveUserProfile, DEFAULT_PROFILE } from '../utils/userProfile.js';

export default function Profile() {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(DEFAULT_PROFILE);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loaded = getUserProfile();
    setProfile(loaded);
    setFormData(loaded);
  }, []);

  const getInitials = (name) => {
    if (!name) return 'JD';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const validate = () => {
    const errs = {};
    if (!formData.name.trim()) errs.name = 'Full name is required';
    if (!formData.email.trim()) {
      errs.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errs.email = 'Please provide a valid email address';
    }
    return errs;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setSaving(true);
    await new Promise(r => setTimeout(r, 400));
    saveUserProfile(formData);
    setProfile(formData);
    setIsEditing(false);
    setSaving(false);
    addToast('Profile changes saved successfully', 'success');
  };

  const handleCancel = () => {
    setFormData(profile);
    setErrors({});
    setIsEditing(false);
  };

  return (
    <div className="page-container animate-fadeIn" style={{ maxWidth: 780 }}>
      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">User Profile</h1>
          <p className="page-subtitle">Manage your personal account preferences and meeting signature details</p>
        </div>
        <div className="page-actions">
          {!isEditing ? (
            <Button
              variant="primary"
              icon={<Edit2 size={14} />}
              onClick={() => setIsEditing(true)}
            >
              Edit Profile
            </Button>
          ) : (
            <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
              <Button variant="secondary" icon={<X size={14} />} onClick={handleCancel}>
                Cancel
              </Button>
              <Button variant="primary" icon={<Save size={14} />} onClick={handleSave} loading={saving}>
                Save Changes
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Profile Card */}
      <div className="card" style={{ marginBottom: 'var(--spacing-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-5)', flexWrap: 'wrap' }}>
          <div style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem',
            fontWeight: 700,
            boxShadow: '0 0 25px rgba(99, 102, 241, 0.4)',
            border: '2px solid rgba(255, 255, 255, 0.15)',
            flexShrink: 0
          }}>
            {getInitials(profile.name)}
          </div>

          <div style={{ flex: 1, minWidth: 200 }}>
            <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '4px' }}>
              {profile.name}
            </h2>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
              {profile.title} · {profile.company}
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span className="badge badge-info" style={{ fontSize: '11px' }}>
                <Shield size={11} style={{ marginRight: 3 }} /> {profile.role}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                Demo Session
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Profile Form */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Personal Information</span>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
            {isEditing ? 'Editing active' : 'Read-only view'}
          </span>
        </div>

        <form onSubmit={handleSave} noValidate>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-4)', marginBottom: 'var(--spacing-4)' }}>
            <div className="form-group">
              <label className="form-label">Full Name {isEditing && <span className="required">*</span>}</label>
              {isEditing ? (
                <Input
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  error={errors.name}
                  placeholder="e.g. Jane Doe"
                />
              ) : (
                <div style={{ padding: '8px 12px', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-base)', fontSize: 'var(--font-size-sm)' }}>
                  {profile.name}
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Email Address {isEditing && <span className="required">*</span>}</label>
              {isEditing ? (
                <Input
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  error={errors.email}
                  placeholder="e.g. jane@company.com"
                />
              ) : (
                <div style={{ padding: '8px 12px', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-base)', fontSize: 'var(--font-size-sm)' }}>
                  {profile.email}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-4)', marginBottom: 'var(--spacing-4)' }}>
            <div className="form-group">
              <label className="form-label">Job Title</label>
              {isEditing ? (
                <Input
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Technical Account Manager"
                />
              ) : (
                <div style={{ padding: '8px 12px', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-base)', fontSize: 'var(--font-size-sm)' }}>
                  {profile.title}
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Company / Organization</label>
              {isEditing ? (
                <Input
                  value={formData.company}
                  onChange={e => setFormData({ ...formData, company: e.target.value })}
                  placeholder="e.g. Apex Solutions Partners"
                />
              ) : (
                <div style={{ padding: '8px 12px', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-base)', fontSize: 'var(--font-size-sm)' }}>
                  {profile.company}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-4)', marginBottom: 'var(--spacing-4)' }}>
            <div className="form-group">
              <label className="form-label">Default Timezone</label>
              {isEditing ? (
                <select
                  className="select"
                  value={formData.timezone}
                  onChange={e => setFormData({ ...formData, timezone: e.target.value })}
                >
                  <option value="Europe/London (GMT+1)">Europe/London (GMT+1)</option>
                  <option value="America/New_York (EST)">America/New_York (EST)</option>
                  <option value="America/Los_Angeles (PST)">America/Los_Angeles (PST)</option>
                  <option value="Asia/Kolkata (IST)">Asia/Kolkata (IST)</option>
                  <option value="UTC">UTC</option>
                </select>
              ) : (
                <div style={{ padding: '8px 12px', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-base)', fontSize: 'var(--font-size-sm)' }}>
                  {profile.timezone}
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Access Level</label>
              <div style={{ padding: '8px 12px', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-base)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                {profile.role} (Demo Account)
              </div>
            </div>
          </div>

          {isEditing && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-3)', marginTop: 'var(--spacing-6)', paddingTop: 'var(--spacing-4)', borderTop: '1px solid var(--color-border)' }}>
              <Button variant="secondary" type="button" onClick={handleCancel}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" loading={saving} icon={<Save size={14} />}>
                Save Changes
              </Button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
