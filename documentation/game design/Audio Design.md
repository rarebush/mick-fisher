# Audio Design

**Overview:**
Audio is critical for game feel. Combination of procedural audio (Tone.js) for dynamic tension and sample playback (Howler.js) for discrete events.

## Audio Categories

**1. UI Sounds (Howler.js samples):**

- Button clicks (menu navigation)
- Location selection confirm
- Item added to inventory (soft chime)
- Upgrade crafted (success fanfare)
- Money received (cash register ding)
- Catalog entry filled (satisfying pop)

**2. Environmental Ambience (Tone.js synthesis):**

- Water sounds (filtered noise, varies by location)
  - Picturesque River: gentle babbling
  - City River: urban water, muffled traffic
  - Industrial Canal: echoey, mechanical hums
  - Sewage Works: unsettling drips, bubbling
- Wind (subtle, location-specific)
- Time-of-day shifts (night = quieter, crickets)

**3. Interaction Feedback (Hybrid):**

**Casting:**

- Throw whoosh (Howler sample)
- Magnet settle splash (Howler sample)
- Ripples (Tone.js filtered decay)

**Horizontal Drag:**

- Water drag (Tone.js filtered noise, pitch follows speed)
- Tension build (Tone.js rising pitch drone)
- Snag impact (Howler sample: metal clunk)
- Line strain (Tone.js creaking, pitch follows tension)

**Lift Phase:**

- Underwater ambience (Tone.js muffled low-pass filter)
- Tap response (Howler sample: muted splash per tap)
- Rising pitch (Tone.js, ascending frequency as depth decreases)
- Weight groans (Tone.js, modulated by tap frequency)

**Surface Break:**

- Splash (Howler sample)
- Item reveal chime (Howler sample, pitch varies by rarity):
  - Common: single note (C)
  - Uncommon: major third (C-E)
  - Rare: major chord (C-E-G)
  - Epic: arpeggiated major 7th
  - Legendary: full melodic phrase
- Water drainage (Howler sample for containers)

**Slip Warnings:**

- 50-80% slip: Tone.js low hum (slowly intensifies)
- 80-95% slip: Tone.js urgent beeping (frequency increases)
- 95-99% slip: Tone.js alarm (rapid beeping)
- 100% slip (failure): Howler sample (magnet pop, disappointed tone)

**Events:**

- Snag detected: Howler sample (scrape, thud)
- Current surge: Tone.js water rush (sudden volume swell)
- Onlooker interrupt: Howler sample (footsteps, voice mumble)
- Police encounter: Howler sample (radio static, authority voice)

**4. Procedural Tension System (Tone.js):**

**Dynamic Tension Drone:**
During horizontal drag and blind lift, continuous drone responds to game state:

```javascript
// Pseudo-code for tension drone
const drone = new Tone.Synth({
  oscillator: { type: "sawtooth" },
  envelope: { attack: 0.1, sustain: 0.9, release: 0.5 },
});

// Update frequency based on tension + slip
function updateDrone(tension, slipPercent) {
  const baseFreq = 80; // low bass
  const tensionMod = tension * 2; // 0-200 Hz range
  const slipMod = slipPercent * 1.5; // adds urgency
  const targetFreq = baseFreq + tensionMod + slipMod;

  drone.frequency.rampTo(targetFreq, 0.1); // smooth transition
}
```

**Effect:** As player increases tension and slip accumulates, drone pitch rises → subconscious anxiety builds → encourages careful play

**During Revealed Lift:**
Drone continues but also triggers:

- Slip meter in yellow (50-80%): add harmonic overtone (warning)
- Slip meter in red (80-95%): add dissonant interval (danger)
- Slip meter critical (95%+): aggressive beeping overrides drone

## Audio-Visual Sync

**Critical Sync Points:**

- Tap input → splash sound (<50ms latency)
- Surface break → chime + visual reveal (synchronized exactly)
- Magnet pop-off → sound + visual separation (<30ms)
- Snag event → audio cue + UI prompt (simultaneous)

**Performance:**

- Use Howler.js sprite sheets (combine small samples)
- Pre-load all samples at location load (no mid-session loading)
- Tone.js polyphony: max 5 simultaneous synths (keep CPU usage low)
- Fallback: disable procedural audio on low-end devices, keep samples only

## Audio Settings (Accessibility)

**Player Options:**

- Master volume (0-100%)
- Music volume (future: ambient music layer)
- SFX volume (Howler samples)
- Ambience volume (Tone.js environmental)
- Tension drone toggle (on/off, for players who find it stressful)

**Presets:**

- Full Experience (all audio)
- Minimal (samples only, no ambience/drone)
- Silent (mute all, for accessibility)

## Open Questions

- **Q32:** Should there be a music layer (ambient background music) separate from environmental sounds, or keep it purely diegetic?
- **Q33:** For the tension drone: should it be subtle (barely noticeable) or prominent (clear gameplay feedback)?
- **Q34:** Should rare item reveal chimes be unique melodies (composable, memorable) or just pitch variations (simpler)?
- **Q35:** Should audio design include haptic feedback on mobile (vibration for tension, slip, events)?
