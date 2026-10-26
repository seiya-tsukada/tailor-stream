import React from 'react';
import { RefreshCw } from 'lucide-react';
import { APP_INFO } from '../config/constants';
import { MESSAGES } from '../config/messages';

interface AppHeaderProps {
  isRefreshing: boolean;
  onRefresh: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ isRefreshing, onRefresh }) => (
  <header className="sticky top-0 z-30 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800/60 px-4 py-3 flex items-center justify-between">
    <div className="min-w-0">
      <h1 className="text-base font-bold tracking-tight text-zinc-100">{APP_INFO.NAME}</h1>
      <p className="text-[11px] text-zinc-500 truncate">{APP_INFO.TAGLINE}</p>
    </div>
    <button
      type="button"
      onClick={onRefresh}
      disabled={isRefreshing}
      aria-label={MESSAGES.REFRESH}
      className="p-2 rounded-full text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
    >
      <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
    </button>
  </header>
);
