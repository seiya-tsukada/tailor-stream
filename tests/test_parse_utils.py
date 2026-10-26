from urllib.parse import quote

from backend.feed.parse_utils import extract_domain, extract_original_url, sanitize_html


class TestSanitizeHtml:
    def test_空文字はそのまま空文字を返す(self) -> None:
        assert sanitize_html("") == ""

    def test_HTMLタグを除去し改行系タグは空白に置き換える(self) -> None:
        assert (
            sanitize_html("<b>AI</b> エージェント<br>最新動向<p>まとめ</p>")
            == "AI エージェント 最新動向 まとめ"
        )

    def test_名前付きエンティティをデコードする(self) -> None:
        assert (
            sanitize_html("&quot;Next.js&quot; &amp; React &lt;19&gt; &hellip;")
            == '"Next.js" & React <19> …'
        )

    def test_10進16進の数値エンティティをデコードする(self) -> None:
        assert sanitize_html("It&#39;s &#x41;&#X42; &#8212; ok") == "It's AB — ok"

    def test_未知のエンティティはそのまま残す(self) -> None:
        assert sanitize_html("a &unknown; b") == "a &unknown; b"

    def test_範囲外の数値エンティティはそのまま残す(self) -> None:
        assert sanitize_html("a &#99999999999; b") == "a &#99999999999; b"

    def test_連続する空白を1つにまとめ前後をトリムする(self) -> None:
        assert sanitize_html("  foo \n\t bar&nbsp;&nbsp;baz  ") == "foo bar baz"


class TestExtractOriginalUrl:
    def test_空文字は空文字を返す(self) -> None:
        assert extract_original_url("") == ""

    def test_Google転送URL以外はそのまま返す(self) -> None:
        url = "https://example.com/article?id=1"
        assert extract_original_url(url) == url

    def test_urlパラメータからオリジナルURLを取り出す(self) -> None:
        google_url = "https://www.google.com/url?rct=j&sa=t&url=https://jp.techcrunch.com/2026/01/01/ai/&ct=ga&cd=abc"
        assert extract_original_url(google_url) == "https://jp.techcrunch.com/2026/01/01/ai/"

    def test_urlが無ければqパラメータを使う(self) -> None:
        assert (
            extract_original_url("https://www.google.co.jp/url?q=https://example.com/a")
            == "https://example.com/a"
        )

    def test_2重エンコードされたURLをデコードする(self) -> None:
        inner = quote(quote("https://example.com/path?a=1&b=2", safe=""), safe="")
        assert (
            extract_original_url(f"https://www.google.com/url?url={inner}")
            == "https://example.com/path?a=1&b=2"
        )

    def test_対象パラメータが無い転送URLはそのまま返す(self) -> None:
        google_url = "https://www.google.com/url?rct=j&sa=t"
        assert extract_original_url(google_url) == google_url

    def test_URLとして解釈できない場合は正規表現でフォールバックする(self) -> None:
        assert (
            extract_original_url("google.com/url?url=https%3A%2F%2Fexample.com%2Fx&ct=ga")
            == "https://example.com/x"
        )


class TestExtractDomain:
    def test_ホスト名を返し先頭のwwwを除去する(self) -> None:
        assert extract_domain("https://www.nikkei.com/article/1") == "nikkei.com"
        assert extract_domain("https://jp.techcrunch.com/a") == "jp.techcrunch.com"

    def test_空文字や不正なURLはフォールバック値を返す(self) -> None:
        assert extract_domain("") == "Web"
        assert extract_domain("not a url") == "Web"
