import React, { useCallback, useState } from 'react';

/**
 * Image Studio — two ways in:
 *  - Pollinations (free, no key): same-origin proxy path through the ZES Mesh
 *    Console's /api/image on :7070, which fetches server-side because
 *    image.pollinations.ai rejects a browser Origin with 403.
 *  - Gemini (your key): the image models answer CORS, so the browser calls
 *    generativelanguage.googleapis.com directly with the api_key already in
 *    localStorage from the rest of the dashboard (BYOK, nothing relayed).
 */

const PROVIDERS = [
  { id: 'pollinations', label: 'Pollinations · free, no key' },
  { id: 'gemini', label: 'Gemini · your key' },
];

// Names verified against the account's ModelService.ListModels — older
// aliases (gemini-2.0-flash-preview-image-generation) now 404.
const GEMINI_MODELS = [
  { id: 'gemini-2.5-flash-image', label: 'Nano Banana · 2.5 flash image' },
  { id: 'gemini-3.1-flash-image-preview', label: '3.1 flash image · preview' },
  { id: 'gemini-3-pro-image', label: '3.0 pro image' },
];

const POLLINATIONS_MODELS = [
  { id: 'flux', label: 'Flux' },
  { id: 'zimage', label: 'Z-Image' },
  { id: 'klein', label: 'Klein' },
  { id: 'kontext', label: 'Kontext' },
];

// Gemini only accepts an aspect ratio; Pollinations wants pixel width/height.
const SIZES = [
  { label: 'Square 1:1 — 1024', w: 1024, h: 1024, ratio: '1:1' },
  { label: 'Portrait 9:16 — 768×1344', w: 768, h: 1344, ratio: '9:16' },
  { label: 'Wide 16:9 — 1344×768', w: 1344, h: 768, ratio: '16:9' },
  { label: 'Vertical 3:4 — 768×1024', w: 768, h: 1024, ratio: '3:4' },
];

const readKey = () => {
  try { return localStorage.getItem('gemini_key') || ''; } catch (_) { return ''; }
};

const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(blob);
});

async function generatePollinations(prompt, model, size) {
  const url = `/studio/api/image?prompt=${encodeURIComponent(prompt)}&model=${model}`
    + `&width=${size.w}&height=${size.h}`;
  const res = await fetch(url);
  if (!res.ok) {
    let detail = `Upstream ${res.status}`;
    try { const j = await res.json(); detail = j.detail || j.error || detail; } catch { /* binary body */ }
    throw new Error(detail);
  }
  const blob = await res.blob();
  if (!blob.type.startsWith('image/')) throw new Error('Upstream returned a non-image');
  return { blob, model, w: size.w, h: size.h };
}

// Not a hook: the callback only fetches, converts and hands the data URL to
// the Video Studio through an event — no state or hooks involved, so it lives
// at module level (rules-of-hooks flagged it when it was a useCallback).
// Not a hook: plain module-level helper (rules-of-hooks flagged the previous
// useCallback and any `use*`-prefixed name — see eslint-plugin-react-hooks).
function sendAsBackground(img) {
  fetch(img.url)
    .then((r) => r.blob())
    .then(blobToDataUrl)
    .then((dataUrl) => {
      localStorage.setItem('zes_bg_image', dataUrl);
      window.dispatchEvent(new CustomEvent('zes-bg-image', { detail: dataUrl }));
    });
}

async function generateGemini(prompt, model, size, key) {
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: size.ratio } },
  };
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
  );
  if (!res.ok) {
    let detail = `Gemini ${res.status}`;
    try { const j = await res.json(); if (j?.error?.message) detail = j.error.message; } catch { /* empty */ }
    // A 429 from this family of models means the key has no image quota left
    // (free tier ships a literal zero for image generation), not a transient
    // blip — say so, it is the whole message otherwise.
    if (res.status === 429 && /quota|exceeded/i.test(detail)) {
      throw new Error('Gemini image quota exceeded (this key has no image quota on the free tier). '
        + 'Use a key with billing, or switch the source to Pollinations (free, no key).');
    }
    throw new Error(detail);
  }
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const image = parts.find((p) => p.inlineData?.mimeType?.startsWith('image/'));
  if (!image) {
    const text = parts.find((p) => p.text)?.text;
    throw new Error(text ? `Gemini returned text only: ${text.slice(0, 120)}` : 'Gemini returned no image');
  }
  const binary = atob(image.inlineData.data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return { blob: new Blob([bytes], { type: image.inlineData.mimeType }), model, w: null, h: null };
}

