# Similar Apps Research: Deuntjes Competitive Landscape

## TL;DR

After surveying ~25 web-based music collaboration tools, **no existing product implements Deuntjes' "fixed slots + multiple takes per slot + combine-and-save-as-mix" model**. The three closest competitors are:

1. **[Sesh.fm](https://sesh.fm/)** — Free browser DAW with real-time collab, version control, and stem tools. Closest in *technology* (browser, multitrack, sharing-by-link), but it's a freeform multitrack DAW, not a slot/take system, and it's pitched at beat-makers, not bedroom songwriting groups. They emphasize real-time over async.
2. **[Endlesss](https://endlesss.fm/)** (now under HabLab London / Imogen Heap) — The closest *philosophical* match: small private "Jams," async + live, loop-stack-based collaboration. It died in May 2024 and is being slowly revived; the corpse contains the most relevant lessons. Loop-stack model is adjacent to slots but not the same — Endlesss layers loops, doesn't let you A/B-swap takes per slot.
3. **[Highnote.fm](https://www.highnote.fm/)** — Async-first audio feedback (timestamped comments, voice notes, version stacking) for small groups. Strong on the *reactions/comments on takes* axis, but it's a review tool not a creation tool — no MIDI building, no playback combination.

Nobody combines: invite-only friend group + async-first + MIDI upload + in-browser tracker + per-slot take selection + saved "mixes." That gap is real.

---

## "Mix-and-Match Takes" Concept — Is Anyone Doing This?

**Verdict: No, not as described.** Closest analogues:

- **[Kanye/Kano Stem Player](https://en.wikipedia.org/wiki/Stem_Player)** and its web-product sibling **[StemFM](https://stem.fm/)**: hardware/web app that splits a finished song into 4 stems (vocals, bass, drums, other) and lets you mute/solo/remix them live. It's the *playback* half of mix-and-match, but stems come from one canonical recording — there are no alternative takes to swap between. It's downstream of authoring, not part of it.
- **[Stems-music.com](https://www.stems-music.com/stems-is-for-djs/)** — DJ format where tracks ship as 4 stems for live mixing/swapping between *different songs*. Adjacent but DJ-context, not authoring.
- **[Tracklib](https://www.tracklib.com/)** — Stem marketplace; "match real songs with curated sample packs" is mix-and-match-flavored but at sampling/licensing layer, not collaborative authoring.
- **[Sesh.fm AI Stem Splitter](https://sesh.fm/tools/ai-stem-splitter)** — Splits, doesn't recombine multi-author takes.
- **DAW vocal comping** (Logic, Reaper, Pro Tools — see [Sound on Sound](https://www.soundonsound.com/techniques/vocal-comping)) — The "take folders" / comping UI is the conceptual ancestor of Deuntjes' slot-with-takes, but it's solo, single-instrument (usually vocals), and you bake one composite — you don't save and share alternative comps as named mixes.

**The novel combination Deuntjes proposes** — multiple authors each drop their own take into a fixed slot, then *any contributor* picks one take per slot to assemble a "mix" they can save and others can A/B against — is not in any product I found. The DAW comping pattern proves the UX is intuitive at the single-track scale; Deuntjes generalizes it across slots and authors.

---

## 1. Async Collaborative DAWs / Songwriting Tools

- **[BandLab](https://www.bandlab.com/)** — Free, cloud-based, web + native. Up to 50 collaborators per project, async-friendly (cloud autosave, no DAW-export needed). Mobile-quality is good. Freemium with most features free. **Good:** frictionless sharing, mobile-first, AI SongStarter for cold-start. **Missing for us:** freeform multitrack — no slot concept, no take-swapping. Public-platform DNA: discover feeds, social. Not invite-only friend-group flavored. Too big and busy for 4 friends.
- **[Soundtrap](https://www.soundtrap.com/)** (Spotify) — Browser DAW with [opt-in live collab](https://blog.symphonic.com/2022/08/19/spotifys-online-music-studio-now-offers-live-collaboration-2/), section commenting, autosave. **Pricing:** free tier; Premium €/$7.99–$11.99/mo. **Good:** in-track comments, classroom-friendly. **Missing:** no slot/takes model; live-collab framed (the marquee feature is real-time). MIDI editing exists but the tool is sample-loop-centric.
- **[Soundation](https://soundation.com/)** — Ableton-like browser DAW with "Collab Live." Premium €6.99/mo. WebAssembly-threaded engine. **Good:** snappy, professional UI, real-time presence. **Missing:** still a freeform DAW, no take-comping for groups.
- **[Audiotool](https://www.audiotool.com/)** — Modular hardware-emulator UI in the browser, free, big sample library, real-time chat collab. Niche and steep; not mobile-friendly. No slot/take model.
- **[Amped Studio](https://ampedstudio.com/)** — Browser DAW with VST support and a [hum-to-MIDI](https://www.musicianwave.com/best-online-daws/) feature. Free / $6.99 / $12.99 tiers. Async via cloud projects. Adjacent to Deuntjes' melody-capture surface but again a generic DAW.
- **[Kompoz](https://www.kompoz.com/)** — Explicitly async, explicitly cross-timezone (their pitch literally is "members in 120 countries, 24 timezones"). Workflow: record in your DAW, upload tracks, others add. Private studios available. **Good:** async-first ethos validates Deuntjes' premise. **Missing:** no in-browser building (you must use your own DAW), no slot/take swap, dated UI, marketplace overlay (SoundBlend).
- **[BeatConnect](https://www.beatconnect.com/)** — Was a shared multiplayer sequencer with offline contribution. **Shutting down** per their own site. Add to the corpse pile.
- **[Endlesss](https://endlesss.fm/)** — Shut down May 2024, [revived under HabLab London](https://endlesss.fm/) (Imogen Heap's org) in 2025. Loop-stack model: people drop short loops ("Rifffs") into shared Jams. **Closest to Deuntjes' vibe:** small private bands, async-tolerant, build-the-song-together. **Lesson 1:** A passionate small-group community can sustain this category — its shutdown was bemoaned, not ignored. **Lesson 2:** SaaS-fragility: when the server died, the songs died ([CDM coverage](https://cdm.link/endlesss-discontinued/)). For Deuntjes — exportable mixes/MIDI matter.
- **[Sessionwire](https://www.sessionwire.com/)** — Real-time virtual studio for pros (video + low-latency audio). Native-first, not browser-async. Skip.
- **[Sesh.fm](https://sesh.fm/)** — Free browser DAW, real-time + offline contribution, link-sharing to Discord/iMessage, version rollback, [18k sounds](https://sesh.fm/features). **Good:** version control as first-class, frictionless sharing, real-time chat. **Missing:** freeform tracks not slots; no MIDI uploads from external DAW prioritized; pitched as beat-maker tool.
- **[Session Studio](https://www.sessionstudio.com/)** — Mobile/web/desktop for managing song credits, splits, audio + lyric collab. More of a metadata/rights tool with audio attached than a creation tool. Useful precedent for splits — irrelevant for our 3-4 friends.

## 2. Stem Swap / Mix-and-Match Tools

- **[Kanye/Kano Stem Player](https://en.wikipedia.org/wiki/Stem_Player)** + **[StemFM](https://stem.fm/)** — Discussed above. UX lesson: 4 sliders, tactile mute/solo, instant A/B is *exactly* the playback ergonomic Deuntjes wants for the "compare mixes" surface. Steal this.
- **[Stems format (stems-music.com)](https://www.stems-music.com/stems-is-for-djs/)** — 4-stem track format for DJs. Adjacent.
- **[SongStems.net](https://songstems.net/)** — Community remix-pack sharing. No mix UI, just file exchange.
- **[Tracklib](https://www.tracklib.com/)** — Stem licensing marketplace + app to "mix and match" sample combinations. Their app UX for browsing-by-stem is worth studying.

## 3. Browser Trackers / Simple DAWs

- **[BeepBox](https://www.beepbox.co/)** and its fork **[JummBox](https://jummb.us/)** — URL-as-save-state chiptune trackers. **Steal:** zero-friction onboarding, share by link, pattern grid that maps cleanly to mobile. **Avoid:** chiptune-only sound, no multi-author state. Deuntjes' in-browser builder should feel this immediate.
- **[Chrome Music Lab Song Maker](https://musiclab.chromeexperiments.com/Song-Maker)** — Grid composer, share-by-link, no login, instant. **Steal:** the no-login + share-link onboarding. **Note:** the [Shared Piano](https://musiclab.chromeexperiments.com/Shared-Piano/) sub-tool is a tiny precedent for real-time multi-author web music.
- **[Signal](https://signalmidi.app/)** — Open-source MIT-licensed browser MIDI editor with piano roll, tempo automation, Web MIDI input. Single-user only. **Strongly relevant** as a reference implementation for Deuntjes' in-browser MIDI editor — same Next-on-Vercel deployment stack ([signal.vercel.app](https://signal.vercel.app/)). Could even be a code-reading reference for piano-roll UX.
- **[OnlineSequencer.net](https://onlinesequencer.net/)** — Since 2013. Simple browser sequencer with light multiplayer/share features. Active community. Aesthetic is dated; mobile is rough.
- **[Strudel](https://strudel.cc/)** — Tidal-style live-coded music in the browser. Niche, code-first, live-jam-oriented. Not really competitive but interesting for the "browser sound engine via Tone.js / Web Audio" stack.

## 4. Friend-Group / Private Music Apps

- **[Endlesss](https://endlesss.fm/)** — Already covered. The single most aligned precedent on the "small private band, async-tolerant" axis. Its death and partial revival validate the category and warn about runway/data-portability.
- **[SonoBus](https://www.sonobus.net/)** — Free open-source peer-to-peer low-latency audio streaming. **Live-only**, not browser, not async. Mention and skip — different problem.
- **[Muse Sessions (musesessions.co)](https://musesessions.co/)** — Music collab tool; thin info, niche. Less relevant than Sesh or Sessionwire.

## 5. Voice/Melody Capture ("sing it and we'll write it")

- **[Amped Studio hum-to-MIDI](https://ampedstudio.com/)**, **[Musicful](https://www.musicful.ai/music-generate/hum-to-music-ai/)**, **[Hum to Song AI](https://www.aimakesong.com/hum-to-song)**, **[SoundTools.io voice-to-instrument](https://soundtools.io/voice-to-instrument/)** — AI hum-to-melody/song tools. Generally produce a finished AI track, not a MIDI take a collaborator can audition and approve. Could be a future Deuntjes feature ("hum a melody → drop it as a MIDI take in the melody slot") but no existing product places voice capture inside an async slot-based collab loop.
- **[Auxy](https://auxy.co/apps/)** — iOS-only loop-based mobile sequencer. Beautiful, fast, mobile-native. **Steal:** the speed-of-sketching ethos and 1/2/4-bar loop framing — that maps well to per-slot takes. **Skip:** native-only, no collab.

## 6. MIDI-Centric Web Tools

Covered above: **[Signal](https://signalmidi.app/)** (best reference), **[OnlineSequencer](https://onlinesequencer.net/)**, **[BeepBox/JummBox](https://www.beepbox.co/)**. None do MIDI-upload + in-browser-build + multi-author take selection.

## 7. Lyric Collab / Songwriting Helpers

- **[LyricStudio](https://lyricstudio.net/)** — Real-time collaborative lyric editor, private chatrooms, rhyme dictionary, free / $5.99 / $9.99 tiers. **Steal:** the lyric-room model for Deuntjes' lyrics slot — multi-author lyric editing with versioning is a thing.
- **[RapPad](https://www.rappad.co/editor)** — AI rap-lyric writer; single-user feel.

## 8. Async Audio Feedback (reactions/comments on takes)

- **[Highnote.fm](https://www.highnote.fm/)** — Private "Spaces" for small groups, **timestamped text + voice comments on audio**, version stacking, polls. **This is the closest match for Deuntjes' "reactions + comments on takes" axis.** Backed by Dropbox, $1.7M pre-seed. **Steal:** voice notes on a take, timestamp anchoring, polls (literally already validates "vote on which take is the keeper"). **Missing:** review-only — no creation, no MIDI, no mix-assembly.
- **[Pibox](https://pibox.com/)** — Similar: audio review w/ waveform-timestamped comments, version chains, mobile review. Pro/agency flavor. **Steal:** version chain visualization.
- **[Soundwhale](https://soundwhale.com/)** — Sample-accurate synchronized remote review. Pro post-production tool. Overkill for 4 friends but the sync-playback pattern is a north star.
- **[Splice Studio](https://www.musicradar.com/news/splice-studio-closing)** — Shut down. Splice gave up on collab to focus on samples. Another corpse — note the [MusicRadar coverage](https://www.musicradar.com/news/splice-studio-closing): they admitted they couldn't make the UX good enough. That's a warning that this is genuinely hard.

---

## What to Steal / What to Avoid

**Steal:**
- **Stem Player's 4-slider mute/solo ergonomic** ([Kanye/Kano](https://en.wikipedia.org/wiki/Stem_Player)) for the mix-comparison view — one row per slot, tap a take to swap. Tactile, mobile-first, instant A/B.
- **Highnote's timestamped voice notes on a take** ([highnote.fm](https://www.highnote.fm/)) for asynchronous reactions — much higher signal than thumbs-up.
- **BeepBox/Song Maker share-via-URL state** ([beepbox.co](https://www.beepbox.co/), [musiclab](https://musiclab.chromeexperiments.com/Song-Maker)) for friction-free "here's the mix I made" sharing inside the friend group.
- **Sesh.fm's auto-versioning every save** ([sesh.fm/features](https://sesh.fm/features)) — at the song/mix level, not the track level, to align with Deuntjes' "key/structure forks; tempo fluid" rule.
- **Endlesss's loop-stack social vibe** — bite-sized contributions, low-pressure, "drop something in." Lower the bar for what a "take" is.
- **Signal's piano-roll UX** ([signalmidi.app](https://signalmidi.app/)) — open source, MIT, browser, same Next/Vercel stack. Literal reference implementation.
- **LyricStudio's collab chatroom for lyrics** — multi-author rich-text with versioning belongs in the lyric slot.

**Avoid:**
- **Splice/BeatConnect's fate** — both shut down their collab products. The lesson: real-time-everything is over-engineered for the actual use case (people aren't online together). Async + presence-when-it-happens beats live-jam mandates.
- **BandLab/Soundtrap's social-platform sprawl** — feeds, followers, discovery. Deuntjes is 4 friends; resist the feature creep.
- **Endlesss's data lock-in** — when the server died, songs were nearly lost. Provide MIDI export and per-mix audio bounce from day one.
- **Soundtrap's pricing model** — paywalling collaboration is the wrong shape for a friend-group product. Whatever Deuntjes charges, it shouldn't be per-seat-per-month at $10.
- **Audiotool's modular-rack UI** — beautiful, but terrible on mobile and discouraging for non-producers. Deuntjes' mobile-first means radical UI simplification.
- **Kompoz's "upload from your DAW only"** — half the friends won't have a DAW open. The in-browser builder is the equalizer.

---

## Defensibility

Deuntjes' angle is defensible *for its scope.* The combination of (a) **invite-only 3-4-person friend groups**, (b) **async-first** (not real-time), (c) **fixed slots with multiple takes**, (d) **MIDI-upload + in-browser building in one tool**, and (e) **save-and-compare named mixes** is not implemented anywhere I found. Each axis individually has competitors:

- BandLab/Soundtrap/Sesh own freeform-multitrack browser DAWs
- Highnote/Pibox own async review
- Endlesss owned the small-private-band vibe (and lost it)
- Stem Player owns playback-stem-swap
- Signal owns browser MIDI editing

But the *product shape* — "songwriting as a turn-based slot game for friends, with comping at the band level" — is novel. The fact that **Splice killed Studio** and **Endlesss died and is barely back** tells you the broad collaborative-DAW market is brutal, but Deuntjes is *not* a broad collab DAW — it's a private-group toy with opinionated structure. Opinionated > general for a 4-person product.

The biggest defensibility risk is **scope creep** (becoming a general DAW) and **execution on the mix-and-match UX** — if "pick a take per slot, hear it, save the mix" is laggy, confusing, or hard to share, the killer feature doesn't kill anything. Get that one interaction tactile and link-shareable and the rest is gravy.
