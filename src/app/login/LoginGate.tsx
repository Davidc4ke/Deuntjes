'use client';

import { useState } from 'react';

// Progressive enhancement over the server-action login forms: we never
// preventDefault, so the native (no-JS, webview-proof) submission still
// runs — we just paint an indeterminate loading bar and dim the gate while
// the server signs the bard in and redirects. On failure the page reloads
// to /login?error=denied, which unmounts this and clears the bar.
export function LoginGate({ children }: { children: React.ReactNode }) {
  const [entering, setEntering] = useState<string | null>(null);

  return (
    <div
      className={`login-gate${entering ? ' entering' : ''}`}
      onSubmit={(e) => {
        const form = (e.target as HTMLElement).closest('form');
        const name = form?.getAttribute('data-name') ?? '';
        setEntering(name);
      }}
    >
      {entering !== null && (
        <div className="login-loading" role="status" aria-live="polite">
          <div className="login-bar">
            <span />
          </div>
          <p className="hint" style={{ textAlign: 'center', margin: '10px 0 0' }}>
            Opening the gates{entering ? ` for ${entering}` : ''}…
          </p>
        </div>
      )}
      {children}
    </div>
  );
}
