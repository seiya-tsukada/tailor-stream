import React from 'react';
import {
  BarChart3,
  Database,
  Download,
  Check,
  Layers,
  Copy,
} from 'lucide-react';
import { AlertItem, AlertKeyword, FeedStats } from '../types';
import { EXPORT_CONFIG } from '../config/constants';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';

// Cloud DB 移行ガイドに表示するサンプルコード
const SUPABASE_SAMPLE_CODE = `// src/services/storage.ts
import { createClient } from '@supabase/supabase-js';

// 1. Supabase用のリポジトリ実装クラスを作成
export class SupabaseAlertRepository implements IAlertRepository {
  private supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  async loadState(): Promise<AlertStateData> {
    const { data: keywords } = await this.supabase.from('keywords').select('*');
    const { data: reads } = await this.supabase.from('reads').select('item_id');
    const { data: favorites } = await this.supabase.from('favorites').select('item_id');
    return {
      keywords: keywords || [],
      readIds: (reads || []).map(r => r.item_id),
      favoriteIds: (favorites || []).map(f => f.item_id),
      cachedItems: [],
    };
  }

  async markAsRead(idOrIds: string | string[], isRead: boolean) {
    // ユーザーIDに紐づけてUpsert / Delete
  }
  // ...
}

// 2. この1行を差し替えるだけで、全画面がSupabase対応になります！
export const defaultAlertRepository = new SupabaseAlertRepository();`;

const percentOf = (value: number, total: number) =>
  total > 0 ? Math.round((value / total) * 100) : 0;

interface StatsViewProps {
  items: AlertItem[];
  keywords: AlertKeyword[];
  stats: FeedStats;
  lastSyncTime: string | null;
}

export const StatsView: React.FC<StatsViewProps> = ({
  items,
  keywords,
  stats,
  lastSyncTime,
}) => {
  const { copied: copiedCode, copy } = useCopyToClipboard();

  const readCount = stats.total - stats.unread;
  const readPercentage = percentOf(readCount, stats.total);

  // JSON エクスポート
  const handleExportJson = () => {
    const data = {
      keywords,
      items,
      exportedAt: new Date().toISOString(),
      version: EXPORT_CONFIG.VERSION,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${EXPORT_CONFIG.FILE_PREFIX}${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };


  return (
    <div className="space-y-6 pb-20">
      {/* 読書進捗・サマリーカード */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-blue-400" />
          <span>アラート閲覧ステータス</span>
        </h2>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-zinc-950/60 p-3 rounded-xl border border-zinc-800 text-center">
            <span className="text-[11px] text-zinc-400 block mb-1">全受信記事</span>
            <span className="text-xl font-bold text-zinc-100 font-mono">
              {stats.total}
            </span>
          </div>

          <div className="bg-zinc-950/60 p-3 rounded-xl border border-zinc-800 text-center">
            <span className="text-[11px] text-blue-400 block mb-1">未読</span>
            <span className="text-xl font-bold text-blue-400 font-mono">
              {stats.unread}
            </span>
          </div>

          <div className="bg-zinc-950/60 p-3 rounded-xl border border-zinc-800 text-center">
            <span className="text-[11px] text-amber-400 block mb-1">保存済み</span>
            <span className="text-xl font-bold text-amber-400 font-mono">
              {stats.favorites}
            </span>
          </div>
        </div>

        {/* プログレスバー */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-zinc-400">
            <span>消化率（既読率）</span>
            <span className="font-mono text-zinc-200">{readPercentage}%</span>
          </div>
          <div className="w-full h-2.5 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500"
              style={{ width: `${readPercentage}%` }}
            />
          </div>
        </div>

        {lastSyncTime && (
          <p className="text-[10px] text-zinc-500 text-right mt-2 font-mono">
            最終同期: {new Date(lastSyncTime).toLocaleTimeString()}
          </p>
        )}
      </div>

      {/* キーワード別内訳 */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
        <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-purple-400" />
          <span>キーワード別受信内訳</span>
        </h3>

        <div className="space-y-2.5">
          {keywords.map((kw) => {
            const count = stats.keywordCounts[kw.id] || { total: 0, unread: 0 };
            const percent = percentOf(count.total, stats.total);

            return (
              <div key={kw.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: kw.color }}
                    />
                    <span className="font-medium text-zinc-200">{kw.keyword}</span>
                  </div>
                  <span className="text-zinc-400 font-mono text-[11px]">
                    {count.total}件 (未読 {count.unread})
                  </span>
                </div>
                <div className="w-full h-1.5 bg-zinc-950 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${percent}%`,
                      backgroundColor: kw.color,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 将来の Supabase / Cloud DB 移行設計ガイド */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
            <Database className="w-4 h-4 text-emerald-400" />
            <span>Cloud DB / Supabase 接続アーキテクチャ</span>
          </h3>
          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-semibold">
            Ready to Plug
          </span>
        </div>

        <p className="text-xs text-zinc-400 leading-relaxed">
          当アプリは状態管理ロジックを <code className="text-zinc-200 bg-zinc-800 px-1 py-0.5 rounded">IAlertRepository</code> インターフェースで完全に抽象化しています。
          SupabaseやFirebase、Prismaへ移行する際は、以下のクラスを差し替えるだけで1行で切り替え可能です。
        </p>

        {/* コードスニペット */}
        <div className="relative bg-zinc-950 rounded-xl p-3 border border-zinc-800 text-[11px] font-mono text-zinc-300 overflow-x-auto">
          <button
            type="button"
            onClick={() => copy(SUPABASE_SAMPLE_CODE)}
            className="absolute top-2.5 right-2.5 text-zinc-400 hover:text-white p-1 rounded bg-zinc-800/80 border border-zinc-700"
            title="コードをコピー"
          >
            {copiedCode ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
          <pre>{SUPABASE_SAMPLE_CODE}</pre>
        </div>
      </div>

      {/* データバックアップ & エクスポート */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between gap-3">
        <div>
          <h4 className="text-xs font-semibold text-zinc-200">
            データのエクスポート (JSON)
          </h4>
          <p className="text-[11px] text-zinc-400">
            登録キーワードとお気に入りデータをローカルファイルにバックアップします。
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportJson}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 shrink-0 transition-colors"
        >
          <Download className="w-4 h-4 text-blue-400" />
          <span>JSON保存</span>
        </button>
      </div>
    </div>
  );
};
