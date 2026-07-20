'use client';
import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';

export function LoginForm() {
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const sp = useSearchParams();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await signIn('credentials', {
        username,
        password: '',
        redirect: false,
      });
      if (res?.error || !res?.ok) {
        setError("That username isn't on the list. Ask David.");
        return;
      }
      router.replace(sp.get('callbackUrl') ?? '/');
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="gform">
      <label className="f-label" htmlFor="login-name">
        Your name, bard
      </label>
      <input
        id="login-name"
        type="text"
        autoCapitalize="none"
        autoCorrect="off"
        autoComplete="username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="bolbo / dilla / david"
        required
      />
      {error ? (
        <p className="hint" style={{ color: 'var(--blood-lit)' }}>
          {error}
        </p>
      ) : null}
      <div style={{ marginTop: 18 }}>
        <button type="submit" disabled={pending} className="gbtn rite">
          {pending ? 'Opening the gates…' : 'Enter'}
        </button>
      </div>
      <p className="hint" style={{ textAlign: 'center', marginTop: 14 }}>
        A private hall for three friends. No password — your name is the key.
      </p>
    </form>
  );
}
