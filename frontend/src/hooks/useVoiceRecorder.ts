import { useEffect, useRef, useState } from "react";

import { transcribe } from "@/api/client";

export type VoiceState = "idle" | "recording" | "transcribing";

const BAR_W = 3;
const GAP = 2;

/**
 * Mic capture + live waveform + transcription, as a small state machine:
 * idle → recording (AnalyserNode drives the canvas) → transcribing → idle.
 * On a successful stop the transcript is handed back via onResult for review —
 * it is not auto-sent.
 */
export function useVoiceRecorder(onResult: (text: string) => void) {
  const [state, setState] = useState<VoiceState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const barsRef = useRef<number[]>([]);

  function teardown() {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    if (timerRef.current != null) clearInterval(timerRef.current);
    rafRef.current = null;
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    audioCtxRef.current?.close().catch(() => undefined);
    streamRef.current = null;
    audioCtxRef.current = null;
    analyserRef.current = null;
  }

  async function start() {
    setError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Mic permission denied");
      return;
    }
    streamRef.current = stream;
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunksRef.current.push(event.data);
    };
    recorderRef.current = recorder;
    recorder.start();

    const audioCtx = new AudioContext();
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 1024;
    audioCtx.createMediaStreamSource(stream).connect(analyser);
    audioCtxRef.current = audioCtx;
    analyserRef.current = analyser;
    barsRef.current = [];

    setElapsed(0);
    const startedAt = Date.now();
    timerRef.current = window.setInterval(() => setElapsed((Date.now() - startedAt) / 1000), 250);

    setState("recording");
  }

  function cancel() {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      recorder.stop();
    }
    teardown();
    setState("idle");
  }

  function stop() {
    const recorder = recorderRef.current;
    if (!recorder) return;
    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
      teardown();
      setState("transcribing");
      try {
        const text = await transcribe(blob);
        if (text.trim()) onResult(text.trim());
      } catch {
        setError("Transcription failed");
      }
      setState("idle");
    };
    recorder.stop();
  }

  // Drives the scrolling waveform while recording (RMS amplitude → rounded bars).
  useEffect(() => {
    if (state !== "recording") return;
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const size = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    };
    size();

    const samples = new Uint8Array(analyser.fftSize);
    const draw = () => {
      analyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (let i = 0; i < samples.length; i++) {
        const v = (samples[i] - 128) / 128;
        sum += v * v;
      }
      const amp = Math.min(1, Math.sqrt(sum / samples.length) * 4.5);
      barsRef.current.push(amp);
      const maxBars = Math.floor(canvas.width / ((BAR_W + GAP) * dpr));
      if (barsRef.current.length > maxBars) barsRef.current = barsRef.current.slice(-maxBars);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const midY = canvas.height / 2;
      const w = BAR_W * dpr;
      barsRef.current.forEach((a, i) => {
        const h = Math.max(2 * dpr, a * canvas.height * 0.9);
        const x = canvas.width - (barsRef.current.length - i) * (BAR_W + GAP) * dpr;
        ctx.fillStyle = `rgba(255,255,255,${0.35 + a * 0.65})`;
        ctx.beginPath();
        ctx.roundRect(x, midY - h / 2, w, h, w / 2);
        ctx.fill();
      });
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);

    window.addEventListener("resize", size);
    return () => {
      window.removeEventListener("resize", size);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [state]);

  useEffect(() => () => teardown(), []);

  return { state, elapsed, error, canvasRef, start, stop, cancel };
}
