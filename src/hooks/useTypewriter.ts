'use client';

import { useState, useEffect, useCallback } from 'react';

const CHARS_PER_SECOND = 40;

export function useTypewriter(text: string, enabled: boolean = true) {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setDisplayedText(text);
      setIsComplete(true);
      return;
    }

    setDisplayedText('');
    setIsComplete(false);

    let charIndex = 0;
    const intervalMs = 1000 / CHARS_PER_SECOND;

    const timer = setInterval(() => {
      charIndex++;
      if (charIndex >= text.length) {
        setDisplayedText(text);
        setIsComplete(true);
        clearInterval(timer);
      } else {
        setDisplayedText(text.slice(0, charIndex));
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [text, enabled]);

  const skip = useCallback(() => {
    setDisplayedText(text);
    setIsComplete(true);
  }, [text]);

  return { displayedText, isComplete, skip };
}
