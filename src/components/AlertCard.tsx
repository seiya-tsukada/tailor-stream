import React from 'react';
import { motion } from 'motion/react';
import {
  ExternalLink,
  Star,
  CheckCircle2,
  Circle,
  Share2,
  BookOpen,
} from 'lucide-react';
import { AlertItem } from '../types';
import { DEFAULT_KEYWORD_COLOR } from '../config/keywords';
import { formatRelativeTime, shareArticle } from '../utils/alertUtils';
import { Favicon } from './Favicon';

interface AlertCardProps {
  item: AlertItem;
  keywordColor?: string;
  onToggleRead: (id: string, isRead: boolean) => void;
  onToggleFavorite: (id: string) => void;
  onOpenArticle: (item: AlertItem) => void;
}

export const AlertCard: React.FC<AlertCardProps> = ({
  item,
  keywordColor = DEFAULT_KEYWORD_COLOR,
  onToggleRead,
  onToggleFavorite,
  onOpenArticle,
}) => {
  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await shareArticle(item, () => navigator.clipboard.writeText(item.originalUrl));
  };

  return (
    <motion.article
      id={`alert-card-${item.id}`}
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.2 }}
      onClick={() => onOpenArticle(item)}
      className={`relative group rounded-2xl p-4 transition-all duration-200 cursor-pointer border ${
        item.isRead
          ? 'bg-zinc-900/60 border-zinc-800/60 opacity-75 hover:opacity-100 hover:border-zinc-700'
          : 'bg-zinc-900 border-zinc-700/80 shadow-lg shadow-black/20 hover:border-zinc-500'
      }`}
    >
      {/* 未読インジケーターバー */}
      {!item.isRead && (
        <div
          className="absolute left-0 top-4 bottom-4 w-1 rounded-r-full"
          style={{ backgroundColor: keywordColor }}
        />
      )}

      {/* ヘッダー情報: ドメイン / ファビコン / キーワード / 時間 */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Favicon
            src={item.faviconUrl}
            alt={item.domain}
            containerClassName="w-5 h-5 rounded-md bg-zinc-800 flex items-center justify-center overflow-hidden shrink-0 border border-zinc-700/50"
            imageClassName="w-3.5 h-3.5 object-contain"
            fallbackIconClassName="w-3 h-3 text-zinc-400"
            lazy
          />

          {/* ドメイン名 */}
          <span className="text-xs font-medium text-zinc-300 truncate max-w-[130px]">
            {item.domain}
          </span>

          {/* キーワードバッジ */}
          <span
            className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 tracking-wide"
            style={{
              backgroundColor: `${keywordColor}20`,
              color: keywordColor,
              border: `1px solid ${keywordColor}40`,
            }}
          >
            {item.keywordName}
          </span>
        </div>

        {/* 投稿日時 */}
        <span className="text-[11px] text-zinc-400 shrink-0 font-mono">
          {formatRelativeTime(item.publishedAt)}
        </span>
      </div>

      {/* 記事タイトル */}
      <h3
        className={`text-base font-semibold leading-snug tracking-tight mb-2 line-clamp-2 ${
          item.isRead ? 'text-zinc-300 font-normal' : 'text-zinc-50'
        }`}
      >
        {item.cleanTitle}
      </h3>

      {/* 記事サマリー */}
      {item.cleanSummary && (
        <p className="text-xs leading-relaxed text-zinc-400 line-clamp-2 mb-3">
          {item.cleanSummary}
        </p>
      )}

      {/* フッターアクションバー */}
      <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80 mt-1">
        <div className="flex items-center gap-1">
          {/* 既読/未読 切り替えボタン */}
          <button
            id={`toggle-read-btn-${item.id}`}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleRead(item.id, !item.isRead);
            }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              item.isRead
                ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                : 'text-blue-400 bg-blue-500/10 hover:bg-blue-500/20'
            }`}
            title={item.isRead ? '未読に戻す' : '既読にする'}
          >
            {item.isRead ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-zinc-500" />
                <span>既読</span>
              </>
            ) : (
              <>
                <Circle className="w-3.5 h-3.5 fill-blue-400 text-blue-400" />
                <span>未読</span>
              </>
            )}
          </button>

          {/* 記事詳細プレビュー */}
          <button
            id={`preview-btn-${item.id}`}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenArticle(item);
            }}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">概要</span>
          </button>
        </div>

        <div className="flex items-center gap-1">
          {/* シェア / コピー */}
          <button
            id={`share-btn-${item.id}`}
            type="button"
            onClick={handleShare}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            title="記事を共有またはURLをコピー"
          >
            <Share2 className="w-4 h-4" />
          </button>

          {/* お気に入り切り替え */}
          <button
            id={`favorite-btn-${item.id}`}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(item.id);
            }}
            className={`p-1.5 rounded-lg transition-colors ${
              item.isFavorite
                ? 'text-amber-400 bg-amber-400/10 hover:bg-amber-400/20'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
            title={item.isFavorite ? 'お気に入りから削除' : 'お気に入りに追加'}
          >
            <Star
              className={`w-4 h-4 ${
                item.isFavorite ? 'fill-amber-400 text-amber-400' : ''
              }`}
            />
          </button>

          {/* 元記事直リンクを開く */}
          <a
            id={`external-link-${item.id}`}
            href={item.originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              e.stopPropagation();
              // リンクをクリックした時点で自動既読にする
              if (!item.isRead) {
                onToggleRead(item.id, true);
              }
            }}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            title="元記事をブラウザで直接開く"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </motion.article>
  );
};
