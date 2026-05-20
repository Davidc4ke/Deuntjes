import { requireUser } from '@/components/shared/AuthGate';
import { AppBar } from '@/components/app/AppBar';
import { signOut } from '@/auth';
import Link from 'next/link';

export default async function HomePage() {
  const { session } = await requireUser();
  const name = session.user?.name ?? 'friend';
  const avatar = (session.user as { avatar?: string }).avatar ?? '🎵';

  return (
    <>
      <AppBar
        title={
          <span>
            {avatar} {name}
          </span>
        }
        right={
          <form
            action={async () => {
              'use server';
              await signOut({ redirectTo: '/login' });
            }}
          >
            <button type="submit" style={{ padding: '6px 10px' }}>
              Sign out
            </button>
          </form>
        }
      />
      <main className="page">
        <div className="card">
          <h2 style={{ marginTop: 0 }}>No songs yet</h2>
          <p className="muted">
            Song creation, mixes, takes, playback, and export all land in tickets #2 and #3. This
            is the foundation deploy — auth works, schema is live, the mobile shell is wired.
          </p>
          <Link href="/songs/new" style={{ display: 'inline-block', marginTop: 12 }}>
            <button>Start a song (stub)</button>
          </Link>
        </div>
      </main>
    </>
  );
}
