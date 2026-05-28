"use client";

import { useEffect, useRef, useState } from "react";

type State = "loading" | "error" | "success";

interface Options {
  fallbackSrc?: string;
  maxRetries?: number;
  retryDelay?: number;
  onError?: (error: Error) => void;
}

export function useImageLoadingState(src?: string, options?: Options) {
  const { maxRetries = 2, retryDelay = 3000, onError } = options || {};
  const [state, setState] = useState<State>(() => (src ? "loading" : "error"));
  const [error, setError] = useState<Error | null>(null);
  const retries = useRef(0);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!src) {
      setState("error");
      setError(new Error("No src provided"));
      return;
    }

    // Reset when src changes
    retries.current = 0;
    setError(null);
    setState("loading");

    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [src]);

  useEffect(() => {
    if (state !== "error" || !src) return;

    if (retries.current < maxRetries) {
      const delay = retryDelay * Math.pow(2, retries.current);
      // auto retry
      timer.current = window.setTimeout(() => {
        retries.current += 1;
        setState("loading");
        setError(null);
      }, delay);
    } else {
      onError?.(error || new Error("Image failed"));
    }
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [state, maxRetries, retryDelay, onError, src, error]);

  const setErrorState = (err?: Error) => {
    const e = err || new Error("Image load error");
    console.error("Image load error:", e.message);
    setError(e);
    setState("error");
  };

  const retry = () => {
    if (!src) return;
    if (retries.current >= maxRetries) return;
    retries.current += 1;
    setError(null);
    setState("loading");
  };

  const setSuccess = () => {
    setState("success");
    setError(null);
  };

  return { state, error, retry, setError: setErrorState, setSuccess } as const;
}
