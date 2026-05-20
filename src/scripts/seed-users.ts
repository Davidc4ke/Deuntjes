import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import bcrypt from 'bcryptjs';
import { db } from '../db/client';
import { users } from '../db/schema';
import { sql } from 'drizzle-orm';

type SeedUser = {
  username: string;
  display_name: string;
  avatar_emoji?: string;
  password: string;
};

async function main() {
  const file = process.argv[2] ?? resolve(process.cwd(), 'users.seed.json');
  const raw = readFileSync(file, 'utf8');
  const list: SeedUser[] = JSON.parse(raw);

  for (const u of list) {
    const hash = await bcrypt.hash(u.password, 10);
    await db
      .insert(users)
      .values({
        username: u.username,
        displayName: u.display_name,
        avatarEmoji: u.avatar_emoji ?? '🎵',
        passwordHash: hash,
      })
      .onConflictDoUpdate({
        target: users.username,
        set: {
          displayName: u.display_name,
          avatarEmoji: u.avatar_emoji ?? '🎵',
          passwordHash: hash,
        },
      });
    console.log(`upserted ${u.username}`);
  }

  await db.execute(sql`select 1`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
