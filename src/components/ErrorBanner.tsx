import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ErrorBannerProps {
  error: string | null;
  onRetry: () => void;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({ error, onRetry }) => {
  if (!error) return null;

  return (
    <div className="mx-4 mt-3 p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-xs text-rose-300 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
        <span>{error}</span>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="text-[11px] underline font-semibold text-rose-200 shrink-0"
      >
        再試行
      </button>
    </div>
  );
};
