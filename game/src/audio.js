// All sound is synthesized with WebAudio — no audio files, no network.
// Short oscillator blips and filtered noise bursts: a coin clink, a pickup
// chime, a lockpick tick, a smoke hiss, an alarm beep that quickens as the
// meter rises, a caught sting and a win fanfare. The context is created on
// the first user gesture; M mutes everything.
export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;
  let alarmTimer = null;
  let alarmOn = false;
  let alarmIntervalMs = 700; // quickens as the meter rises (see setAlarmInterval)

  function ensure() {
    if (context) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, duration, type, volume, when, slideTo) {
    if (!ensure() || muted) return;
    const start = context.currentTime + (when || 0);
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + duration);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume || 0.2, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  function noise(duration, volume, filterFreq) {
    if (!ensure() || muted) return;
    const start = context.currentTime;
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 1200;
    const gain = context.createGain();
    gain.gain.value = volume || 0.15;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(start);
  }

  return {
    /** Call from any key/click handler so the context is allowed to start. */
    unlock() {
      if (ensure() && context.state === 'suspended') context.resume().catch(() => {});
    },
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      if (muted) this.stopAlarm();
      return muted;
    },
    click() {
      tone(660, 0.06, 'square', 0.08);
    },
    coin() {
      tone(1567, 0.09, 'sine', 0.18);
      tone(2093, 0.14, 'sine', 0.15, 0.07);
    },
    pickup() {
      tone(523, 0.1, 'triangle', 0.2);
      tone(659, 0.1, 'triangle', 0.2, 0.08);
      tone(784, 0.18, 'triangle', 0.2, 0.16);
    },
    lockpickTick() {
      tone(1200, 0.04, 'square', 0.07);
    },
    smoke() {
      noise(0.5, 0.2, 900);
    },
    step() {
      noise(0.05, 0.05, 500);
    },
    spotted() {
      tone(220, 0.25, 'sawtooth', 0.2, 0, 110);
    },
    caught() {
      tone(392, 0.22, 'sawtooth', 0.22, 0, 196);
      tone(311, 0.3, 'sawtooth', 0.22, 0.18, 155);
      tone(233, 0.5, 'sawtooth', 0.22, 0.36, 116);
    },
    win() {
      const notes = [523, 659, 784, 1046, 784, 1046];
      notes.forEach((freq, i) => tone(freq, 0.22, 'triangle', 0.2, i * 0.12));
    },
    levelClear() {
      tone(523, 0.12, 'triangle', 0.2);
      tone(784, 0.12, 'triangle', 0.2, 0.1);
      tone(1046, 0.25, 'triangle', 0.2, 0.2);
    },
    /** A soft beep while the alarm is hot; the interval shortens as it rises. */
    startAlarm() {
      if (alarmOn || !ensure()) return;
      alarmOn = true;
      const beep = () => {
        if (!alarmOn || muted) {
          alarmTimer = null;
          return;
        }
        tone(880, 0.08, 'square', 0.07);
        alarmTimer = window.setTimeout(beep, alarmIntervalMs);
      };
      beep();
    },
    /** How fast the alarm beeps, in milliseconds — the game drives this
     *  from the meter so the sound tightens as the alarm climbs. */
    setAlarmInterval(ms) {
      alarmIntervalMs = Math.max(220, Math.min(900, ms));
    },
    stopAlarm() {
      alarmOn = false;
      if (alarmTimer !== null) {
        window.clearTimeout(alarmTimer);
        alarmTimer = null;
      }
    },
  };
}
