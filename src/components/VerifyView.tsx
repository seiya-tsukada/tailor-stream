import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import type { Me } from '../api/types';
import { URL_QUERY_KEYS } from '../config/constants';
import { MESSAGES } from '../config/messages';
import { verifyLoginToken } from '../services/apiClient';
import { getErrorMessage } from '../utils/errors';

interface VerifyViewProps {
  onVerified: (user: Me) => void;
  onGoHome: () => void;
}

/**
 * メールのログインリンク（/auth/verify?token=...）の着地ページ
 * リンクスキャナーの GET で消費されないよう、トークンはここから POST で送る
 */
export const VerifyView: React.FC<VerifyViewProps> = ({ onVerified, onGoHome }) => {
  const [error, setError] = useState<string | null>(null);
  // StrictMode で effect が2回走ってもトークンを2回送らない（2回目は使用済みで失敗するため）
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = new URLSearchParams(window.location.search).get(URL_QUERY_KEYS.TOKEN) ?? '';
    verifyLoginToken(token)
      .then(onVerified)
      .catch((err: unknown) => setError(getErrorMessage(err, MESSAGES.VERIFY_FAILED)));
  }, [onVerified]);

  return (
    <div className="flex flex-col items-center text-center px-8 py-16">
      {error ? (
        <>
          <AlertTriangle className="w-7 h-7 text-rose-400 mb-3" />
          <p className="text-sm text-zinc-200 mb-4">{error}</p>
          <button type="button" onClick={onGoHome} className="text-xs underline text-zinc-300">
            {MESSAGES.BACK}
          </button>
        </>
      ) : (
        <>
          <Loader2 className="w-7 h-7 text-blue-400 animate-spin mb-3" />
          <p className="text-sm text-zinc-300">{MESSAGES.VERIFYING}</p>
        </>
      )}
    </div>
  );
};