export default function ZesImageStudio({ geminiApiKey = '' }) {
  const [provider, setProvider] = useState('pollinations');
  const [model, setModel] = useState('flux');
  const [size, setSize] = useState(0);
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [images, setImages] = useState([]); // {url, model, label, prompt} — newest first

  const models = provider === 'gemini' ? GEMINI_MODELS : POLLINATIONS_MODELS;
  const activeModel = models.some((m) => m.id === model) ? model : models[0].id;
  const key = geminiApiKey || readKey();

  const generate = useCallback(async () => {
    if (!prompt.trim()) { setError('Prompt required'); return; }
    if (provider === 'gemini' && !key.trim()) {
      setError('Gemini needs your API key — set it in the API keys card, or switch to Pollinations (free).');
      return;
    }
    setBusy(true); setError('');
    try {
      const picked = SIZES[size];
      const out = provider === 'gemini'
        ? await generateGemini(prompt, activeModel, picked, key.trim())
        : await generatePollinations(prompt, activeModel, picked);
      const url = URL.createObjectURL(out.blob);
      const dims = out.w ? `${out.w}×${out.h}` : picked.ratio;
      setImages((prev) => [{ url, model: out.model, label: dims, prompt, provider }, ...prev].slice(0, 12));
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setBusy(false);
    }
  }, [prompt, provider, activeModel, size, key]);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      <div>
        <h2 className="font-display text-xl text-ink">Image Studio</h2>
        <p className="text-sm text-ink3">
          Free Pollinations (flux · zimage · klein · kontext) or Gemini with your own key — models, sizes and prompts below.
        </p>
      </div>

      <div className="card p-4 space-y-3">
        <label className="block text-sm font-medium text-ink2">Prompt</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          placeholder="an octopus-shaped hot air balloon over a neon city"
          className="input-field resize-y"
        />
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <span className="readout block mb-1">source</span>
            <select value={provider}
              onChange={(e) => { const p = e.target.value; setProvider(p); setModel(p === 'gemini' ? GEMINI_MODELS[0].id : POLLINATIONS_MODELS[0].id); }}
              className="px-3 py-2 bg-paper border border-rule rounded-input text-ink text-sm">
              {PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <span className="readout block mb-1">model</span>
            <select value={activeModel} onChange={(e) => setModel(e.target.value)}
              className="px-3 py-2 bg-paper border border-rule rounded-input text-ink text-sm">
              {models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <span className="readout block mb-1">size</span>
            <select value={size} onChange={(e) => setSize(Number(e.target.value))}
              className="px-3 py-2 bg-paper border border-rule rounded-input text-ink text-sm">
              {SIZES.map((s, i) => <option key={s.label} value={i}>{s.label}</option>)}
            </select>
          </div>
          <button onClick={generate} disabled={busy} className="btn-primary">
            {busy ? 'Generating…' : 'Generate'}
          </button>
        </div>
        {provider === 'gemini' && !key.trim() && (
          <p className="text-sm text-warn">No Gemini key yet — add one in the API keys card first.</p>
        )}
        {provider === 'pollinations' && (
          <p className="text-sm text-ink3">Runs through <code className="font-mono">localhost:7070/api/image</code>, free with no key.</p>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {images.map((img, i) => (
            <figure key={i} className="border border-rule rounded-card overflow-hidden bg-paper2">
              <img src={img.url} alt={img.prompt} className="w-full aspect-square object-cover bg-paper" />
              <figcaption className="p-2 space-y-1.5">
                <p className="readout truncate">{img.model} · {img.label}</p>
                <div className="flex gap-2">
                  <a href={img.url} download={`zes-${img.model}-${Date.now()}.png`}
                    className="text-xs text-ink2 hover:text-ink underline">Download</a>
                  <button onClick={() => sendAsBackground(img)}
                    className="text-xs text-ink2 hover:text-ink underline">Use as video background</button>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}