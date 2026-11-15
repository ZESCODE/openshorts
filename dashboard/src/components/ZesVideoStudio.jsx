import React, { useCallback, useEffect, useState } from 'react';

/**
 * Video Studio — renders through the local zes-studio Remotion pipeline
 * (FactsVideo props or a KineticVideo payload), polling job status and
 * playing/downloading the finished mp4.
 */

const EMPTY_FACT = { emoji: '✨', headline: '', detail: '', stat: '', statLabel: '' };

function buildFactsPayload(form, facts, imageDataUrl) {
  return {
    kicker: form.kicker || 'AMAZING FACTS',
    topic: form.topic || 'THE TOPIC',
    accent: form.accent || '#4DD8FF',
    accent2: form.accent2 || '#FFC94D',
    handle: form.handle || '@yourchannel',
    audioSrc: '',
    imageSrc: imageDataUrl || '',
    facts: facts.map((f) => ({ ...f })),
  };
}

export default function ZesVideoStudio() {
  const [mode, setMode] = useState('facts'); // facts | kinetic
  const [form, setForm] = useState({ kicker: 'AMAZING FACTS', topic: 'THE OCEAN', accent: '#4DD8FF', accent2: '#FFC94D', handle: '@5factsdaily' });
  const [facts, setFacts] = useState([0, 1, 2, 3, 4].map(() => ({ ...EMPTY_FACT })));
  const [kineticJson, setKineticJson] = useState('');
  const [bgImage, setBgImage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [job, setJob] = useState(null); // { id, status, progress, message, url, movieFile }
  const [frames, setFrames] = useState('');

  useEffect(() => {
    const onBg = (e) => setBgImage(e.detail || '');
    window.addEventListener('zes-bg-image', onBg);
    const stored = localStorage.getItem('zes_bg_image');
    if (stored) setBgImage(stored);
    return () => window.removeEventListener('zes-bg-image', onBg);
  }, []);

  const setFact = (i, key, value) =>
    setFacts((prev) => prev.map((f, j) => (j === i ? { ...f, [key]: value } : f)));

  const poll = useCallback((id) => {
    const tick = async () => {
      try {
        const res = await fetch(`/studio/api/render/${id}`);
        const j = await res.json();
        setJob((prev) => ({ ...prev, ...j }));
        if (j.status === 'done' || j.status === 'error') { setBusy(false); return; }
        setTimeout(tick, 1500);
      } catch (e) {
        setError(String(e.message || e));
        setBusy(false);
      }
    };
    tick();
  }, []);

  const start = useCallback(async () => {
    setBusy(true); setError(''); setJob(null);
    try {
      let body;
      if (mode === 'kinetic') {
        body = JSON.parse(kineticJson);
        if (!Array.isArray(body.scenes)) throw new Error('payload needs a scenes[] array');
      } else {
        if (facts.some((f) => !f.headline.trim())) throw new Error('all 5 facts need a headline');
        body = buildFactsPayload(form, facts, bgImage);
      }
      if (frames && /^\d+(-\d+)?$/.test(frames)) body.frames = frames;

      const res = await fetch('/studio/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok || !j.id) throw new Error(j.detail || j.error || 'render failed to start');
      setJob({ id: j.id, status: j.status, progress: 0, message: j.message });
      poll(j.id);
    } catch (e) {
      setError(String(e.message || e));
      setBusy(false);
    }
  }, [mode, kineticJson, facts, form, bgImage, frames, poll]);

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">
      <div>
        <h2 className="font-display text-xl text-ink">Video Studio</h2>
        <p className="text-sm text-ink3">Remotion facts videos + kinetic typography, rendered by the local studio and auto-exported to Movies.</p>
      </div>

      <div className="flex gap-2">
        {[['facts', 'Top-5 facts'], ['kinetic', 'Kinetic typography (JSON)']].map(([id, label]) => (
          <button key={id} onClick={() => setMode(id)}
            className={`px-3 py-1.5 text-sm rounded-input border ${mode === id ? 'bg-ink text-paper border-ink' : 'border-rule text-ink2 hover:text-ink'}`}>
            {label}
          </button>
        ))}
      </div>

      {mode === 'facts' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              ['topic', 'Topic'], ['kicker', 'Kicker'], ['accent', 'Accent'], ['accent2', 'Accent 2'], ['handle', 'Handle'],
            ].map(([key, label]) => (
              <label key={key} className="block">
                <span className="block text-xs text-ink3 mb-1">{label}</span>
                <input value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="w-full px-3 py-2 bg-paper border border-rule rounded-input text-ink text-sm" />
              </label>
            ))}
          </div>

          <div className="space-y-2">
            <span className="block text-xs text-ink3">Background image (from Image Studio — optional, FactsVideo)</span>
            {bgImage
              ? <img src={bgImage} alt="background" className="h-20 rounded-input border border-rule object-cover" />
              : <p className="text-xs text-ink3">None — generate one in Image Studio and hit “Use as video background”.</p>}
          </div>

          {facts.map((f, i) => (
            <div key={i} className="border border-rule rounded-card p-3 space-y-2">
              <p className="text-xs font-medium text-ink2">Fact {i + 1}</p>
              <div className="grid grid-cols-[4rem_1fr] gap-2">
                <input value={f.emoji} onChange={(e) => setFact(i, 'emoji', e.target.value)} placeholder="emoji"
                  className="px-2 py-1.5 bg-paper border border-rule rounded-input text-ink text-sm text-center" />
                <input value={f.headline} onChange={(e) => setFact(i, 'headline', e.target.value)} placeholder="headline"
                  className="px-3 py-1.5 bg-paper border border-rule rounded-input text-ink text-sm" />
              </div>
              <input value={f.detail} onChange={(e) => setFact(i, 'detail', e.target.value)} placeholder="detail line"
                className="w-full px-3 py-1.5 bg-paper border border-rule rounded-input text-ink text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <input value={f.stat} onChange={(e) => setFact(i, 'stat', e.target.value)} placeholder="stat badge"
                  className="px-3 py-1.5 bg-paper border border-rule rounded-input text-ink text-sm" />
                <input value={f.statLabel} onChange={(e) => setFact(i, 'statLabel', e.target.value)} placeholder="stat label"
                  className="px-3 py-1.5 bg-paper border border-rule rounded-input text-ink text-sm" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          <span className="block text-xs text-ink3">Paste a KineticVideo payload (see the video skill / README for the schema)</span>
          <textarea value={kineticJson} onChange={(e) => setKineticJson(e.target.value)} rows={12}
            placeholder='{"videoTitle":"…","fps":30,"durationInFrames":240,"scenes":[…]}'
            className="w-full px-3 py-2 bg-paper border border-rule rounded-input text-ink text-xs font-mono resize-y" />
        </div>
      )}

      <div className="flex items-center gap-3">
        <button onClick={start} disabled={busy}
          className="px-4 py-2 bg-ink text-paper rounded-input text-sm font-medium hover:opacity-90 disabled:opacity-50">
          {busy ? 'Rendering…' : 'Render video'}
        </button>
        <input value={frames} onChange={(e) => setFrames(e.target.value)} placeholder="frames e.g. 0-90 (optional smoke)"
          className="px-3 py-2 bg-paper border border-rule rounded-input text-ink text-sm w-56" />
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}

      {job && (
        <div className="border border-rule rounded-card p-4 space-y-3 bg-paper2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink2">Job <code className="text-xs">{job.id}</code></span>
            <span className={job.status === 'error' ? 'text-red-500' : 'text-ink2'}>{job.status}{job.progress ? ` · ${job.progress}%` : ''}</span>
          </div>
          <div className="w-full h-2 bg-paper3 rounded-full overflow-hidden">
            <div className="h-full bg-ink transition-all" style={{ width: `${Math.max(2, job.progress || 0)}%` }} />
          </div>
          {job.message && <p className="text-xs text-ink3 break-all">{job.message}</p>}
          {job.status === 'error' && <p className="text-sm text-red-500">{job.error}</p>}
          {job.file && (
            <div className="space-y-2">
              <video controls className="w-full rounded-card border border-rule bg-black" src={`/studio/${job.file}`} />
              <div className="flex gap-3">
                <a href={`/studio/${job.file}${job.file.includes('?') ? '&' : '?'}download=1`} download className="text-sm text-ink2 hover:text-ink underline">Download mp4</a>
                {job.movieFile && <span className="text-xs text-ink3">also exported to Movies/</span>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
