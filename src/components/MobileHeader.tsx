import React, { useState } from 'react';
import {
  Bell,
  RefreshCw,
  Search,
  X,
  CheckCheck,
  Filter,
} from 'lucide-react';
import { AlertKeyword, FeedFilterType } from '../types';

interface MobileHeaderProps {
  keywords: AlertKeyword[];
  selectedKeywordId: string | null;
  onSelectKeyword: (id: string | null) => void;
  filterType: FeedFilterType;
  onSelectFilterType: (filter: FeedFilterType) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isRefreshing: boolean;
  onRefresh: () => void;
  onMarkAllAsRead: () => void;
  unreadCount: number;
  totalCount: number;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  keywords,
  selectedKeywordId,
  onSelectKeyword,
  filterType,
  onSelectFilterType,
  searchQuery,
  onSearchChange,
  isRefreshing,
  onRefresh,
  onMarkAllAsRead,
  unreadCount,
  totalCount,
}) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800/80 px-4 pt-3 pb-2.5">
      {/* 上段: ロゴ・ステータス・アクションボタン */}
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-md shadow-blue-500/20">
            <Bell className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white tracking-tight leading-none">
                AlertPulse
              </h1>
              {unreadCount > 0 && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500 text-white leading-none">
                  {unreadCount}
                </span>
              )}
            </div>
            <p className="text-[10px] text-zinc-400 font-mono mt-0.5">
              Google Alerts Hub
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* 検索トグル */}
          <button
            id="toggle-search-btn"
            type="button"
            onClick={() => {
              setIsSearchOpen(!isSearchOpen);
              if (isSearchOpen) onSearchChange('');
            }}
            className={`p-2 rounded-xl transition-colors ${
              isSearchOpen || searchQuery
                ? 'bg-blue-500/20 text-blue-400'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
            title="記事を検索"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* 一括既読ボタン */}
          {unreadCount > 0 && (
            <button
              id="mark-all-read-btn"
              type="button"
              onClick={onMarkAllAsRead}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-zinc-300 bg-zinc-800/80 hover:bg-zinc-700 hover:text-white border border-zinc-700/50 transition-colors"
              title="すべての未読記事を既読にする"
            >
              <CheckCheck className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-[11px]">全既読</span>
            </button>
          )}

          {/* 更新ボタン */}
          <button
            id="header-refresh-btn"
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className={`p-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors ${
              isRefreshing ? 'animate-spin text-blue-400' : ''
            }`}
            title="フィードを最新に更新"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 検索バー展開時 */}
      {isSearchOpen && (
        <div className="relative mb-2.5">
          <input
            id="search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="タイトル・要約・ドメインで検索..."
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2 pl-9 pr-9 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            autoFocus
          />
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* キーワード横スクロールバー */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar scroll-smooth">
        {/* すべて */}
        <button
          id="kw-filter-all"
          type="button"
          onClick={() => onSelectKeyword(null)}
          className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all shrink-0 ${
            selectedKeywordId === null
              ? 'bg-zinc-100 text-zinc-900 font-semibold shadow-sm'
              : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-zinc-800'
          }`}
        >
          すべて ({totalCount})
        </button>

        {/* 各キーワード */}
        {keywords.map((kw) => {
          const isSelected = selectedKeywordId === kw.id;
          return (
            <button
              id={`kw-filter-${kw.id}`}
              key={kw.id}
              type="button"
              onClick={() => onSelectKeyword(isSelected ? null : kw.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all shrink-0 flex items-center gap-1.5 ${
                isSelected
                  ? 'text-white font-semibold shadow-sm'
                  : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-zinc-800'
              }`}
              style={{
                backgroundColor: isSelected ? kw.color : undefined,
              }}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: isSelected ? '#FFFFFF' : kw.color }}
              />
              <span>{kw.keyword}</span>
            </button>
          );
        })}
      </div>

      {/* フィルタサブバー: すべて / 未読 / お気に入り */}
      <div className="flex items-center justify-between pt-2 mt-1 border-t border-zinc-900 text-xs">
        <div className="flex items-center gap-1">
          <Filter className="w-3 h-3 text-zinc-500 mr-1" />
          <button
            id="filter-tab-all"
            type="button"
            onClick={() => onSelectFilterType('all')}
            className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors ${
              filterType === 'all'
                ? 'bg-zinc-800 text-zinc-100 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            全件
          </button>
          <button
            id="filter-tab-unread"
            type="button"
            onClick={() => onSelectFilterType('unread')}
            className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors ${
              filterType === 'unread'
                ? 'bg-blue-500/20 text-blue-300 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            未読のみ ({unreadCount})
          </button>
          <button
            id="filter-tab-favorites"
            type="button"
            onClick={() => onSelectFilterType('favorites')}
            className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors ${
              filterType === 'favorites'
                ? 'bg-amber-500/20 text-amber-300 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            お気に入り
          </button>
        </div>

        {/* 選択中のキーワード解除リンク */}
        {selectedKeywordId && (
          <button
            type="button"
            onClick={() => onSelectKeyword(null)}
            className="text-[10px] text-zinc-400 hover:text-zinc-200 underline"
          >
            キーワード絞込を解除
          </button>
        )}
      </div>
    </header>
  );
};
