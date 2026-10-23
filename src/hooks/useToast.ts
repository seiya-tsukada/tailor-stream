import { useCallback, useState } from 'react';
import { UI_TIMING } from '../config/constants';

// 一定時間だけ表示されるトーストメッセージ
export function useToast(durationMs: number = UI_TIMING.TOAST_DURATION_MS) {
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback(
    (message: string) => {
      setToastMessage(message);
      setTimeout(() => setToastMessage(null), durationMs);
    },
    [durationMs]
  );

  return { toastMessage, showToast };
}
