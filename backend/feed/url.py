"""URL 正規化と記事 ID"""

import hashlib
from urllib.parse import parse_qsl, urlencode, urlsplit

from backend.config import ARTICLE_ID_LENGTH

# 正規化時に除去するトラッキング用クエリパラメータ（utm_* は前方一致で別途除去）
TRACKING_PARAMS: frozenset[str] = frozenset(
    {
        "fbclid",
        "gclid",
        "dclid",
        "gbraid",
        "wbraid",
        "yclid",
        "msclkid",
        "twclid",
        "igshid",
        "mc_cid",
        "mc_eid",
        "_ga",
        "_gl",
    }
)

_TRACKING_PARAM_PREFIX = "utm_"
_DEFAULT_PORTS = {"http": 80, "https": 443}


def _is_tracking_param(name: str) -> bool:
    lower = name.lower()
    return lower.startswith(_TRACKING_PARAM_PREFIX) or lower in TRACKING_PARAMS


def normalize_url(raw_url: str) -> str:
    """同じ記事を指す URL が同じ文字列になるように正規化する

    - スキーム・ホストを小文字化し、既定のポートを除去
    - トラッキングパラメータ・フラグメント・末尾スラッシュを除去
    - 残ったクエリパラメータはキー順に並べ替える
    URL として解釈できない値は前後の空白だけ除いてそのまま返す。
    """
    trimmed = raw_url.strip()
    try:
        parts = urlsplit(trimmed)
        port = parts.port
    except ValueError:
        return trimmed
    if not parts.scheme or not parts.hostname:
        return trimmed

    scheme = parts.scheme.lower()
    host = parts.hostname
    if port is not None and port != _DEFAULT_PORTS.get(scheme):
        host = f"{host}:{port}"

    params = sorted(
        (
            (name, value)
            for name, value in parse_qsl(parts.query, keep_blank_values=True)
            if not _is_tracking_param(name)
        ),
        key=lambda param: param[0],
    )
    search = f"?{urlencode(params)}" if params else ""
    path = parts.path.rstrip("/")

    return f"{scheme}://{host}{path}{search}"


def is_http_url(url: str) -> bool:
    try:
        parts = urlsplit(url)
    except ValueError:
        return False
    return parts.scheme in _DEFAULT_PORTS and bool(parts.hostname)


def create_article_id(url: str) -> str:
    """正規化した URL の SHA-256 から記事 ID を作る（同じ記事なら同じ ID になる）"""
    digest = hashlib.sha256(normalize_url(url).encode("utf-8")).hexdigest()
    return digest[:ARTICLE_ID_LENGTH]
