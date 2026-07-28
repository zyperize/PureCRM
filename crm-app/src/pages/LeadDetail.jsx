import { useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Phone, Mail, MapPin, Globe, ArrowLeft, Edit2,
  MessageSquare, Loader2, Send, Package, CheckCircle2, Trash2
} from 'lucide-react';
import { leadsService } from '../services/leadsService';
import { notesService } from '../services/notesService';
import { tasksService } from '../services/tasksService';
import { emailService } from '../services/emailService';
import { audienceService } from '../services/audienceService';
import { invalidateLeadWorkspace } from '../utils/queryInvalidation';
import toast from 'react-hot-toast';
import QuestionsWidget from '../components/qualification/QuestionsWidget';
import DialerModal from '../components/calling/DialerModal';
import TaskManager from '../components/tasks/TaskManager';
import EditLeadModal from '../components/leads/EditLeadModal';

export default function LeadDetail() {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState('activity');
  const [isDialerOpen, setIsDialerOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [samplesDraft, setSamplesDraft] = useState({ open: false, tracking: '' });
  const [markWonDraft, setMarkWonDraft] = useState({ open: false, amount: '' });
  const [noteText, setNoteText] = useState('');
  const [showEmailDropdown, setShowEmailDropdown] = useState(false);
  const queryClient = useQueryClient();

  // Fetch email templates
  const { data: emailTemplates } = useQuery({
    queryKey: ['email-templates'],
    queryFn: () => emailService.getTemplates()
  });

  // Fetch lead data from Supabase
  const { data: leadData, isLoading, error } = useQuery({
    queryKey: ['lead', id],
    queryFn: () => leadsService.getLead(id),
    enabled: !!id
  });

  const navigate = useNavigate();
  const lead = leadData;
  const leadNotes = lead?.notes;
  const leadCallLogs = lead?.callLogs;
  const activityItems = useMemo(() => {
    const notes = (leadNotes || []).map((n) => ({ kind: 'note', key: `note-${n.id}`, at: n.created_at, data: n }));
    const calls = (leadCallLogs || []).map((c) => ({ kind: 'call', key: `call-${c.id}`, at: c.created_at, data: c }));
    return [...notes, ...calls].sort((a, b) => new Date(b.at) - new Date(a.at));
  }, [leadNotes, leadCallLogs]);

  // Mutation for creating notes
  const createNoteMutation = useMutation({
    mutationFn: (noteData) => notesService.createNote(id, noteData.text, noteData.type),
    onSuccess: () => {
      invalidateLeadWorkspace(queryClient, id);
      setNoteText('');
      toast.success('Note added successfully');
    },
    onError: (error) => {
      toast.error(`Failed to add note: ${error.message}`);
    }
  });

  const handleLogNote = () => {
    if (!noteText.trim()) {
      toast.error('Please enter a note');
      return;
    }
    createNoteMutation.mutate({ text: noteText, type: 'general' });
  };

  // Send Samples flow: stage -> samples_sent, log a note, and queue a 7-day follow-up.
  const sendSamplesMutation = useMutation({
    mutationFn: async (tracking) => {
      await leadsService.updateLead(id, { lead_stage: 'samples_sent' });
      await notesService.createNote(id, tracking ? `Samples shipped. Tracking: ${tracking}` : 'Samples shipped.', 'general');
      const due = new Date();
      due.setDate(due.getDate() + 7);
      await tasksService.createTask(id, 'Follow up on sample delivery & product feedback', 0, due.toISOString().slice(0, 10));
    },
    onSuccess: () => {
      invalidateLeadWorkspace(queryClient, id);
      setSamplesDraft({ open: false, tracking: '' });
      toast.success('Samples logged - stage set to Samples Sent, 7-day follow-up created');
    },
    onError: (err) => toast.error(`Failed to log samples: ${err.message}`),
  });

  const handleSendSamples = () => {
    setSamplesDraft({ open: true, tracking: '' });
  };

  const handleSendSamplesSubmit = (event) => {
    event.preventDefault();
    sendSamplesMutation.mutate(samplesDraft.tracking.trim());
  };

  const markWonMutation = useMutation({
    mutationFn: async (orderTotalInput) => {
      const orderTotal = Number.parseFloat(orderTotalInput);
      const safeOrderTotal = Number.isFinite(orderTotal) ? Math.max(0, orderTotal) : 0;

      await audienceService.recordCustomerOrderFromLead(lead, safeOrderTotal);
      await leadsService.updateLead(id, { lead_stage: 'won' });
      await notesService.createNote(
        id,
        safeOrderTotal > 0
          ? `Marked won and recorded customer order: $${safeOrderTotal.toFixed(2)}.`
          : 'Marked won and added to customer reorder list.',
        'general'
      );

      const due = new Date();
      due.setDate(due.getDate() + 45);
      await tasksService.createTask(
        id,
        'Check reorder opportunity with new customer',
        0,
        due.toISOString().slice(0, 10)
      );
    },
    onSuccess: () => {
      invalidateLeadWorkspace(queryClient, id);
      queryClient.invalidateQueries({ queryKey: ['dashboard-command-center'] });
      queryClient.invalidateQueries({ queryKey: ['customers-list'] });
      setMarkWonDraft({ open: false, amount: '' });
      toast.success('Lead marked won and customer follow-up queued');
    },
    onError: (err) => toast.error(`Failed to mark won: ${err.message}`),
  });

  const handleMarkWon = () => {
    if (!lead.email && !lead.manager_email) {
      toast.error('Add an email before converting this lead to a customer');
      return;
    }

    setMarkWonDraft({ open: true, amount: '' });
  };

  const handleMarkWonSubmit = (event) => {
    event.preventDefault();
    markWonMutation.mutate(markWonDraft.amount.trim());
  };

  const handleSendEmail = async (templateId) => {
    try {
      if (!lead.email && !lead.manager_email) {
        toast.error('No email address found for this lead');
        return;
      }

      const result = await emailService.sendWithTemplate(templateId, lead);

      // Log email to notes
      await notesService.createNote(id, `Email sent: ${result.template}`, 'email');

      toast.success(`Email template opened in your email client`);
      setShowEmailDropdown(false);
      invalidateLeadWorkspace(queryClient, id);
    } catch (error) {
      toast.error(`Failed to send email: ${error.message}`);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-gold-400" />
        <span className="ml-3 text-gray-400">Loading lead details...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="card p-8 text-center">
        <p className="text-red-400 mb-4">Failed to load lead: {error.message}</p>
        <Link to="/leads" className="btn-secondary">
          <ArrowLeft size={18} /> Back to Leads
        </Link>
      </div>
    );
  }

  // No data state
  if (!leadData) {
    return (
      <div className="card p-8 text-center">
        <p className="text-gray-400 mb-4">Lead not found</p>
        <Link to="/leads" className="btn-secondary">
          <ArrowLeft size={18} /> Back to Leads
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <DialerModal isOpen={isDialerOpen} onClose={() => setIsDialerOpen(false)} lead={lead} />
      <EditLeadModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} lead={lead} />
      {samplesDraft.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <form onSubmit={handleSendSamplesSubmit} className="w-full max-w-md rounded-lg border border-white/10 bg-charcoal-900 p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-gold-300">Send Samples</p>
                <h2 className="mt-1 text-xl font-black text-white">{lead.business_name}</h2>
                <p className="mt-1 text-sm text-gray-400">{lead.street_address || lead.full_address || [lead.city, lead.state].filter(Boolean).join(', ')}</p>
              </div>
              <button
                type="button"
                onClick={() => setSamplesDraft({ open: false, tracking: '' })}
                disabled={sendSamplesMutation.isPending}
                className="rounded-md border border-white/10 px-3 py-1.5 text-sm font-bold text-gray-400 hover:border-white/20 hover:text-white disabled:opacity-50"
              >
                Close
              </button>
            </div>

            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-gray-500">Tracking Number</span>
              <input
                type="text"
                value={samplesDraft.tracking}
                onChange={(event) => setSamplesDraft((draft) => ({ ...draft, tracking: event.target.value }))}
                className="input-field"
                placeholder="Optional"
                autoFocus
              />
            </label>

            <p className="mt-3 text-xs leading-5 text-gray-500">
              This moves the lead to samples sent, logs the shipment, and queues a 7-day feedback follow-up.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setSamplesDraft({ open: false, tracking: '' })}
                disabled={sendSamplesMutation.isPending}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm font-bold text-gray-300 hover:border-white/20 hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sendSamplesMutation.isPending}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-gold-500 px-4 py-2 text-sm font-black text-charcoal-950 hover:bg-gold-400 disabled:opacity-50"
              >
                {sendSamplesMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Package size={16} />}
                Log Samples
              </button>
            </div>
          </form>
        </div>
      )}
      {markWonDraft.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <form onSubmit={handleMarkWonSubmit} className="w-full max-w-md rounded-lg border border-white/10 bg-charcoal-900 p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-300">Mark Won</p>
                <h2 className="mt-1 text-xl font-black text-white">{lead.business_name}</h2>
                <p className="mt-1 text-sm text-gray-400">{lead.email || lead.manager_email}</p>
              </div>
              <button
                type="button"
                onClick={() => setMarkWonDraft({ open: false, amount: '' })}
                disabled={markWonMutation.isPending}
                className="rounded-md border border-white/10 px-3 py-1.5 text-sm font-bold text-gray-400 hover:border-white/20 hover:text-white disabled:opacity-50"
              >
                Close
              </button>
            </div>

            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-gray-500">Initial Order Amount</span>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={markWonDraft.amount}
                onChange={(event) => setMarkWonDraft((draft) => ({ ...draft, amount: event.target.value }))}
                className="input-field"
                placeholder="0.00"
                autoFocus
              />
            </label>

            <p className="mt-3 text-xs leading-5 text-gray-500">
              This creates or updates the customer, marks the lead won, logs the order, and schedules the 45-day reorder check.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setMarkWonDraft({ open: false, amount: '' })}
                disabled={markWonMutation.isPending}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm font-bold text-gray-300 hover:border-white/20 hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={markWonMutation.isPending}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-black text-charcoal-950 hover:bg-emerald-400 disabled:opacity-50"
              >
                {markWonMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                Mark Won
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Header / Nav */}
      <div className="flex items-center gap-4">
        <Link to="/leads" className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{lead.business_name}</h1>
            {lead.lead_stage && (
              <span className={`stage-badge ${lead.lead_stage.replace('_', '-')}`}>
                {lead.lead_stage.replace('_', ' ')}
              </span>
            )}
          </div>
          <p className="text-gray-400 text-sm flex items-center gap-2 mt-1">
            <MapPin size={14} />
            {lead.street_address || lead.full_address || 'No address'}, {lead.city}, {lead.state} {lead.zipcode}
          </p>
        </div>
        <div className="ml-auto flex gap-3">
          <button
            onClick={() => {
              setIsDialerOpen(true);
              if (lead.phone) {
                const cleaned = lead.phone.replace(/\D/g, '');
                const formatted = cleaned.length === 10 ? `1${cleaned}` : cleaned;
                window.open(`https://voice.google.com/u/0/calls?a=nc,+${formatted}`, '_blank');
              }
            }}
            className="btn-secondary"
          >
            <Phone size={18} /> Call
          </button>

          {/* Send Email with Template Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowEmailDropdown(!showEmailDropdown)}
              className="btn-secondary"
              disabled={!lead.email && !lead.manager_email}
            >
              <Send size={18} /> Send Email
            </button>

            {showEmailDropdown && emailTemplates && emailTemplates.length > 0 && (
              <div className="absolute right-0 top-12 w-64 bg-charcoal-800 border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden">
                <div className="p-2 border-b border-white/10">
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Select Template</p>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {emailTemplates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleSendEmail(template.id)}
                      className="w-full text-left px-4 py-3 hover:bg-charcoal-700 transition-colors border-b border-white/5 last:border-0"
                    >
                      <p className="text-sm font-medium text-white">{template.name}</p>
                      <p className="text-xs text-gray-400 mt-1 truncate">{template.subject}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {showEmailDropdown && (!emailTemplates || emailTemplates.length === 0) && (
              <div className="absolute right-0 top-12 w-64 bg-charcoal-800 border border-white/10 rounded-lg shadow-xl z-50 p-4">
                <p className="text-sm text-gray-400 text-center">
                  No email templates found. Create templates in Settings.
                </p>
              </div>
            )}
          </div>

          <button
            onClick={handleSendSamples}
            disabled={sendSamplesMutation.isPending}
            className="btn-secondary disabled:opacity-50"
          >
            {sendSamplesMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <Package size={18} />} Send Samples
          </button>

          <button
            onClick={handleMarkWon}
            disabled={markWonMutation.isPending}
            className="btn-secondary disabled:opacity-50"
          >
            {markWonMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />} Mark Won
          </button>

          <button onClick={() => setIsEditModalOpen(true)} className="btn-primary">
            <Edit2 size={18} /> Edit
          </button>

          <button
            onClick={async () => {
              if (!window.confirm(`Delete "${lead.business_name}"? This also removes its notes, tasks, and call logs. This cannot be undone.`)) return;
              try {
                await leadsService.deleteLead(id);
                toast.success('Lead deleted');
                navigate('/leads');
              } catch (err) {
                toast.error(`Failed to delete: ${err.message}`);
              }
            }}
            className="btn-danger"
            title="Delete lead"
          >
            <Trash2 size={18} /> Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Lead Info */}
        <div className="space-y-6">
          {/* Contact Card */}
          <div className="card space-y-4">
            <h3 className="text-lg font-bold border-b border-white/5 pb-3">Contact Details</h3>

            <div className="space-y-3">
              {lead.manager_name && (
                <div className="flex items-center gap-3 text-gray-300">
                  <div className="w-8 h-8 rounded bg-charcoal-700 flex items-center justify-center text-gold-400">
                    <UserIcon />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Manager</p>
                    <p className="font-medium">{lead.manager_name}</p>
                  </div>
                </div>
              )}

              {lead.phone && (
                <div className="flex items-center gap-3 text-gray-300">
                  <div className="w-8 h-8 rounded bg-charcoal-700 flex items-center justify-center text-gold-400">
                    <Phone size={16} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Phone</p>
                    <p className="font-medium">{lead.phone_formatted || lead.phone}</p>
                  </div>
                </div>
              )}

              {lead.email && (
                <div className="flex items-center gap-3 text-gray-300">
                  <div className="w-8 h-8 rounded bg-charcoal-700 flex items-center justify-center text-gold-400">
                    <Mail size={16} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Email</p>
                    <p className="font-medium">{lead.email}</p>
                  </div>
                </div>
              )}

              {lead.website && (
                <div className="flex items-center gap-3 text-gray-300">
                  <div className="w-8 h-8 rounded bg-charcoal-700 flex items-center justify-center text-gold-400">
                    <Globe size={16} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Website</p>
                    <a
                      href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-gold-400 hover:underline"
                    >
                      {lead.website}
                    </a>
                  </div>
                </div>
              )}
            </div>

            {lead.tags && lead.tags.length > 0 && (
              <div className="pt-4 border-t border-white/5">
                <p className="text-xs text-gray-500 mb-2">Tags</p>
                <div className="flex flex-wrap gap-2">
                  {lead.tags.map((tag, idx) => (
                    <span key={idx} className="badge bg-charcoal-700 text-gray-300 border border-white/10">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Map Preview */}
          <div className="card p-0 overflow-hidden h-48 relative group bg-charcoal-800">
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <MapPin className="w-8 h-8 text-gold-400 opacity-60" />
              <p className="text-gray-400 text-sm">
                {lead.city && lead.state ? `${lead.city}, ${lead.state}` : 'No location data'}
              </p>
              <Link to="/map" className="btn-secondary bg-charcoal-900/80 backdrop-blur text-sm">
                Open Map View
              </Link>
            </div>
          </div>
        </div>

        {/* Right Column: Activities & Tasks */}
        <div className="lg:col-span-2">
          <div className="card h-full flex flex-col">
            {/* Tabs */}
            <div className="flex border-b border-white/5 mb-6">
              {['activity', 'tasks', 'qualification'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors capitalize ${activeTab === tab
                      ? 'border-gold-500 text-gold-400'
                      : 'border-transparent text-gray-400 hover:text-white'
                    }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1">
              {activeTab === 'activity' && (
                <div className="space-y-6">
                  <div className="flex gap-2 mb-6">
                    <textarea
                      placeholder="Log a note or call..."
                      className="input-field min-h-[80px] resize-none"
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.ctrlKey) {
                          handleLogNote();
                        }
                      }}
                    />
                    <button
                      onClick={handleLogNote}
                      disabled={createNoteMutation.isPending || !noteText.trim()}
                      className="btn-primary h-[80px] w-20 flex flex-col gap-1 items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {createNoteMutation.isPending ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <MessageSquare size={18} />
                      )}
                      <span className="text-xs">Log</span>
                    </button>
                  </div>

                  {/* Timeline */}
                  <div className="space-y-6 pl-4 border-l border-white/10 ml-2">
                    {activityItems.length > 0 ? (
                      activityItems.map((item) => {
                        if (item.kind === 'call') {
                          const call = item.data;
                          const duration = call.call_duration;

                          return (
                            <div key={item.key} className="relative pl-6">
                              <div className="absolute -left-[25px] top-0 w-8 h-8 rounded-full bg-charcoal-800 border-2 border-charcoal-900 flex items-center justify-center text-green-400">
                                <Phone size={14} />
                              </div>
                              <p className="text-sm font-medium text-white capitalize">
                                Call{call.call_outcome ? ` — ${call.call_outcome.replace('_', ' ')}` : ''}
                                {typeof duration === 'number' && duration > 0 && (
                                  <span className="text-gray-500"> · {Math.floor(duration / 60)}m {duration % 60}s</span>
                                )}
                              </p>
                              <p className="text-xs text-gray-500 mb-2">
                                {new Date(call.created_at).toLocaleString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                  hour: 'numeric',
                                  minute: '2-digit',
                                  hour12: true
                                })}
                              </p>
                              <div className="text-sm text-gray-400 bg-charcoal-900/50 p-3 rounded border border-white/5 whitespace-pre-wrap">
                                {call.call_notes && <p>{call.call_notes}</p>}
                                {call.summary && <p>AI summary: {call.summary}</p>}
                                {!call.call_notes && !call.summary && <p className="text-gray-500">No details logged.</p>}
                              </div>
                            </div>
                          );
                        }

                        const note = item.data;
                        const noteIcon = note.note_type === 'call' ? Phone : note.note_type === 'email' ? Mail : MessageSquare;
                        const noteColor = note.note_type === 'call' ? 'text-blue-400' : note.note_type === 'email' ? 'text-purple-400' : 'text-gray-400';
                        const NoteIcon = noteIcon;

                        return (
                          <div key={item.key} className="relative pl-6">
                            <div className={`absolute -left-[25px] top-0 w-8 h-8 rounded-full bg-charcoal-800 border-2 border-charcoal-900 flex items-center justify-center ${noteColor}`}>
                              <NoteIcon size={14} />
                            </div>
                            <p className="text-sm font-medium text-white capitalize">
                              {note.note_type === 'general' ? 'Note' : note.note_type}
                            </p>
                            <p className="text-xs text-gray-500 mb-2">
                              {new Date(note.created_at).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit',
                                hour12: true
                              })}
                            </p>
                            <p className="text-sm text-gray-400 bg-charcoal-900/50 p-3 rounded border border-white/5 whitespace-pre-wrap">
                              {note.note_text}
                            </p>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-gray-500 text-center py-8">No activity yet. Add your first note above!</p>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'tasks' && (
                <TaskManager leadId={id} />
              )}

              {activeTab === 'qualification' && (
                <QuestionsWidget
                  leadId={id}
                  onSave={() => {
                    invalidateLeadWorkspace(queryClient, id);
                    toast.success('Qualification answers saved');
                  }}
                  answers={lead.qualificationAnswers || []}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function UserIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
  )
}
