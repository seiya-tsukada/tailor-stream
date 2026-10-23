import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Plus,
  Trash2,
  ExternalLink,
  HelpCircle,
  CheckCircle2,
  AlertCircle,
  Rss,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { AlertKeyword } from '../types';
import { createGoogleAlertsWebUrl } from '../utils/alertUtils';
import { validateFeedUrl } from '../services/feedApi';
import { KEYWORD_COLOR_PALETTE } from '../config/keywords';
import { EXTERNAL_LINKS } from '../config/constants';
import { MESSAGES } from '../config/messages';

interface KeywordSettingsProps {
  keywords: AlertKeyword[];
  onAddKeyword: (keyword: string, feedUrl: string, color?: string) => Promise<void>;
  onUpdateKeyword: (id: string, updates: Partial<AlertKeyword>) => Promise<void>;
  onDeleteKeyword: (id: string) => Promise<void>;
  onToggleActive: (id: string) => Promise<void>;
}

type FeedTestResult = {
  status: 'idle' | 'loading' | 'success' | 'error';
  message?: string;
};

export const KeywordSettingsView: React.FC<KeywordSettingsProps> = ({
  keywords,
  onAddKeyword,
  onUpdateKeyword,
  onDeleteKeyword,
  onToggleActive,
}) => {
  const [newKeyword, setNewKeyword] = useState('');
  const [newFeedUrl, setNewFeedUrl] = useState('');
  const [selectedColor, setSelectedColor] = useState<string>(KEYWORD_COLOR_PALETTE[0].hex);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testResult, setTestResult] = useState<FeedTestResult>({ status: 'idle' });
  const [showGuide, setShowGuide] = useState(false);

  // RSS URLのバリデーションテスト
  const handleTestUrl = async () => {
    if (!newFeedUrl.trim()) return;

    setTestResult({ status: 'loading' });
    try {
      const result = await validateFeedUrl(newFeedUrl.trim());
      if (result.success && result.data) {
        setTestResult({
          status: 'success',
          message: MESSAGES.FEED_TEST_SUCCESS(result.data.title, result.data.itemCount),
        });
      } else {
        setTestResult({
          status: 'error',
          message: result.error || MESSAGES.FEED_TEST_FAILED,
        });
      }
    } catch {
      setTestResult({
        status: 'error',
        message: MESSAGES.NETWORK_ERROR,
      });
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyword.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onAddKeyword(newKeyword, newFeedUrl, selectedColor);
      setNewKeyword('');
      setNewFeedUrl('');
      setTestResult({ status: 'idle' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* 説明ヘッダー */}
      <div className="bg-gradient-to-r from-blue-900/30 to-indigo-900/30 border border-blue-800/40 rounded-2xl p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Rss className="w-4 h-4 text-blue-400" />
              <span>キーワード＆アラート設定</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              Google アラートのキーワードやRSSフィードURLを登録してリアルタイム収集します。
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowGuide(!showGuide)}
            className="text-xs text-blue-400 hover:text-blue-300 font-medium inline-flex items-center gap-1 shrink-0 p-1 bg-blue-500/10 rounded-lg border border-blue-500/20"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>{showGuide ? 'ガイドを閉じる' : 'RSS取得方法'}</span>
          </button>
        </div>

        {/* ガイド展開部 */}
        {showGuide && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 pt-3 border-t border-blue-800/40 text-xs text-zinc-300 space-y-2"
          >
            <div className="font-semibold text-blue-300">
              📌 Google アラートからRSSを取得する3ステップ:
            </div>
            <ol className="list-decimal list-inside space-y-1 text-zinc-300">
              <li>
                <a
                  href={EXTERNAL_LINKS.GOOGLE_ALERTS}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 underline inline-flex items-center gap-0.5"
                >
                  Google アラート公式ページ <ExternalLink className="w-3 h-3" />
                </a>
                を開きます。
              </li>
              <li>
                キーワードを入力し、「オプションを表示」をクリックして、配信先を「
                <span className="text-amber-300 font-medium">RSS フィード</span>
                」に設定して作成します。
              </li>
              <li>
                作成されたアラート横の「RSSアイコン」を右クリックして「リンクのアドレスをコピー」し、以下の「RSS
                URL」欄に貼り付けます。
              </li>
            </ol>
            <p className="text-[11px] text-zinc-400">
              ※ RSS URLが空欄の場合でも、キーワードに応じたサンプルプレビューが生成されます。
            </p>
          </motion.div>
        )}
      </div>

      {/* 新規キーワード追加フォーム */}
      <form
        onSubmit={handleAddSubmit}
        className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3"
      >
        <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5 text-blue-400" />
          <span>新しいアラートキーワードを追加</span>
        </h3>

        {/* キーワード名 */}
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1">
            検索キーワード <span className="text-red-400">*</span>
          </label>
          <div className="flex gap-2">
            <input
              id="input-new-keyword"
              type="text"
              required
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              placeholder="例: 生成AI, TypeScript, スタートアップ"
              className="flex-1 bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
            />
            {newKeyword.trim() && (
              <a
                href={createGoogleAlertsWebUrl(newKeyword)}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-blue-400 text-xs font-medium inline-flex items-center gap-1 shrink-0 transition-colors border border-zinc-700"
                title="Googleアラート作成画面を開く"
              >
                <span>Googleで作成</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>

        {/* RSS Feed URL (任意) */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-zinc-400">
              Google Alert RSS URL（任意）
            </label>
            {newFeedUrl && (
              <button
                type="button"
                onClick={handleTestUrl}
                disabled={testResult.status === 'loading'}
                className="text-[11px] text-blue-400 hover:text-blue-300 font-medium inline-flex items-center gap-1"
              >
                {testResult.status === 'loading' ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
                <span>フィード接続テスト</span>
              </button>
            )}
          </div>
          <input
            id="input-feed-url"
            type="url"
            value={newFeedUrl}
            onChange={(e) => {
              setNewFeedUrl(e.target.value);
              setTestResult({ status: 'idle' });
            }}
            placeholder={EXTERNAL_LINKS.GOOGLE_ALERTS_FEED_PLACEHOLDER}
            className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 font-mono"
          />

          {/* テスト結果表示 */}
          {testResult.status === 'success' && (
            <div className="mt-1.5 p-2 bg-emerald-950/40 border border-emerald-800/60 rounded-lg text-[11px] text-emerald-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
              <span>{testResult.message}</span>
            </div>
          )}
          {testResult.status === 'error' && (
            <div className="mt-1.5 p-2 bg-rose-950/40 border border-rose-800/60 rounded-lg text-[11px] text-rose-300 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
              <span>{testResult.message}</span>
            </div>
          )}
        </div>

        {/* タグカラー選択 */}
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">
            タグカラー
          </label>
          <div className="flex items-center gap-2">
            {KEYWORD_COLOR_PALETTE.map((color) => (
              <button
                key={color.hex}
                type="button"
                onClick={() => setSelectedColor(color.hex)}
                className={`w-6 h-6 rounded-full transition-transform ${
                  selectedColor === color.hex
                    ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900 scale-110'
                    : 'opacity-70 hover:opacity-100'
                }`}
                style={{ backgroundColor: color.hex }}
                title={color.name}
              />
            ))}
          </div>
        </div>

        {/* 送信ボタン */}
        <button
          id="btn-add-keyword-submit"
          type="submit"
          disabled={!newKeyword.trim() || isSubmitting}
          className="w-full mt-2 py-2.5 px-4 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>{isSubmitting ? '登録中...' : 'キーワードを登録する'}</span>
        </button>
      </form>

      {/* 登録済みキーワードリスト */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider px-1">
          登録中のキーワード ({keywords.length}件)
        </h3>

        {keywords.length === 0 ? (
          <div className="text-center py-8 bg-zinc-900/50 rounded-2xl border border-zinc-800 text-xs text-zinc-400">
            登録されたキーワードがありません。上のフォームから追加してください。
          </div>
        ) : (
          <div className="space-y-2">
            {keywords.map((kw) => (
              <div
                id={`keyword-row-${kw.id}`}
                key={kw.id}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex items-center justify-between gap-3 hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* カラーピル */}
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: kw.color }}
                  />

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-zinc-100 truncate">
                        {kw.keyword}
                      </span>
                      {kw.feedUrl ? (
                        <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.2 rounded font-mono">
                          RSS連携済
                        </span>
                      ) : (
                        <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.2 rounded">
                          自動
                        </span>
                      )}
                    </div>
                    {kw.feedUrl && (
                      <p className="text-[10px] text-zinc-500 font-mono truncate max-w-[200px] sm:max-w-xs">
                        {kw.feedUrl}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* 有効/無効トグル */}
                  <button
                    type="button"
                    onClick={() => onToggleActive(kw.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      kw.isActive
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                    }`}
                  >
                    {kw.isActive ? '受信中' : '停止中'}
                  </button>

                  {/* 削除ボタン */}
                  <button
                    id={`delete-kw-${kw.id}`}
                    type="button"
                    onClick={() => onDeleteKeyword(kw.id)}
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    title="キーワードを削除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
