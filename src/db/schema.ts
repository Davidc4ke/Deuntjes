import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  primaryKey,
  unique,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: text('username').notNull().unique(),
  displayName: text('display_name').notNull(),
  avatarEmoji: text('avatar_emoji').notNull().default('🎵'),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const songs = pgTable('songs', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const songVersions = pgTable(
  'song_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    songId: uuid('song_id').notNull().references(() => songs.id, { onDelete: 'cascade' }),
    versionNumber: integer('version_number').notNull(),
    parentVersionId: uuid('parent_version_id').references((): AnyPgColumn => songVersions.id),
    label: text('label'),
    tempoBpm: integer('tempo_bpm').notNull(),
    keyRoot: text('key_root').notNull(),
    keyMode: text('key_mode').notNull(),
    timeSigNum: integer('time_sig_num').notNull(),
    timeSigDen: integer('time_sig_den').notNull(),
    barCount: integer('bar_count').notNull(),
    activeMixId: uuid('active_mix_id'),
    createdBy: uuid('created_by').notNull().references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uqSongVersion: unique().on(t.songId, t.versionNumber),
  }),
);

export const drumKits = pgTable('drum_kits', {
  id: uuid('id').primaryKey().defaultRandom(),
  songVersionId: uuid('song_version_id')
    .notNull()
    .unique()
    .references(() => songVersions.id, { onDelete: 'cascade' }),
});

export const drumKitPads = pgTable(
  'drum_kit_pads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    drumKitId: uuid('drum_kit_id').notNull().references(() => drumKits.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    midiNote: integer('midi_note').notNull(),
    orderIdx: integer('order_idx').notNull(),
  },
  (t) => ({
    uqOrder: unique().on(t.drumKitId, t.orderIdx),
  }),
);

export const sections = pgTable(
  'sections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    songVersionId: uuid('song_version_id')
      .notNull()
      .references(() => songVersions.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    startBar: integer('start_bar').notNull(),
    lengthBars: integer('length_bars').notNull(),
    orderIdx: integer('order_idx').notNull(),
  },
  (t) => ({
    uqOrder: unique().on(t.songVersionId, t.orderIdx),
  }),
);

export const SLOT_KINDS = ['chords', 'melody', 'bass', 'drums', 'lyrics'] as const;
export type SlotKind = (typeof SLOT_KINDS)[number];

export const slots = pgTable(
  'slots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    songVersionId: uuid('song_version_id')
      .notNull()
      .references(() => songVersions.id, { onDelete: 'cascade' }),
    kind: text('kind').$type<SlotKind>().notNull(),
  },
  (t) => ({
    uqKind: unique().on(t.songVersionId, t.kind),
  }),
);

export const takes = pgTable('takes', {
  id: uuid('id').primaryKey().defaultRandom(),
  slotId: uuid('slot_id').notNull().references(() => slots.id, { onDelete: 'cascade' }),
  sectionId: uuid('section_id').references(() => sections.id, { onDelete: 'cascade' }),
  parentTakeId: uuid('parent_take_id').references((): AnyPgColumn => takes.id),
  name: text('name').notNull(),
  notes: text('notes'),
  source: text('source').$type<'native' | 'uploaded'>().notNull(),
  granularity: integer('granularity'),
  payloadJson: jsonb('payload_json'),
  midiPath: text('midi_path'),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const mixes = pgTable('mixes', {
  id: uuid('id').primaryKey().defaultRandom(),
  songVersionId: uuid('song_version_id')
    .notNull()
    .references(() => songVersions.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const mixSelections = pgTable(
  'mix_selections',
  {
    mixId: uuid('mix_id').notNull().references(() => mixes.id, { onDelete: 'cascade' }),
    slotId: uuid('slot_id').notNull().references(() => slots.id, { onDelete: 'cascade' }),
    sectionId: uuid('section_id').references(() => sections.id, { onDelete: 'cascade' }),
    takeId: uuid('take_id').notNull().references(() => takes.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.mixId, t.slotId, t.sectionId] }),
  }),
);

export const reactions = pgTable(
  'reactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    takeId: uuid('take_id').notNull().references(() => takes.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    emoji: text('emoji').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uqReaction: unique().on(t.takeId, t.userId, t.emoji),
  }),
);

export const comments = pgTable('comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  takeId: uuid('take_id').notNull().references(() => takes.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  body: text('body').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const activities = pgTable('activities', {
  id: uuid('id').primaryKey().defaultRandom(),
  songId: uuid('song_id').notNull().references(() => songs.id, { onDelete: 'cascade' }),
  songVersionId: uuid('song_version_id').references(() => songVersions.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  targetId: uuid('target_id'),
  payloadJson: jsonb('payload_json'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const readState = pgTable(
  'read_state',
  {
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    songId: uuid('song_id').notNull().references(() => songs.id, { onDelete: 'cascade' }),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.songId] }),
  }),
);

export const _sqlHelper = sql;
