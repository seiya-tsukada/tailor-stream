"""開発用のモックプロバイダ（外部 API を呼ばずにカテゴリごとのサンプル記事を返す）"""

from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from backend.feed.categories import Category
from backend.feed.provider import FetchedArticle, FetchResult

GOOGLE_REDIRECT_BASE = "https://www.google.com/url?rct=j&sa=t&ct=ga&url="


@dataclass(frozen=True)
class _SampleTemplate:
    domain: str
    source_name: str
    # {kw} がカテゴリ名に置き換わる。<b> は Google アラートと同じく ingestion のサニタイズで除去される
    title: str
    snippet: str
    path: str
    minutes_ago: int
    share_count: int | None


_SAMPLE_TEMPLATES: tuple[_SampleTemplate, ...] = (
    _SampleTemplate(
        domain="jp.techcrunch.com",
        source_name="TechCrunch Japan",
        title="<b>{kw}</b>の最新動向と実践アーキテクチャ2026年版まとめ",
        snippet="最新の<b>{kw}</b>を活用した高速開発手法と、本番運用におけるセキュリティ考慮事項を解説します。",
        path="/news/2026/10/{id}-trends",
        minutes_ago=25,
        share_count=120,
    ),
    _SampleTemplate(
        domain="nikkei.com",
        source_name="日本経済新聞",
        title="国内企業における<b>{kw}</b>導入事例と業務効率化の成果発表",
        snippet="従来のワークフローと比べて約40%のコスト削減を達成した<b>{kw}</b>の設計パターンが公開されました。",
        path="/article/{id}-case-study",
        minutes_ago=120,
        share_count=40,
    ),
    _SampleTemplate(
        domain="zenn.dev",
        source_name="Zenn",
        title="次世代<b>{kw}</b>技術スタックの選定とパフォーマンス比較検証レポート",
        snippet="エンジニアコミュニティで話題の<b>{kw}</b>関連ライブラリを実際にベンチマークした詳細レポートです。",
        path="/articles/{id}-benchmark",
        minutes_ago=360,
        share_count=8,
    ),
    _SampleTemplate(
        domain="itmedia.co.jp",
        source_name="ITmedia",
        title="新興スタートアップが発表した<b>{kw}</b>連携プラットフォームの全貌",
        snippet="プレシードラウンドでの資金調達を完了し、ベータ版の事前登録を開始。<b>{kw}</b>を活用した新UIが特徴。",
        path="/news/articles/{id}-platform",
        minutes_ago=60 * 18,
        share_count=None,
    ),
)


class MockNewsProvider:
    def __init__(self, now: Callable[[], datetime] | None = None) -> None:
        self._now = now or (lambda: datetime.now(UTC))

    @property
    def name(self) -> str:
        return "mock"

    def supports(self, category: Category) -> bool:
        return True

    def fetch_articles(self, category: Category) -> FetchResult:
        now = self._now()
        articles = [
            FetchedArticle(
                # Google アラートと同じ転送 URL 形式にして、元 URL の復元処理も通す
                url=GOOGLE_REDIRECT_BASE
                + f"https://{template.domain}{template.path.format(id=category.id)}?utm_source=mock",
                title=template.title.format(kw=category.name_ja),
                snippet=template.snippet.format(kw=category.name_ja),
                source_name=template.source_name,
                published_at=now - timedelta(minutes=template.minutes_ago),
                language="ja",
                region="jp",
                share_count=template.share_count,
            )
            for template in _SAMPLE_TEMPLATES
        ]
        return FetchResult(articles=articles, request_units=0)
