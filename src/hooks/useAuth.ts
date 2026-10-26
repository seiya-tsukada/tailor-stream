import { useCallback, useEffect, useRef, useState } from 'react';
import type { Me } from '../api/types';
import { fetchMe, logout as logoutApi } from '../services/apiClient';

export type AuthStatus = 'loading' | 'ready';

/**
 * ログイン状態（ログインは任意。未ログインなら user は null）
 * 起動時の /api/me とログイン完了（verify）が競合しても、後から確定した方を優先する
 */
export function useAuth() {
  const [user, setUserState] = useState<Me | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const seq = useRef(0);

  const refresh = useCallback(async () => {
    const current = ++seq.current;
    let next: Me | null = null;
    try {
      next = await fetchMe();
    } catch {
      // サーバーに届かない場合も未ログインとして使えるようにする
    }
    if (current !== seq.current) return;
    setUserState(next);
    setStatus('ready');
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** ログイン完了時など、ユーザーが確定したときに呼ぶ（進行中の /api/me の結果は捨てる） */
  const setUser = useCallback((next: Me | null) => {
    seq.current += 1;
    setUserState(next);
    setStatus('ready');
  }, []);

  const logout = useCallback(async () => {
    await logoutApi();
    setUser(null);
  }, [setUser]);

  return { user, status, setUser, refresh, logout };
}
