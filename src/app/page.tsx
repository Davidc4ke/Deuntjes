import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '@/components/shared/AuthGate';
import { AppBar } from '@/components/app/AppBar';
import { signOut } from '@/auth';
import { db } from '@/db/client';
import { songs, users } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';
import { defaultSequencerState } from '@/lib/sequencerState';

export const dynamic = 'force-dynamic';

async function createSongAction() {
  'use server';
  const { userId } = await requireUser();
  const [row] = await db
    .insert(songs)
    .values({ title: 'Untitled song', createdBy: userId, sequencerData: defaultSequencerState() })
    .returning({ id: songs.id });
  redirect(`/songs/${row.id}`);
}

export default async function HomePage() {
  const { userId, session } = await requireUser();
  const name = session.user?.name ?? 'friend';
  const avatar = (session.user as { avatar?: string }).avatar ?? '🎵';

  const rows = await db
    .select({
      id: songs.id,
      title: songs.title,
      createdAt: songs.createdAt,
      updatedAt: songs.updatedAt,
      createdBy: songs.createdBy,
      creatorName: users.displayName,
      creatorAvatar: users.avatarEmoji,
    })
    .from(songs)
    .innerJoin(users, eq(users.id, songs.createdBy))
    .orderBy(desc(songs.updatedAt));

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
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <form action={createSongAction}>
            <button
              type="submit"
              style={{ background: 'var(--accent)', color: '#1a1024', borderColor: 'transparent' }}
            >
              + New song
            </button>
          </form>
        </div>
        {rows.length === 0 ? (
          <div className="card">
            <h2 style={{ marginTop: 0 }}>No songs yet</h2>
            <p className="muted">Tap “New song” to start your first sequencer.</p>
          </div>
        ) : (
          <div>
            {rows.map((r) => (
              <Link key={r.id} href={`/songs/${r.id}`} className="song-card">
                <span style={{ fontSize: 22 }}>{r.creatorAvatar}</span>
                <div className="song-card-meta">
                  <div className="song-card-title">{r.title}</div>
                  <div className="song-card-sub">
                    {r.creatorName}
                    {r.createdBy === userId ? ' · you' : ''}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
