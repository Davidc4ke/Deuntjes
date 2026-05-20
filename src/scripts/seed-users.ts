import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import bcrypt from 'bcryptjs';
import { db } from '../db/client';
import { users } from '../db/schema';

type SeedUser = {
  username: string;
  display_name?: string;
  avatar_emoji?: string;
  password?: string;
};

async function main() {
  const file = process.argv[2] ?? resolve(process.cwd(), 'users.seed.json');
  const raw = readFileSync(file, 'utf8');
  const list: SeedUser[] = JSON.parse(raw);

  for (const u of list) {
    const username = u.username.trim().toLowerCase();
    const passwordHash = u.password ? await bcrypt.hash(u.password, 10) : null;
    const displayName = u.display_name ?? username.charAt(0).toUpperCase() + username.slice(1);
    const avatarEmoji = u.avatar_emoji ?? '🎵';
    await db
      .insert(users)
      .values({ username, displayName, avatarEmoji, passwordHash })
      .onConflictDoUpdate({
        target: users.username,
        set: { displayName, avatarEmoji, passwordHash },
      });
    console.log(`upserted ${username}${passwordHash ? ' (with password)' : ' (passwordless)'}`);
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
