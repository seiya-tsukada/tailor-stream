# AlertPulse - Google Alerts Mobile Reader / スマートRSSリーダー

[日本語](#japanese) | [English](#english)

---

<a id="japanese"></a>
## 🇯🇵 日本語ドキュメント

**AlertPulse** は、Google Alert（Google アラート）の情報をスマートフォンから快適に閲覧・収集・管理できるように設計されたモバイルアプリ風Webアプリケーション（PWA対応）です。

Google Alert特有のHTMLタグ混入やGoogle転送URLをサーバーサイドで自動解析・正規化し、洗練されたネイティブライクなUIでストレスのない情報収集体験を提供します。

---

### 1. 主な特徴 (Features)

- **Google Alert 特化パースエンジン**:
  - Googleの転送URL (`https://www.google.com/url?url=...`) から本来の記事WebサイトURLを自動復元・抽出。
  - タイトルや概要に含まれる `<b>` タグや特殊HTMLエンティティ（`&quot;`, `&#39;` 等）を完全サニタイズ。
  - 情報ソース（ドメイン名）とファビコンの自動取得・表示。
- **柔軟なキーワード設定 & RSS管理**:
  - キーワードごとのRSSフィードURL登録、ワンタップ接続テスト機能、タグカラー設定。
  - Google アラート作成ページへのダイレクトリンクと作成手順ガイド内蔵。
- **モバイルファーストなネイティブライクUI**:
  - ダークモードベースのカード型レイアウト、親指で操作しやすい下部固定ナビゲーションバー。
  - 既読・未読の直感的な切り替え、一括既読機能、お気に入り保存、アプリ内要約プレビュー。
  - 読書進捗やキーワード別受信内訳の可視化グラフ。
- **将来のCloud DB / Supabase連携を見据えた抽象化設計**:
  - リポジトリパターン（`IAlertRepository`）を採用し、現在はLocalStorageで動作しつつ、将来的なCloud DBへの移行を1行で実現。

---

### 2. システムアーキテクチャ (Architecture)

```
[ Google Alerts RSS Feeds ]
            │
            ▼ (HTTP / XML)
┌─────────────────────────────────────────────────────────────┐
│  Server-Side Processing Engine (Express / Next.js Route)   │
│  - RSS Fetcher (rss-parser)                                 │
│  - Google Redirect URL Decoder (extractOriginalUrl)        │
│  - HTML Tag Sanitizer & Entity Decoder (sanitizeHtml)       │
│  - Domain & Favicon Resolver (extractDomain)               │
└──────────────────────────┬──────────────────────────────────┘
                           │ Clean JSON Response
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Client Application Layer                                   │
│  - Custom Hook: `useAlertState` (State Management)          │
│  - Storage Interface: `IAlertRepository`                    │
│    ├─ LocalStorageAlertRepository (Current)                 │
│    └─ SupabaseAlertRepository / CloudDB (Pluggable)         │
│  - UI Views: FeedList, KeywordSettings, StatsView, Modal    │
└─────────────────────────────────────────────────────────────┘
```

#### ディレクトリ構成
```
/
├── app/                      # Next.js App Router 移植用構成
│   ├── api/feed/route.ts     # Google Alert特化RSSパースAPI
│   ├── layout.tsx            # PWA/ビューポート設定
│   ├── manifest.ts           # Web App Manifest (PWA)
│   ├── globals.css           # グローバルスタイル
│   └── page.tsx              # メインページ
├── hooks/
│   └── useAlertState.ts      # 状態管理フック (Next.js/React共用)
├── src/                      # アプリケーションソース (React/Vite)
│   ├── components/           # UIコンポーネント群
│   │   ├── AlertCard.tsx     # 記事カード
│   │   ├── ArticleModal.tsx  # 詳細プレビューモーダル
│   │   ├── BottomNav.tsx     # 下部固定ナビゲーション
│   │   ├── FeedList.tsx      # フィード一覧表示
│   │   ├── KeywordSettingsModal.tsx # キーワード設定画面
│   │   ├── MobileHeader.tsx  # モバイルヘッダー
│   │   └── StatsView.tsx     # 統計・DB移行ガイド画面
│   ├── hooks/
│   │   └── useAlertState.ts  # 状態管理カスタムフック
│   ├── services/
│   │   └── storage.ts        # IAlertRepository & LocalStorage実装
│   ├── utils/
│   │   └── alertUtils.ts     # Google Alert特化ユーティリティ
│   ├── types.ts              # TypeScript型定義
│   ├── App.tsx               # メインアプリケーションコンポーネント
│   └── main.tsx              # エントリーポイント
├── server.ts                 # Express / APIサーバー
├── package.json              # 依存パッケージ定義
└── tsconfig.json             # TypeScript設定
```

---

### 3. データの持ち方・スキーマ設計 (Data Modeling & Persistence)

データ層は **Repository Pattern (`IAlertRepository`)** で抽象化されており、UIコンポーネントは永続化先の仕様（LocalStorage, Supabase, Firebase, PostgreSQL等）に依存しません。

#### TypeScript インターフェース定義 (`src/types.ts`)

```typescript
// 記事アイテムの型定義
export interface AlertItem {
  id: string;               // 一意の識別子 (Base64ハッシュ)
  title: string;            // 生のタイトル (HTML含む場合あり)
  cleanTitle: string;       // サニタイズ済みプレーンタイトル
  summary: string;          // 生の概要
  cleanSummary: string;     // サニタイズ済み概要テキスト
  originalUrl: string;      // 復元された元Webサイトの直URL
  googleUrl: string;        // Google転送URL
  publishedAt: string;      // ISO 8601 形式の公開日時
  domain: string;           // 抽出されたドメイン名 (例: zenn.dev)
  faviconUrl: string;       // Google Favicon API経由のアイコンURL
  keywordId: string;        // 紐づくキーワードID
  keywordName: string;      // キーワード表示名
  isRead: boolean;          // 既読フラグ
  isFavorite: boolean;      // お気に入り/保存フラグ
}

// キーワード設定の型定義
export interface AlertKeyword {
  id: string;               // キーワードID
  keyword: string;          // 検索語句 (例: "AI エージェント")
  feedUrl: string;          // Google Alert RSSフィードURL
  isActive: boolean;        // 受信有効/無効フラグ
  color: string;            // バッジ/テーマカラー
  createdAt: string;        // 作成日時
}

// ストレージ抽象化インターフェース
export interface IAlertRepository {
  loadState(): Promise<AlertStateData>;
  saveKeywords(keywords: AlertKeyword[]): Promise<void>;
  markAsRead(id: string | string[], isRead: boolean): Promise<void>;
  toggleFavorite(id: string, isFavorite: boolean): Promise<void>;
  cacheFeedItems(items: AlertItem[]): Promise<void>;
}
```

#### Supabase / Cloud DB への移行方法 (1行切り替え)

`src/services/storage.ts` に以下のクラスを追加し、エクスポートを差し替えるだけで、全画面がSupabase対応になります。

```typescript
// src/services/storage.ts
import { createClient } from '@supabase/supabase-js';

export class SupabaseAlertRepository implements IAlertRepository {
  private supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

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

  async markAsRead(idOrIds: string | string[], isRead: boolean): Promise<void> {
    const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
    if (isRead) {
      await this.supabase.from('reads').upsert(ids.map(id => ({ item_id: id })));
    } else {
      await this.supabase.from('reads').delete().in('item_id', ids);
    }
  }

  async toggleFavorite(id: string, isFavorite: boolean): Promise<void> {
    if (isFavorite) {
      await this.supabase.from('favorites').upsert({ item_id: id });
    } else {
      await this.supabase.from('favorites').delete().eq('item_id', id);
    }
  }

  async saveKeywords(keywords: AlertKeyword[]): Promise<void> {
    await this.supabase.from('keywords').upsert(keywords);
  }

  async cacheFeedItems(items: AlertItem[]): Promise<void> {}
}

// ★ この1行を差し替えるだけ
export const defaultAlertRepository: IAlertRepository = new SupabaseAlertRepository();
```

---

### 4. デプロイ方法 (Deployment Guide)

#### A. Vercel へのデプロイ (Next.js App Router 構成)
1. GitHubリポジトリにプッシュします。
2. [Vercel](https://vercel.com/) にインポートし、Framework Presetとして **Next.js** を選択。
3. ビルドコマンド: `next build` を実行してデプロイ完了。

#### B. Cloud Run / Docker コンテナデプロイ (フルスタック構成)
付属の `Dockerfile` または標準 Node.js コンテナでデプロイ可能です。

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["npm", "run", "start"]
```

#### C. ローカル開発環境の起動
```bash
# 依存関係のインストール
npm install

# 開発サーバーの起動 (ポート 3000)
npm run dev

# プロダクションビルド
npm run build

# 本番起動
npm run start
```

---
---

<a id="english"></a>
## 🇬🇧 English Documentation

**AlertPulse** is a mobile-first Progressive Web Application (PWA) designed to comfortably browse, collect, and manage Google Alert feeds from smartphones and tablets.

It automatically strips HTML garbage, decodes obfuscated Google redirect links back into original publisher URLs, and delivers a native-feeling dark-mode reading experience.

---

### 1. Key Features

- **Google Alert Specialized Parser**:
  - Automatically restores destination URLs from Google redirect links (`https://www.google.com/url?url=...`).
  - Completely sanitizes HTML tags (`<b>`, `<div>`, etc.) and decodes character entities (`&quot;`, `&#39;`).
  - Automatically extracts publisher domains and high-res favicons.
- **Keyword & Feed Management**:
  - Register RSS feeds per topic with custom tag colors.
  - Built-in feed connection validator and Google Alerts setup guide.
- **Mobile Native-Like UI/UX**:
  - Bottom sticky navigation bar with Unread / Favorite count badges.
  - Read/unread toggling, batch mark-all-as-read, article sharing, and in-app summary sheet.
  - Reading velocity and keyword distribution metrics.
- **Pluggable Database Architecture**:
  - Encapsulated via the Repository Pattern (`IAlertRepository`).
  - Runs out of the box with `localStorage`, and can be migrated to **Supabase / Firebase / Cloud DB** in a single line of code.

---

### 2. System Architecture

```
[ Google Alerts RSS Feeds ]
            │
            ▼ (HTTP / XML)
┌─────────────────────────────────────────────────────────────┐
│  Server-Side Processing Engine (Express / Next.js Route)   │
│  - RSS Fetcher (rss-parser)                                 │
│  - Google Redirect URL Decoder (extractOriginalUrl)        │
│  - HTML Tag Sanitizer & Entity Decoder (sanitizeHtml)       │
│  - Domain & Favicon Resolver (extractDomain)               │
└──────────────────────────┬──────────────────────────────────┘
                           │ Clean JSON Response
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Client Application Layer                                   │
│  - Custom Hook: `useAlertState` (State Management)          │
│  - Storage Interface: `IAlertRepository`                    │
│    ├─ LocalStorageAlertRepository (Default)                 │
│    └─ SupabaseAlertRepository / CloudDB (Drop-in ready)     │
│  - UI Views: FeedList, KeywordSettings, StatsView, Modal    │
└─────────────────────────────────────────────────────────────┘
```

---

### 3. Data Modeling & Persistence

The state is abstracted via `IAlertRepository`, isolating UI components from the underlying storage mechanism.

#### Schema Definitions (`src/types.ts`)

- `AlertItem`: Represents parsed and enriched Google Alert entries (cleanTitle, cleanSummary, originalUrl, domain, faviconUrl, isRead, isFavorite).
- `AlertKeyword`: Keyword metadata, custom tag color, and RSS feed URL.
- `IAlertRepository`: Repository contract containing `loadState()`, `saveKeywords()`, `markAsRead()`, `toggleFavorite()`, and `cacheFeedItems()`.

---

### 4. Deployment Methods

#### Vercel (Next.js App Router)
1. Push this repository to GitHub.
2. Import project into Vercel.
3. Select **Next.js** framework preset and deploy.

#### Docker & Cloud Run
```bash
# Build production bundle
npm run build

# Start production server
npm run start
```

---

### 5. License
Apache-2.0
