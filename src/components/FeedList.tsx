import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Inbox,
  Sparkles,
  RefreshCw,
  Sliders,
  CheckCircle,
  Star,
} from 'lucide-react';
import { AlertItem, AlertKeyword, FeedFilterType, NavTabType } from '../types';
import { AlertCard } from './AlertCard';

interface FeedListProps {
  items: AlertItem[];
  keywords: AlertKeyword[];
  filterType: FeedFilterType;
  activeTab: NavTabType;
  isLoading: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
  onToggleRead: (id: string, isRead: boolean) => void;
  onToggleFavorite: (id: string) => void;
  onOpenArticle: (item: AlertItem) => void;
  onGoToKeywords: () => void;
}

export const FeedList: React.FC<FeedListProps> = ({
  items,
  keywords,
  filterType,
  activeTab,
  isLoading,
  isRefreshing,
  onRefresh,
  onToggleRead,
  onToggleFavorite,
  onOpenArticle,
  onGoToKeywords,
}) => {
  // キーワードのカラーマッピング用Map
  const keywordColorMap = React.useMemo(() => {
    const map = new Map<string, string>();
    keywords.forEach((kw) => map.set(kw.id, kw.color));
    return map;
  }, [keywords]);

  // ローディングプレースホルダー
  if (isLoading && items.length === 0) {
    return (
      <div className="space-y-3 p-4">
        {[1, 2, 3, 4].map((n) => (
          <div
            key={n}
            className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 animate-pulse space-y-2.5"
          >
            <div className="flex items-center justify-between">
              <div className="w-24 h-4 bg-zinc-800 rounded-md" />
              <div className="w-12 h-3 bg-zinc-800 rounded-md" />
            </div>
            <div className="w-4/5 h-5 bg-zinc-800 rounded-md" />
            <div className="w-full h-3 bg-zinc-800/60 rounded-md" />
            <div className="w-2/3 h-3 bg-zinc-800/60 rounded-md" />
          </div>
        ))}
      </div>
    );
  }

  // 記事が0件の場合の空ステート
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center px-4 py-16">
        <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4 text-zinc-400">
          {activeTab === 'favorites' || filterType === 'favorites' ? (
            <Star className="w-7 h-7 text-amber-400/80" />
          ) : filterType === 'unread' ? (
            <CheckCircle className="w-7 h-7 text-blue-400/80" />
          ) : (
            <Inbox className="w-7 h-7 text-zinc-500" />
          )}
        </div>

        <h3 className="text-base font-bold text-zinc-100 mb-1">
          {activeTab === 'favorites' || filterType === 'favorites'
            ? '保存された記事はありません'
            : filterType === 'unread'
            ? '未読の記事はありません！'
            : '表示できるアラート記事がありません'}
        </h3>

        <p className="text-xs text-zinc-400 max-w-xs mb-6 leading-relaxed">
          {activeTab === 'favorites' || filterType === 'favorites'
            ? '記事カードの星マークアイコンをタップすると、後から読み返せるようにここにストックされます。'
            : filterType === 'unread'
            ? 'すべての記事を読み終えました。最新のアラートを受信するには更新ボタンを押してください。'
            : 'キーワード設定からGoogle Alert RSSフィードを追加するか、更新ボタンを押して最新情報を同期してください。'}
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>最新を受信</span>
          </button>

          <button
            type="button"
            onClick={onGoToKeywords}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20 transition-colors"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>キーワード設定</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4 pb-24">
      {/* フィード同期中インジケータ */}
      {isRefreshing && (
        <div className="py-2 px-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-300 flex items-center justify-center gap-2">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>最新のGoogle Alertフィードを同期中...</span>
        </div>
      )}

      {/* 記事カード一覧 */}
      <AnimatePresence mode="popLayout">
        {items.map((item) => (
          <AlertCard
            key={item.id}
            item={item}
            keywordColor={keywordColorMap.get(item.keywordId) || '#3B82F6'}
            onToggleRead={onToggleRead}
            onToggleFavorite={onToggleFavorite}
            onOpenArticle={onOpenArticle}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};
