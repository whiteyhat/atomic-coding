"use client";

import { Sparkles } from "lucide-react";

interface SuggestedPromptsProps {
  prompts: string[];
  onSelect: (prompt: string) => void;
}

export function SuggestedPrompts({ prompts, onSelect }: SuggestedPromptsProps) {
  if (prompts.length === 0) return null;

  return (
    <div className="px-3 py-3 space-y-2">
      <p className="text-xs text-white/40 flex items-center gap-1.5">
        <Sparkles className="size-3 text-rose-400" />
        Suggested next steps
      </p>
      <div className="flex flex-col gap-1.5">
        {prompts.map((prompt, i) => (
          <button
            key={i}
            onClick={() => onSelect(prompt)}
            className="text-left text-sm px-3 py-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-white/12 text-white/70 transition-colors"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
