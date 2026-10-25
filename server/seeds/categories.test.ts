import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { type CategoryRow, toRow } from '../../shared/domain';
import { SEED_CATEGORIES } from './categories';

const SEED_SQL_PATH = path.resolve(__dirname, '../../supabase/seed.sql');
const SQL_VALUE = /'((?:[^']|'')*)'|\b(true|false|null)\b|(-?\d+)/g;

/** seed.sql の categories の values 行（"  ('ai', ...)," 形式）を行オブジェクトに変換する */
function parseSeedSql(sql: string): CategoryRow[] {
  return sql
    .split('\n')
    .filter((line) => /^\s*\('/.test(line))
    .map((line) => {
      const values = [...line.matchAll(SQL_VALUE)].map(([, text, literal, num]) => {
        if (text !== undefined) return text.replace(/''/g, "'");
        if (literal !== undefined) return literal === 'null' ? null : literal === 'true';
        return Number(num);
      });
      const [id, name_ja, name_en, description, sort_order, is_active] = values;
      return { id, name_ja, name_en, description, sort_order, is_active } as CategoryRow;
    });
}

describe('SEED_CATEGORIES', () => {
  const sqlRows = parseSeedSql(readFileSync(SEED_SQL_PATH, 'utf8'));

  it('supabase/seed.sql とカテゴリ ID が一致する', () => {
    expect(sqlRows.map((row) => row.id)).toEqual(SEED_CATEGORIES.map((category) => category.id));
  });

  it('supabase/seed.sql と全列の内容が一致する', () => {
    expect(sqlRows).toEqual(SEED_CATEGORIES.map((category) => toRow(category)));
  });

  it('ID は slug 形式で重複しない', () => {
    const ids = SEED_CATEGORIES.map((category) => category.id);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id) => expect(id).toMatch(/^[a-z0-9-]+$/));
  });
});
