import React from 'react';
import { Newspaper, Star, Sliders, BarChart3 } from 'lucide-react';
import { NavTabType } from '../types';
import { LIMITS } from '../config/constants';

interface BottomNavProps {
  activeTab: NavTabType;
  onChangeTab: (tab: NavTabType) => void;
  unreadCount: number;
  favoriteCount: number;
  keywordCount: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onChangeTab,
  unreadCount,
  favoriteCount,
  keywordCount,
}) => {
  const navItems: Array<{
    id: NavTabType;
    label: string;
    icon: typeof Newspaper;
    badge: number | null;
    badgeColor: string;
  }> = [
    {
      id: 'feed',
      label: 'フィード',
      icon: Newspaper,
      badge: unreadCount > 0 ? unreadCount : null,
      badgeColor: 'bg-blue-500',
    },
    {
      id: 'favorites',
      label: '保存済み',
      icon: Star,
      badge: favoriteCount > 0 ? favoriteCount : null,
      badgeColor: 'bg-amber-500',
    },
    {
      id: 'keywords',
      label: 'キーワード',
      icon: Sliders,
      badge: null,
      badgeColor: 'bg-zinc-600',
    },
    {
      id: 'stats',
      label: '分析・設定',
      icon: BarChart3,
      badge: null,
      badgeColor: 'bg-zinc-600',
    },
  ];

  return (
    <nav
      id="bottom-navigation-bar"
      className="fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/95 backdrop-blur-lg border-t border-zinc-800/80 pb-safe-area"
    >
      <div className="max-w-md mx-auto flex items-center justify-around px-2 py-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              id={`nav-tab-${item.id}`}
              key={item.id}
              type="button"
              onClick={() => onChangeTab(item.id)}
              className={`relative flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'text-blue-400 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform duration-200 ${
                    isActive ? 'scale-110' : ''
                  }`}
                />
                {item.badge !== null && (
                  <span
                    className={`absolute -top-1 -right-2.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center leading-none ${item.badgeColor}`}
                  >
                    {item.badge > LIMITS.BADGE_MAX ? `${LIMITS.BADGE_MAX}+` : item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-1 tracking-tight">
                {item.label}
              </span>
              {isActive && (
                <div className="w-1 h-1 rounded-full bg-blue-400 mt-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
