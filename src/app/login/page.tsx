import { Suspense } from 'react';
import { LoginForm } from './LoginForm';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <main className="page" style={{ maxWidth: 380, margin: '0 auto' }}>
      <h1 style={{ marginTop: 24 }}>Deuntjes</h1>
      <p className="muted">Sign in to keep writing.</p>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
