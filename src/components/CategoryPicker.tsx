import React, { useState } from 'react';
import { Check } from 'lucide-react';
import type { Category } from '../api/types';
import { LIMITS } from '../config/constants';
import { MESSAGES } from '../config/messages';
import { toggleCategory } from '../utils/categoryQuery';

interface CategoryPickerProps {
  categories: Category[];
  selectedIds: string[];
  isLoading: boolean;
  onChange: (ids: string[]) => void;
}

export const CategoryPicker: React.FC<CategoryPickerProps> = ({ categories, selectedIds, isLoading, onChange }) => {
  const [limitReached, setLimitReached] = useState(false);

  const handleToggle = (categoryId: string) => {
    const next = toggleCategory(selectedIds, categoryId, LIMITS.MAX_CATEGORIES);
    setLimitReached(next === null);
    if (next) onChange(next);
  };

  return (
    <section className="px-4 pt-4">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-xs font-semibold text-zinc-300">{MESSAGES.CATEGORY_PICKER_TITLE}</h2>
        <span className={`text-[11px] ${limitReached ? 'text-amber-400' : 'text-zinc-500'}`}>
          {limitReached
            ? MESSAGES.CATEGORY_LIMIT_REACHED(LIMITS.MAX_CATEGORIES)
            : MESSAGES.CATEGORY_PICKER_HINT(LIMITS.MAX_CATEGORIES)}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {isLoading && categories.length === 0
          ? Array.from({ length: 6 }, (_, i) => <div key={i} className="h-8 w-20 rounded-full bg-zinc-900 animate-pulse" />)
          : categories.map((category) => {
              const isSelected = selectedIds.includes(category.id);
              return (
                <button
                  key={category.id}
                  type="button"
                  aria-pressed={isSelected}
                  title={category.description ?? undefined}
                  onClick={() => handleToggle(category.id)}
                  className={`h-8 px-3 rounded-full text-xs font-medium border flex items-center gap-1 transition-colors ${
                    isSelected
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:border-zinc-500'
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3" />}
                  {category.nameJa}
                </button>
              );
            })}
      </div>
    </section>
  );
};
