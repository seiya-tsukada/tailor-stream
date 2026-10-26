import React, { useState } from 'react';
import { MailCheck } from 'lucide-react';
import { MESSAGES } from '../config/messages';
import { requestLoginLink } from '../services/apiClient';
import { getErrorMessage } from '../utils/errors';

interface LoginViewProps {
  /** ログインリンクを要求する直前に呼ぶ（未ログインで選んでいたカテゴリを退避するため） */
  onBeforeRequest: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onBeforeRequest }) => {
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);
    setError(null);
    try {
      onBeforeRequest();
      await requestLoginLink(email);
      setSentTo(email.trim());
    } catch (err: unknown) {
      setError(getErrorMessage(err, MESSAGES.LOGIN_FAILED));
    } finally {
      setIsSending(false);
    }
  };

  if (sentTo) {
    return (
      <div className="flex flex-col items-center text-center px-8 py-16">
        <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
          <MailCheck className="w-7 h-7 text-emerald-400" />
        </div>
        <h2 className="text-sm font-semibold text-zinc-100 mb-1">{MESSAGES.LOGIN_SENT_TITLE}</h2>
        <p className="text-xs leading-relaxed text-zinc-400">{MESSAGES.LOGIN_SENT_DESCRIPTION(sentTo)}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 space-y-4">
      <p className="text-xs leading-relaxed text-zinc-400">{MESSAGES.LOGIN_DESCRIPTION}</p>
      <label className="block">
        <span className="block text-xs font-semibold text-zinc-300 mb-1.5">{MESSAGES.LOGIN_EMAIL_LABEL}</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={MESSAGES.LOGIN_EMAIL_PLACEHOLDER}
          className="w-full h-11 px-3 rounded-xl bg-zinc-900 border border-zinc-700 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500"
        />
      </label>
      {error && <p className="text-xs text-rose-400">{error}</p>}
      <button
        type="submit"
        disabled={isSending || email.trim().length === 0}
        className="w-full h-11 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
      >
        {isSending ? MESSAGES.LOGIN_SENDING : MESSAGES.LOGIN_SUBMIT}
      </button>
    </form>
  );
};
