import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Zap, Lock, Mail, User, Building, Eye, EyeOff,
  ArrowLeft, ArrowRight, ShieldCheck, CheckCircle2, AlertCircle
} from 'lucide-react';
import { Button } from '../components/common/FormControls.jsx';
import { useToast } from '../components/common/ToastNotification.jsx';
import { signup, quickDemoLogin } from '../services/auth.js';

export default function SignUp() {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [form, setForm] = useState({
    name: '',
    email: '',
    company: '',
    password: '',
    agreeTerms: true,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Password strength calculation
  const strength = useMemo(() => {
    const pwd = form.password;
    if (!pwd) return { score: 0, label: 'None', className: '' };
    
    let score = 0;
    if (pwd.length >= 8) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;

    if (score === 1) return { score: 1, label: 'Weak', className: 'weak' };
    if (score === 2) return { score: 2, label: 'Fair', className: 'fair' };
    if (score === 3) return { score: 3, label: 'Good', className: 'good' };
    if (score >= 4) return { score: 4, label: 'Strong', className: 'strong' };
    return { score: 1, label: 'Weak', className: 'weak' };
  }, [form.password]);

  const updateField = (key, val) => {
    setForm(prev => ({ ...prev, [key]: val }));
    setErrors(prev => ({ ...prev, [key]: '', form: '' }));
  };

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Full name is required';
    if (!form.email.trim()) {
      errs.email = 'Work email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errs.email = 'Please provide a valid email address';
    }

    if (!form.password) {
      errs.password = 'Password is required';
    } else if (form.password.length < 6) {
      errs.password = 'Password must be at least 6 characters';
    }

    if (!form.agreeTerms) {
      errs.agreeTerms = 'You must agree to the Terms of Service';
    }
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setLoading(true);
    setErrors({});
    try {
      const res = await signup(form);
      addToast(`Account created! Welcome, ${res.user.name}.`, 'success');
      navigate('/app/dashboard');
    } catch (err) {
      setErrors({ form: err.message });
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialMock = async (provider) => {
    setLoading(true);
    try {
      await quickDemoLogin();
      addToast(`Signed up via ${provider}`, 'success');
      navigate('/app/dashboard');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        {/* Back Link */}
        <div style={{ marginBottom: '1.25rem' }}>
          <Link
            to="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-secondary)',
              textDecoration: 'none',
              transition: 'color var(--transition-fast)',
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--color-text-primary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-secondary)'}
          >
            <ArrowLeft size={14} /> Back to website
          </Link>
        </div>

        {/* Logo and Headings */}
        <div className="auth-logo-badge">
          <Zap size={22} />
        </div>
        <h1 className="auth-title">Create Account</h1>
        <p className="auth-subtitle">
          Start converting high-stakes client meetings into verified action items and auditable records.
        </p>

        {/* Auth Mode Tabs */}
        <div className="auth-tabs">
          <Link to="/login" className="auth-tab">
            Sign In
          </Link>
          <button className="auth-tab active" type="button">
            Create Account
          </button>
        </div>

        {/* General Form Error */}
        {errors.form && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            background: 'var(--color-danger-bg)',
            border: '1px solid var(--color-danger-border)',
            borderRadius: 'var(--radius-base)',
            color: 'var(--color-danger)',
            fontSize: 'var(--font-size-xs)',
            marginBottom: '1rem',
          }}>
            <AlertCircle size={14} style={{ flexShrink: 0 }} />
            <span>{errors.form}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="signup-name">Full Name *</label>
            <div style={{ position: 'relative' }}>
              <input
                id="signup-name"
                type="text"
                className={`input ${errors.name ? 'error' : ''}`}
                placeholder="Sarah Connor"
                value={form.name}
                onChange={e => updateField('name', e.target.value)}
                style={{ paddingLeft: '2.25rem' }}
                autoComplete="name"
                required
              />
              <User size={15} color="var(--color-text-muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            </div>
            {errors.name && <span className="form-error">{errors.name}</span>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="signup-email">Work Email *</label>
            <div style={{ position: 'relative' }}>
              <input
                id="signup-email"
                type="email"
                className={`input ${errors.email ? 'error' : ''}`}
                placeholder="sarah@company.com"
                value={form.email}
                onChange={e => updateField('email', e.target.value)}
                style={{ paddingLeft: '2.25rem' }}
                autoComplete="email"
                required
              />
              <Mail size={15} color="var(--color-text-muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            </div>
            {errors.email && <span className="form-error">{errors.email}</span>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="signup-company">Company / Organization</label>
            <div style={{ position: 'relative' }}>
              <input
                id="signup-company"
                type="text"
                className="input"
                placeholder="Cyberdyne Systems"
                value={form.company}
                onChange={e => updateField('company', e.target.value)}
                style={{ paddingLeft: '2.25rem' }}
                autoComplete="organization"
              />
              <Building size={15} color="var(--color-text-muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="signup-password">Password *</label>
            <div style={{ position: 'relative' }}>
              <input
                id="signup-password"
                type={showPassword ? 'text' : 'password'}
                className={`input ${errors.password ? 'error' : ''}`}
                placeholder="At least 6 characters"
                value={form.password}
                onChange={e => updateField('password', e.target.value)}
                style={{ paddingLeft: '2.25rem', paddingRight: '2.25rem' }}
                autoComplete="new-password"
                required
              />
              <Lock size={15} color="var(--color-text-muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text-muted)',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {errors.password && <span className="form-error">{errors.password}</span>}

            {/* Password strength meter */}
            {form.password && (
              <div className="password-strength-wrap">
                <div className="password-strength-bars">
                  <div className={`strength-bar ${strength.score >= 1 ? strength.className : ''}`} />
                  <div className={`strength-bar ${strength.score >= 2 ? strength.className : ''}`} />
                  <div className={`strength-bar ${strength.score >= 3 ? strength.className : ''}`} />
                  <div className={`strength-bar ${strength.score >= 4 ? strength.className : ''}`} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--color-text-muted)' }}>
                  <span>Password strength</span>
                  <span style={{ fontWeight: 600, color: strength.score >= 3 ? 'var(--color-success)' : strength.score >= 2 ? 'var(--color-warning)' : 'var(--color-danger)' }}>
                    {strength.label}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Terms checkbox */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, margin: '4px 0' }}>
            <input
              type="checkbox"
              id="agree-terms"
              checked={form.agreeTerms}
              onChange={e => updateField('agreeTerms', e.target.checked)}
              style={{ marginTop: 3, cursor: 'pointer' }}
            />
            <label htmlFor="agree-terms" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.4, cursor: 'pointer' }}>
              I agree to the <span style={{ color: 'var(--color-text-primary)' }}>Terms of Service</span> and <span style={{ color: 'var(--color-text-primary)' }}>Privacy Policy</span>. Zero training on customer transcripts.
            </label>
          </div>
          {errors.agreeTerms && <span className="form-error">{errors.agreeTerms}</span>}

          <Button
            type="submit"
            variant="primary"
            loading={loading}
            icon={<ArrowRight size={15} />}
            style={{ width: '100%', marginTop: 6 }}
          >
            {loading ? 'Creating Account…' : 'Create Account'}
          </Button>
        </form>

        {/* Divider */}
        <div className="auth-divider">
          <span>Or sign up with</span>
        </div>

        {/* Social Mock Login */}
        <div className="auth-social-row">
          <button
            type="button"
            className="auth-social-btn"
            onClick={() => handleSocialMock('Google')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.4l3.7 2.9C6.5 7.4 9 5 12 5z"/>
              <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"/>
              <path fill="#FBBC05" d="M5.6 14.7c-.2-.7-.4-1.5-.4-2.7 0-1.1.2-2 .4-2.7L1.9 6.4C.7 8.8 0 10.3 0 12s.7 3.2 1.9 5.6l3.7-2.9z"/>
              <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2-6.4-4.8L1.9 16.4C3.7 20.3 7.5 23 12 23z"/>
            </svg>
            Google
          </button>
          <button
            type="button"
            className="auth-social-btn"
            onClick={() => handleSocialMock('GitHub')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
            </svg>
            GitHub
          </button>
        </div>

        {/* Security & Sign In Link */}
        <div style={{ textAlign: 'center', marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--color-border)' }}>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: 8 }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--color-accent)', fontWeight: 600, textDecoration: 'none' }}>
              Sign in
            </Link>
          </p>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--color-text-muted)' }}>
            <ShieldCheck size={12} color="var(--color-success)" /> Encrypted Enterprise Infrastructure
          </div>
        </div>
      </div>
    </div>
  );
}

