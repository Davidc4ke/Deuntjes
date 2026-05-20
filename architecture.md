# Collaborative Songwriting App — Architecture (v3)

Working name: TBD.

**The project in one paragraph:** A private, invite-only, mobile-first web app for 3-4 friends in different time zones to write songs together asynchronously. Each song has slots (chords, melody, bass, drums, lyrics) and anyone can drop takes — uploaded MIDI from their DAW/MPC, or built directly in-browser via a tracker-style editor. The killer feature is mix-and-match: pick one take per slot, hear the combination, save as a mix, share with friends. Reactions and comments give async contributors signal that their work landed. Hosted on Railway.

---

## What this app is and isn't

**Is:** A small, private creative tool for a defined friend group. A mix-and-match interface with playback. An on-ramp for friends without gear via the tracker.

**Isn't:** A DAW. A public platform. A general-purpose collab tool. The tracker is good enough to write a melody, not good enough to mix an album.

This framing matters because it bounds the work: every feature gets weighed against "do 4 people actually need this?" Most things don't.

---

## Locked decisions

| Decision | Choice | Why |
|---|---|---|
| Audience | 3-4 friends, invite-only | Defines scope of social features, removes public-share complexity |
| Collab mode | Async-first | Different time zones, fits real workflow |
| Mix-and-match | Core feature | The unique value over shared MIDI folders |
| Tracker editor | Build it | On-ramp for no-gear contributors |
| Mobile-first | Yes, with desktop scale-up | Phone contributions matter |
| Versioning | Yes, but tempo edits stay within version | Key/structure changes fork; tempo is fluid |
| Drum mapping | General MIDI under the hood, friendly UI labels | Portable + friendly |
| Take scope | Section-scoped from day 1 | Real use case (different chords in bridge) |
| Take deletion when referenced | Blocked with error | Safest for shared work |
| Storage | Railway volume now, R2 later via adapter | Simpler start, swap path is clear |
| Stack | Next.js + Postgres + Drizzle + NextAuth + Tone.js + TanStack Query + Zustand | Known, lightweight, deploys cleanly to Railway |
| Reactions/comments | Yes, on takes | Async needs feedback signal |
| Tracker default granularity | 16th notes, user-configurable per take | Tracker convention |
| Tracker layout | Vertical (top-to-bottom), pitch picker + input row at bottom | Touch-friendly, matches phone scroll |
| Bottom bar | Floating transport bubble + context-specific bar | Flexible, doesn't crowd |

---

## Core mental model

A **song** is a conceptual identity (title, owner). It has one or more **song versions** — snapshots holding the structural parameters that takes depend on:
- **Key** (root + mode) — changing this fragments existing takes harmonically; forks a new version
- **Time signature** — changing this re-aligns ticks; forks a new version
- **Section structure** — changing section lengths/order breaks section-scoped takes; forks a new version
- **Bar count** — changing total length can orphan tail-end notes; forks a new version

But **tempo** stays editable within a version. Takes are stored in ticks/bars (musical time), not seconds, so tempo changes re-stretch naturally on playback. This is the most common edit, so it shouldn't punish you.

Each version has **sections**, a **drum kit** (with GM defaults + friendly labels), **slots**, **takes**, and **mixes**.

**Slots** are fixed: chords, melody, bass, drums, lyrics. One per version.

**Takes** are immutable submissions to a slot. Each is:
- Whole-song (covers all bars) or section-scoped (covers one section)
- Native (built in app, has editable payload) or uploaded (.mid file only)
- Fork-able — revising creates a new take with `parent_take_id`

**Mixes** are named selections — one take per (slot, section) pairing. Sharing a song = sharing the active mix's playback. Versions have their own mixes.

**Reactions and comments** attach to takes. The list view shows reaction counts as glanceable signal ("3 fire emojis on Marco's bassline take — must be good").

---

## Data model (Postgres)

