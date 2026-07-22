"use client";

import { useEffect, useRef, useState } from "react";

export function AmbientAudio({ activeIndex, circleCount }: { activeIndex: number; circleCount: number }) {
  const [enabled, setEnabled] = useState(false);
  const contextRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const filterRef = useRef<BiquadFilterNode | null>(null);

  useEffect(() => {
    if (!enabled || !contextRef.current || !oscillatorRef.current || !filterRef.current) return;
    const ratio = circleCount > 1 ? activeIndex / (circleCount - 1) : 0;
    const now = contextRef.current.currentTime;
    oscillatorRef.current.frequency.exponentialRampToValueAtTime(52 - ratio * 30, now + 1.2);
    filterRef.current.frequency.exponentialRampToValueAtTime(900 - ratio * 700, now + 1.2);
  }, [activeIndex, circleCount, enabled]);

  async function toggle() {
    if (enabled) {
      gainRef.current?.gain.setTargetAtTime(0.0001, contextRef.current?.currentTime ?? 0, 0.08);
      setEnabled(false);
      return;
    }

    if (!contextRef.current) {
      const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) return;
      const context = new AudioCtor();
      const master = context.createGain();
      const oscillator = context.createOscillator();
      const filter = context.createBiquadFilter();
      const noiseGain = context.createGain();
      const noise = context.createBufferSource();
      const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
      const channel = buffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < channel.length; i += 1) {
        const white = Math.random() * 2 - 1;
        last = last * 0.985 + white * 0.015;
        channel[i] = last * 3.5;
      }
      noise.buffer = buffer;
      noise.loop = true;
      oscillator.type = "sine";
      oscillator.frequency.value = 52;
      filter.type = "lowpass";
      filter.frequency.value = 900;
      master.gain.value = 0.0001;
      noiseGain.gain.value = 0.04;
      oscillator.connect(filter).connect(master);
      noise.connect(noiseGain).connect(filter);
      master.connect(context.destination);
      oscillator.start();
      noise.start();
      contextRef.current = context;
      gainRef.current = master;
      oscillatorRef.current = oscillator;
      filterRef.current = filter;
    }

    await contextRef.current.resume();
    gainRef.current?.gain.setTargetAtTime(0.12, contextRef.current.currentTime, 0.2);
    setEnabled(true);
  }

  return (
    <button className={enabled ? "sound-toggle is-on" : "sound-toggle"} onClick={toggle} aria-pressed={enabled}>
      <span aria-hidden="true">{enabled ? "◉" : "○"}</span>
      {enabled ? "ZVUK UKLJUČEN" : "POKRENI ZVUK"}
    </button>
  );
}
