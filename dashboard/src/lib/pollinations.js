/**
 * Pollinations Pay (BYOP) — OAuth authorization-code flow with PKCE.
 *
 * The App Key (pk_…) is publishable and identifies the app; after the user
 * approves, enter.pollinations.ai returns their scoped sk_ key, which we keep
 * in sessionStorage for the tab only. Requests go through the same-origin
 * image proxy, which forwards the key to gen.pollinations.ai.
 */

export const POLL_APP_KEY = import.meta.env.VITE_POLLINATIONS_APP_KEY || '';
export const hasAppKey = Boolean(POLL_APP_KEY);

const AUTHORIZE_URL = 'https://enter.pollinations.ai/authorize';
// Same-origin exchange: enter.pollinations.ai does not send CORS headers.
// The whop app serves /api/pollinations/token; the dev server proxies it.
const TOKEN_PROXY = import.meta.env.VITE_POLLINATIONS_TOKEN_PROXY || '/api/pollinations/token';
const PKCE_KEY = 'poll_pkce';
const KEY_STORE = 'poll_key';

const base64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const randomString = (n) => base64url(crypto.getRandomValues(new Uint8Array(n)));

export const pollenKey = {
  get() { try { return sessionStorage.getItem(KEY_STORE) || ''; } catch { return ''; } },
  set(value) { try { sessionStorage.setItem(KEY_STORE, value); } catch { /* private mode */ } },
  clear() { try { sessionStorage.removeItem(KEY_STORE); } catch { /* private mode */ } },
};

// Same origin + path on both legs; loopback redirects match any port.
export const redirectUri = () => `${location.origin}${location.pathname}`;

export async function startConnect() {
  if (!hasAppKey) throw new Error('No Pollinations App Key configured');
  const verifier = randomString(32);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const state = randomString(16);
  sessionStorage.setItem(PKCE_KEY, JSON.stringify({ verifier, state }));
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: POLL_APP_KEY,
    redirect_uri: redirectUri(),
    scope: 'profile usage',
    state,
    code_challenge: base64url(digest),
    code_challenge_method: 'S256',
    models: 'image',
    budget: '10',
    expiry: '7',
  });
  location.href = `${AUTHORIZE_URL}?${params}`;
}

/** Handles the ?code=… return leg; safe to call on every page load. */
export async function completeConnect() {
  const params = new URLSearchParams(location.search);
  const code = params.get('code');
  if (!code) return false;

  const cleanUrl = () => {
    const url = new URL(location.href);
    url.searchParams.delete('code');
    url.searchParams.delete('state');
    history.replaceState(null, '', `${url.pathname}${url.search}#app`);
  };

  let saved = null;
  try { saved = JSON.parse(sessionStorage.getItem(PKCE_KEY) || 'null'); } catch { saved = null; }
  sessionStorage.removeItem(PKCE_KEY);
  if (!saved || saved.state !== params.get('state')) { cleanUrl(); return false; }

  const res = await fetch(TOKEN_PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      client_id: POLL_APP_KEY,
      redirect_uri: redirectUri(),
      code_verifier: saved.verifier,
    }),
  });
  const data = await res.json().catch(() => ({}));
  cleanUrl();
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || `Token exchange failed (${res.status})`);
  }
  pollenKey.set(data.access_token);
  return true;
}