```sql
users (
  id              uuid pk,
  username        text unique,
  display_name    text,
  avatar_emoji    text,                 -- e.g. '🐸' — cheap profile pic
  password_hash   text,
  created_at      timestamptz default now()
)

-- Conceptual song identity. Stable across versions.
songs (
  id              uuid pk,
  title           text,
  created_by      uuid fk users,
  created_at      timestamptz default now()
)

-- Snapshot. Forks on key/time-sig/structure/bar-count changes.
song_versions (
  id              uuid pk,
  song_id         uuid fk songs,
  version_number  int,
  parent_version_id uuid null fk song_versions,
  label           text null,            -- 'initial', 'minor key try'
  tempo_bpm       int,                  -- EDITABLE in place
  key_root        text,                 -- forks on change
  key_mode        text,                 -- forks on change
  time_sig_num    int,                  -- forks on change
  time_sig_den    int,                  -- forks on change
  bar_count       int,                  -- forks on change
  active_mix_id   uuid null,
  created_by      uuid fk users,
  created_at      timestamptz default now(),
  unique (song_id, version_number)
)

-- One per version. Pad list defines drum tracker rows.
drum_kits (
  id              uuid pk,
  song_version_id uuid fk song_versions unique
)

drum_kit_pads (
  id              uuid pk,
  drum_kit_id     uuid fk drum_kits,
  label           text,                 -- 'Kick', 'Snare', 'Hat closed' — user-facing
  midi_note       int,                  -- defaults to GM (Kick=36, Snare=38...), editable
  order_idx       int,
  unique (drum_kit_id, order_idx)
)

sections (
  id              uuid pk,
  song_version_id uuid fk song_versions,
  name            text,
  start_bar       int,
  length_bars     int,
  order_idx       int,
  unique (song_version_id, order_idx)
)

slots (
  id              uuid pk,
  song_version_id uuid fk song_versions,
  kind            text,                 -- 'chords' | 'melody' | 'bass' | 'drums' | 'lyrics'
  unique (song_version_id, kind)
)

takes (
  id              uuid pk,
  slot_id         uuid fk slots,
  section_id      uuid null fk sections,    -- null = whole-song
  parent_take_id  uuid null fk takes,
  name            text,
  notes           text,
  source          text,                     -- 'native' | 'uploaded'
  granularity     int null,                 -- tracker: 4|8|16|32
  payload_json    jsonb null,
  midi_path       text null,
  created_by      uuid fk users,
  created_at      timestamptz default now()
)

mixes (
  id              uuid pk,
  song_version_id uuid fk song_versions,
  name            text,
  created_by      uuid fk users,
  created_at      timestamptz default now()
)

mix_selections (
  mix_id          uuid fk mixes,
  slot_id         uuid fk slots,
  section_id      uuid null fk sections,
  take_id         uuid fk takes,
  primary key (mix_id, slot_id, section_id)
)

-- Social layer
reactions (
  id              uuid pk,
  take_id         uuid fk takes,
  user_id         uuid fk users,
  emoji           text,                     -- '🔥' '❤️' '🤯' free-form short string
  created_at      timestamptz default now(),
  unique (take_id, user_id, emoji)          -- one of each emoji per user per take
)

comments (
  id              uuid pk,
  take_id         uuid fk takes,
  user_id         uuid fk users,
  body            text,
  created_at      timestamptz default now()
)

-- Activity feed source (what's new since last visit)
activities (
  id              uuid pk,
  song_id         uuid fk songs,
  song_version_id uuid null fk song_versions,
  user_id         uuid fk users,
  kind            text,                     -- 'take_added' | 'comment' | 'reaction' | 'mix_saved' | 'version_forked'
  target_id       uuid,                     -- the take/comment/mix/version id
  payload_json    jsonb null,               -- denormalized for cheap reads
  created_at      timestamptz default now()
)

-- Per-user, per-song read state for "what's new" indicators
read_state (
  user_id         uuid fk users,
  song_id         uuid fk songs,
  last_seen_at    timestamptz,
  primary key (user_id, song_id)
)
```

### Payload JSON shapes

**Chord take:**
```json
{
  "version": 1,
  "voicing_octave": 4,
  "chords": [
    { "start_bar": 0, "length_beats": 4, "root": "C", "quality": "maj7" }
  ]
}
```

**Tracker take (melody/bass):**
```json
{
  "version": 1,
  "granularity": 16,
  "notes": [
    { "step": 0, "pitch": 60, "velocity": 100, "length_steps": 2 }
  ]
}
```

**Drum take:**
```json
{
  "version": 1,
  "granularity": 16,
  "hits": [
    { "step": 0, "pad_id": "uuid-of-kick-pad", "velocity": 100 }
  ]
}
```
On export, `pad_id` resolves through `drum_kit_pads.midi_note` to a GM-standard note number.

**Lyrics take:**
```json
{
  "version": 1,
  "sections": [
    { "section_name": "verse 1", "text": "..." }
  ]
}
```

---

## Forking a song version — flow

User edits the **key** from C major to A minor:
1. Modal: "Changing key will create a new version (v2). Takes from v1 stay in v1. Continue?"
2. On confirm:
   - Insert `song_versions` row with `parent_version_id` = current, version_number = current + 1
   - Copy `sections`, `drum_kits`, `drum_kit_pads`, `slots` (empty takes)
   - Do not copy takes or mixes
