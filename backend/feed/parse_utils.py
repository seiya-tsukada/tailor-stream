"""Google アラートの RSS 向けパーサー＆サニタイズユーティリティ"""

import re
from urllib.parse import parse_qs, unquote, urlsplit

FALLBACK_DOMAIN = "Web"

_HTML_ENTITIES: dict[str, str] = {
    "&quot;": '"',
    "&apos;": "'",
    "&#39;": "'",
    "&#x27;": "'",
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&nbsp;": " ",
    "&#160;": " ",
    "&middot;": "・",
    "&hellip;": "…",
    "&#8230;": "…",
    "&mdash;": "—",
    "&#8212;": "—",
    "&ndash;": "–",
    "&#8211;": "–",
    "&copy;": "©",
    "&reg;": "®",
}

_BREAK_TAG = re.compile(r"<(br|p|div)\s*/?>", re.IGNORECASE)
_ANY_TAG = re.compile(r"<[^>]+>")
_ENTITY = re.compile(r"&[a-zA-Z0-9#x]+;")
_WHITESPACE = re.compile(r"\s+")
_REDIRECT_PARAM = re.compile(r"[?&](?:url|q)=([^&]+)")


def _decode_numeric_entity(entity: str, prefix_length: int, base: int) -> str:
    try:
        return chr(int(entity[prefix_length:-1], base))
    except (ValueError, OverflowError):
        return entity


def _decode_entity(match: re.Match[str]) -> str:
    entity = match.group(0)
    if entity in _HTML_ENTITIES:
        return _HTML_ENTITIES[entity]
    if entity.startswith(("&#x", "&#X")):
        return _decode_numeric_entity(entity, 3, 16)
    if entity.startswith("&#"):
        return _decode_numeric_entity(entity, 2, 10)
    return entity


def sanitize_html(raw_html: str) -> str:
    """HTML タグを除去し、エンティティをデコードして空白を整える"""
    if not raw_html:
        return ""
    without_tags = _ANY_TAG.sub("", _BREAK_TAG.sub(" ", raw_html))
    decoded = _ENTITY.sub(_decode_entity, without_tags)
    return _WHITESPACE.sub(" ", decoded).strip()


def extract_original_url(google_url: str) -> str:
    """Google 転送 URL（https://www.google.com/url?rct=j&sa=t&url=...）から元の URL を取り出す"""
    if not google_url:
        return ""
    if "google." not in google_url or "/url?" not in google_url:
        return google_url

    parts = urlsplit(google_url)
    if not parts.scheme or not parts.netloc:
        # URL として解釈できない場合は正規表現でフォールバック
        match = _REDIRECT_PARAM.search(google_url)
        return unquote(match.group(1)) if match else google_url

    query = parse_qs(parts.query)
    target = (query.get("url") or query.get("q") or [""])[0]
    if not target:
        return google_url

    # 2重エンコードにも対応
    decoded = unquote(target)
    if "%3A" in decoded or "%2F" in decoded:
        decoded = unquote(decoded)
    return decoded


def extract_domain(url: str) -> str:
    """ドメイン名（情報ソース）を取り出す。先頭の www. は除く"""
    if not url:
        return FALLBACK_DOMAIN
    try:
        hostname = urlsplit(url).hostname
    except ValueError:
        return FALLBACK_DOMAIN
    if not hostname:
        return FALLBACK_DOMAIN
    return hostname.removeprefix("www.") or FALLBACK_DOMAIN
