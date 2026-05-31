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
    <form onSubmit={onSubmit} className="stack" style={{ marginTop: 24 }}>
      <label>
        <div className="muted" style={{ marginBottom: 6 }}>
          Username
        </div>
        <input
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="bolbo / dilla / david"
          required
        />
      </label>
      {error ? <div style={{ color: 'var(--danger)' }}>{error}</div> : null}
      <button type="submit" disabled={pending} className="primary">
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
      <p className="muted" style={{ fontSize: 13 }}>
        Private app for 3 friends. No password — usernames are the whole list.
      </p>
    </form>
  );
}
