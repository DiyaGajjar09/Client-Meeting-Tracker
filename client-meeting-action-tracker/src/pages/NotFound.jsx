import { useNavigate, Link } from 'react-router-dom';
import { Compass, ArrowLeft, LayoutDashboard, Home } from 'lucide-react';
import { Button } from '../components/common/FormControls.jsx';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: '80vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      textAlign: 'center',
    }}>
      <div style={{ maxWidth: 460 }}>
        <div style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.5rem',
          color: 'var(--color-accent)',
        }}>
          <Compass size={32} />
        </div>

        <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
          404 Error
        </div>

        <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '12px' }}>
          Page Not Found
        </h1>

        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: '2rem' }}>
          The link you followed may be broken, or the page may have been moved or archived. Use the navigation buttons below to return to safety.
        </p>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Button
            variant="secondary"
            icon={<Home size={14} />}
            onClick={() => navigate('/')}
          >
            Return Home
          </Button>

          <Button
            variant="primary"
            icon={<LayoutDashboard size={14} />}
            onClick={() => navigate('/app/dashboard')}
          >
            Go to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}

