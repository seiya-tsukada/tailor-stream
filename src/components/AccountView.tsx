import React, { useState } from 'react';
import type { Me } from '../api/types';
import { MESSAGES } from '../config/messages';
import { getErrorMessage } from '../utils/errors';

interface AccountViewProps {
  user: Me;
  onLogout: () => Promise<void>;
}

export const AccountView: React.FC<AccountViewProps> = ({ user, onLogout }) => {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    setError(null);
    try {
      await onLogout();
    } catch (err: unknown) {
      setError(getErrorMessage(err, MESSAGES.LOGOUT_FAILED));
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <dl className="rounded-2xl border border-zinc-800 bg-zinc-900 divide-y divide-zinc-800 text-sm">
        <div className="flex justify-between gap-4 px-4 py-3">
          <dt className="text-zinc-400">{MESSAGES.ACCOUNT_EMAIL}</dt>
          <dd className="text-zinc-100 truncate">{user.email}</dd>
        </div>
        <div className="flex justify-between gap-4 px-4 py-3">
          <dt className="text-zinc-400">{MESSAGES.ACCOUNT_PLAN}</dt>
          <dd className="text-zinc-100">{MESSAGES.PLAN_NAMES[user.plan]}</dd>
        </div>
      </dl>
      {error && <p className="text-xs text-rose-400">{error}</p>}
      <button
        type="button"
        onClick={handleLogout}
        disabled={isLoggingOut}
        className="w-full h-11 rounded-xl border border-zinc-700 text-sm font-semibold text-zinc-200 hover:bg-zinc-900 disabled:opacity-50"
      >
        {MESSAGES.LOGOUT}
      </button>
    </div>
  );
};
