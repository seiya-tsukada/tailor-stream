from backend.feed.url import create_article_id, is_http_url, normalize_url


class TestNormalizeUrl:
    def test_スキームとホストを小文字化する(self) -> None:
        assert normalize_url("HTTPS://Example.COM/Path") == "https://example.com/Path"

    def test_トラッキングパラメータを除去し他のパラメータは残す(self) -> None:
        assert (
            normalize_url(
                "https://example.com/a?id=1&utm_source=x&UTM_Medium=y&fbclid=f&gclid=g&page=2"
            )
            == "https://example.com/a?id=1&page=2"
        )

    def test_残ったパラメータはキー順に並べる(self) -> None:
        assert normalize_url("https://example.com/a?b=2&a=1") == "https://example.com/a?a=1&b=2"

    def test_フラグメントと末尾スラッシュを除去する(self) -> None:
        assert normalize_url("https://example.com/a/b/#section") == "https://example.com/a/b"
        assert normalize_url("https://example.com/") == "https://example.com"

    def test_既定のポートは除去しそれ以外は残す(self) -> None:
        assert normalize_url("https://example.com:443/a") == "https://example.com/a"
        assert normalize_url("http://example.com:8080/a") == "http://example.com:8080/a"

    def test_URLでない値は前後の空白だけ除いて返す(self) -> None:
        assert normalize_url("  タイトル-1 ") == "タイトル-1"


class TestCreateArticleId:
    def test_32文字の16進文字列を返す(self) -> None:
        article_id = create_article_id("https://example.com/a")
        assert len(article_id) == 32
        assert all(c in "0123456789abcdef" for c in article_id)

    def test_正規化後に同じURLなら同じIDになる(self) -> None:
        assert create_article_id("https://Example.com/a/?utm_source=x#top") == create_article_id(
            "https://example.com/a"
        )

    def test_トラッキングパラメータだけが違う同一記事ではIDが一致する(self) -> None:
        assert create_article_id(
            "HTTPS://WWW.Example.com/articles/1/?utm_source=google&utm_medium=email#top"
        ) == create_article_id("https://www.example.com/articles/1?fbclid=abc123")

    def test_同一ドメインの別記事は別のIDになる(self) -> None:
        assert create_article_id("https://example.com/articles/1") != create_article_id(
            "https://example.com/articles/2"
        )


def test_is_http_url() -> None:
    assert is_http_url("https://example.com/a")
    assert is_http_url("http://example.com")
    assert not is_http_url("javascript:alert(1)")
    assert not is_http_url("ftp://example.com/a")
    assert not is_http_url("タイトル-1")
