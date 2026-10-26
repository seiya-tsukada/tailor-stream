import React, { useCallback, useMemo, useState } from 'react';
import type { Me } from './api/types';
import { AccountView } from './components/AccountView';
import { AppHeader } from './components/AppHeader';
import { CategoryPicker } from './components/CategoryPicker';
import { ErrorBanner } from './components/ErrorBanner';
import { FeedList } from './components/FeedList';
import { LoginView } from './components/LoginView';
import { PageHeader } from './components/PageHeader';
import { VerifyView } from './components/VerifyView';
import { PAGE_PATHS } from './config/constants';
import { MESSAGES } from './config/messages';
import { useAuth } from './hooks/useAuth';
import { useCategories } from './hooks/useCategories';
import { useCategorySelection } from './hooks/useCategorySelection';
import { useFeed } from './hooks/useFeed';
import { savePendingCategories } from './services/pendingCategories';

type View = 'feed' | 'account' | 'verify';

const initialView = (): View => (window.location.pathname === PAGE_PATHS.AUTH_VERIFY ? 'verify' : 'feed');

export default function App() {
  const [view, setView] = useState<View>(initialView);
  const { user, status: authStatus, setUser, logout } = useAuth();
  const isAuthReady = authStatus === 'ready';
  const { categories, isLoading: isLoadingCategories, error: categoriesError, reload: reloadCategories } = useCategories();
  const {
    selectedIds,
    setSelectedIds,
    isSyncing,
    error: selectionError,
  } = useCategorySelection(user, isAuthReady);
  const {
    articles,
    isLoading: isLoadingFeed,
    error: feedError,
    reload: reloadFeed,
  } = useFeed(selectedIds, user?.id ?? null, isAuthReady && !isSyncing && view === 'feed');

  const categoryNames = useMemo(
    () => Object.fromEntries(categories.map((category) => [category.id, category.nameJa])),
    [categories]
  );

  const goHome = useCallback(() => {
    if (window.location.pathname !== PAGE_PATHS.HOME) {
      window.history.replaceState(null, '', PAGE_PATHS.HOME);
    }
    setView('feed');
  }, []);

  const handleVerified = useCallback(
    (verifiedUser: Me) => {
      setUser(verifiedUser);
      goHome();
    },
    [setUser, goHome]
  );

  const handleLogout = async () => {
    await logout();
    goHome();
  };

  const handleRefresh = () => {
    if (categoriesError) void reloadCategories();
    void reloadFeed();
  };

  const renderBody = () => {
    if (view === 'verify') {
      return <VerifyView onVerified={handleVerified} onGoHome={goHome} />;
    }
    if (view === 'account') {
      return (
        <>
          <PageHeader title={user ? MESSAGES.ACCOUNT_TITLE : MESSAGES.LOGIN_TITLE} onBack={goHome} />
          {user ? (
            <AccountView user={user} onLogout={handleLogout} />
          ) : (
            <LoginView onBeforeRequest={() => savePendingCategories(selectedIds)} />
          )}
        </>
      );
    }
    return (
      <>
        <AppHeader
          isRefreshing={isLoadingFeed}
          isLoggedIn={user !== null}
          onRefresh={handleRefresh}
          onOpenAccount={() => setView('account')}
        />
        <CategoryPicker
          categories={categories}
          selectedIds={selectedIds}
          isLoading={isLoadingCategories || !isAuthReady}
          disabled={isSyncing}
          onChange={(ids) => void setSelectedIds(ids)}
          footer={
            isAuthReady && user === null ? (
              <p className="mt-3 text-[11px] text-zinc-500">{MESSAGES.LOGIN_PROMPT}</p>
            ) : null
          }
        />
        <ErrorBanner error={categoriesError ?? selectionError ?? feedError} onRetry={handleRefresh} />
        <main className="flex-1">
          <FeedList
            articles={articles}
            categoryNames={categoryNames}
            hasSelection={selectedIds.length > 0}
            isLoading={isLoadingFeed || isSyncing || !isAuthReady}
          />
        </main>
      </>
    );
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-blue-500 selection:text-white">
      {/* デスクトップでは中央にスマホ幅で表示、モバイルでは全幅 */}
      <div className="w-full max-w-md mx-auto min-h-screen flex flex-col bg-zinc-950 border-x border-zinc-800/40">
        {renderBody()}
      </div>
    </div>
  );
}
