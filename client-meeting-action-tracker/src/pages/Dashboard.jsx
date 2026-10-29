import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, PlusCircle, ClipboardList, AlertTriangle,
  HelpCircle, Users, Calendar, ExternalLink, TrendingUp, Clock
} from 'lucide-react';
import { getDashboardStats, getMeetings } from '../services/api.js';
import { LoadingState, ErrorMessage } from '../components/common/States.jsx';
import { StatusBadge } from '../components/common/Badges.jsx';
import { Button } from '../components/common/FormControls.jsx';

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [s, m] = await Promise.all([getDashboardStats(), getMeetings()]);
        setStats(s);
        setMeetings(m.slice(0, 5));
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div className="page-container"><LoadingState message="Loading dashboard..." /></div>;
  if (error) return <div className="page-container"><ErrorMessage message={error} onRetry={() => window.location.reload()} /></div>;

  const statCards = [
    {
      label: 'Meetings Processed',
      value: stats.totalMeetings,
      icon: LayoutDashboard,
      iconBg: 'var(--color-accent-light)',
      iconColor: 'var(--color-accent)',
    },
    {
      label: 'Tasks Awaiting Review',
      value: stats.tasksAwaitingReview,
      icon: ClipboardList,
      iconBg: 'var(--color-warning-bg)',
      iconColor: 'var(--color-warning)',
    },
    {
      label: 'Missing Owner / Deadline',
      value: stats.tasksMissingOwner + stats.tasksMissingDeadline,
      icon: Users,
      iconBg: 'var(--color-danger-bg)',
      iconColor: 'var(--color-danger)',
    },
    {
      label: 'Open Risks',
      value: stats.openRisks,
      icon: AlertTriangle,
      iconBg: 'var(--color-warning-bg)',
      iconColor: 'var(--color-warning)',
    },
    {
      label: 'Unanswered Questions',
      value: stats.unansweredQuestions,
      icon: HelpCircle,
      iconBg: 'var(--color-info-bg)',
      iconColor: 'var(--color-info)',
    },
  ];

  return (
    <div className="page-container animate-fadeIn">
      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Overview of all processed meetings and outstanding action items</p>
        </div>
        <div className="page-actions">
          <Button
            variant="primary"
            icon={<PlusCircle size={16} />}
            onClick={() => navigate('/app/new-meeting')}
          >
            New Meeting
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-row">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="stat-card">
              <div
                className="stat-card-icon"
                style={{ background: card.iconBg }}
              >
                <Icon size={16} color={card.iconColor} />
              </div>
              <div className="stat-number">{card.value}</div>
              <div className="stat-label">{card.label}</div>
            </div>
          );
        })}
      </div>

      {/* Attention Required */}
      {(stats.tasksMissingOwner > 0 || stats.unansweredQuestions > 0) && (
        <div className="card" style={{ marginBottom: 'var(--spacing-6)', borderColor: 'var(--color-warning-border)', background: 'var(--color-warning-bg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)' }}>
            <AlertTriangle size={16} color="var(--color-warning)" />
            <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--color-warning)' }}>
              Action required
            </span>
          </div>
          <ul style={{ marginTop: 'var(--spacing-2)', paddingLeft: 'var(--spacing-5)', listStyle: 'disc' }}>
            {stats.tasksMissingOwner > 0 && (
              <li style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', marginTop: 4 }}>
                {stats.tasksMissingOwner} task{stats.tasksMissingOwner !== 1 ? 's' : ''} with no assigned owner
              </li>
            )}
            {stats.tasksMissingDeadline > 0 && (
              <li style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', marginTop: 4 }}>
                {stats.tasksMissingDeadline} task{stats.tasksMissingDeadline !== 1 ? 's' : ''} with no confirmed deadline
              </li>
            )}
            {stats.unansweredQuestions > 0 && (
              <li style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', marginTop: 4 }}>
                {stats.unansweredQuestions} open question{stats.unansweredQuestions !== 1 ? 's' : ''} pending clarification
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Recent Meetings */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Recent Meetings</span>
          <Button variant="ghost" size="sm" onClick={() => navigate('/app/history')}>
            View all
          </Button>
        </div>

        {meetings.length === 0 ? (
          <div style={{ padding: 'var(--spacing-8)', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
            No meetings yet. <button className="btn btn-ghost btn-sm" style={{ display: 'inline', padding: '0 4px' }} onClick={() => navigate('/app/new-meeting')}>Submit your first meeting</button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Meeting</th>
                  <th>Date</th>
                  <th>Tasks</th>
                  <th>Outstanding</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {meetings.map(m => (
                  <tr key={m.id}>
                    <td>
                      <span style={{ fontWeight: 500, fontSize: 'var(--font-size-sm)' }}>{m.clientName}</span>
                    </td>
                    <td style={{ fontWeight: 500 }}>{m.title}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-text-secondary)' }}>
                        <Calendar size={12} />
                        <span>{new Date(m.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      </div>
                    </td>
                    <td>{m.taskCount}</td>
                    <td>
                      {m.outstandingItems > 0 ? (
                        <span style={{ color: 'var(--color-warning)', fontWeight: 500 }}>{m.outstandingItems}</span>
                      ) : (
                        <span style={{ color: 'var(--color-success)' }}>0</span>
                      )}
                    </td>
                    <td><StatusBadge status={m.status} /></td>
                    <td>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<ExternalLink size={12} />}
                        onClick={() => navigate(`/app/review/${m.id}`)}
                      >
                        Open
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-4)', marginTop: 'var(--spacing-6)' }}>
        <QuickAction
          icon={<ClipboardList size={18} />}
          title="Review Items"
          description="Review and accept extracted tasks, risks, and decisions"
          onClick={() => navigate('/app/review/m1')}
        />
        <QuickAction
          icon={<HelpCircle size={18} />}
          title="Clarification Needed"
          description="Items with missing owners or deadlines requiring follow-up"
          onClick={() => navigate('/app/clarification')}
        />
        <QuickAction
          icon={<AlertTriangle size={18} />}
          title="Possible Duplicates"
          description="Review flagged duplicate tasks across meetings"
          onClick={() => navigate('/app/duplicates')}
        />
      </div>
    </div>
  );
}

function QuickAction({ icon, title, description, onClick }) {
  return (
    <button
      className="card"
      onClick={onClick}
      style={{
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'all var(--transition-base)',
        fontFamily: 'inherit',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-accent)';
        e.currentTarget.style.boxShadow = '0 0 25px rgba(99, 102, 241, 0.2)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-border)';
        e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div style={{
        width: 36,
        height: 36,
        borderRadius: 'var(--radius-base)',
        background: 'rgba(99, 102, 241, 0.12)',
        border: '1px solid rgba(99, 102, 241, 0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--color-accent)',
        marginBottom: 'var(--spacing-3)',
      }}>
        {icon}
      </div>
      <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>{description}</div>
    </button>
  );
}

