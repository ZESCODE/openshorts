import React, { useCallback, useEffect, useState } from 'react';
import PublishingStatus from './PublishingStatus';

/**
 * Publishing Studio — upload-posting finish clips to every connected platform
 * through the OpenShorts social API (Upload-Post under the hood).
 *   1. load a job's finished clips (job id)
 *   2. pick one, fill title/description/tags
 *   3. publish now or schedule → poll status → result
 */
const PRIVACY = [
  { id: 'private', label: 'Private' },
  { id: 'unlisted', label: 'Unlisted' },
  { id: 'public', label: 'Public' },
];

export default function PublishingStudio({ uploadPostKey = '' }) {
  const [profile, setProfile] = useState(null);
  const [jobId, setJobId] = useState('');
  const [clips, setClips] = useState([]);
  const [picked, setPicked] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [privacy, setPrivacy] = useState('private');
  const [schedule, setSchedule] = useState('');
  const [platforms, setPlatforms] = useState([]);
  const [busy, setBusy] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/social/user', uploadPostKey
      ? { headers: { 'X-Upload-Post-Key': uploadPostKey } }
      : undefined)
      .then((r) => r.json())
      .then((d) => {
        const p = d.profiles?.[0];
        if (p) {
          setProfile(p);
          if (!platforms.length && p.connected?.length) {
            setPlatforms([p.connected[0]]);
          }
        }
      })
      .catch(() => {});
  }, []);

  const loadJob = useCallback(async () => {
    setError(''); setClips([]); setPicked(null);
    if (!jobId.trim()) { setError('Paste a job id'); return; }
    setBusy('load');
    try {
      const res = await fetch(`/api/status/${encodeURIComponent(jobId.trim())}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.detail || j.error || 'job not found');
      const list = (j.result?.clips || []).map((c, i) => ({
        index: i, // /api/social/post addresses clips positionally
        title: c.video_title_for_youtube_short || c.title,
        video_url: c.video_url,
        duration: c.start != null && c.end != null ? c.end - c.start : c.duration,
        hook_score: c.predicted_score ?? c.hook_score,
      }));
      if (!list.length) throw new Error('this job has no clips yet');
      setClips(list);
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setBusy('');
    }
  }, [jobId]);

  const pick = (clip) => {
    setPicked(clip);
    if (!title) setTitle(clip.title || 'Clip');
  };

  const togglePlatform = (p) =>
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  const publish = async (mode) => {
    setError(''); setResult(null);
    if (!picked) { setError('Pick a clip first'); return; }
    if (!platforms.length) { setError('Select at least one platform'); return; }
    if (!title.trim()) { setError('Title is required (YouTube)'); return; }
    if (mode === 'schedule' && !schedule) { setError('Pick a schedule date/time'); return; }
    setBusy(mode);
    try {
      const body = {
        job_id: jobId.trim(),
        clip_index: picked.index,
        platforms,
        title: title.trim(),
        description: description.trim() || title.trim(),
        tags: tags.split(',').map((t) => t.trim().replace(/^#/, '')).filter(Boolean),
        privacy_status: privacy,
      };
      if (mode === 'schedule') body.scheduled_date = new Date(schedule).toISOString();
      const res = await fetch('/api/social/post', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.detail || j.error || 'publish failed');

      if (j.request_id) {
        // poll async status
        const rid = j.request_id;
        for (let i = 0; i < 40; i++) {
          await new Promise((r) => setTimeout(r, 3000));
          const sr = await fetch(`/api/social/post-status/${rid}`);
          const sj = await sr.json();
          if (sj.status === 'completed' || sj.status === 'failed') {
            setResult({request_id: rid, ...sj});
            setBusy('');
            return;
          }
        }
        setResult({request_id: rid, status: 'timeout'});
      } else {
        setResult(j);
      }
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl text-ink">Publishing</h2>
          <p className="text-sm text-ink3">
            Post finished clips to YouTube, TikTok, Instagram and 19 more networks — one profile,
            one call.
          </p>
        </div>
        {profile && (
          <div className="text-right">
            <p className="text-sm font-medium text-ink">@{profile.username}</p>
            <p className="text-xs text-ink3">
              {profile.connected?.length
                ? `connected: ${profile.connected.join(', ')}`
                : 'no accounts connected yet'}
            </p>
          </div>
        )}
      </div>

      <PublishingStatus uploadPostKey={uploadPostKey} onConnect={() => window.open('/user', '_blank', 'noopener')} />

      {/* clip source */}
      <section className="bg-paper2 border border-rule rounded-card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-ink2">1 · Load a job's clips</h3>
        <div className="flex flex-wrap gap-3 items-end">
          <label className="grow">
            <span className="block text-xs text-ink3 mb-1">Job id</span>
            <input
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
              placeholder="e.g. 717e94be-…"
              className="w-full px-3 py-2 bg-paper border border-rule rounded-input text-ink text-sm font-mono"
            />
          </label>
          <button onClick={loadJob} disabled={busy === 'load'}
            className="px-4 py-2 bg-ink text-paper rounded-input text-sm font-medium hover:opacity-90 disabled:opacity-50">
            {busy === 'load' ? 'Loading…' : 'Load clips'}
          </button>
        </div>
        {!profile?.connected?.length && (
          <p className="text-xs text-amber-500">
            No accounts connected on this profile — open the connect page first (Upload-Post profile
            “default”).
          </p>
        )}
      </section>

      {/* clips */}
      {clips.length > 0 && (
        <section className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {clips.map((c) => (
            <button key={c.index} onClick={() => pick(c)}
              className={`text-left border rounded-card overflow-hidden bg-paper2 ${picked?.index === c.index ? 'border-ink' : 'border-rule hover:border-ink3'}`}>
              {c.video_url && (
                <video preload="metadata" className="w-full aspect-[9/16] bg-black" src={c.video_url} />
              )}
              <div className="p-2 space-y-1">
                <p className="text-sm text-ink line-clamp-1">{c.title || `clip ${c.index + 1}`}</p>
                <p className="text-xs text-ink3">
                  {c.duration ? `${Math.round(c.duration)}s` : ''}
                  {c.duration && c.hook_score != null ? ' · ' : ''}
                  {c.hook_score != null ? `hook ${Math.round(c.hook_score * 100)}%` : ''}
                </p>
              </div>
            </button>
          ))}
        </section>
      )}

      {/* publish form */}
      {picked && (
        <section className="bg-paper2 border border-rule rounded-card p-4 space-y-4">
          <h3 className="text-sm font-semibold text-ink2">
            2 · Publish clip {picked.index + 1}
          </h3>

          <div className="flex flex-wrap gap-4">
            {(profile?.connected || []).map((p) => (
              <label key={p} className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" checked={platforms.includes(p)} onChange={() => togglePlatform(p)} />
                <span className="capitalize">{p}</span>
              </label>
            ))}
          </div>

          <label className="block">
            <span className="block text-xs text-ink3 mb-1">Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100}
              className="w-full px-3 py-2 bg-paper border border-rule rounded-input text-ink text-sm" />
          </label>
          <label className="block">
            <span className="block text-xs text-ink3 mb-1">Description</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4}
              className="w-full px-3 py-2 bg-paper border border-rule rounded-input text-ink text-sm resize-y" />
          </label>
          <label className="block">
            <span className="block text-xs text-ink3 mb-1">Tags (comma-separated)</span>
            <input value={tags} onChange={(e) => setTags(e.target.value)}
              placeholder="Japan, JapanFacts, DidYouKnow"
              className="w-full px-3 py-2 bg-paper border border-rule rounded-input text-ink text-sm" />
          </label>

          <div className="flex flex-wrap gap-4 items-end">
            <label className="block">
              <span className="block text-xs text-ink3 mb-1">Privacy (YouTube)</span>
              <select value={privacy} onChange={(e) => setPrivacy(e.target.value)}
                className="px-3 py-2 bg-paper border border-rule rounded-input text-ink text-sm">
                {PRIVACY.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="block text-xs text-ink3 mb-1">Schedule (optional)</span>
              <input type="datetime-local" value={schedule} onChange={(e) => setSchedule(e.target.value)}
                className="px-3 py-2 bg-paper border border-rule rounded-input text-ink text-sm" />
            </label>
            <button onClick={() => publish('now')} disabled={Boolean(busy)}
              className="px-4 py-2 bg-ink text-paper rounded-input text-sm font-medium hover:opacity-90 disabled:opacity-50">
              {busy === 'now' ? 'Publishing…' : 'Publish now'}
            </button>
            <button onClick={() => publish('schedule')} disabled={Boolean(busy) || !schedule}
              className="px-4 py-2 border border-rule text-ink rounded-input text-sm font-medium hover:border-ink3 disabled:opacity-50">
              {busy === 'schedule' ? 'Scheduling…' : 'Schedule'}
            </button>
          </div>
        </section>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}
      {result && (
        <div className="bg-paper2 border border-rule rounded-card p-4 space-y-2">
          <h3 className="text-sm font-semibold text-ink2">Result</h3>
          {result.results?.map((r, i) => (
            <div key={i} className="text-sm">
              <span className=" capitalize text-ink">{r.platform}</span>
              {r.success ? (
                <span className="text-green-500"> — posted {r.platform_post_id ? `(${r.platform_post_id})` : ''}
                  {r.post_url && !r.post_url.startsWith('Post uploaded') && (
                    <> · <a href={r.post_url} target="_blank" rel="noreferrer" className="underline">open</a></>
                  )}
                </span>
              ) : (
                <span className="text-red-500"> — failed: {r.error_message || r.error_code}</span>
              )}
            </div>
          ))}
          {result.status && !result.results && (
            <p className="text-sm text-ink2">status: {result.status} ({result.request_id})</p>
          )}
          {result.job_id && <p className="text-xs text-ink3">job {result.job_id}</p>}
        </div>
      )}
    </div>
  );
}