3. Switch UI to new version. Old version accessible via version dropdown.

Tempo edits: just update `tempo_bpm` on the current version. No fork. Show a small toast "Tempo updated — takes will re-stretch on playback."

Section edits: blocked if takes exist on this version; show fork-prompt.

---

## Activity & "what's new"

The async story lives or dies on this. When a friend opens the app after sleeping:

- **Home screen** lists songs with a colored dot/badge if there's activity since their `last_seen_at` for that song.
- **Song view** shows an "Activity" tab/panel: chronological feed of takes added, comments, reactions, version forks. Each item is tappable to jump to the thing.
- **Read state** updates when they open the song.
- **Reactions** appear inline on take cards as emoji + count. New takes since last visit get a "NEW" pill.

This is cheap to build and the highest-leverage feature for async use. Without it, the app feels dead.

No push notifications in v1 — friends check the app deliberately. Can add web push later if anyone asks.

---

## Storage layout (Railway volume)

```
/data/
  midi/{song_id}/{song_version_id}/{take_id}.mid
  uploads/{song_id}/{song_version_id}/{take_id}.mid
```

Served via auth-gated `/api/files/[...path]`. `StorageAdapter` interface (`put/get/delete/exists`) so swapping to R2 later is one file.

---

## API routes

**Auth:**
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

