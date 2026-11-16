import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { apiJson } from '../lib/api';

/**
 * Read-only status for the publishing profile: which networks are connected
 * and the last numbers each one reported.
 *
 * Two routes, both read-only and both optional: /api/social/user and
 * /api/social/analytics exist on the whop host and on the OpenShorts backend.
 * A self-hosted instance without the Upload-Post key gets a 404/empty answer,
 * and the card removes itself instead of showing an error.
 */
const TILES = [
  ['followers', 'followers'],
  ['impressions', 'impressions'],
  ['likes', 'likes'],
  ['comments', 'comments'],
];

export default function PublishingStatus({ onConnect }) {
  const [state, setState] = useState('loading'); // loading | ready | empty | unavailable | error
  const [profiles, setProfiles] = useState([]);
  const [metrics, setMetrics] = useState({});
  const [asOf, setAsOf] = useState('');

  const load = useCallback(async () => {
    setState('loading');
    try {
      const data = await apiJson('/api/social/user');
      const list = data?.profiles || [];
      setProfiles(list);
      const first = list[0];
      if (!first?.connected?.length) { setState('empty'); return; }
      const stats = await apiJson(
        `/api/social/analytics?user=${encodeURIComponent(first.username)}&platforms=${first.connected.join(',')}`,
      );
      setMetrics(stats?.metrics || {});
      setAsOf(stats?.as_of || data?.as_of || '');
      setState('ready');
    } catch (e) {
      const status = e?.status || e?.response?.status;
      // 401 = outside the Whop iframe, 404 = no route (self-hosted without it).
      setState(status === 401 || status === 404 ? 'unavailable' : 'error');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (state === 'loading') {
    return (
      <section className="bg-paper2 border border-rule rounded-card p-4 flex items-center gap-2 text-sm text-ink3">
        <RefreshCw size={14} className="animate-spin" /> checking the publishing profile…
      </section>
    );
  }

  if (state === 'unavailable') return null;

  if (state === 'error') {
    return (
      <section className="bg-paper2 border border-rule rounded-card p-4 flex items-start gap-2 text-sm">
        <AlertCircle size={15} className="text-danger mt-0.5 shrink-0" />
        <span className="text-ink3">Could not read the publishing status just now.</span>
      </section>
    );
  }

  const first = profiles[0];
  const when = asOf ? new Date(asOf) : null;

  return (
    <section className="bg-paper2 border border-rule rounded-card p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink2">
          Publishing status
          {first?.username ? <span className="text-ink3 font-normal"> · {first.username}</span> : null}
        </h3>
        <div className="flex items-center gap-2">
          {when && !Number.isNaN(when.getTime()) && (
            <span className="readout text-ink3">
              read {when.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </span>
          )}
          <button onClick={load} className="text-xs text-ink3 hover:text-ink inline-flex items-center gap-1">
            <RefreshCw size={12} /> refresh
          </button>
        </div>
      </div>

      {state === 'empty' ? (
        <p className="text-sm text-ink3">
          No social account is connected to the publishing profile yet.
          {onConnect ? (
            <>
              {' '}
              <button onClick={onConnect} className="underline hover:text-ink">Connect one</button> to start publishing.
            </>
          ) : null}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {(first?.connected || []).map((name) => (
              <span key={name} className="readout px-2 py-1 rounded-full border border-rule bg-paper text-ink2">
                {name}
              </span>
            ))}
          </div>
          {Object.entries(metrics).length === 0 ? (
            <p className="text-sm text-ink3">No numbers reported for the connected networks yet.</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(metrics).map(([platform, m]) => (
                <div key={platform} className="rounded-input border border-rule bg-paper px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="readout text-ink2">{platform}</span>
                    <span className="readout text-xs text-ink3">last 30 days</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
                    {TILES.map(([key, label]) => (
                      <div key={key}>
                        <p className="readout text-[11px] text-ink3">{label}</p>
                        <p className="text-sm text-ink">
                          {m?.[key] == null ? '—' : Number(m[key]).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-ink3">
            Totals per platform; they settle a day or two after publishing.
          </p>
        </>
      )}
    </section>
  );
}
