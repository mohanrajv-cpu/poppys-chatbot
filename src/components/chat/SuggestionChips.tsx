'use client';

import { SuggestionChip } from '@/types';

export default function SuggestionChips({
  chips,
  onSelect,
}: {
  chips: SuggestionChip[];
  onSelect: (action: string) => void;
}) {
  if (!chips.length) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {chips.map((chip) => (
        <button
          key={chip.action}
          onClick={() => onSelect(chip.action)}
          className="px-4 py-2 bg-[#b8dfff]/30 text-[#155387] text-sm rounded-full border border-[#3ba6ff]/30 hover:bg-[#b8dfff]/60 hover:shadow-sm transition-all duration-150"
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}
