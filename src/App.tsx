/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useAlertState } from './hooks/useAlertState';
import { MobileHeader } from './components/MobileHeader';
import { BottomNav } from './components/BottomNav';
import { FeedList } from './components/FeedList';
import { KeywordSettingsModal } from './components/KeywordSettingsModal';
import { ArticleModal } from './components/ArticleModal';
import { StatsView } from './components/StatsView';
import { AlertItem, NavTabType } from './types';
import { Sparkles, Check, AlertTriangle } from 'lucide-react';

export default function App() {
  const {
    keywords,
    items,
    filteredItems,
    isLoading,
    isRefreshing,
    error,
    lastSyncTime,
    stats,
    activeTab,
    setActiveTab,
    filterType,
    setFilterType,
    selectedKeywordId,
    setSelectedKeywordId,
    searchQuery,
    setSearchQuery,
    fetchFeeds,
    markAsRead,
    markAllAsRead,
    toggleFavorite,
    addKeyword,
    updateKeyword,
    deleteKeyword,
    toggleKeywordActive,
  } = useAlertState();

  const [selectedArticle, setSelectedArticle] = useState<AlertItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead(selectedKeywordId);
    showToast('すべての未読記事を既読にしました');
  };

  const handleAddKeyword = async (keyword: string, feedUrl: string, color?: string) => {
    await addKeyword(keyword, feedUrl, color);
    showToast(`「${keyword}」を追加しました`);
  };

  const handleDeleteKeyword = async (id: string) => {
    const kw = keywords.find((k) => k.id === id);
    await deleteKeyword(id);
    if (kw) showToast(`「${kw.keyword}」を削除しました`);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between selection:bg-blue-500 selection:text-white">
      {/* モバイルビュー用コンテナ（デスクトップでは中央にスマホ幅でセンタリング、モバイルでは全幅） */}
      <div className="w-full max-w-md mx-auto min-h-screen flex flex-col bg-zinc-950 border-x border-zinc-800/40 relative shadow-2xl">
        {/* トースト通知 */}
        {toastMessage && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-zinc-800/95 border border-zinc-700 text-zinc-100 text-xs font-semibold px-4 py-2 rounded-full shadow-lg flex items-center gap-2 backdrop-blur-md animate-fade-in">
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* ヘッダー */}
        <MobileHeader
          keywords={keywords}
          selectedKeywordId={selectedKeywordId}
          onSelectKeyword={setSelectedKeywordId}
          filterType={filterType}
          onSelectFilterType={setFilterType}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          isRefreshing={isRefreshing}
          onRefresh={() => fetchFeeds()}
          onMarkAllAsRead={handleMarkAllRead}
          unreadCount={stats.unread}
          totalCount={items.length}
        />

        {/* エラーバナー */}
        {error && (
          <div className="mx-4 mt-3 p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-xs text-rose-300 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => fetchFeeds()}
              className="text-[11px] underline font-semibold text-rose-200 shrink-0"
            >
              再試行
            </button>
          </div>
        )}

        {/* メインコンテンツエリア */}
        <main className="flex-1">
          {/* タブ1: フィード / タブ2: お気に入り */}
          {(activeTab === 'feed' || activeTab === 'favorites') && (
            <FeedList
              items={filteredItems}
              keywords={keywords}
              filterType={filterType}
              activeTab={activeTab}
              isLoading={isLoading}
              isRefreshing={isRefreshing}
              onRefresh={() => fetchFeeds()}
              onToggleRead={markAsRead}
              onToggleFavorite={toggleFavorite}
              onOpenArticle={setSelectedArticle}
              onGoToKeywords={() => setActiveTab('keywords')}
            />
          )}

          {/* タブ3: キーワード設定 */}
          {activeTab === 'keywords' && (
            <div className="p-4">
              <KeywordSettingsModal
                keywords={keywords}
                onAddKeyword={handleAddKeyword}
                onUpdateKeyword={updateKeyword}
                onDeleteKeyword={handleDeleteKeyword}
                onToggleActive={toggleKeywordActive}
              />
            </div>
          )}

          {/* タブ4: 統計・同期設定 */}
          {activeTab === 'stats' && (
            <div className="p-4">
              <StatsView
                items={items}
                keywords={keywords}
                stats={stats}
                lastSyncTime={lastSyncTime}
              />
            </div>
          )}
        </main>

        {/* 記事プレビューモーダル */}
        <ArticleModal
          item={selectedArticle}
          onClose={() => setSelectedArticle(null)}
          onToggleFavorite={toggleFavorite}
          onToggleRead={markAsRead}
        />

        {/* 下部固定ナビゲーションバー */}
        <BottomNav
          activeTab={activeTab}
          onChangeTab={setActiveTab}
          unreadCount={stats.unread}
          favoriteCount={stats.favorites}
          keywordCount={keywords.length}
        />
      </div>
    </div>
  );
}
