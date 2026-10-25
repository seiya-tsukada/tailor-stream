import { describe, expect, it } from 'vitest';
import { extractDomain, extractOriginalUrl, sanitizeHtml } from './parseUtils';

describe('sanitizeHtml', () => {
  it('空文字はそのまま空文字を返す', () => {
    expect(sanitizeHtml('')).toBe('');
  });

  it('HTML タグを除去し、改行系タグは空白に置き換える', () => {
    expect(sanitizeHtml('<b>AI</b> エージェント<br>最新動向<p>まとめ</p>')).toBe('AI エージェント 最新動向 まとめ');
  });

  it('名前付きエンティティをデコードする', () => {
    expect(sanitizeHtml('&quot;Next.js&quot; &amp; React &lt;19&gt; &hellip;')).toBe('"Next.js" & React <19> …');
  });

  it('10進・16進の数値エンティティをデコードする', () => {
    expect(sanitizeHtml('It&#39;s &#x41;&#X42; &#8212; ok')).toBe("It's AB — ok");
  });

  it('未知のエンティティはそのまま残す', () => {
    expect(sanitizeHtml('a &unknown; b')).toBe('a &unknown; b');
  });

  it('連続する空白を1つにまとめ、前後をトリムする', () => {
    expect(sanitizeHtml('  foo \n\t bar&nbsp;&nbsp;baz  ')).toBe('foo bar baz');
  });
});

describe('extractOriginalUrl', () => {
  it('空文字は空文字を返す', () => {
    expect(extractOriginalUrl('')).toBe('');
  });

  it('Google 転送 URL 以外はそのまま返す', () => {
    expect(extractOriginalUrl('https://example.com/article?id=1')).toBe('https://example.com/article?id=1');
  });

  it('url パラメータからオリジナル URL を取り出す', () => {
    const googleUrl =
      'https://www.google.com/url?rct=j&sa=t&url=https://jp.techcrunch.com/2026/01/01/ai/&ct=ga&cd=abc';
    expect(extractOriginalUrl(googleUrl)).toBe('https://jp.techcrunch.com/2026/01/01/ai/');
  });

  it('url が無ければ q パラメータを使う', () => {
    expect(extractOriginalUrl('https://www.google.co.jp/url?q=https://example.com/a')).toBe('https://example.com/a');
  });

  it('2重エンコードされた URL をデコードする', () => {
    const inner = encodeURIComponent(encodeURIComponent('https://example.com/path?a=1&b=2'));
    expect(extractOriginalUrl(`https://www.google.com/url?url=${inner}`)).toBe('https://example.com/path?a=1&b=2');
  });

  it('対象パラメータが無い転送 URL はそのまま返す', () => {
    const googleUrl = 'https://www.google.com/url?rct=j&sa=t';
    expect(extractOriginalUrl(googleUrl)).toBe(googleUrl);
  });

  it('URL として解釈できない場合は正規表現でフォールバックする', () => {
    expect(extractOriginalUrl('google.com/url?url=https%3A%2F%2Fexample.com%2Fx&ct=ga')).toBe(
      'https://example.com/x'
    );
  });
});

describe('extractDomain', () => {
  it('ホスト名を返し、先頭の www. を除去する', () => {
    expect(extractDomain('https://www.nikkei.com/article/1')).toBe('nikkei.com');
    expect(extractDomain('https://jp.techcrunch.com/a')).toBe('jp.techcrunch.com');
  });

  it('空文字・不正な URL はフォールバック値を返す', () => {
    expect(extractDomain('')).toBe('Web');
    expect(extractDomain('not a url')).toBe('Web');
  });
});
