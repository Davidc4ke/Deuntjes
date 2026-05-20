import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { authConfig } from './auth.config';
import { db } from './db/client';
import { users } from './db/schema';
import { eq } from 'drizzle-orm';

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(creds) {
        const username = String(creds?.username ?? '').trim().toLowerCase();
        if (!username) return null;
        const [row] = await db.select().from(users).where(eq(users.username, username)).limit(1);
        if (!row) return null;

        if (row.passwordHash) {
          const password = String(creds?.password ?? '');
          if (!password) return null;
          const ok = await bcrypt.compare(password, row.passwordHash);
          if (!ok) return null;
        }
        return {
          id: row.id,
          name: row.displayName,
          email: `${row.username}@deuntjes.local`,
          image: row.avatarEmoji,
        };
      },
    }),
  ],
});
