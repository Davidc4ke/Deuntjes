'use client';
import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';

export type LoginUser = { username: string; displayName: string; avatarEmoji: string };

// One door per bard: the access list is three friends, so the gate shows
// them by name instead of asking anyone to type. Tapping a name signs in
// as that user (passwordless by design — the list IS the lock).
export function LoginForm({ roster }: { roster: LoginUser[] }) {
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const sp = useSearchParams();

  function enter(username: string) {
    if (pending) return;
    setError(null);
    setChosen(username);
    start(async () => {
      const res = await signIn('credentials', {
        username,
        password: '',
        redirect: false,
      });
      if (res?.error || !res?.ok) {
        setError('The gate stayed shut. Ask David.');
        setChosen(null);
        return;
      }
      router.replace(sp.get('callbackUrl') ?? '/');
      router.refresh();
    });
  }

  return (
    <div className="gform">
      <label className="f-label">Who goes there?</label>
      {roster.map((u) => (
        <button
          key={u.username}
          type="button"
          className="player-pick"
          onClick={() => enter(u.username)}
          disabled={pending}
          style={{
            width: '100%',
            textAlign: 'left',
            cursor: 'pointer',
            font: 'inherit',
            opacity: pending && chosen !== u.username ? 0.45 : 1,
            ...(chosen === u.username ? { borderColor: 'var(--blood-lit)' } : {}),
          }}
        >
          <span className="med">
            {u.displayName.slice(0, 1).toUpperCase()}
            {u.displayName.slice(1, 2).toLowerCase()}
          </span>
          <span className="pname">
            {u.avatarEmoji} {u.displayName}
          </span>
          <span className="pyou">{chosen === u.username && pending ? 'opening the gates…' : 'enter ›'}</span>
        </button>
      ))}
      {error ? (
        <p className="hint" style={{ color: 'var(--blood-lit)' }}>
          {error}
        </p>
      ) : null}
      <p className="hint" style={{ textAlign: 'center', marginTop: 14 }}>
        A private hall for three friends. No password — your name is the key.
      </p>
    </div>
  );
}
