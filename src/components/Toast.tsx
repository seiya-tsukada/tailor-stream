import React from 'react';
import { Check } from 'lucide-react';

interface ToastProps {
  message: string | null;
}

export const Toast: React.FC<ToastProps> = ({ message }) => {
  if (!message) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-zinc-800/95 border border-zinc-700 text-zinc-100 text-xs font-semibold px-4 py-2 rounded-full shadow-lg flex items-center gap-2 backdrop-blur-md">
      <Check className="w-3.5 h-3.5 text-emerald-400" />
      <span>{message}</span>
    </div>
  );
};
