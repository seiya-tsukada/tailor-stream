import { useCallback, useState } from 'react';
import { UI_TIMING } from '../config/constants';

// クリップボードへコピーし、一定時間 copied=true にする
export function useCopyToClipboard(durationMs: number = UI_TIMING.COPY_FEEDBACK_MS) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(
    (text: string) => {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), durationMs);
    },
    [durationMs]
  );

  return { copied, copy };
}
