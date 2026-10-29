import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Download, FileText, FileSpreadsheet, Table as TableIcon, Code,
  AlertTriangle, Eye, RotateCcw, Building2, Calendar, CheckCircle2, HelpCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table as DocxTable,
  TableRow,
  TableCell,
  WidthType,
} from 'docx';
import { Button, Select } from '../components/common/FormControls.jsx';
import { StatusBadge, ConfidenceBadge, TypeBadge } from '../components/common/Badges.jsx';
import { useToast } from '../components/common/ToastNotification.jsx';
import { getMeetings, getReviewItems, exportMeeting, getMeetingById } from '../services/api.js';
import { LoadingState } from '../components/common/States.jsx';

const FORMATS = [
  {
    id: 'xlsx',
    label: 'Excel (.xlsx)',
    icon: FileSpreadsheet,
    description: 'Professional workbook with 5 sheets (Tasks, Decisions, Risks, Questions, README), column filters, freeze panes, and formatting.',
  },
  {
    id: 'csv',
    label: 'CSV (.csv)',
    icon: TableIcon,
    description: 'UTF-8 encoded comma-separated values with formula injection safeguards and configurable columns.',
  },
  {
    id: 'docx',
    label: 'Word Minutes (.docx)',
    icon: FileText,
    description: 'Formatted meeting minutes with title block, summary, decision statements, action tables, and reviewer signature block.',
  },
  {
    id: 'json',
    label: 'Structured JSON (.json)',
    icon: Code,
    description: 'Schema-versioned (v1.0) JSON preserving exact uncertainty states, verbatim quotes, and review metadata.',
  },
];

const DEFAULT_COLUMNS = [
  { id: 'id', label: 'Task ID', selected: true },
  { id: 'description', label: 'Task Description', selected: true },
  { id: 'owner', label: 'Owner', selected: true },
  { id: 'owner_state', label: 'Owner Status', selected: true },
  { id: 'due_date', label: 'Due Date', selected: true },
  { id: 'raw_date_wording', label: 'Due Date as Said', selected: true },
  { id: 'priority', label: 'Priority', selected: true },
  { id: 'status', label: 'Review Status', selected: true },
  { id: 'confidence', label: 'Confidence', selected: true },
  { id: 'evidence', label: 'Evidence Quote', selected: false },
  { id: 'clarification_needed', label: 'Clarification Needed', selected: false },
];

