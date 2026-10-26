import React from 'react';
import { RefreshCw, UserRound } from 'lucide-react';
import { APP_INFO } from '../config/constants';
import { MESSAGES } from '../config/messages';

interface AppHeaderProps {
  isRefreshing: boolean;
  isLoggedIn: boolean;
  onRefresh: () => void;
  onOpenAccount: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ isRefreshing, isLoggedIn, onRefresh, onOpenAccount }) => (
  <header className="sticky top-0 z-30 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800/60 px-4 py-3 flex items-center justify-between">
    <div className="min-w-0">
      <h1 className="text-base font-bold tracking-tight text-zinc-100">{APP_INFO.NAME}</h1>
      <p className="text-[11px] text-zinc-500 truncate">{APP_INFO.TAGLINE}</p>
    </div>
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={onRefresh}
        disabled={isRefreshing}
        aria-label={MESSAGES.REFRESH}
        className="p-2 rounded-full text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
      >
        <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
      </button>
      {isLoggedIn ? (
        <button
          type="button"
          onClick={onOpenAccount}
          aria-label={MESSAGES.ACCOUNT}
          className="p-2 rounded-full text-zinc-300 hover:bg-zinc-800"
        >
          <UserRound className="w-4 h-4" />
        </button>
      ) : (
        <button
          type="button"
          onClick={onOpenAccount}
          className="ml-1 h-8 px-3 rounded-full text-xs font-semibold bg-blue-600 text-white hover:bg-blue-500"
        >
          {MESSAGES.LOGIN_TITLE}
        </button>
      )}
    </div>
  </header>
);
