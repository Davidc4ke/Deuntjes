import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: text('username').notNull().unique(),
  displayName: text('display_name').notNull(),
  avatarEmoji: text('avatar_emoji').notNull().default('🎵'),
  passwordHash: text('password_hash'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// One row per song. The entire sequencer state (channels, notes, transport,
// scale, etc.) lives in `sequencerData` as a single JSON blob — saved as a
// whole on every debounced autosave. Last-write-wins; the API enforces that
// only `createdBy` may PATCH.
export const songs = pgTable('songs', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  sequencerData: jsonb('sequencer_data').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
