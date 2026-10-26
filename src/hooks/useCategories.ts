import { useCallback, useEffect, useState } from 'react';
import type { Category } from '../api/types';
import { MESSAGES } from '../config/messages';
import { fetchCategories } from '../services/apiClient';
import { getErrorMessage } from '../utils/errors';

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setCategories(await fetchCategories());
    } catch (err: unknown) {
      setError(getErrorMessage(err, MESSAGES.CATEGORIES_FETCH_FAILED));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { categories, isLoading, error, reload: load };
}
