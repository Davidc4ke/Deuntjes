import { Suspense } from 'react';
import { LoginForm } from './LoginForm';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <div className="grim">
      <div className="grim-grain" aria-hidden="true" />
      <main className="grim-page" style={{ maxWidth: 400 }}>
        <div style={{ textAlign: 'center', padding: '13vh 0 26px' }}>
          <h1
            className="misprint"
            data-text="Deuntjes"
            style={{ fontFamily: 'var(--g-display)', fontSize: 52, margin: 0 }}
          >
            <span style={{ color: 'var(--blood-lit)' }}>D</span>euntjes
          </h1>
          <p style={{ color: 'var(--g-smoke)', fontStyle: 'italic', fontSize: 15, margin: '8px 0 0' }}>
            Speak your name and the gates will open.
          </p>
        </div>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </main>
    </div>
  );
}
