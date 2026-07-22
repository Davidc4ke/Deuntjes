import { redirect } from 'next/navigation';
import { AuthError } from 'next-auth';
import { signIn } from '@/auth';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { asc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// The gate is a set of plain HTML forms, one per bard, submitting to a
// server action. No client JS in the sign-in path at all — this must work
// in every browser AND the in-app webviews (WhatsApp on Android was
// swallowing the old client-side signIn flow).
async function enterAction(formData: FormData) {
  'use server';
  const username = String(formData.get('username') ?? '');
  const rawCb = String(formData.get('callbackUrl') ?? '/');
  // relative paths only — never an open redirect
  const callbackUrl = rawCb.startsWith('/') && !rawCb.startsWith('//') ? rawCb : '/';
  try {
    await signIn('credentials', { username, password: '', redirectTo: callbackUrl });
  } catch (err) {
    if (err instanceof AuthError) redirect('/login?error=denied');
    throw err; // success is a NEXT_REDIRECT — let it fly
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const { callbackUrl, error } = await searchParams;
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
        <div className="gform">
          <label className="f-label">Who goes there?</label>
          {roster.map((u) => (
            <form key={u.username} action={enterAction}>
              <input type="hidden" name="username" value={u.username} />
              <input type="hidden" name="callbackUrl" value={callbackUrl ?? '/'} />
              <button
                type="submit"
                className="player-pick"
                style={{ width: '100%', textAlign: 'left', cursor: 'pointer', font: 'inherit' }}
              >
                <span className="med">
                  {u.displayName.slice(0, 1).toUpperCase()}
                  {u.displayName.slice(1, 2).toLowerCase()}
                </span>
                <span className="pname">
                  {u.avatarEmoji} {u.displayName}
                </span>
                <span className="pyou">enter ›</span>
              </button>
            </form>
          ))}
          {error ? (
            <p className="hint" style={{ color: 'var(--blood-lit)' }}>
              The gate stayed shut. Ask David.
            </p>
          ) : null}
          <p className="hint" style={{ textAlign: 'center', marginTop: 14 }}>
            A private hall for three friends. No password — your name is the key.
          </p>
        </div>
      </main>
    </div>
  );
}
