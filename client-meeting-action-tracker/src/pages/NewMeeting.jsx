import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, X, FileText, Plus, CheckCircle, Loader } from 'lucide-react';
import { Button, Input, Select, Textarea } from '../components/common/FormControls.jsx';
import { Modal } from '../components/common/Modal.jsx';
import { useToast } from '../components/common/ToastNotification.jsx';
import { getClients, createClient, extractActionItems, createMeeting } from '../services/api.js';
import { MOCK_REVIEW_ITEMS_M1 } from '../data/mockData.js';

const ALLOWED_TYPES = ['.txt', '.docx', '.pdf', '.vtt', '.srt'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export default function NewMeeting() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const fileInputRef = useRef(null);

  const [clients, setClients] = useState([]);
  const [form, setForm] = useState({
    clientId: '',
    title: '',
    date: new Date().toISOString().split('T')[0],
    attendees: '',
    transcript: '',
  });
  const [errors, setErrors] = useState({});
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stageMessage, setStageMessage] = useState('Initializing AI extraction pipeline...');
  const [showAddClient, setShowAddClient] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', contact: '', email: '' });
  const [addingClient, setAddingClient] = useState(false);

  useEffect(() => {
    getClients().then(setClients).catch(() => {});
  }, []);

  function updateForm(key, val) {
    setForm(f => ({ ...f, [key]: val }));
    setErrors(e => ({ ...e, [key]: '' }));
  }

  function validate() {
    const errs = {};
    if (!form.clientId) errs.clientId = 'Please select a client';
    if (!form.title.trim()) errs.title = 'Meeting title is required';
    if (!form.date) errs.date = 'Meeting date is required';
    if (!form.transcript.trim() && !file) {
      errs.transcript = 'Please provide a transcript or upload a file';
    }
    return errs;
  }

  function handleFileSelect(selectedFile) {
    if (!selectedFile) return;
    const ext = '.' + selectedFile.name.split('.').pop().toLowerCase();
    if (!ALLOWED_TYPES.includes(ext)) {
      addToast(`Unsupported file type. Allowed: ${ALLOWED_TYPES.join(', ')}`, 'error');
      return;
    }
    if (selectedFile.size > MAX_FILE_SIZE) {
      addToast('File exceeds the 10 MB limit', 'error');
      return;
    }
    setFile(selectedFile);
    setErrors(e => ({ ...e, transcript: '' }));

    // If it's a text file (txt, vtt, srt), load into transcript area automatically
    if (['.txt', '.vtt', '.srt'].includes(ext)) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target.result;
        if (text && !form.transcript.trim()) {
          setForm(f => ({ ...f, transcript: text }));
          addToast(`Loaded ${selectedFile.name} contents into transcript`, 'info');
        }
      };
      reader.readAsText(selectedFile);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFileSelect(dropped);
  }

  async function handleExtract(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setExtracting(true);
    setProgress(5);
    setStageMessage('Preparing transcript & context for AI extraction...');

    // Progress stage updates
    const progressInterval = setInterval(() => {
      setProgress(p => {
        const next = Math.min(p + Math.random() * 12 + 6, 92);
        if (next < 30) {
          setStageMessage('Chunking transcript & analyzing with Gemini AI...');
        } else if (next < 60) {
          setStageMessage('Extracting tasks, decisions, risks, and questions...');
        } else if (next < 85) {
          setStageMessage('Verifying verbatim evidence quotes against transcript...');
        } else {
          setStageMessage('Normalizing owners & relative deadlines...');
        }
        return next;
      });
    }, 450);

    try {
      const meeting = await createMeeting({
        clientId: form.clientId,
        clientName: clients.find(c => c.id === form.clientId)?.name || '',
        title: form.title,
        date: form.date,
        attendees: form.attendees.split(',').map(a => a.trim()).filter(Boolean),
        transcript: form.transcript,
      });

      setStageMessage('Running AI extraction engine...');
      await extractActionItems(meeting.id, form.transcript);
      clearInterval(progressInterval);
      setProgress(100);
      setStageMessage('Extraction and verification complete!');

      await new Promise(r => setTimeout(r, 400));

      addToast('Action items extracted and verified successfully', 'success');
      navigate(`/app/review/${meeting.id}`);
    } catch (err) {
      clearInterval(progressInterval);
      addToast('Extraction note: ' + err.message, 'error');
    } finally {
      setExtracting(false);
      setProgress(0);
    }
  }

  async function handleAddClient(e) {
    e.preventDefault();
    if (!newClient.name.trim()) return;
    setAddingClient(true);
    try {
      const created = await createClient(newClient);
      setClients(prev => [...prev, created]);
      setForm(f => ({ ...f, clientId: created.id }));
      setShowAddClient(false);
      setNewClient({ name: '', contact: '', email: '' });
      addToast(`Client "${created.name}" added`, 'success');
    } catch (err) {
      addToast('Failed to add client: ' + err.message, 'error');
    } finally {
      setAddingClient(false);
    }
  }

  return (
    <div className="page-container animate-fadeIn">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">New Meeting</h1>
          <p className="page-subtitle">Submit a meeting transcript to extract action items, decisions, risks, and open questions</p>
        </div>
      </div>

      <div style={{ maxWidth: 760 }}>
        <form onSubmit={handleExtract} noValidate>
          {/* Client section */}
          <div className="card" style={{ marginBottom: 'var(--spacing-4)' }}>
            <div className="card-header">
              <span className="card-title">Meeting Details</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 'var(--spacing-3)', alignItems: 'end' }}>
              <Select
                label="Client"
                required
                value={form.clientId}
                onChange={e => updateForm('clientId', e.target.value)}
                error={errors.clientId}
              >
                <option value="">Select a client…</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
              <Button
                variant="secondary"
                size="sm"
                icon={<Plus size={14} />}
                onClick={() => setShowAddClient(true)}
                type="button"
                style={{ marginBottom: errors.clientId ? 20 : 0 }}
              >
                Add client
              </Button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-4)', marginTop: 'var(--spacing-3)' }}>
              <Input
                label="Meeting Title"
                required
                placeholder="e.g. Q4 Product Review"
                value={form.title}
                onChange={e => updateForm('title', e.target.value)}
                error={errors.title}
              />
              <Input
                label="Meeting Date"
                type="date"
                required
                value={form.date}
                onChange={e => updateForm('date', e.target.value)}
                error={errors.date}
              />
            </div>

            <div style={{ marginTop: 'var(--spacing-3)' }}>
              <Input
                label="Attendees"
                placeholder="Sarah Chen, Tom Hargreaves, Emily Starks (optional, comma-separated)"
                value={form.attendees}
                onChange={e => updateForm('attendees', e.target.value)}
                hint="Optional — separate names with commas"
              />
            </div>
          </div>

          {/* Transcript section */}
          <div className="card" style={{ marginBottom: 'var(--spacing-4)' }}>
            <div className="card-header">
              <span className="card-title">Transcript</span>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                Paste text or upload a file
              </span>
            </div>

            <Textarea
              label="Meeting Transcript"
              placeholder="Paste your meeting transcript here…&#10;&#10;Speaker labels and timestamps are recommended (e.g. [00:01:23] Sarah: We need to...)&#10;&#10;The system will identify tasks, decisions, risks, and open questions."
              rows={12}
              value={form.transcript}
              onChange={e => updateForm('transcript', e.target.value)}
              error={errors.transcript}
            />

            <div style={{ marginTop: 'var(--spacing-4)' }}>
              <div className="form-label">Upload File</div>
              <div
                className={`file-upload-zone ${dragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
                aria-label="Upload transcript file"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.docx,.pdf,.vtt,.srt"
                  style={{ display: 'none' }}
                  onChange={e => handleFileSelect(e.target.files[0])}
                />
                {file ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--spacing-3)' }}>
                    <CheckCircle size={20} color="var(--color-success)" />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--color-success)' }}>{file.name}</div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                        {(file.size / 1024).toFixed(1)} KB
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setFile(null); }}
                      className="btn btn-ghost btn-icon btn-sm"
                      aria-label="Remove file"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div>
                    <Upload size={24} color="var(--color-text-muted)" style={{ margin: '0 auto 8px' }} />
                    <div style={{ fontWeight: 500, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                      Drop a file here or click to browse
                    </div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 4 }}>
                      TXT, DOCX, PDF (text-based), VTT, SRT · Max 10 MB
                    </div>
                  </div>
                )}
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 6 }}>
                Note: File contents are previewed for review. The AI extraction pipeline uses Google Gemini with zero-hallucination verification.
              </div>
            </div>
          </div>

          {/* Extraction progress */}
          {extracting && (
            <div className="card" style={{ marginBottom: 'var(--spacing-4)', borderColor: 'var(--color-accent)', background: 'var(--color-accent-light)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)' }}>
                  <Loader size={18} color="var(--color-accent)" style={{ animation: 'spin 1s linear infinite' }} />
                  <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--color-accent)' }}>
                    AI Extraction & Evidence Verification
                  </span>
                </div>
                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-accent)' }}>
                  {Math.round(progress)}%
                </span>
              </div>
              <div style={{ background: 'var(--color-border)', borderRadius: 'var(--radius-full)', height: 6, overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${progress}%`,
                    background: 'var(--color-accent)',
                    borderRadius: 'var(--radius-full)',
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 8 }}>
                {stageMessage}
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-3)' }}>
            <Button variant="secondary" type="button" onClick={() => navigate('/app/dashboard')}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              loading={extracting}
              icon={<FileText size={16} />}
            >
              {extracting ? 'Extracting…' : 'Extract Action Items'}
            </Button>
          </div>
        </form>
      </div>

      {/* Add Client Modal */}
      <Modal
        isOpen={showAddClient}
        onClose={() => setShowAddClient(false)}
        title="Add New Client"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowAddClient(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleAddClient} loading={addingClient}>Add Client</Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
          <Input
            label="Company Name"
            required
            placeholder="e.g. Acme Corporation"
            value={newClient.name}
            onChange={e => setNewClient(c => ({ ...c, name: e.target.value }))}
          />
          <Input
            label="Primary Contact"
            placeholder="e.g. Jane Doe"
            value={newClient.contact}
            onChange={e => setNewClient(c => ({ ...c, contact: e.target.value }))}
          />
          <Input
            label="Email"
            type="email"
            placeholder="e.g. jane@example.com"
            value={newClient.email}
            onChange={e => setNewClient(c => ({ ...c, email: e.target.value }))}
          />
        </div>
      </Modal>
    </div>
  );
}

