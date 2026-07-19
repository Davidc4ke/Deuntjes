import { pgTable, uuid, text, timestamp, jsonb, integer, uniqueIndex } from 'drizzle-orm/pg-core';

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

// A dungeon game: one shared song built room-by-room by a fixed circle of
// players. The song row is the canvas; the game rows are the turn machinery.
// While a game references a song, the plain /songs editing paths are blocked
// (409) — the only write path is the turn/lock API for the current player.
export const games = pgTable('games', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  songId: uuid('song_id').notNull().references(() => songs.id, { onDelete: 'cascade' }),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  playerOrder: jsonb('player_order').notNull(), // string[] of user uuids, turn order
  currentRoomIndex: integer('current_room_index').notNull().default(0),
  roomCount: integer('room_count').notNull(),
  status: text('status').notNull().default('active'), // 'active' | 'complete'
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// One row per room (turn). Player + channel are assigned for every room at
// game creation (the map shows them up front); the curse is dealt only when
// the room becomes current.
export const gameRooms = pgTable(
  'game_rooms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gameId: uuid('game_id').notNull().references(() => games.id, { onDelete: 'cascade' }),
    roomIndex: integer('room_index').notNull(), // 0-based
    playerId: uuid('player_id').notNull().references(() => users.id),
    channelId: integer('channel_id').notNull(),
    curseId: text('curse_id'),
    status: text('status').notNull().default('pending'), // 'pending' | 'current' | 'locked'
    lockedAt: timestamp('locked_at', { withTimezone: true }),
  },
  (t) => [uniqueIndex('game_rooms_game_idx').on(t.gameId, t.roomIndex)],
);
