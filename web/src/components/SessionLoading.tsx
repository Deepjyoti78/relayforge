import { useEffect, useState } from 'react';
import './SessionLoading.css';

export function SessionLoading({ error, onRetry }: { error?: string | null; onRetry: () => void }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (error) return;
    setSlow(false);
    const timer = window.setTimeout(() => setSlow(true), 4000);
    return () => window.clearTimeout(timer);
  }, [error]);

  return <main className="rf-session-screen" aria-busy={!error}>
    <a className="rf-session-brand" href="/">RelayForge<span aria-hidden="true">↗</span></a>
    <div className="rf-session-content">
      <div className={`rf-session-relay${error ? ' rf-session-relay-paused' : ''}`} aria-hidden="true">
        <span /><span /><span />
      </div>
      <div role={error ? 'alert' : 'status'} aria-live="polite">
        <h1>{error ? 'Let’s try that again.' : 'Opening your workspace.'}</h1>
        <p>{error ? 'Unable to verify your session. Your session may still be active.' : slow
          ? 'This is taking longer than usual. We’re still checking your secure session.'
          : 'Checking your secure session. You’ll be right in.'}</p>
      </div>
      {error && <div className="rf-session-actions">
        <button type="button" onClick={onRetry}>Retry<span aria-hidden="true"> ↗</span></button>
        <a href="/">Back to home</a>
      </div>}
    </div>
    <p className="rf-session-footnote">Your workspace, securely connected.</p>
  </main>;
}
