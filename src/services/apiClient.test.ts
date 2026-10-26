import { describe, expect, it } from 'vitest';
import { parseErrorBody } from './apiClient';

describe('parseErrorBody', () => {
  it('エラー本文からコードとメッセージを取り出す', () => {
    expect(parseErrorBody({ error: { code: 'TOO_MANY_CATEGORIES', message: '最大3つ' } })).toEqual({
      code: 'TOO_MANY_CATEGORIES',
      message: '最大3つ',
    });
  });

  it('形式が違えば null', () => {
    expect(parseErrorBody(null)).toBeNull();
    expect(parseErrorBody({ detail: 'x' })).toBeNull();
    expect(parseErrorBody({ error: { code: 1, message: 'x' } })).toBeNull();
  });
});
