import React, { useMemo } from 'react';
import { AppHeader } from './components/AppHeader';
import { CategoryPicker } from './components/CategoryPicker';
import { ErrorBanner } from './components/ErrorBanner';
import { FeedList } from './components/FeedList';
import { useCategories } from './hooks/useCategories';
import { useCategorySelection } from './hooks/useCategorySelection';
import { useFeed } from './hooks/useFeed';

export default function App() {
  const { categories, isLoading: isLoadingCategories, error: categoriesError, reload: reloadCategories } = useCategories();
  const { selectedIds, setSelectedIds } = useCategorySelection();
  const { articles, isLoading: isLoadingFeed, error: feedError, reload: reloadFeed } = useFeed(selectedIds);

  const categoryNames = useMemo(
    () => Object.fromEntries(categories.map((category) => [category.id, category.nameJa])),
    [categories]
  );

  const handleRefresh = () => {
    if (categoriesError) void reloadCategories();
    void reloadFeed();
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-blue-500 selection:text-white">
      {/* デスクトップでは中央にスマホ幅で表示、モバイルでは全幅 */}
      <div className="w-full max-w-md mx-auto min-h-screen flex flex-col bg-zinc-950 border-x border-zinc-800/40">
        <AppHeader isRefreshing={isLoadingFeed} onRefresh={handleRefresh} />
        <CategoryPicker
          categories={categories}
          selectedIds={selectedIds}
          isLoading={isLoadingCategories}
          onChange={setSelectedIds}
        />
        <ErrorBanner error={categoriesError ?? feedError} onRetry={handleRefresh} />
        <main className="flex-1">
          <FeedList
            articles={articles}
            categoryNames={categoryNames}
            hasSelection={selectedIds.length > 0}
            isLoading={isLoadingFeed}
          />
        </main>
      </div>
    </div>
  );
}
