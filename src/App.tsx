import React, { useState } from 'react';
import { useAlertState } from './hooks/useAlertState';
import { useToast } from './hooks/useToast';
import { MobileHeader } from './components/MobileHeader';
import { BottomNav } from './components/BottomNav';
import { FeedList } from './components/FeedList';
import { KeywordSettingsView } from './components/KeywordSettingsView';
import { ArticleModal } from './components/ArticleModal';
import { StatsView } from './components/StatsView';
import { Toast } from './components/Toast';
import { ErrorBanner } from './components/ErrorBanner';
import { AlertItem } from './types';
import { MESSAGES } from './config/messages';

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
  const { toastMessage, showToast } = useToast();

  const handleRefresh = () => fetchFeeds();

  const handleMarkAllRead = async () => {
    await markAllAsRead(selectedKeywordId);
    showToast(MESSAGES.MARKED_ALL_READ);
  };

  const handleAddKeyword = async (keyword: string, feedUrl: string, color?: string) => {
    await addKeyword(keyword, feedUrl, color);
    showToast(MESSAGES.KEYWORD_ADDED(keyword));
  };

  const handleDeleteKeyword = async (id: string) => {
    const kw = keywords.find((k) => k.id === id);
    await deleteKeyword(id);
    if (kw) showToast(MESSAGES.KEYWORD_DELETED(kw.keyword));
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between selection:bg-blue-500 selection:text-white">
      {/* モバイルビュー用コンテナ（デスクトップでは中央にスマホ幅でセンタリング、モバイルでは全幅） */}
      <div className="w-full max-w-md mx-auto min-h-screen flex flex-col bg-zinc-950 border-x border-zinc-800/40 relative shadow-2xl">
        <Toast message={toastMessage} />

        <MobileHeader
          keywords={keywords}
          selectedKeywordId={selectedKeywordId}
          onSelectKeyword={setSelectedKeywordId}
          filterType={filterType}
          onSelectFilterType={setFilterType}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          isRefreshing={isRefreshing}
          onRefresh={handleRefresh}
          onMarkAllAsRead={handleMarkAllRead}
          unreadCount={stats.unread}
          totalCount={items.length}
        />

        <ErrorBanner error={error} onRetry={handleRefresh} />

        {/* メインコンテンツエリア */}
        <main className="flex-1">
          {/* フィード / お気に入り */}
          {(activeTab === 'feed' || activeTab === 'favorites') && (
            <FeedList
              items={filteredItems}
              keywords={keywords}
              filterType={filterType}
              activeTab={activeTab}
              isLoading={isLoading}
              isRefreshing={isRefreshing}
              onRefresh={handleRefresh}
              onToggleRead={markAsRead}
              onToggleFavorite={toggleFavorite}
              onOpenArticle={setSelectedArticle}
              onGoToKeywords={() => setActiveTab('keywords')}
            />
          )}

          {/* キーワード設定 */}
          {activeTab === 'keywords' && (
            <div className="p-4">
              <KeywordSettingsView
                keywords={keywords}
                onAddKeyword={handleAddKeyword}
                onUpdateKeyword={updateKeyword}
                onDeleteKeyword={handleDeleteKeyword}
                onToggleActive={toggleKeywordActive}
              />
            </div>
          )}

          {/* 統計・同期設定 */}
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

        <ArticleModal
          item={selectedArticle}
          onClose={() => setSelectedArticle(null)}
          onToggleFavorite={toggleFavorite}
          onToggleRead={markAsRead}
        />

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
