import React from 'react';
import { ExternalLink } from 'lucide-react';
import type { Article } from '../api/types';
import { MESSAGES } from '../config/messages';
import { formatRelativeTime, getFaviconUrl } from '../utils/format';
import { Favicon } from './Favicon';

interface ArticleCardProps {
  article: Article;
  categoryNames: Record<string, string>;
}

export const ArticleCard: React.FC<ArticleCardProps> = ({ article, categoryNames }) => (
  <article className="rounded-2xl p-4 border bg-zinc-900 border-zinc-700/80 shadow-lg shadow-black/20 hover:border-zinc-500 transition-colors">
    <a href={article.url} target="_blank" rel="noopener noreferrer" aria-label={`${MESSAGES.OPEN_ARTICLE}: ${article.title}`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Favicon
            src={getFaviconUrl(article.sourceDomain)}
            alt={article.sourceDomain}
            containerClassName="w-5 h-5 rounded-md bg-zinc-800 flex items-center justify-center overflow-hidden shrink-0 border border-zinc-700/50"
            imageClassName="w-3.5 h-3.5 object-contain"
            fallbackIconClassName="w-3 h-3 text-zinc-400"
            lazy
          />
          <span className="text-xs font-medium text-zinc-300 truncate">{article.sourceName ?? article.sourceDomain}</span>
        </div>
        <time dateTime={article.publishedAt} className="text-[11px] text-zinc-500 shrink-0">
          {formatRelativeTime(article.publishedAt)}
        </time>
      </div>

      <h3 className="text-sm font-semibold leading-snug text-zinc-100 mb-1.5">{article.title}</h3>
      {article.snippet && <p className="text-xs leading-relaxed text-zinc-400 line-clamp-3">{article.snippet}</p>}

      <div className="flex items-center justify-between gap-2 mt-3">
        <div className="flex flex-wrap gap-1">
          {article.categoryIds.map((id) => (
            <span key={id} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300">
              {categoryNames[id] ?? id}
            </span>
          ))}
        </div>
        <ExternalLink className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
      </div>
    </a>
  </article>
);
