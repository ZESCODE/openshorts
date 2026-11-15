import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, ExternalLink, Copy, Check, AlertCircle, Settings,
  Instagram, Tiktok, Youtube, Linkedin, X, Facebook,
  Calendar, Eye, EyeOff, Lock, Unlock, Trash2
} from 'lucide-react';
import { apiJson } from '../lib/api';
import { track } from '../lib/analytics';

const PLATFORMS = [
  { key: 'instagram', label: 'Instagram', icon: Instagram, color: 'text-pink-500' },
  { key: 'tiktok', label: 'TikTok', icon: Tiktok, color: 'text-black dark:text-white' },
  { key: 'youtube', label: 'YouTube', icon: Youtube, color: 'text-red-500' },
  { key: 'linkedin', label: 'LinkedIn', icon: Linkedin, color: 'text-blue-600' },
  { key: 'x', label: 'X (Twitter)', icon: X, color: 'text-black dark:text-white' },
  { key: 'facebook', label: 'Facebook', icon: Facebook, color: 'text-blue-500' },
  { key: 'bluesky', label: 'Bluesky', icon: null, color: 'text-blue-400' },
];

const THEME_OPTIONS = [
  { value: 'auto', label: 'Auto (System)' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const LANGUAGE_OPTIONS = [
  { value: '', label: 'Auto (Browser)' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'de', label: 'German' },
  { value: 'fr', label: 'French' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'pl', label: 'Polish' },
  { value: 'tr', label: 'Turkish' },
];

const DEFAULT_UI_LABELS = {
  'connect.card.connect': 'Connect account',
  'connect.card.connected': 'Connected',
  'connect.card.disconnect': 'Disconnect',
  'connect.section.accounts': 'Connected accounts',
  'connect.section.calendar': 'Scheduled posts',
  'connect.privacy.text': 'We only store encrypted OAuth tokens. Your passwords never leave the platform.',
};

export default function UploadPostWhiteLabel({ cloud, onRefresh }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    logo_image: '',
    connect_title: '',
    connect_description: '',
    platforms: ['instagram', 'tiktok', 'youtube', 'linkedin'],
    redirect_url: '',
    redirect_button_text: 'Back to Dashboard',
    language: '',
    connect_theme: 'auto',
    ui_labels: { ...DEFAULT_UI_LABELS },
    show_calendar: true,
    readonly_calendar: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [generatedLink, setGeneratedLink] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);

  const fetchClients = useCallback(async () => {
    try {
      const data = await apiJson('/api/uploadpost/clients');
      setClients(data.clients || []);
    } catch (e) {
      console.error('Failed to fetch clients:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  });

  const handlePlatformChange = (platform) => {
    setFormData(prev => ({
      ...prev,
      platforms: prev.platforms.includes(platform)
        ? prev.platforms.filter(p => p !== platform)
        : [...prev.platforms, platform],
    }));
  });

  const handleLabelChange = (key, value) => {
    setFormData(prev => ({
      ...prev,
      ui_labels: { ...prev.ui_labels, [key]: value },
    }));
  };

  const resetForm = () => {
    setFormData({
      username: '',
      logo_image: '',
      connect_title: '',
      connect_description: '',
      platforms: ['instagram', 'tiktok', 'youtube', 'linkedin'],
      redirect_url: '',
      redirect_button_text: 'Back to Dashboard',
      language: '',
      connect_theme: 'auto',
      ui_labels: { ...DEFAULT_UI_LABELS },
      show_calendar: true,
      readonly_calendar: false,
    });
    setEditingClient(null);
    setGeneratedLink(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (client) => {
    setEditingClient(client);
    setFormData({
      username: client.username,
      logo_image: client.logo_image || '',
      connect_title: client.connect_title || '',
      connect_description: client.connect_description || '',
      platforms: client.platforms || ['instagram', 'tiktok', 'youtube', 'linkedin'],
      redirect_url: client.redirect_url || '',
      redirect_button_text: client.redirect_button_text || 'Back to Dashboard',
      language: client.language || '',
      connect_theme: client.connect_theme || 'auto',
      ui_labels: { ...DEFAULT_UI_LABELS, ...client.ui_labels },
      show_calendar: client.show_calendar !== false,
      readonly_calendar: client.readonly_calendar === true,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        username: formData.username,
        logo_image: formData.logo_image || undefined,
        connect_title: formData.connect_title || undefined,
        connect_description: formData.connect_description || undefined,
        platforms: formData.platforms.length > 0 ? formData.platforms : undefined,
        redirect_url: formData.redirect_url || undefined,
        redirect_button_text: formData.redirect_button_text || undefined,
        language: formData.language || undefined,
        connect_theme: formData.connect_theme !== 'auto' ? formData.connect_theme : undefined,
        ui_labels: Object.keys(formData.ui_labels).some(k => formData.ui_labels[k] !== DEFAULT_UI_LABELS[k])
          ? formData.ui_labels : undefined,
        show_calendar: formData.show_calendar,
        readonly_calendar: formData.readonly_calendar,
      };

      // Remove undefined values
      Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);

      if (editingClient) {
        await apiJson(`/api/uploadpost/clients/${editingClient.username}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        track('UploadPostClientUpdated', { props: { username: editingClient.username } });
      } else {
        const result = await apiJson('/api/uploadpost/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        track('UploadPostClientCreated', { props: { username: formData.username } });
        if (result.access_url) {
          setGeneratedLink(result.access_url);
        }
      }
      setShowModal(false);
      fetchClients();
      track(editingClient ? 'UploadPostClientUpdated' : 'UploadPostClientCreated', {
        props: { username: editingClient?.username || formData.username },
      });
    } catch (e) {
      alert(e?.detail || e?.message || 'Failed to save client');
    } finally {
      setSubmitting(false);
    }
  };

  const generateLink = async (client) => {
    try {
      const result = await apiJson(`/api/uploadpost/clients/${client.username}/generate-link`, {
        method: 'POST',
      });
      setGeneratedLink(result.access_url);
      track('UploadPostLinkGenerated', { props: { username: client.username } });
    } catch (e) {
      alert(e?.detail || 'Failed to generate link');
    }
  };

  const copyLink = async () => {
    if (generatedLink) {
      await navigator.clipboard.writeText(generatedLink);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const openLink = (url) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const deleteClient = async (client) => {
    if (!confirm(`Delete client "${client.username}"? This cannot be undone.`)) return;
    try {
      await apiJson(`/api/uploadpost/clients/${client.username}`, { method: 'DELETE' });
      fetchClients();
      track('UploadPostClientDeleted', { props: { username: client.username } });
    } catch (e) {
      alert(e?.detail || 'Failed to delete client');
    }
  };

  const formatDate = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getPlatformIcon = (key) => {
    const platform = PLATFORMS.find(p => p.key === key);
    return platform?.icon;
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin text-brass" style={{ width: 32, height: 32, border: '3px solid', borderTopColor: 'transparent', borderRadius: '50%' }} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-1.5">UPLOAD-POST WHITE LABEL</p>
          <h2 className="font-display lowercase text-2xl text-ink leading-tight">Client Connect Pages</h2>
          <p className="text-muted text-sm mt-1">
            Branded OAuth connect pages for your clients. Powered by Upload-Post.
          </p>
        </div>
        <button onClick={openCreateModal} className="btn-primary px-4 py-2 shrink-0">
          <Plus size={16} /> Add Client
        </button>
      </div>

      {/* Clients List */}
      <div className="card p-6">
        {clients.length === 0 ? (
          <div className="text-center py-12">
            <Settings size={48} className="mx-auto text-muted/30 mb-4" />
            <h3 className="font-display lowercase text-lg text-ink mb-2">No clients yet</h3>
            <p className="text-muted text-sm mb-4">
              Create your first client to generate a branded connect page.
            </p>
            <button onClick={openCreateModal} className="btn-primary px-4 py-2">
              <Plus size={16} className="mr-2" /> Create Client
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {clients.map((client) => (
              <div key={client.username} className="border border-rule rounded-card p-4 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      {client.logo_image && (
                        <img src={client.logo_image} alt="" className="w-10 h-10 rounded-lg object-cover" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-ink">{client.username}</span>
                          {client.connect_title && (
                            <span className="text-muted text-sm">{client.connect_title}</span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {client.platforms?.map(p => (
                            <span key={p} className="badge-muted text-xs capitalize">{p}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {client.access_url && (
                      <button
                        onClick={() => openLink(client.access_url)}
                        className="btn-ghost px-3 py-1.5 text-xs"
                      >
                        <ExternalLink size={14} className="mr-1" /> Open Page
                      </button>
                    )}
                    <button
                      onClick={() => generateLink(client)}
                      disabled={submitting}
                      className="btn-primary px-3 py-1.5 text-xs"
                    >
                      <ExternalLink size={14} className="mr-1" /> Generate Link
                    </button>
                    <button
                      onClick={() => openEditModal(client)}
                      className="btn-ghost px-3 py-1.5 text-xs"
                    >
                      <Settings size={14} />
                    </button>
                    <button
                      onClick={() => deleteClient(client)}
                      className="btn-ghost px-3 py-1.5 text-xs text-warn hover:text-warn"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {client.access_url && (
                  <div className="rounded-card bg-paper2 p-3 flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-muted lowercase">Connect URL</span>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="flex-1 text-xs text-ink2 truncate bg-paper3 px-2 py-1 rounded">{client.access_url}</code>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(client.access_url);
                            setCopySuccess(true);
                            setTimeout(() => setCopySuccess(false), 2000);
                          }}
                          className="btn-ghost px-2 py-1 text-xs shrink-0"
                        >
                          {copySuccess ? (
                            <>
                              <Check size={14} className="text-emerald" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy size={14} /> Copy
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => openLink(client.access_url)}
                          className="btn-ghost px-2 py-1 text-xs"
                        >
                          <ExternalLink size={14} /> Open
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div className="rounded-card bg-paper2 p-3">
                    <div className="text-muted text-xs lowercase">Theme</div>
                    <div className="text-ink capitalize">{client.connect_theme || 'auto'}</div>
                  </div>
                  <div className="rounded-card bg-paper2 p-3">
                    <div className="text-muted text-xs lowercase">Calendar</div>
                    <div className="text-ink capitalize">{client.show_calendar === false ? 'Hidden' : 'Visible'}</div>
                  </div>
                  <div className="rounded-card bg-paper2 p-3">
                    <div className="text-muted text-xs lowercase">Read-only</div>
                    <div className="text-ink capitalize">{client.readonly_calendar ? 'Yes' : 'No'}</div>
                  </div>
                  <div className="rounded-card bg-paper2 p-3">
                    <div className="text-muted text-xs lowercase">Language</div>
                    <div className="text-ink capitalize">{client.language || 'Auto'}</div>
                  </div>
                </div>

                {Object.keys(client.ui_labels || {}).length > 0 && (
                  <div className="pt-4 border-t border-rule">
                    <div className="text-muted text-xs lowercase mb-2">Custom Labels</div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(client.ui_labels).map(([key, value]) => (
                        <span key={key} className="badge-muted text-xs flex items-center gap-1">
                          <span className="text-muted">{key}:</span>
                          <span className="text-ink">{value}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-paper1 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="sticky top-0 bg-paper1 border-b border-rule px-6 py-4 flex items-center justify-between z-10">
              <h3 className="font-display lowercase text-lg text-ink">
                {editingClient ? 'Edit Client' : 'Create Client'}
              </h3>
              <button onClick={() => setShowModal(false)} className="btn-ghost p-1">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-ink2">Client Username *</label>
                <input
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  disabled={editingClient}
                  placeholder="client-harbor (lowercase, no spaces)"
                  className="w-full px-3 py-2 bg-paper2 border border-rule rounded-lg text-ink placeholder-muted focus:border-brass focus:outline-none"
                  required
                />
                <p className="text-xs text-muted">Lowercase, alphanumeric + hyphens only. Used in API calls.</p>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-ink2">Logo URL</label>
                <input
                  name="logo_image"
                  value={formData.logo_image}
                  onChange={handleInputChange}
                  placeholder="https://youragency.com/logo.png"
                  className="w-full px-3 py-2 bg-paper2 border border-rule rounded-lg text-ink placeholder-muted focus:border-brass focus:outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-ink2">Page Title</label>
                <input
                  name="connect_title"
                  value={formData.connect_title}
                  onChange={handleInputChange}
                  placeholder="Connect your accounts to Agency Name"
                  className="w-full px-3 py-2 bg-paper2 border border-rule rounded-lg text-ink placeholder-muted focus:border-brass focus:outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-ink2">Description</label>
                <textarea
                  name="connect_description"
                  value={formData.connect_description}
                  onChange={handleInputChange}
                  placeholder="Link the channels we will manage for you."
                  rows={2}
                  className="w-full px-3 py-2 bg-paper2 border border-rule rounded-lg text-ink placeholder-muted focus:border-brass focus:outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-ink2">Platforms</label>
                <div className="flex flex-wrap gap-2">
                  {PLATFORMS.map(platform => (
                    <label key={platform.key} className="inline-flex items-center gap-1.5 px-3 py-1.5 border rounded-lg cursor-pointer transition-colors
                      {formData.platforms.includes(platform.key)
                        ? 'border-brass bg-brass/10 text-brass'
                        : 'border-rule hover:border-brass/50'}">
                    <input
                      type="checkbox"
                      checked={formData.platforms.includes(platform.key)}
                      onChange={() => handlePlatformChange(platform.key)}
                      className="sr-only"
                    />
                    {platform.icon && <platform.icon size={14} className={platform.color} />}
                    <span className="text-sm">{platform.label}</span>
                  </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-ink2">Redirect URL</label>
                <input
                  name="redirect_url"
                  value={formData.redirect_url}
                  onChange={handleInputChange}
                  placeholder="https://yourdashboard.com/clients/connected"
                  className="w-full px-3 py-2 bg-paper2 border border-rule rounded-lg text-ink placeholder-muted focus:border-brass focus:outline-none"
                />
                <p className="text-xs text-muted">Where clients go after connecting accounts.</p>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-ink2">Redirect Button Text</label>
                <input
                  name="redirect_button_text"
                  value={formData.redirect_button_text}
                  onChange={handleInputChange}
                  placeholder="Back to Dashboard"
                  className="w-full px-3 py-2 bg-paper2 border border-rule rounded-lg text-ink placeholder-muted focus:border-brass focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-ink2">Language</label>
                  <select
                    name="language"
                    value={formData.language}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-paper2 border border-rule rounded-lg text-ink focus:border-brass focus:outline-none"
                  >
                    {LANGUAGE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-ink2">Theme</label>
                  <select
                    name="connect_theme"
                    value={formData.connect_theme}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-paper2 border border-rule rounded-lg text-ink focus:border-brass focus:outline-none"
                  >
                    {THEME_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="show_calendar"
                    checked={formData.show_calendar}
                    onChange={handleInputChange}
                    className="w-4 h-4 text-brass border-rule rounded focus:ring-brass"
                  />
                  <label className="text-sm text-ink2">Show Calendar Tab</label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="readonly_calendar"
                    checked={formData.readonly_calendar}
                    onChange={handleInputChange}
                    className="w-4 h-4 text-brass border-rule rounded focus:ring-brass"
                  />
                  <label className="text-sm text-ink2">Read-only Calendar</label>
                </div>
              </div>

              <div className="pt-4 border-t border-rule">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium text-ink2">Custom UI Labels</span>
                  <span className="text-xs text-muted">Optional — override button/text labels</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(DEFAULT_UI_LABELS).map(([key, defaultValue]) => (
                    <div key={key} className="space-y-1">
                      <label className="block text-xs text-muted lowercase">{key}</label>
                      <input
                        value={formData.ui_labels[key] || defaultValue}
                        onChange={(e) => handleLabelChange(key, e.target.value)}
                        placeholder={defaultValue}
                        className="w-full px-2 py-1.5 bg-paper2 border border-rule rounded-lg text-ink placeholder-muted focus:border-brass focus:outline-none text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="sticky bottom-0 bg-paper1 border-t border-rule px-6 py-4 flex justify-end gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="btn-ghost px-4 py-2">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn-primary px-4 py-2">
                  {submitting ? 'Saving…' : (editingClient ? 'Save Changes' : 'Create Client')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Generated Link Modal */}
      {generatedLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-paper1 rounded-xl w-full max-w-md shadow-xl p-6 space-y-4">
            <h3 className="font-display lowercase text-lg text-ink">Link Generated</h3>
            <div className="rounded-card bg-paper2 p-3">
              <code className="text-xs text-ink2 truncate block">{generatedLink}</code>
            </div>
            <div className="flex gap-3">
              <button
                onClick={copyLink}
                className="flex-1 btn-primary py-2"
              >
                {copySuccess ? (
                  <>
                    <Check size={14} className="mr-1" /> Copied!
                  </>
                ) : (
                  <>
                    <Copy size={14} className="mr-1" /> Copy Link
                  </>
                )}
              </button>
              <button onClick={openLink} className="flex-1 btn-ghost py-2">
                <ExternalLink size={14} className="mr-1" /> Open
              </button>
            </div>
            <button onClick={() => setGeneratedLink(null)} className="text-sm text-muted hover:text-ink">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}