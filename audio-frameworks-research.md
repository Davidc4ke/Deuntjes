# Audio Frameworks Research

Research compiled May 2026 for the Deuntjes async songwriting app (Next.js 15 + React 19, mobile-first, Tone.js 15 baseline).

## TL;DR — top recommendations

- **Keep Tone.js as the core.** It's the right shape for what we're doing (transport, scheduling, slot mix-and-match). Nothing on the market beats it for "musician-friendly + works on iOS Safari".
- **Add [`smplr`](https://github.com/danigb/smplr) for realistic instruments** (piano/drums/EP/mellotron) — MIT, no server, drop-in alongside Tone. Much better than `soundfont-player` (archived) for ergonomics and sound.
- **Add [`pitchy`](https://github.com/ianprime0509/pitchy) for live pitch detection** in the tracker / vocal input — ~10 KB, no model download, ESM. Best fit for an iOS-friendly tuner / melody-capture helper.
- **Use [`extendable-media-recorder`](https://www.npmjs.com/package/extendable-media-recorder) (+ WAV encoder) for vocal recording.** Native MediaRecorder is the right primitive but iOS Safari's WebM/Opus quirks mean a thin polyfill saves pain.
- **Use [`@tonejs/midi`](https://github.com/Tonejs/Midi) (already in stack) + native [Web MIDI API](https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API).** Skip the wrapper libs unless we want playNote()-style sugar.
- **Defer/avoid for now:** Magenta.js (heavy, semi-abandoned), RNBO (license footgun above $200k), Csound (LGPL on the WASM binary), Faust (cool but overkill).

---

## 1. General-purpose Web Audio frameworks

| Library | License | Maintenance | iOS Safari | Fit |
|---|---|---|---|---|
| [Tone.js](https://github.com/Tonejs/Tone.js) | MIT | Active | Good | **Keep — core** |
| [Elementary Audio](https://github.com/elemaudio/elementary) | MIT | Active | Good | Experimental |
| [Strudel](https://strudel.cc/) | AGPL-3.0 (core) | Very active | Good | Avoid (license) / fun feature |
| [Csound](https://www.npmjs.com/package/@csound/browser) | Apache-2.0 wrapper, **LGPL-2.1 wasm-bin** | Active (7.x beta) | OK (AudioWorklet) | Overkill |
| [Faust / faustwasm](https://github.com/grame-cncm/faustwasm) | MIT / LGPL pieces | Active | Good | Overkill |
| [WebPd](https://github.com/sebpiq/WebPd) | LGPL-3.0 | Alpha, slow | Untested | Avoid for prod |
| [RNBO.js](https://rnbo.cycling74.com/learn/getting-the-rnbojs-library) | engine MIT; generated code dual GPLv3 / C74 commercial | Active | Good | Avoid (license/$200k clause) |
| [Magenta.js](https://github.com/magenta/magenta-js) | Apache-2.0 | Stale (~12 mo) | Slow on mobile | Experimental |

### Notes

**Tone.js 15** — Already in our stack. Built on top of native Web Audio nodes, so it inherits good mobile/iOS Safari behavior. Just remember `Tone.start()` must be triggered by a user gesture on iOS — this is a hard requirement of the underlying [Web Audio API on Safari](https://tonejs.github.io/), not Tone-specific.

**[Elementary Audio](https://www.elementary.audio/)** — Functional declarative DSP. You describe a graph in JS and Elementary reconciles it (think React-for-audio). Genuinely interesting for parametric effects, but doesn't replace Tone's transport / scheduling. Could be a "v2 effects engine" play; not now.

**[Strudel](https://strudel.cc/)** — TidalCycles port to JS for live-coding patterns. Cool for the async-songwriting "drop a generative pattern" angle, but the core repo is **AGPL-3.0** ([Codeberg mirror](https://codeberg.org/uzu/strudel)) which is a problem if we ever close-source any of the app or want clean redistribution. Note the @strudel/* sub-packages have varying licenses — check each. Could be a "fun feature" if sandboxed, but not core.

**[Csound WASM](https://www.npmjs.com/package/@csound/browser)** — Full Csound in the browser via AudioWorklet. The wrapper is Apache-2.0 but `@csound/wasm-bin` is **LGPL-2.1** — workable as a library (dynamic linking-style), but a footgun for an SPA bundle. Beautiful tool, far too heavy for our needs.

**[Faust / faustwasm](https://github.com/grame-cncm/faustwasm)** — Compile Faust DSP code → WASM AudioWorklet. Great if we ever want custom synths/effects authored in Faust. Overkill until then.

**[WebPd](https://github.com/sebpiq/WebPd)** — Pure Data → JS/AssemblyScript compiler. Project explicitly **alpha**, many objects unsupported. LGPL-3.0. Skip.

**[RNBO](https://rnbo.cycling74.com/)** — Cycling '74's commercial product. Engine is MIT; **patcher-generated code is dual-licensed GPLv3 or a Cycling '74 commercial license**. Companies under $200k revenue currently don't owe fees but must register above that. Hard pass for a hobby app that might one day be public.

**[Magenta.js](https://github.com/magenta/magenta-js)** — ML music gen on TF.js. The npm package has been quiet for ~12 months. Models are tens of MB; inference is slow on mid-range phones. Could be a server-side "continue this drum loop" async feature later, but doesn't belong in the client bundle.

---

## 2. Synthesizers & instruments

| Library | License | Size | iOS | Fit |
|---|---|---|---|---|
| [smplr](https://github.com/danigb/smplr) | MIT | small core, CDN samples | Good | **Drop-in useful** |
| [soundfont-player](https://github.com/danigb/soundfont-player) | MIT | small | Good | Avoid (archived) |
| [WebAudioFont](https://github.com/surikov/webaudiofont) | MIT | small JS, big GM library | OK | Useful if we want full GM |
| [ZzFX](https://github.com/KilledByAPixel/ZzFX) | MIT | **<1 KB** | Good | Fun feature (UI blips) |
| Vital / Surge WASM ports | — | — | — | None exist (yet) |
| [Klangmeister](https://github.com/ctford/klangmeister) / Glicol | mixed | — | varies | Curiosity only |

### Notes

**[smplr](https://github.com/danigb/smplr)** — Author (danigb) explicitly markets it as the **modern replacement for `soundfont-player`** which is now archived. Includes 11 instruments: Sampler, Soundfont, SplendidGrandPiano, ElectricPiano, DrumMachine, DrumAbuse, Mallet, Mellotron, Smolken double bass, Versilian, Soundfont2. MIT-licensed. Samples are CDN-hosted on `smpldsnds` so no Railway volume bloat. **Strong recommend** for the "give me a real piano / EP / mellotron / drum kit out of the box" path. Plays nicely with Tone.js because it's just Web Audio nodes underneath — pipe its output through Tone's effects bus.

**[soundfont-player](https://github.com/danigb/soundfont-player)** — Use smplr instead. Same author, archived.

**[WebAudioFont](https://github.com/surikov/webaudiofont)** — Massive instrument catalog (thousands of GM variations) with built-in reverb and EQ. If we ever want a "pick any GM patch" dropdown for MIDI playback this is the move. Heavier than smplr's curated set.

**[ZzFX](https://github.com/KilledByAPixel/ZzFX)** — 1 KB total. Built for game jams. Zero use for songwriting, but cheap and adorable for app UI sounds (click, success ding, slot-locked feedback). Skip unless we want UI polish.

**Vital / Surge WASM ports** — Don't exist as redistributable browser libs. There are interesting projects like [web-synth (Ameo)](https://github.com/Ameobea/web-synth) and [webOBXD](https://github.com/jariseon/webOBXD), but none are drop-in. If we want analog-style synths, use Tone's `MonoSynth` / `FMSynth` or build patches with Elementary later.

---

## 3. Audio effects libraries / DSP

| Library | License | Size | iOS | Fit |
|---|---|---|---|---|
| Native Web Audio nodes | n/a | 0 | Good | **Default** |
| [Tuna.js](https://github.com/Theodeus/tuna) | MIT | ~30 KB | Good | Drop-in useful |
| [Pizzicato.js](https://github.com/alemangui/pizzicato) | MIT | ~25 KB | Good | Optional |
| Tone.js effects | MIT | bundled | Good | **Use first** |

### Notes

Tone.js already includes Reverb, FeedbackDelay, PingPongDelay, Chorus, Phaser, AutoFilter, Distortion, BitCrusher, etc. Reach for these first.

**[Tuna.js](https://github.com/Theodeus/tuna)** — Old-school effects library (since 2012), npm 1.1.3 still publishing. Has a `Convolver` node with bundled IRs which is nice if Tone's reverb doesn't sound how we want, plus some quirky effects (Tremolo, MoogFilter, Bitcrusher). Lightly maintained. Only pull in if we hit a Tone gap.

**[Pizzicato.js](https://github.com/alemangui/pizzicato)** — Similar scope to Tuna with a friendlier API: ping-pong delay, dub delay, quadrafuzz, ring modulator. Maintenance is slow. Not necessary alongside Tone.

For convolution reverb specifically, just use Tone's `Convolver` and load an IR sample. We don't need a wrapper.

---

## 4. Voice input / vocal modulation / pitch

This is where the most interesting "songwriting helper" features live.

| Library | License | Approach | Size | iOS | Fit |
|---|---|---|---|---|---|
| [pitchy](https://github.com/ianprime0509/pitchy) | ISC | McLeod algorithm, pure JS | ~10 KB ESM | Good | **Drop-in useful** |
| [Pitchfinder](https://github.com/peterkhayes/pitchfinder) | MIT | multiple algorithms | ~15 KB | Good | Alternative to pitchy |
| [aubio.js](https://github.com/qiuxiang/aubiojs) | GPL-3.0 (aubio) | WASM, pitch + beat | ~300 KB | Good | **Avoid (GPL)** |
| [ml5.js + CREPE](https://github.com/ml5js/ml5-library) | MIT | TF.js DNN | ~MB + model | Slow on mobile | Experimental |
| [phaze](https://github.com/olvb/phaze) | MIT | phase vocoder Worklet | small | Good | Drop-in useful |
| [SoundTouchJS](https://github.com/cutterbl/SoundTouchJS) | LGPL-2.1 | time/pitch shift Worklet | ~50 KB | Good | Caution (LGPL) |
| [pitch-shift](https://www.npmjs.com/package/pitch-shift) | MIT | granular | small | Good | OK |

### Notes

**[pitchy](https://www.npmjs.com/package/pitchy)** — McLeod Pitch Method, accurate to a few cents, runs comfortably at audio rate in an AudioWorklet. v4 is **ESM-only**, which Next.js 15 / React 19 handle fine. Best choice for "what note is the user singing?" and for the tracker melody-capture flow.

**[Pitchfinder](https://github.com/peterkhayes/pitchfinder)** — Bundle of detection algorithms (YIN, AMDF, dynamic wavelet, etc). Useful if pitchy struggles on a particular voice and we want to A/B.

**[aubio.js](https://github.com/qiuxiang/aubiojs)** — Powerful (pitch + tempo + onset) but the underlying aubio library is **GPL-3.0**. Hard avoid for distributed JS.

**[ml5.js + CREPE](https://wp.nyu.edu/shanghai-ima-documentation/category/electives/interactive-machine-learning/)** — Best accuracy in the field, but downloads a multi-MB TF.js model and runs on WebGL — battery and latency killer on phones. Skip for live, maybe useful for an async "transcribe my vocal" server-side feature.

**Autotune / pitch-correction.** No single permissive npm package gives us a polished autotune. The realistic path:
- **[phaze](https://github.com/olvb/phaze)** — MIT-licensed real-time pitch-shifter Worklet, phase-vocoder based. Solid foundation.
- Combine pitchy (detect note) + phaze (shift to nearest scale degree) and you have a basic autotune in maybe ~200 lines. The reference for this exact recipe is [alexcrist/autotone](https://github.com/alexcrist/autotone) (MIT) — worth reading even if we don't take it as a dep.
- **SoundTouchJS** has LPC-based formant preservation which sounds more natural but is **LGPL-2.1**.
- Harmonizer/vocoder libs: none worth recommending; build with `OscillatorNode` + envelope follower if we want a talkbox effect.

---

## 5. Recorders

| Library | License | Format | iOS | Fit |
|---|---|---|---|---|
| Native MediaRecorder | n/a | webm/mp4 (varies) | iOS 14.3+ | **Default** |
| [extendable-media-recorder](https://www.npmjs.com/package/extendable-media-recorder) | MIT | pluggable (WAV encoder available) | Good | **Drop-in useful** |
| [opus-recorder](https://github.com/chris-rudmin/opus-recorder) | MIT | Ogg Opus / WAV | iOS can't play Opus | Avoid for our case |
| [opus-media-recorder](https://github.com/kbumsik/opus-media-recorder) | MIT | Opus / WAV via WASM polyfill | mic empty on iOS Safari | Avoid |
| [Recorder.js](https://github.com/mattdiamond/Recorderjs) | MIT | WAV | OK | Stale — prefer above |
| [audio-recorder-polyfill](https://github.com/ai/audio-recorder-polyfill) | MIT | WAV | Good | Drop-in useful |

### Notes

iOS Safari is the constant headache. Key facts:
- Safari supports MediaRecorder from iOS 14.3, but only mp4/AAC by default.
- Safari cannot decode Opus, so producing Opus is pointless if we plan to play takes back in-browser.
- WebKit's MediaRecorder has had bugs where the mic stream returns silence in third-party iOS browsers (which are all WebKit anyway).

Recommended stack:
1. Default to **`MediaRecorder` with WAV via `extendable-media-recorder` + `extendable-media-recorder-wav-encoder`**. Universal playback, ~10x larger files than Opus but takes are short.
2. Fallback to native `MediaRecorder` with `audio/mp4` on iOS where WAV-via-polyfill misbehaves.
3. Visualize during recording with `wavesurfer.js` record plugin (see §7) — note the iOS Safari quirk about passing `timeslice: 1000` to `start()`.

---

## 6. MIDI

| Library | License | Purpose | Fit |
|---|---|---|---|
| Native Web MIDI API | n/a | hardware/software MIDI I/O | Use directly |
| [@tonejs/midi](https://github.com/Tonejs/Midi) | MIT | parse/write .mid files | **Already in stack** |
| [webmidi.js](https://webmidijs.org/) | Apache-2.0 | high-level wrapper around Web MIDI | Optional sugar |
| [JZZ.js](https://jazz-soft.net/) | MIT | MIDI for Node + browser, virtual ports | Optional |

### Notes

For our use case (parsing user-uploaded `.mid` files from DAWs, scheduling notes via Tone) `@tonejs/midi` is exactly the right tool and we're already on it.

If we ever wire up live MIDI controllers (a USB keyboard plugged into a phone via USB-C?), the native Web MIDI API is fine; **[webmidi.js v3](https://webmidijs.org/)** provides `playNote()` / `sendControlChange()` sugar. iOS Safari only got Web MIDI support recently (16.4+) — Android Chrome has had it for years.

JZZ.js is more powerful (virtual ports, in-browser kbd input) but heavier; only worth it if we need virtual MIDI routing.

---

## 7. Notation & visualization

| Library | License | Input format | Bundle | Fit |
|---|---|---|---|---|
| [VexFlow](https://github.com/vexflow/vexflow) | MIT | JS API / VexTab | ~700 KB | Drop-in for staff rendering |
| [abcjs](https://github.com/paulrosen/abcjs) | MIT | ABC notation | ~400 KB | **Drop-in useful** |
| [OpenSheetMusicDisplay](https://github.com/opensheetmusicdisplay/opensheetmusicdisplay) | BSD-3-Clause | MusicXML (on top of VexFlow) | ~1 MB | Drop-in for MusicXML |
| [wavesurfer.js](https://github.com/katspaugh/wavesurfer.js) | BSD-3-Clause | audio buffer | ~80 KB + plugins | **Drop-in useful** |
| [peaks.js](https://github.com/bbc/peaks.js) | LGPL-2.1 | audio + waveform-data | ~200 KB | Caution (LGPL) |

### Notes

For the tracker UI we render our own grid, but if we ever want to show "here's the chord progression on a staff" or "here's the melody you recorded as notes", **abcjs** is the friendliest. ABC is a tiny text format we can produce from our chord/note model trivially.

**VexFlow** is more powerful but requires building objects programmatically. **OSMD** is the right choice only if users upload MusicXML.

**wavesurfer.js** is the natural fit for visualizing recorded vocal takes. Has a [Record plugin](https://wavesurfer.xyz/) that combines mic capture + live waveform. Permissive license, very active, handles iOS Safari with the known `timeslice: 1000` workaround.

**peaks.js** is BBC's waveform editor (regions, markers) but is **LGPL-2.1** — avoid unless we use it via a dynamic boundary.

---

## 8. Trackers / sequencer UIs

We're building our own tracker UI but it's worth knowing what's out there to borrow patterns and look-and-feel from.

- **[BassoonTracker](https://github.com/steffest/BassoonTracker)** — MIT-licensed, pure-JS, full Amiga ProTracker / FastTracker XM editor in the browser. Plays/edits `.mod` and `.xm`, exports `.mod`/`.xm`/`.wav`/`.mp3`. Worth studying for the keyboard-shortcut feel and the way it lays out a tracker grid on a desktop screen. Mobile is not its strength — we already chose mobile-first, so we're inventing here, but BassoonTracker's data model (rows × channels × note/instrument/effect cells) is a sound reference.
- No other actively maintained tracker UI in JS is significantly different. Most others are abandoned ports of MilkyTracker etc.

---

## 9. AI music (Magenta etc.)

Already covered in §1 — short version: **don't ship Magenta in the client.** If we want a "continue this drum loop" or "suggest a melody over these chords" feature, run it server-side (Python Magenta, or a hosted model) and return MIDI. Browser TF.js inference on a phone is too slow and too battery-hungry for a feature that won't be used often.

A lighter, deterministic alternative: write Markov-chain or rule-based generators using **[tonal](https://github.com/tonaljs/tonal)** (already in stack) for scale/chord awareness. Cheap, fun, no model download.

---

## Suggested next experiments

Ranked by effort × value for our concrete app:

1. **Add `smplr` for instrument variety** *(small, immediate UX win)*. Wire SplendidGrandPiano + DrumMachine + Mellotron into the playback engine as alternative voices for the chords / drums / melody slots. Pipe through Tone's effects/master bus. ~half-day.

2. **`wavesurfer.js` for waveform display on vocal takes** *(visible win)*. Use the Record plugin for capture + native waveform UI for take comparison. ~half-day. Mind the iOS `timeslice: 1000` quirk.

3. **`pitchy` in an AudioWorklet for live pitch readout** *(songwriting helper)*. Show "you're singing C4" in the tracker / vocal-recording UI; let users tap "capture this as the melody note for row N". Most musician-friendly feature we could ship cheaply.

4. **`extendable-media-recorder` + WAV encoder for vocal-take recording** *(robustness)*. Standardize on WAV so playback is identical on iOS / Android / desktop, accept the file-size cost (takes are short).

5. **Cheap autotune experiment** *(fun feature)*. Compose `pitchy` (detect) + `phaze` (shift) + `tonal` (snap to scale). Could be a "Slot Mode: Autotuned" toggle on vocal takes. Reference: alexcrist/autotone repo.

6. **abcjs render of the locked chord progression** *(polish)*. Once a chord take is locked in, show it as a one-line staff above the slot. ~hour with ABC generation from our chord model.

7. **Tuna.js convolution reverb send** *(later)*. Only if Tone's reverb sounds insufficient.

8. **Server-side Magenta drum-continuation, async** *(later/maybe)*. Async-songwriting frame is perfect for "request a drum suggestion, get a notification when it's ready". Build only after the core slot UX is loved.

### Things to actively avoid

- **Strudel core, aubio.js, SoundTouchJS** — license incompatibility risk (AGPL / GPL / LGPL).
- **RNBO** — license footgun for any future commercial use.
- **Magenta.js in the client bundle** — too heavy, too slow on phones.
- **opus-recorder / opus-media-recorder** — iOS Safari can't decode Opus, undermines mix-and-match playback.
- **Csound WASM** — beautiful, unjustifiable bundle weight and LGPL on the binary.

---

## Appendix: Effects deep-dive (reverb, delay, modulation, etc.)

Tone.js 15 already ships a respectable in-house effects rack: `Reverb` (convolution-via-Freeverb-fallback), `JCReverb`, `Freeverb`, `FeedbackDelay`, `PingPongDelay`, `Chorus`, `Phaser`, `Vibrato`, `Tremolo`, `AutoFilter`, `AutoWah`, `Distortion`, `BitCrusher`, `Chebyshev`, `FrequencyShifter`, and `PitchShift`. For most "musical" use cases that's enough. The gaps worth filling are: **studio-grade reverb (true convolution with curated IRs, plus algorithmic plate/hall/shimmer), tape-style delay, rotary/Leslie, analog-modelled filters (Moog ladder, SVF), multiband/sidechain dynamics, and granular/freeze/glitch**. Everything below was checked against the constraint that it must run in a modern Next.js 15 + React 19 browser app, ideally with AudioWorklet (not ScriptProcessorNode, which iOS Safari still tolerates but Chrome has been threatening to remove since 2018).

A general warning up front: a lot of the "web audio effects" npm ecosystem is from 2014–2017 and still uses `ScriptProcessorNode`. Those will run on iOS 14.5+ but glitch on the main thread under load. I have flagged each one.

### Reverb

| Library | What it is | License | Size | iOS / Worklet | Maintained | Verdict |
|---|---|---|---|---|---|---|
| **Tone.Reverb** (baseline) | Convolution reverb with auto-generated IR (Freeverb-style noise burst, decay shaped) | MIT | in Tone | Yes | Active | Baseline |
| **freeverb-ts** ([npm](https://www.npmjs.com/package/freeverb)) | Schroeder/Freeverb implementation as a WebAudio node graph | MIT | ~5 KB | Yes (native nodes only) | Stale (2017) but works | Skip — duplicates Tone.Freeverb |
| **CloudSeed-WASM** ports ([github.com/ValdemarOrn/CloudSeed](https://github.com/ValdemarOrn/CloudSeed), JS port at [github.com/chrisguttandin/cloud-seed-web](https://github.com/chrisguttandin/cloud-seed-web)) | WASM port of CloudSeed — algorithmic shimmer/hall reverb, 8 diffusers + pitch-shifted feedback. Closest thing to a Valhalla Shimmer in the browser. | MIT (original) | ~200 KB wasm | AudioWorklet — iOS 14.5+ OK | Original C++ dormant; JS ports lightly maintained | **Drop-in useful** for shimmer/hall |
| **Convolver + curated IRs** (native `ConvolverNode` + IR pack) | Just `ConvolverNode` with real impulse responses | n/a | depends on IRs | Yes | Native | **Drop-in useful** — see IR sources below |
| **schroeder-reverb** ([npm](https://www.npmjs.com/package/schroeder-reverb)) | Tiny Schroeder allpass reverb | MIT | <2 KB | Yes | 2018, dead | Skip |
| **waa-reverb** | Convolver wrapper with a few baked IRs | MIT | small | Yes | Dead (2015) | Skip |
| **DattorroReverbNode** ([github.com/khoin/DattorroReverbNode](https://github.com/khoin/DattorroReverbNode)) | Dattorro plate reverb as an AudioWorklet | MIT | ~10 KB | Worklet, iOS OK | Lightly maintained, code is solid | **Drop-in useful** — best plate-style algorithmic |
| **soundpipe-web** (Soundpipe via WASM) | Hundreds of DSP modules incl. zitarev, bigverb | MIT | large bundle | Worklet | Niche | Experimental |

**Free / permissive IR collection sources** (host these in `public/irs/` or R2):

- **OpenAIR** ([openair.hosted.york.ac.uk](https://www.openair.hosted.york.ac.uk/)) — University of York, anechoic + real spaces, CC-BY 4.0. Cathedrals, halls, tunnels.
- **EchoThief Impulse Response Library** ([echothief.com](http://www.echothief.com/)) — CC-BY, 115 unusual spaces (caves, silos, churches).
- **Voxengo Free IRs** ([voxengo.com/impulses](https://www.voxengo.com/impulses/)) — Free, redistributable, halls/plates/springs.
- **MIT McDermott Lab IRs** — research-grade rooms, permissive.
- **Fokke van Saane** (mirrored on archive.org) — historical organ/cathedral IRs, public-use.

For a Tone.Reverb replacement you can just `new Tone.Convolver().load("/irs/hall-medium.wav")` and ship 3-5 IRs (~200-800 KB total at 24-bit 48k mono trimmed to 2-4 s).

### Delay

| Library | What it is | License | iOS / Worklet | Maintained | Verdict |
|---|---|---|---|---|---|
| **Tone.FeedbackDelay / PingPongDelay** (baseline) | Clean digital delay | MIT | Yes | Active | Baseline |
| **Tuna.js** `Delay` + `Filter` chain ([github.com/Theodeus/tuna](https://github.com/Theodeus/tuna)) | Older effects suite | MIT | Native nodes, iOS OK | Dormant since 2019 | Skip — fully duplicated by Tone |
| **Pizzicato.js** `Delay` ([alemangui.github.io/pizzicato](https://alemangui.github.io/pizzicato/)) | Friendlier API around WebAudio | MIT | Native nodes | Light maintenance | Skip — duplicates Tone |
| **tape-delay** (custom: Tone.FeedbackDelay + LFO on `delayTime` + Tone.Distortion in feedback loop) | Build-it-yourself tape emulation | — | Yes | — | **Drop-in useful** — recipe, not a library |
| **looper.js** / **recorder.js + scheduling** | Live looper | MIT (various) | Yes | Mostly dead | Build on top of `Tone.Player` + `Tone.Recorder` instead |
| **soundtouch-js** ([github.com/cutterbl/SoundTouchJS](https://github.com/cutterbl/SoundTouchJS)) | Time-stretch / pitch-shift; can drive granular feedback delay | LGPL-2.1 | Worklet branch exists; main is ScriptProcessor | Active | **Flag: LGPL** — dynamic linking from a web bundle is debated; safer to keep optional or skip |
| **rubberband-web** ([github.com/jhasse/rubberband-web](https://github.com/jhasse/rubberband-web)) | WASM Rubber Band time/pitch | GPL-2.0 | Worklet | Active | **Avoid (GPL)** for closed app |
| **phaze** ([github.com/olvb/phaze](https://github.com/olvb/phaze)) | Phase-vocoder pitch shifter as AudioWorklet | MIT | Worklet, iOS OK | 2020-ish, but clean & reusable | **Drop-in useful** — better PitchShift, also pairs with delay feedback for shimmer-delay |

There is no actively maintained "tape delay" npm package worth recommending. Roll your own: `Tone.FeedbackDelay` → modulate `delayTime` with a slow + fast `Tone.LFO` (wow + flutter) → put `Tone.Distortion({distortion: 0.1})` + a lowpass in the feedback path. This is what Pizzicato's `tape` effect was internally anyway.

### Modulation FX

| Library | What it adds beyond Tone | License | iOS | Verdict |
|---|---|---|---|---|
| **Tuna.js** — `Chorus`, `Phaser`, `Tremolo`, `WahWah` | Slightly different topologies, plus `MoogFilter` | MIT | Native nodes | Skip for mod FX (Tone equivalents exist); keep an eye on its MoogFilter (see Filters) |
| **Pizzicato.js** — `Flanger`, `Ring Modulator`, `Stereo Panner` | Pizzicato's `Flanger` is one of the few off-the-shelf flangers (Tone has Chorus but not a true Flanger). `Ring Modulator` too. | MIT | Native nodes | **Drop-in useful** for `Flanger` + `RingModulator` only |
| **rotary-speaker-worklet** / DIY Leslie | Tone has nothing for Leslie | — | — | Roll your own: two `Tone.AutoFilter` + cross-fading panners + slow/fast ramps. No mature npm exists. |
| **faust-web-component** + Faust DSP library (`stdfaust.lib`) ([faustlibraries.grame.fr](https://faustlibraries.grame.fr/)) | Compile any Faust DSP to AudioWorklet in-browser — gives you `phaser2_demo`, `flanger`, `chorus`, `leslie`, `rotary_speaker`, `vocoder` etc. as pre-written `.dsp` files | MIT / STK-4.3 | Worklet, iOS OK | **Drop-in useful** — huge effects library, but heavier toolchain (`@grame/faustwasm` ~1 MB) |

`@grame/faustwasm` is the most efficient way to get pro-grade modulation effects you don't have to write. Pre-compile chosen `.dsp` files at build time to `.wasm` + worklet processor and ship just those — keeps runtime overhead small.

### Distortion / saturation

| Library | What | License | iOS | Verdict |
|---|---|---|---|---|
| **Tone.Distortion / Chebyshev / BitCrusher** | Waveshaper + harmonic generator + bit reducer | MIT | Yes | Baseline |
| **Tuna.js** `Overdrive`, `Compressor` | Asymmetric waveshapers + softer curve than Tone | MIT | Native | Mildly useful — different curve "feel"; can be done with custom `WaveShaperNode` curves instead |
| **Faust `tape.lib` / `misc.lib`** — `tape_saturation`, `cubicnl`, `gate` | Real tape saturation with hysteresis | MIT | Worklet | **Drop-in useful** if you're already paying the Faust cost |
| **wavesaber** / **wave-shaper-utils** | Tools to generate waveshaper curves | MIT | n/a | Useful as a helper, not a library |

For most "dirt" needs, generate a curve once and feed it to `WaveShaperNode`. There's no `pnpm add tube-saturation` worth recommending — Faust is the cleanest path if you want analog-style nonlinearities.

### Filters & EQ

| Library | What | License | iOS | Verdict |
|---|---|---|---|---|
| **Tuna.js `MoogFilter`** | Stilson/Smith Moog ladder approximation | MIT | ScriptProcessorNode (legacy) | Works on iOS but main-thread; **experimental** |
| **moog-grandmother-worklet** / **noisecraft moog** ([github.com/maximecb/noisecraft](https://github.com/maximecb/noisecraft) — extractable) | Moog ladder as AudioWorklet | GPL-3.0 (NoiseCraft) | Worklet | Avoid (GPL) — but the algorithm is small enough to re-implement in your own worklet |
| **State-Variable Filter worklet** (Chamberlin SVF, various MIT impls) | Multimode (LP/HP/BP/notch) with resonance up to self-oscillation | MIT (most impls) | Worklet | **Drop-in useful** — write a 30-line worklet |
| **Tone.Filter / Tone.EQ3** | Biquad-based | MIT | Yes | Baseline; chain three `Tone.Filter` for a parametric EQ |

For our use case (mobile-first songmaker), the practical answer is: **stay on `Tone.Filter` for utility, and add one Moog-ladder worklet** for the "fat" preset. SVF gives you the most musical sweep behavior for cheap.

### Dynamics

| Library | What | License | iOS | Verdict |
|---|---|---|---|---|
| **Tone.Compressor / Tone.Limiter / Tone.MultibandCompressor** | Tone actually does ship `MultibandCompressor` (three-band) | MIT | Yes | **Baseline already covers multiband** — verify in Tone 15 docs ([tonejs.github.io](https://tonejs.github.io/docs/15.0.4/classes/MultibandCompressor.html)) |
| **DynamicsCompressorNode** | Native | n/a | Yes | Baseline |
| **Sidechain compression** | Not a library — use `Tone.Compressor` with its `threshold` modulated by another track's envelope follower (`Tone.Meter` + `Tone.Gain` automation, or a worklet) | — | Yes | Recipe — no library needed |
| **brickwall-limiter-worklet** / Faust `lib.limiter` | True-peak limiter | MIT | Worklet | **Drop-in useful** via Faust |

There's no compelling reason to add a third-party dynamics library when `Tone.Compressor`, `Tone.Limiter`, and `Tone.MultibandCompressor` exist. Sidechain is a routing pattern, not a dependency.

### Creative / glitch / granular / freeze / vocoder

| Library | What | License | iOS | Verdict |
|---|---|---|---|---|
| **granular.js** ([github.com/jsantell/web-audio-granular](https://github.com/jsantell/web-audio-granular)) | Simple grain scheduler | MIT | ScriptProcessor in places | Stale (2016); usable as reference, not as dep |
| **granular-synth** ([npm](https://www.npmjs.com/package/granular-synth)) | Small grain engine on top of WebAudio | MIT | Native nodes | 2020, low activity — **experimental** |
| **soundtouch-js** | Time-stretch enables freeze + granular feedback | **LGPL-2.1** | ScriptProcessor (main); a worklet fork exists | Flag — LGPL; OK if linked dynamically, but I'd skip for a closed app |
| **phaze** ([github.com/olvb/phaze](https://github.com/olvb/phaze)) | Phase-vocoder pitch shift, AudioWorklet | MIT | Worklet, iOS OK | **Drop-in useful** — also gives you spectral freeze trivially (lock the FFT frames) |
| **paulstretch-web** (JS ports of Paul Nasca's extreme stretch) | Extreme time-stretch / ambient drone | Public domain | Worklet ports exist | **Experimental/fun** |
| **beat-repeat / glitch-shuffler** | No popular npm; build on `Tone.Player` + `Tone.Buffer` slicing + scheduled retriggers | — | Yes | Recipe |
| **vocoder.js** / Faust `vocoder.dsp` | Channel vocoder | MIT | Worklet via Faust | **Experimental** — niche; add only if vocals are central |
| **elementary audio** ([elementary.audio](https://www.elementary.audio/)) | Declarative DSP graph compiled to WASM, BYO effects (filters, comps, reverbs all available as JSX-like nodes) | MIT | Worklet, iOS OK | Active, well-maintained | **Drop-in useful** if you want a second DSP runtime — but it overlaps Tone; only add if you're going to lean into it for FX patches |

### Recommended adds beyond Tone (ranked)

1. **`ConvolverNode` + a curated 4-IR pack from Voxengo/OpenAIR** (`public/irs/`, ~500 KB total). Single biggest perceptual upgrade over `Tone.Reverb`'s synthetic IR. Zero new dependency, full iOS support.
2. **`@grame/faustwasm` with 4-6 pre-compiled `.dsp` effects**: `dm.zita_light` (reverb), `dm.tape_delay`, `dm.flanger`, `dm.phaser2`, `dm.rotary`, `dm.tape_saturation`. AudioWorklet output, MIT-licensed, iOS-clean. Lets us add pro-grade FX as `.wasm` files without writing DSP. [faustlibraries.grame.fr](https://faustlibraries.grame.fr/)
3. **`DattorroReverbNode`** ([github.com/khoin/DattorroReverbNode](https://github.com/khoin/DattorroReverbNode)) — plate reverb worklet, ~10 KB, sounds noticeably better than `Tone.Freeverb` for vocals and snares.
4. **CloudSeed WASM port** for the shimmer/hall preset. The one effect Tone genuinely can't fake.
5. **`phaze`** ([github.com/olvb/phaze](https://github.com/olvb/phaze)) — drop-in better pitch shifter than `Tone.PitchShift`, and unlocks spectral freeze.
6. **Pizzicato.js — but only cherry-pick `Flanger` and `RingModulator`** (Tone has neither). Or re-implement both in ~40 lines and skip the dep.
7. **A custom SVF / Moog-ladder AudioWorklet** (~50 lines) for the "fat filter" preset. No npm dep, MIT-by-you, full iOS support.

Things to actively **skip**: Tuna.js (dormant, ScriptProcessor-heavy, fully covered by Tone), `freeverb-ts` / `schroeder-reverb` / `waa-reverb` (dead, duplicate Tone.Freeverb), `rubberband-web` (GPL), NoiseCraft's Moog (GPL). `soundtouch-js` is LGPL — defer unless we have a clear need and legal answer.
