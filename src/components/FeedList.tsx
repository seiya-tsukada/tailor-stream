import React from 'react';
import { Inbox, Sliders } from 'lucide-react';
import type { Article } from '../api/types';
import { SKELETON_COUNT } from '../config/constants';
import { MESSAGES } from '../config/messages';
import { ArticleCard } from './ArticleCard';

interface FeedListProps {
  articles: Article[];
  categoryNames: Record<string, string>;
  hasSelection: boolean;
  isLoading: boolean;
}

const EmptyState: React.FC<{ icon: React.ReactNode; title: string; description: string }> = ({
  icon,
  title,
  description,
}) => (
  <div className="flex flex-col items-center text-center px-8 py-16">
    <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
      {icon}
    </div>
    <h3 className="text-sm font-semibold text-zinc-200 mb-1">{title}</h3>
    <p className="text-xs leading-relaxed text-zinc-500">{description}</p>
  </div>
);

export const FeedList: React.FC<FeedListProps> = ({ articles, categoryNames, hasSelection, isLoading }) => {
  if (!hasSelection) {
    return (
      <EmptyState
        icon={<Sliders className="w-7 h-7 text-blue-400/80" />}
        title={MESSAGES.FEED_EMPTY_NO_CATEGORY_TITLE}
        description={MESSAGES.FEED_EMPTY_NO_CATEGORY_DESCRIPTION}
      />
    );
  }

  if (isLoading && articles.length === 0) {
    return (
      <div className="p-4 space-y-3">
        {Array.from({ length: SKELETON_COUNT }, (_, i) => (
          <div key={i} className="h-32 rounded-2xl bg-zinc-900 border border-zinc-800 animate-pulse" />
        ))}
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <EmptyState
        icon={<Inbox className="w-7 h-7 text-zinc-500" />}
        title={MESSAGES.FEED_EMPTY_TITLE}
        description={MESSAGES.FEED_EMPTY_DESCRIPTION}
      />
    );
  }

  return (
    <div className="p-4 space-y-3">
      {articles.map((article) => (
        <ArticleCard key={article.id} article={article} categoryNames={categoryNames} />
      ))}
    </div>
  );
};
