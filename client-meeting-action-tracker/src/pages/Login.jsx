import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Zap, Lock, Mail, Eye, EyeOff, ArrowLeft, ArrowRight,
  ShieldCheck, Sparkles, CheckCircle2, AlertCircle
} from 'lucide-react';
import { Button, Input } from '../components/common/FormControls.jsx';
import { Modal } from '../components/common/Modal.jsx';
import { useToast } from '../components/common/ToastNotification.jsx';
import { login, quickDemoLogin } from '../services/auth.js';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useToast();

  const [email, setEmail] = useState('jane.doe@company.com');
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Forgot Password Modal State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  const validate = () => {
    const errs = {};
    if (!email.trim()) {
      errs.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = 'Please provide a valid email address';
    }

    if (!password) {
      errs.password = 'Password is required';
    } else if (password.length < 6) {
      errs.password = 'Password must be at least 6 characters';
    }
    return errs;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setLoading(true);
    setErrors({});
    try {
      const res = await login({ email, password });
      addToast(`Welcome back, ${res.user.name}!`, 'success');
      navigate('/app/dashboard');
    } catch (err) {
      setErrors({ form: err.message });
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = async () => {
    setDemoLoading(true);
    try {
      const res = await quickDemoLogin();
      addToast(`Logged in as demo user (${res.user.name})`, 'success');
      navigate('/app/dashboard');
    } catch (err) {
      addToast('Demo login error: ' + err.message, 'error');
    } finally {
      setDemoLoading(false);
    }
  };

  const handleSocialMock = async (provider) => {
    setLoading(true);
    try {
      await quickDemoLogin();
      addToast(`Authenticated via ${provider}`, 'success');
      navigate('/app/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    if (!forgotEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forgotEmail)) {
      addToast('Please enter a valid email address', 'error');
      return;
    }
    setForgotLoading(true);
    await new Promise(r => setTimeout(r, 600));
    setForgotLoading(false);
    setForgotSent(true);
    addToast('Password reset instructions sent', 'success');
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
        <h1 className="auth-title">Welcome Back</h1>
        <p className="auth-subtitle">
          Sign in to access your meeting transcripts, reviewed items, and exported trackers.
        </p>

        {/* Auth Mode Tabs */}
        <div className="auth-tabs">
          <button className="auth-tab active" type="button">
            Sign In
          </button>
          <Link to="/signup" className="auth-tab">
            Create Account
          </Link>
        </div>

        {/* 1-Click Quick Demo Banner */}
        <div className="auth-demo-banner">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 'var(--font-size-xs)', fontWeight: 600, color: '#c7d2fe' }}>
              <Sparkles size={13} color="var(--color-accent)" /> 1-Click Demo Access
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
              Explore as Workspace Admin (Jane Doe)
            </div>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleQuickDemo}
            disabled={demoLoading || loading}
            style={{ whiteSpace: 'nowrap' }}
          >
            {demoLoading ? 'Signing in…' : 'Quick Demo'}
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
        <form onSubmit={handleLogin} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">Work Email</label>
            <div style={{ position: 'relative' }}>
              <input
                id="login-email"
                type="email"
                className={`input ${errors.email ? 'error' : ''}`}
                placeholder="name@company.com"
                value={email}
                onChange={e => {
                  setEmail(e.target.value);
                  setErrors(prev => ({ ...prev, email: '', form: '' }));
                }}
                style={{ paddingLeft: '2.25rem' }}
                autoComplete="email"
                required
              />
              <Mail size={15} color="var(--color-text-muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            </div>
            {errors.email && <span className="form-error">{errors.email}</span>}
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label" htmlFor="login-password">Password</label>
              <button
                type="button"
                onClick={() => {
                  setForgotEmail(email);
                  setForgotSent(false);
                  setShowForgotModal(true);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-accent)',
                  fontSize: 'var(--font-size-xs)',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Forgot password?
              </button>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                className={`input ${errors.password ? 'error' : ''}`}
                placeholder="••••••••"
                value={password}
                onChange={e => {
                  setPassword(e.target.value);
                  setErrors(prev => ({ ...prev, password: '', form: '' }));
                }}
                style={{ paddingLeft: '2.25rem', paddingRight: '2.25rem' }}
                autoComplete="current-password"
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
          </div>

          {/* Remember me checkbox */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0' }}>
            <input
              type="checkbox"
              id="remember-me"
              checked={rememberMe}
              onChange={e => setRememberMe(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <label htmlFor="remember-me" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
              Keep me signed in for 30 days
            </label>
          </div>

          <Button
            type="submit"
            variant="primary"
            loading={loading}
            icon={<ArrowRight size={15} />}
            style={{ width: '100%', marginTop: 6 }}
          >
            {loading ? 'Signing In…' : 'Sign In'}
          </Button>
        </form>

        {/* Divider */}
        <div className="auth-divider">
          <span>Or continue with</span>
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

        {/* Security & Sign Up Link */}
        <div style={{ textAlign: 'center', marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--color-border)' }}>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: 8 }}>
            Don't have an account?{' '}
            <Link to="/signup" style={{ color: 'var(--color-accent)', fontWeight: 600, textDecoration: 'none' }}>
              Sign up for free
            </Link>
          </p>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--color-text-muted)' }}>
            <ShieldCheck size={12} color="var(--color-success)" /> TLS 256-Bit Encrypted SaaS Sandbox
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowForgotModal(false)}
          title="Reset your password"
          size="sm"
          footer={
            forgotSent ? (
              <Button variant="primary" onClick={() => setShowForgotModal(false)}>Done</Button>
            ) : (
              <>
                <Button variant="secondary" onClick={() => setShowForgotModal(false)}>Cancel</Button>
                <Button variant="primary" onClick={handleForgotSubmit} loading={forgotLoading}>Send Reset Link</Button>
              </>
            )
          }
        >
          {forgotSent ? (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <CheckCircle2 size={36} color="var(--color-success)" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 6 }}>
                Check your inbox
              </h3>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                We've sent password reset instructions to <strong>{forgotEmail}</strong>. Follow the link in the email to set a new password.
              </p>
            </div>
          ) : (
            <form onSubmit={handleForgotSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                Enter the work email address associated with your account, and we will send you a secure link to reset your credentials.
              </p>
              <div className="form-group">
                <label className="form-label" htmlFor="forgot-email">Email Address</label>
                <input
                  id="forgot-email"
                  type="email"
                  className="input"
                  placeholder="name@company.com"
                  value={forgotEmail}
                  onChange={e => setForgotEmail(e.target.value)}
                  required
                />
              </div>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
}

