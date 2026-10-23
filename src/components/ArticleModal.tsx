import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  ExternalLink,
  Star,
  Share2,
  Copy,
  Check,
  Calendar,
  Layers,
} from 'lucide-react';
import { AlertItem } from '../types';
import { formatRelativeTime, shareArticle } from '../utils/alertUtils';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';
import { Favicon } from './Favicon';

interface ArticleModalProps {
  item: AlertItem | null;
  onClose: () => void;
  onToggleFavorite: (id: string) => void;
  onToggleRead: (id: string, isRead: boolean) => void;
}

export const ArticleModal: React.FC<ArticleModalProps> = ({
  item,
  onClose,
  onToggleFavorite,
  onToggleRead,
}) => {
  const { copied, copy } = useCopyToClipboard();

  if (!item) return null;

  const handleCopyLink = () => copy(item.originalUrl);

  const handleShare = () => shareArticle(item, handleCopyLink);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm">
        {/* 背景クリックで閉じる */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0"
        />

        {/* モーダルコンテンツ */}
        <motion.div
          initial={{ y: '100%', opacity: 0.8 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl z-10 max-h-[85vh] overflow-y-auto"
        >
          {/* 上部グラブバー（モバイル用） */}
          <div className="w-12 h-1 bg-zinc-700 rounded-full mx-auto mb-4 sm:hidden" />

          {/* ヘッダー */}
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-zinc-800 mb-4">
            <div className="flex items-center gap-2">
              <Favicon
                src={item.faviconUrl}
                alt={item.domain}
                containerClassName="w-6 h-6 rounded-lg bg-zinc-800 flex items-center justify-center overflow-hidden border border-zinc-700"
                imageClassName="w-4 h-4 object-contain"
                fallbackIconClassName="w-3.5 h-3.5 text-zinc-400"
              />
              <span className="text-sm font-semibold text-zinc-200">
                {item.domain}
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* メタ情報 */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400 mb-3">
            <span className="inline-flex items-center gap-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-md font-medium">
              <Layers className="w-3 h-3" />
              {item.keywordName}
            </span>

            <span className="inline-flex items-center gap-1 text-zinc-400 font-mono">
              <Calendar className="w-3 h-3 text-zinc-500" />
              {formatRelativeTime(item.publishedAt)} ({new Date(item.publishedAt).toLocaleDateString()})
            </span>
          </div>

          {/* 記事タイトル */}
          <h2 className="text-lg font-bold text-zinc-50 leading-snug tracking-tight mb-4">
            {item.cleanTitle}
          </h2>

          {/* 概要カード */}
          <div className="bg-zinc-950/80 rounded-xl p-4 border border-zinc-800/80 mb-5">
            <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              アラート要約（Google Alert Snippet）
            </h4>
            <p className="text-sm leading-relaxed text-zinc-300 whitespace-pre-wrap">
              {item.cleanSummary || '要約テキストはありません。'}
            </p>
          </div>

          {/* URL情報 */}
          <div className="bg-zinc-950/40 rounded-xl p-3 border border-zinc-800/50 mb-5 text-xs">
            <div className="text-zinc-500 mb-1 flex items-center justify-between">
              <span>復元された元記事URL:</span>
              <button
                type="button"
                onClick={handleCopyLink}
                className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-1"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'コピー完了' : 'URLコピー'}</span>
              </button>
            </div>
            <p className="text-zinc-400 font-mono break-all truncate">
              {item.originalUrl}
            </p>
          </div>

          {/* アクションボタングループ */}
          <div className="flex flex-col gap-2 pt-2">
            {/* メインCTA: 元記事を開く */}
            <a
              id="modal-open-original-link"
              href={item.originalUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                if (!item.isRead) {
                  onToggleRead(item.id, true);
                }
              }}
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 transition-colors"
            >
              <span>元記事をブラウザで読む</span>
              <ExternalLink className="w-4 h-4" />
            </a>

            {/* サブアクション */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onToggleFavorite(item.id)}
                className={`inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-semibold border transition-colors ${
                  item.isFavorite
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                    : 'bg-zinc-800/80 border-zinc-700 text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                <Star
                  className={`w-4 h-4 ${
                    item.isFavorite ? 'fill-amber-400 text-amber-400' : ''
                  }`}
                />
                <span>{item.isFavorite ? '保存済み' : 'お気に入り保存'}</span>
              </button>

              <button
                type="button"
                onClick={handleShare}
                className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-semibold bg-zinc-800/80 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                <Share2 className="w-4 h-4" />
                <span>共有 / コピー</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
