import { Suspense } from 'react';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { asc } from 'drizzle-orm';
import { LoginForm } from './LoginForm';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  // The whole access list is three friends — show them as doors to tap
  // instead of a field to type in.
  const roster = await db
    .select({ username: users.username, displayName: users.displayName, avatarEmoji: users.avatarEmoji })
    .from(users)
    .orderBy(asc(users.displayName));
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
            Choose your name and the gates will open.
          </p>
        </div>
        <Suspense fallback={null}>
          <LoginForm roster={roster} />
        </Suspense>
      </main>
    </div>
  );
}
