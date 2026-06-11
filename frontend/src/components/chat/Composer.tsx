import { useState, type FormEvent } from "react";

import { CheckIcon, MicIcon, SendIcon, XIcon } from "@/components/icons";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";

interface Props {
  onSend: (text: string, opts?: { speak?: boolean }) => void;
  disabled?: boolean;
}

function formatElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

export function Composer({ onSend, disabled }: Props) {
  const [value, setValue] = useState("");
  const [fromVoice, setFromVoice] = useState(false);

  const voice = useVoiceRecorder((text) => {
    setValue(text);
    setFromVoice(true);
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text, { speak: fromVoice });
    setValue("");
    setFromVoice(false);
  }

  const { state } = voice;

  return (
    <form className="compose" onSubmit={submit}>
      <div className="rowbox">
        {/* idle / review */}
        <div className={`vrow${state !== "idle" ? " hidden" : ""}`}>
          <div className="field">
            <input
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                setFromVoice(false);
              }}
              placeholder={voice.error ?? "Type a message…"}
              disabled={disabled}
            />
          </div>
          <button
            type="button"
            className="rb mic"
            onClick={voice.start}
            disabled={disabled}
            aria-label="Record voice message"
          >
            <MicIcon />
          </button>
          <button type="submit" className="rb send" disabled={disabled} aria-label="Send">
            <SendIcon />
          </button>
        </div>

        {/* recording — the black wave strip */}
        <div className={`vrow${state !== "recording" ? " hidden" : ""}`}>
          <div className="strip">
            <span className="recdot" />
            <span className="timer">{formatElapsed(voice.elapsed)}</span>
            <canvas className="wave" ref={voice.canvasRef} />
            <button
              type="button"
              className="sb cancel"
              onClick={voice.cancel}
              aria-label="Discard recording"
            >
              <XIcon />
            </button>
            <button
              type="button"
              className="sb done"
              onClick={voice.stop}
              aria-label="Stop and transcribe"
            >
              <CheckIcon />
            </button>
          </div>
        </div>

        {/* transcribing */}
        <div className={`vrow${state !== "transcribing" ? " hidden" : ""}`}>
          <div className="trans">
            <span className="eq">
              <i />
              <i />
              <i />
              <i />
              <i />
            </span>
            <span className="shimmer">Transcribing…</span>
          </div>
        </div>
      </div>
    </form>
  );
}
