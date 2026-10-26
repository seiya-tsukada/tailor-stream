import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { MESSAGES } from '../config/messages';

interface PageHeaderProps {
  title: string;
  onBack: () => void;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, onBack }) => (
  <header className="sticky top-0 z-30 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800/60 px-2 py-3 flex items-center gap-1">
    <button
      type="button"
      onClick={onBack}
      aria-label={MESSAGES.BACK}
      className="p-2 rounded-full text-zinc-300 hover:bg-zinc-800"
    >
      <ChevronLeft className="w-4 h-4" />
    </button>
    <h1 className="text-sm font-bold text-zinc-100">{title}</h1>
  </header>
);
