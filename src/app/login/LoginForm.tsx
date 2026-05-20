'use client';
import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';

export function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
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
        password,
        redirect: false,
      });
      if (res?.error) {
        setError('Wrong username or password.');
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
          required
        />
      </label>
      <label>
        <div className="muted" style={{ marginBottom: 6 }}>
          Password
        </div>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>
      {error ? <div style={{ color: 'var(--danger)' }}>{error}</div> : null}
      <button
        type="submit"
        disabled={pending}
        style={{ background: 'var(--accent)', color: '#1a1024', borderColor: 'transparent' }}
      >
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