**Songs & versions:**
- `GET /api/songs` — list with unread counts per song
- `POST /api/songs` — create song + v1
- `GET /api/songs/[id]` — metadata + versions list
- `POST /api/songs/[id]/seen` — update read_state
- `GET /api/songs/[id]/versions/[versionId]` — full version
- `PATCH /api/songs/[id]/versions/[versionId]/tempo` — in-place tempo edit
- `POST /api/songs/[id]/versions/[versionId]/fork` — fork to new version, body: overrides + label
- `PATCH /api/songs/[id]/versions/[versionId]` — label only
- `GET /api/songs/[id]/activity` — feed since `?since=` timestamp (default: user's last_seen_at)

**Sections, drum kit, slots:**
- `PUT /api/versions/[versionId]/sections` — only when 0 takes (else 409 → client offers fork)
- `GET /api/versions/[versionId]/drum-kit`
- `PUT /api/versions/[versionId]/drum-kit` — only when 0 drum takes

**Takes:**
- `POST /api/slots/[id]/takes` — section_id optional, granularity optional, payload or .mid upload
- `GET /api/takes/[id]`
- `GET /api/takes/[id]/midi`
- `POST /api/takes/[id]/fork`
- `PATCH /api/takes/[id]` — name/notes
- `DELETE /api/takes/[id]` — 409 if referenced by any mix

**Mixes:**
- `POST /api/versions/[versionId]/mixes`
- `PATCH /api/mixes/[id]`
- `DELETE /api/mixes/[id]`
- `POST /api/versions/[versionId]/active-mix`
- `GET /api/mixes/[id]/export` — zip + manifest

**Social:**
- `POST /api/takes/[id]/reactions` — body `{ emoji }`
- `DELETE /api/takes/[id]/reactions/[reactionId]`
- `GET /api/takes/[id]/comments`
- `POST /api/takes/[id]/comments`
- `DELETE /api/comments/[id]`

**Files:**
- `GET /api/files/[...path]` — auth-gated

---

## Frontend — mobile-first

### Layout primitives

- Single column on phone, multi-column at `≥1024px`
- **Floating transport bubble** — bottom-right, draggable, always visible during song view. Shows play/stop/bar position. Tap to expand into a sheet with per-slot mute/solo + volume.
- **Context bar** at the bottom of the screen — changes by view:
  - Song view: mix picker + add-take button
  - Tracker view: pitch selector + input row
  - Chord builder: chord palette
  - Lyrics: keyboard already takes the bottom, no extra bar needed
- Top app bar: title, version dropdown, activity bell, menu
- `viewport-fit=cover`, safe-area-inset for iOS home indicator

### Component tree

```
app/
  layout.tsx                       # auth, viewport, transport portal
  login/page.tsx
  page.tsx                         # song list with unread badges
  songs/
    new/page.tsx                   # create-song wizard
    [id]/
      page.tsx                     # latest version song view
      activity/page.tsx            # full activity feed
      v/[versionId]/
        page.tsx                   # specific version
        edit-structure/page.tsx
        edit-drum-kit/page.tsx
        slots/[slotId]/
          new-take/page.tsx        # editor based on slot kind
          takes/[takeId]/page.tsx  # play + react + comment
        mixes/[mixId]/page.tsx

components/
  app/
    AppBar.tsx
    VersionPicker.tsx
    ActivityBell.tsx               # unread indicator
    FloatingTransport.tsx          # the bubble
    ContextBar.tsx                 # swappable bottom
    BottomSheet.tsx
  song/
    SongCard.tsx                   # in list, with unread dot
    SectionTimeline.tsx
    SlotList.tsx
    SlotRow.tsx                    # active take + open-takes-sheet
    TakeSheet.tsx                  # bottom sheet, lists takes per slot
    TakeCard.tsx                   # name, author, reactions, play
    MixPicker.tsx
    ExportButton.tsx
  social/
    ReactionBar.tsx                # emoji picker + counts
    CommentThread.tsx
    ActivityFeed.tsx
  editors/
    Tracker/
      Tracker.tsx                  # vertical canvas
      TrackerGrid.tsx
      TrackerInputRow.tsx          # in ContextBar slot
      PitchSelector.tsx
    Chord/
      ChordBuilder.tsx
      ChordPicker.tsx
      ChordBarList.tsx
    Drum/
      DrumTracker.tsx
      DrumPadConfig.tsx
    LyricsEditor.tsx
    UploadDropzone.tsx
  shared/
    AuthGate.tsx
    ConfirmDialog.tsx
    ForkPrompt.tsx
```

### Tracker editor

Vertical scroll, time flows top-to-bottom. Steps quantized to the take's granularity (16th default, configurable 4/8/16/32).

```
┌─────────────────────────────────────┐
│ ←  Melody · v1  ·  Save             │  AppBar
├─────────────────────────────────────┤
│ Bar 1                               │
│ ╔════╗                              │
│ ║ C4 ║ step 0                       │
│ ╠════╣                              │
│ ║    ║ step 1                       │
│ ╠════╣                              │
│ ║ E4 ║ step 2                       │
│ ╠════╣                              │
│ ║    ║ step 3                       │
│ ║──── beat 2 ────                   │
│ ...                                 │
│ Bar 2                               │
│ ...                                 │
├─────────────────────────────────────┤  ← ContextBar
│ Pitch: [E4]   Oct −/+   Len 1 step │
│ Vel ▁▂▃▄▅▆▇█                        │
│ Piano keys ◀ C D E F G A B ▶        │
└─────────────────────────────────────┘
        ●  ← FloatingTransport
```

**Interaction:** select pitch in input row → tap a step to place. Tap existing note to select; long-press for menu (delete, change length, change velocity). Pinch on grid = visual zoom (row height), not granularity change.

**Drum tracker variant** — input row shows drum pad labels (Kick, Snare, Hat) instead of piano keys. Same placement logic.

### Chord builder

Vertical list of bars as cards. Tap a bar → bottom sheet with chord picker (roman numerals tab, raw names tab). Pick → bar updates. Transport bubble previews.

### Section timeline

Horizontal scroll (only horizontal-scroll surface; sections have natural L→R semantics). Long-press to reorder, tap to edit.

### Song home view

```
┌─────────────────────────────────────┐
│ ← Late Night Jam · v3 ▾ · 🔔(3)     │
├─────────────────────────────────────┤
│ Sections: [Intro][Verse][Chorus][..] ← horiz scroll
├─────────────────────────────────────┤
│ Active mix: "Marco's pick" ▾        │
├─────────────────────────────────────┤
│ ▶ Chords                            │
│   "Jazz progression v2" • 🔥3 ❤️1   │
│   Whole song · by Marco             │
│   [Browse takes (4)]                │
├─────────────────────────────────────┤
│ ▶ Melody                            │
│   "Sleepy hook" · 🔥1               │
│   Verse only · by you               │
│   [Browse takes (2)]                │
├─────────────────────────────────────┤
│ ... (bass, drums, lyrics)           │
├─────────────────────────────────────┤
│ Mix ▾  • + Add take                 │  ← ContextBar
└─────────────────────────────────────┘
        ●  ← FloatingTransport
```

Tap a SlotRow → TakeSheet slides up showing all takes grouped by section, with reactions/comments inline.

---

## Playback engine (Tone.js)

- One Tone.Transport per page
- Section-aware: walk through sections in order, for each (section, slot), find selected take; queue notes with appropriate bar offset
- Synths per slot kind (deliberately ugly previews):
  - chords: PolySynth (soft saw)
  - melody: Synth (triangle)
  - bass: MonoSynth (square)
  - drums: Sampler with a few bundled 808 samples
- Volume/mute/solo per slot in transport expanded view
- Tempo update on active version → just sets `Tone.Transport.bpm`; no take regeneration needed (musical time)

---

## MIDI rendering & export

Native takes render to MIDI on save (server-side via `@tonejs/midi`). For mix export:
1. Walk sections in order
2. For each (section, slot), find selected take, extract its bar range, offset to section's start_bar
3. Stitch into per-slot tracks
4. Bundle: per-slot .mid files + combined multi-track .mid + manifest.json

`manifest.json`:
```json
{
  "song": "Late Night Jam",
  "version": 3,
  "version_label": "slower take",
  "tempo": 100,
  "key": "Cm",
  "time_signature": "4/4",
  "bar_count": 32,
  "exported_at": "2026-05-20T12:00:00Z",
  "drum_kit": [
    { "label": "Kick", "midi_note": 36 },
    { "label": "Snare", "midi_note": 38 }
  ],
  "tracks": [
    { "file": "chords.mid", "slot": "chords", "take_name": "Jazz progression v2", "author": "marco" }
  ]
}
```

GM drum mapping means a plain DAW import works without translation. Friendly labels are UI-only.

---

## State management

- **Server state**: TanStack Query. `refetchOnWindowFocus: true`, `refetchInterval` on song view (~30s) so new takes appear during a session.
- **Editor state**: Zustand per editor (in-progress payload, undo, current pitch/vel/length)
- **Playback state**: Tone.js owns transport; Zustand mirrors for UI
- **Read state**: TanStack mutation on song open

---

## Auth, deployment

NextAuth credentials provider + bcrypt. User seeding via a one-off CLI script (`pnpm seed:users`).

Railway: Next.js service (`output: 'standalone'`), Postgres add-on, volume at `/data`, Drizzle migrations on deploy. Env: `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `STORAGE_PATH=/data`.

PWA manifest + icons in week 1 (cheap; lets friends add-to-home-screen early). Service worker for offline-shell deferred.

---

## Build order (revised, audience-aware)

**Week 1 — usable async skeleton (most important week)**
- Auth, user seed
- Mobile layout primitives (AppBar, FloatingTransport, ContextBar, BottomSheet)
- Song + v1 creation flow
- Sections + drum kit setup (GM defaults)
- Upload-a-MIDI take (section-scoped or whole-song)
- Mix create + section-aware selection
- Tone.js playback
- Export (zip + manifest)
- **Activity feed + unread badges**
- **Reactions on takes**
- Comments on takes
- Railway deploy
- PWA manifest

By end of week 1: friends can use it. They drop MIDI from their DAW, mix-and-match, react, comment, export. The app already feels alive even without editors.

**Week 2 — chord builder**
- ChordBuilder mobile UI
- Tonal.js for chord-to-MIDI
- Save as native take

**Week 3 — tracker editor**
- Vertical canvas grid, pitch selector, input row in ContextBar
- Tap-to-place, select, long-press menu
- Configurable granularity
- Native take save
- In-editor preview playback

**Week 4 — drum tracker + polish**
- Drum tracker variant (pad row instead of piano)
- Velocity editing
- Lyrics editor + section tagging
- Mix sharing via URL (private, signed link)
- Fork-a-take UI
- Per-slot volume/mute/solo
- Visual polish

**Deferred**
- Push notifications
- MPC sync script (separate repo)
- Audio rendering
- Import-takes-from-parent-version
- Public sharing
- Effects, automation

---

## Risks worth tracking

1. **No-gear friends need the tracker to be good, fast.** Week 3 is now load-bearing. If the tracker feels janky, they won't contribute and the project loses half its point. Build it with real song attempts during the week, not at the end.

2. **Section-scoped take UX is the trickiest interaction.** SlotRow needs to communicate "verse uses take A, chorus uses take B" without becoming a spreadsheet. Prototype this component in week 1 even though full section-scoping might not be exercised until later.

3. **Activity feed deduplication.** A flurry of edits shouldn't produce a flood of activities. Group reactions/comments per take per hour. Roll up "Marco added 3 takes" instead of 3 separate items.

4. **Latency from China.** You're in Chengdu, friends are elsewhere. Railway's regions matter. Pick the region closest to the majority of users (probably US East or EU), accept that your own experience will have some lag. Worth measuring on day 1.

5. **Version sprawl from key/structure tweaks.** Encourage labels at fork time (modal forces a one-line description). Allow deleting versions that have no takes.

6. **MIDI file naming + manifest as the contract with future tools.** The MPC sync script and any DAW import depend on the export shape staying stable. Lock the manifest schema in week 1 and version it. Future-proof.
