import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";

interface BrowserSpeechRecognitionAlternative {
  transcript: string;
}

interface BrowserSpeechRecognitionResult {
  0: BrowserSpeechRecognitionAlternative;
  length: number;
}

type BrowserSpeechRecognitionResultList = ArrayLike<BrowserSpeechRecognitionResult>;

interface BrowserSpeechRecognitionEvent {
  results: BrowserSpeechRecognitionResultList;
}

interface BrowserSpeechRecognitionErrorEvent {
  error: string;
}

interface BrowserSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export type SpeechRecognitionStatus = "idle" | "listening" | "error" | "disabled";

function recognitionErrorMessage(error: string) {
  switch (error) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access denied";
    case "audio-capture":
      return "Microphone not available";
    default:
      return "Speech recognition error";
  }
}

export function useSpeechRecognition(
  onTranscript: (text: string) => void,
  inputRef?: RefObject<HTMLTextAreaElement | null>,
) {
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const RecognitionCtor = useMemo(() => {
    if (typeof window === "undefined") {
      return null;
    }
    return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
  }, []);

  const isSupported = Boolean(RecognitionCtor);
  const status: SpeechRecognitionStatus = !isSupported
    ? "disabled"
    : isListening
      ? "listening"
      : error
        ? "error"
        : "idle";

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const start = useCallback(async () => {
    if (!RecognitionCtor) {
      setError("Speech input not supported in this browser");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Microphone not available");
      return;
    }

    setError(null);
    recognitionRef.current?.stop();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
    } catch (error) {
      const mediaError = error as { name?: string };
      setIsListening(false);
      setError(mediaError?.name === "NotAllowedError" ? "Microphone access denied" : "Microphone not available");
      return;
    }

    const recognition = new RecognitionCtor();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();

      if (transcript) {
        onTranscript(transcript);
        window.setTimeout(() => inputRef?.current?.focus(), 0);
      }
    };

    recognition.onerror = (event) => {
      if (event.error === "aborted") {
        return;
      }

      if (event.error === "no-speech") {
        setError("Speech recognition error");
        return;
      }

      setError(recognitionErrorMessage(event.error));
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [RecognitionCtor, inputRef, onTranscript]);

  const toggle = useCallback(() => {
    if (isListening) {
      stop();
      return;
    }

    void start();
  }, [isListening, start, stop]);

  useEffect(() => stop, [stop]);

  return {
    error,
    isListening,
    isSupported,
    status,
    start,
    stop,
    toggle,
  };
}
