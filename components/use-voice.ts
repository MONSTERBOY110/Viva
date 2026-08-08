"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* ---------------------------------------------------------------------------
   The examiner speaking.

   Text is registered with our own route, which returns a short id; the audio
   then streams from that id straight into an <audio> element, so playback
   begins while ElevenLabs is still generating. The API key never reaches the
   browser, and every failure path ends in silence rather than an error.
--------------------------------------------------------------------------- */

const ON_KEY = "viva:voice";
const VOICE_KEY = "viva:voice-id";

export type VoiceOption = { id: string; name: string; note: string };

export function useExaminerVoice() {
  const [available, setAvailable] = useState(false);
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [voiceId, setVoiceIdState] = useState<string | null>(null);
  const [enabled, setEnabledState] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  /** Browsers refuse to autoplay until the user has interacted with the page. */
  const [blocked, setBlocked] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const endedRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/voice");
        const data = (await res.json()) as {
          enabled?: boolean;
          voices?: VoiceOption[];
          defaultVoice?: string | null;
        };
        if (cancelled) return;
        setAvailable(Boolean(data.enabled));
        setVoices(data.voices ?? []);
        if (data.enabled) {
          const savedVoice = localStorage.getItem(VOICE_KEY);
          setVoiceIdState(savedVoice || data.defaultVoice || null);
          // Configured means on unless the user has turned it off before.
          setEnabledState(localStorage.getItem(ON_KEY) !== "off");
        }
      } catch {
        setAvailable(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    setSpeaking(false);
  }, []);

  const setEnabled = useCallback(
    (next: boolean) => {
      setEnabledState(next);
      try {
        localStorage.setItem(ON_KEY, next ? "on" : "off");
      } catch {
        // Private mode: the preference just does not persist.
      }
      if (!next) stop();
      else setBlocked(false);
    },
    [stop],
  );

  const setVoice = useCallback((id: string) => {
    setVoiceIdState(id);
    try {
      localStorage.setItem(VOICE_KEY, id);
    } catch {
      // Preference is best effort.
    }
  }, []);

  /**
   * Speak a line. Resolves when the audio finishes, is interrupted, or fails,
   * so the hands-free loop can wait on it before opening the microphone.
   */
  const speak = useCallback(
    async (text: string): Promise<void> => {
      if (!available || !enabled || !text.trim()) return;
      stop();

      const controller = new AbortController();
      abortRef.current = controller;
      setSpeaking(true);

      try {
        const res = await fetch("/api/voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voice: voiceId }),
          signal: controller.signal,
        });

        if (res.status === 204 || !res.ok) {
          setSpeaking(false);
          return;
        }

        const { id } = (await res.json()) as { id?: string };
        if (!id || controller.signal.aborted) {
          setSpeaking(false);
          return;
        }

        const audio = audioRef.current ?? new Audio();
        audioRef.current = audio;
        audio.preload = "auto";
        audio.src = `/api/voice/${id}`;

        await new Promise<void>((resolve) => {
          let settled = false;
          const finish = () => {
            if (settled) return;
            settled = true;
            endedRef.current = null;
            setSpeaking(false);
            resolve();
          };
          endedRef.current = finish;
          audio.onended = finish;
          audio.onerror = finish;
          controller.signal.addEventListener("abort", finish, { once: true });

          audio.play().catch(() => {
            // Autoplay policy. Surface a control rather than failing silently.
            setBlocked(true);
            finish();
          });
        });
      } catch {
        setSpeaking(false);
      }
    },
    [available, enabled, voiceId, stop],
  );

  /** Play whatever is already loaded, used after an autoplay block. */
  const replay = useCallback(async (): Promise<void> => {
    const audio = audioRef.current;
    if (!audio?.src) return;
    try {
      setSpeaking(true);
      audio.currentTime = 0;
      await audio.play();
      setBlocked(false);
    } catch {
      setSpeaking(false);
    }
  }, []);

  useEffect(() => stop, [stop]);

  return {
    available,
    enabled,
    setEnabled,
    voices,
    voiceId,
    setVoice,
    speaking,
    blocked,
    speak,
    stop,
    replay,
  };
}

/* ---------------------------------------------------------------------------
   The candidate answering aloud, using the browser's own speech recognition.
   Free, no key, no quota, and hidden entirely where unsupported so the typed
   path is never worse off.
--------------------------------------------------------------------------- */

type RecognitionResultList = {
  length: number;
  [index: number]: { 0: { transcript: string }; isFinal: boolean };
};

type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult:
    | ((e: { resultIndex: number; results: RecognitionResultList }) => void)
    | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

function recognitionCtor(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => Recognition;
    webkitSpeechRecognition?: new () => Recognition;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useDictation({
  onChunk,
  onSilence,
  silenceMs = 3000,
}: {
  onChunk: (chunk: string) => void;
  /** Fired when the candidate has said something and then gone quiet. */
  onSilence?: () => void;
  silenceMs?: number;
}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  /** Counts down to auto submit in hands-free mode, null when not pending. */
  const [silencePending, setSilencePending] = useState(false);

  const ref = useRef<Recognition | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heardRef = useRef(false);
  const cbs = useRef({ onChunk, onSilence });
  cbs.current = { onChunk, onSilence };

  useEffect(() => {
    setSupported(recognitionCtor() !== null);
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setSilencePending(false);
  }, []);

  const stop = useCallback(() => {
    clearTimer();
    ref.current?.stop();
    setListening(false);
  }, [clearTimer]);

  const cancel = useCallback(() => {
    clearTimer();
    ref.current?.abort();
    setListening(false);
  }, [clearTimer]);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    ref.current?.abort();
    heardRef.current = false;
    clearTimer();

    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-IN";

    rec.onresult = (e) => {
      let finalText = "";
      let sawInterim = false;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
        else sawInterim = true;
      }

      // Any speech at all resets the countdown.
      if (sawInterim || finalText) clearTimer();

      if (finalText.trim()) {
        heardRef.current = true;
        cbs.current.onChunk(finalText.trim());
      }

      if (heardRef.current && cbs.current.onSilence) {
        setSilencePending(true);
        timerRef.current = setTimeout(() => {
          setSilencePending(false);
          cbs.current.onSilence?.();
        }, silenceMs);
      }
    };

    rec.onerror = () => {
      clearTimer();
      setListening(false);
    };
    rec.onend = () => {
      setListening(false);
    };

    ref.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, [clearTimer, silenceMs]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      ref.current?.abort();
    },
    [],
  );

  return { supported, listening, silencePending, start, stop, cancel, clearTimer };
}