export default function ExportPage() {
  const [searchParams] = useSearchParams();
  const { addToast } = useToast();

  const [meetings, setMeetings] = useState([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState(searchParams.get('meetingId') || '');
  const [selectedMeeting, setSelectedMeeting] = useState(null);

  const [format, setFormat] = useState('xlsx');
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);
  const [statusFilter, setStatusFilter] = useState('accepted');
  const [reviewerName, setReviewerName] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  // Load meetings list on mount
  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const mtgs = await getMeetings();
        setMeetings(mtgs);
        const initialId = searchParams.get('meetingId') || (mtgs[0]?.id || 'm1');
        setSelectedMeetingId(initialId);
      } catch (err) {
        addToast('Failed to load meetings: ' + err.message, 'error');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [searchParams]);

  // Load items whenever selected meeting changes
  useEffect(() => {
    if (!selectedMeetingId) return;
    async function loadMeetingItems() {
      try {
        const [mtgItems, mtgDetails] = await Promise.all([
          getReviewItems(selectedMeetingId),
          getMeetingById(selectedMeetingId).catch(() => null),
        ]);
        setItems(mtgItems);
        setSelectedMeeting(mtgDetails || meetings.find(m => m.id === selectedMeetingId));
      } catch (err) {
        addToast('Failed to load meeting items: ' + err.message, 'error');
      }
    }
    loadMeetingItems();
  }, [selectedMeetingId, meetings]);

  const tasks = items.filter(i => i.type === 'task');
  const decisions = items.filter(i => i.type === 'decision');
  const risks = items.filter(i => i.type === 'risk');
  const questions = items.filter(i => i.type === 'open_question');

  const exportableItems = items.filter(i => {
    if (statusFilter === 'accepted') return i.reviewStatus === 'accepted';
    if (statusFilter === 'all_reviewed') return ['accepted', 'rejected', 'merged'].includes(i.reviewStatus);
    return true;
  });

  const selectedColumns = columns.filter(c => c.selected);

  function toggleColumn(id) {
    setColumns(prev => prev.map(c => c.id === id ? { ...c, selected: !c.selected } : c));
  }

  function handleColumnLabelChange(id, newLabel) {
    setColumns(prev => prev.map(c => c.id === id ? { ...c, label: newLabel } : c));
  }

  function resetColumns() {
    setColumns(DEFAULT_COLUMNS);
    addToast('Reset columns to default tracker layout', 'info');
  }

  // Build row data respecting "Not stated" rules
  function buildRows(sourceItems) {
    return sourceItems.map(item => {
      const row = {};
      selectedColumns.forEach(col => {
        if (col.id === 'owner') {
          row[col.label] = item.owner || 'Not stated';
        } else if (col.id === 'due_date' || col.id === 'dueDate') {
          row[col.label] = item.dueDate
            ? new Date(item.dueDate).toLocaleDateString('en-GB')
            : '';
        } else if (col.id === 'raw_date_wording' || col.id === 'rawDateWording') {
          row[col.label] = item.rawDateWording || '';
        } else if (col.id === 'owner_state' || col.id === 'ownerStatus') {
          row[col.label] = item.ownerStatus || 'not_stated';
        } else if (col.id === 'status' || col.id === 'reviewStatus') {
          row[col.label] = item.reviewStatus || 'needs_review';
        } else if (col.id === 'evidence' || col.id === 'evidenceQuote') {
          row[col.label] = item.evidenceQuote || '';
        } else if (col.id === 'clarification_needed') {
          row[col.label] = (item.clarificationNeeded || []).join(', ');
        } else {
          row[col.label] = item[col.id] ?? '';
        }
      });
      return row;
    });
  }

  async function handleExport() {
    if (!selectedMeetingId) {
      addToast('Please select a meeting to export.', 'warning');
      return;
    }

    if (exportableItems.length === 0) {
      addToast('No items matching current scope to export. Please adjust filter or review items.', 'warning');
      return;
    }

    const needsReviewCount = items.filter(i => i.reviewStatus === 'needs_review').length;
    if (needsReviewCount > 0 && statusFilter === 'accepted') {
      addToast(`${needsReviewCount} item(s) still need review and are excluded from approved export.`, 'warning');
    }

    setExporting(true);
    try {
      const res = await exportMeeting(selectedMeetingId, {
        format,
        statusFilter,
        columnMapping: selectedColumns,
        reviewerName: reviewerName || null,
        includeTranscript: false,
      });

      if (res?.isMock) {
        // Fallback to client-side export generation when in mock mode
        const rows = buildRows(exportableItems);
        const filename = `${selectedMeeting?.clientName || 'Client'}_${selectedMeeting?.title || 'Meeting'}_${new Date().toISOString().slice(0, 10)}`;

        if (format === 'xlsx') {
          await exportXlsx(rows, filename);
        } else if (format === 'csv') {
          exportCsv(rows, filename);
        } else if (format === 'json') {
          exportJson(exportableItems, filename);
        } else if (format === 'docx') {
          await exportDocx(exportableItems, filename);
        }
      }

      addToast(`Successfully downloaded meeting export as ${format.toUpperCase()}`, 'success');
    } catch (err) {
      addToast('Export failed: ' + err.message, 'error');
    } finally {
      setExporting(false);
    }
  }

  // Client-side fallback generators for mock demonstration mode
  async function exportXlsx(rows, filename) {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tasks');

    const colWidths = selectedColumns.map(col => ({
      wch: Math.max(col.label.length + 4, 18),
    }));
    ws['!cols'] = colWidths;
    XLSX.writeFile(wb, `${filename}.xlsx`);
  }

  function exportCsv(rows, filename) {
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const csvContent = [
      headers.join(','),
      ...rows.map(row =>
        headers.map(h => {
          let val = String(row[h] ?? '').replace(/"/g, '""');
          if (val && ['=', '+', '-', '@'].includes(val[0])) val = "'" + val;
          return val.includes(',') || val.includes('"') || val.includes('\n') ? `"${val}"` : val;
        }).join(',')
      ),
    ].join('\n');
    downloadBlob(csvContent, `${filename}.csv`, 'text/csv;charset=utf-8;');
  }

  function exportJson(itemsList, filename) {
    const data = {
      schema_version: '1.0',
      exported_at: new Date().toISOString(),
      client: { name: selectedMeeting?.clientName || 'Acme Corp' },
      meeting: { id: selectedMeetingId, title: selectedMeeting?.title || 'Meeting' },
      total_items: itemsList.length,
      items: itemsList.map(item => ({
        id: item.id,
        type: item.type,
        description: item.description,
        owner: item.owner ?? null,
        owner_status: item.ownerStatus || 'not_stated',
        due_date: item.dueDate ?? null,
        due_date_status: item.dueDateStatus || 'not_stated',
        raw_date_wording: item.rawDateWording ?? null,
        confidence: item.confidence,
        review_status: item.reviewStatus,
        evidence_quote: item.evidenceQuote,
      })),
    };
    downloadBlob(JSON.stringify(data, null, 2), `${filename}.json`, 'application/json');
  }

  async function exportDocx(itemsList, filename) {
    const docTasks = itemsList.filter(i => i.type === 'task');
    const docDecisions = itemsList.filter(i => i.type === 'decision');
    const docRisks = itemsList.filter(i => i.type === 'risk');
    const docQuestions = itemsList.filter(i => i.type === 'open_question');

    function makeItemRows(sectionItems) {
      if (sectionItems.length === 0) {
        return [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 100, type: WidthType.PERCENTAGE },
                children: [new Paragraph({ text: "None recorded." })],
              }),
            ],
          }),
        ];
      }
      return sectionItems.map(it => {
        const ownerText = it.owner || "Not stated";
        const dateText = it.dueDate ? new Date(it.dueDate).toLocaleDateString("en-GB") : (it.rawDateWording || "Not stated");
        return new TableRow({
          children: [
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              children: [new Paragraph({ text: it.description || it.statement || it.question })],
            }),
            new TableCell({
              width: { size: 25, type: WidthType.PERCENTAGE },
              children: [new Paragraph({ text: `Owner: ${ownerText}` })],
            }),
            new TableCell({
              width: { size: 25, type: WidthType.PERCENTAGE },
              children: [new Paragraph({ text: `Due: ${dateText}` })],
            }),
          ],
        });
      });
    }

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              text: `${selectedMeeting?.title || "Meeting"} — Minutes & Action Tracker`,
              heading: HeadingLevel.HEADING_1,
              spacing: { after: 150 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Client: ${selectedMeeting?.clientName || "Client"} | Export Date: ${new Date().toLocaleDateString("en-GB")}`,
                  italics: true,
                }),
              ],
              spacing: { after: 250 },
            }),
            new Paragraph({
              text: "Action Items & Tasks",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 200, after: 100 },
            }),
            new DocxTable({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: makeItemRows(docTasks),
            }),
            new Paragraph({
              text: "Key Decisions",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 250, after: 100 },
            }),
            new DocxTable({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: makeItemRows(docDecisions),
            }),
            new Paragraph({
              text: "Identified Risks",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 250, after: 100 },
            }),
            new DocxTable({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: makeItemRows(docRisks),
            }),
            new Paragraph({
              text: "Open Questions",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 250, after: 100 },
            }),
            new DocxTable({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: makeItemRows(docQuestions),
            }),
            new Paragraph({
              text: `Generated from meeting notes and reviewed by ${reviewerName || "Designated Reviewer"}.`,
              spacing: { before: 300 },
            }),
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    downloadBlob(blob, `${filename}.docx`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  }

  function downloadBlob(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const needsReview = items.filter(i => i.reviewStatus === 'needs_review');
  const missingOwnerCount = tasks.filter(t => !t.owner || t.ownerStatus === 'not_stated').length;
  const missingDeadlineCount = tasks.filter(t => !t.dueDate).length;

  return (
    <div className="page-container animate-fadeIn">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Export Action Tracker</h1>
          <p className="page-subtitle">
            Download verified and reviewed meeting actions in Excel, CSV, Word, or JSON formats
          </p>
        </div>
      </div>

      {loading ? (
        <LoadingState message="Loading meeting records…" />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 'var(--spacing-6)', alignItems: 'start' }}>
          {/* Left: Configuration Panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
            
            {/* Target Meeting Selector */}
            <div className="card">
              <div className="card-title" style={{ marginBottom: 'var(--spacing-3)' }}>Target Meeting</div>
              <Select
                value={selectedMeetingId}
                onChange={e => setSelectedMeetingId(e.target.value)}
              >
                {meetings.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.clientName ? `${m.clientName} — ` : ''}{m.title}
                  </option>
                ))}
              </Select>
              {selectedMeeting && (
                <div style={{ marginTop: 'var(--spacing-2)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', display: 'flex', gap: 'var(--spacing-3)' }}>
                  <span><Building2 size={12} style={{ display: 'inline', verticalAlign: -1 }} /> {selectedMeeting.clientName || 'Acme Corp'}</span>
                  <span><Calendar size={12} style={{ display: 'inline', verticalAlign: -1 }} /> {selectedMeeting.date || 'Unspecified'}</span>
                </div>
              )}
            </div>

            {/* Format selection */}
            <div className="card">
              <div className="card-title" style={{ marginBottom: 'var(--spacing-4)' }}>Export Format</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)' }}>
                {FORMATS.map(f => {
                  const Icon = f.icon;
                  const isSelected = format === f.id;
                  return (
                    <label
                      key={f.id}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 'var(--spacing-3)',
                        padding: 'var(--spacing-3)',
                        border: `1px solid ${isSelected ? 'var(--color-accent)' : 'var(--color-border)'}`,
                        borderRadius: 'var(--radius-base)',
                        cursor: 'pointer',
                        background: isSelected ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                        boxShadow: isSelected ? '0 0 15px rgba(99, 102, 241, 0.2)' : 'none',
                        transition: 'all var(--transition-base)',
                      }}
                    >
                      <input
                        type="radio"
                        name="format"
                        value={f.id}
                        checked={isSelected}
                        onChange={() => setFormat(f.id)}
                        style={{ marginTop: 2 }}
                      />
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Icon size={14} color={isSelected ? 'var(--color-accent)' : 'var(--color-text-secondary)'} />
                          <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: isSelected ? 'var(--color-accent)' : 'var(--color-text-primary)' }}>
                            {f.label}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2, lineHeight: 1.4 }}>
                          {f.description}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Scope & Reviewer */}
            <div className="card">
              <div className="card-title" style={{ marginBottom: 'var(--spacing-3)' }}>Export Scope & Reviewer</div>
              <Select
                label="Item review status filter"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="accepted">Accepted items only (PRD Recommended)</option>
                <option value="all_reviewed">All reviewed (Accepted, Rejected, Merged)</option>
                <option value="all">All items (Including unreviewed items)</option>
              </Select>

              {format === 'docx' && (
                <div style={{ marginTop: 'var(--spacing-3)' }}>
                  <label className="form-label" style={{ fontSize: 'var(--font-size-xs)' }}>Reviewer Name (for minutes footer)</label>
                  <input
                    type="text"
                    className="input input-sm"
                    placeholder="e.g. Jane Doe, Project Lead"
                    value={reviewerName}
                    onChange={e => setReviewerName(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>
              )}
            </div>

            {/* Column Mapping for Excel & CSV */}
            {(format === 'xlsx' || format === 'csv') && (
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-3)' }}>
                  <span className="card-title">Column Mapping</span>
                  <button
                    onClick={resetColumns}
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 11, padding: '2px 6px' }}
                    title="Reset to PRD default column layout"
                  >
                    <RotateCcw size={11} style={{ marginRight: 4 }} /> Reset
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)', maxHeight: 220, overflowY: 'auto' }}>
                  {columns.map(col => (
                    <div key={col.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                      <input
                        type="checkbox"
                        checked={col.selected}
                        onChange={() => toggleColumn(col.id)}
                      />
                      <input
                        type="text"
                        className="input input-sm"
                        value={col.label}
                        onChange={e => handleColumnLabelChange(col.id, e.target.value)}
                        style={{ fontSize: 12, padding: '3px 8px', flex: 1 }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Validation & Uncertainty Warnings */}
            {needsReview.length > 0 && statusFilter === 'accepted' && (
              <div style={{
                background: 'var(--color-warning-bg)',
                border: '1px solid var(--color-warning-border)',
                borderRadius: 'var(--radius-base)',
                padding: 'var(--spacing-3)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <AlertTriangle size={14} color="var(--color-warning)" />
                  <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-warning)' }}>
                    Review Required Warning
                  </span>
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-warning)', lineHeight: 1.4 }}>
                  • {needsReview.length} item(s) are still in <strong>Needs Review</strong> and will be excluded from the approved export tracker.
                </div>
              </div>
            )}

            {/* Export Action */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)' }}>
              <Button
                variant="primary"
                icon={<Download size={16} />}
                onClick={handleExport}
                loading={exporting}
                disabled={exporting}
              >
                {exporting ? 'Generating export…' : `Download ${format.toUpperCase()}`}
              </Button>
            </div>
          </div>

          {/* Right: Summary Metrics & Data Preview */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
            
            {/* Quick Metrics Bar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--spacing-3)' }}>
              <div className="card" style={{ padding: 'var(--spacing-3) var(--spacing-4)', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tasks</div>
                <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-text-primary)' }}>{tasks.length}</div>
              </div>
              <div className="card" style={{ padding: 'var(--spacing-3) var(--spacing-4)', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Decisions</div>
                <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-text-primary)' }}>{decisions.length}</div>
              </div>
              <div className="card" style={{ padding: 'var(--spacing-3) var(--spacing-4)', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Risks</div>
                <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-text-primary)' }}>{risks.length}</div>
              </div>
              <div className="card" style={{ padding: 'var(--spacing-3) var(--spacing-4)', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Questions</div>
                <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-text-primary)' }}>{questions.length}</div>
              </div>
            </div>

            {/* Table Preview */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{
                padding: 'var(--spacing-4) var(--spacing-5)',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <span className="card-title">Live Export Data Preview</span>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  {exportableItems.length} items included · {selectedColumns.length} columns active
                </span>
              </div>
              
              <div style={{ overflowX: 'auto', maxHeight: 460, overflowY: 'auto' }}>
                {exportableItems.length === 0 ? (
                  <div style={{ padding: 'var(--spacing-8)', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                    No items match your current status filter for this meeting.<br />Accept items in the Review screen to include them in the final tracker.
                  </div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        {selectedColumns.map(col => <th key={col.id}>{col.label}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {exportableItems.slice(0, 25).map(item => {
                        const rows = buildRows([item])[0];
                        return (
                          <tr key={item.id}>
                            {selectedColumns.map(col => (
                              <td key={col.id} style={{ maxWidth: 220 }}>
                                {col.id === 'status' || col.id === 'reviewStatus' ? (
                                  <StatusBadge status={item.reviewStatus} />
                                ) : col.id === 'confidence' ? (
                                  <ConfidenceBadge level={item.confidence} />
                                ) : col.id === 'type' ? (
                                  <TypeBadge type={item.type} />
                                ) : col.id === 'owner' && !item.owner ? (
                                  <span style={{ color: 'var(--color-warning)', fontStyle: 'italic', fontSize: 'var(--font-size-xs)' }}>Not stated</span>
                                ) : (col.id === 'due_date' || col.id === 'dueDate') && !item.dueDate ? (
                                  <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic', fontSize: 'var(--font-size-xs)' }}>—</span>
                                ) : (
                                  <span className="text-truncate" style={{ display: 'block', maxWidth: 220, fontSize: 'var(--font-size-xs)' }}>
                                    {rows[col.label] || '—'}
                                  </span>
                                )}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
              {exportableItems.length > 25 && (
                <div style={{
                  padding: 'var(--spacing-3) var(--spacing-5)',
                  borderTop: '1px solid var(--color-border)',
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-secondary)',
                }}>
                  Showing first 25 of {exportableItems.length} items. All items will be included in the downloaded file.
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
