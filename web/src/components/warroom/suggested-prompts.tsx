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
      <p className="text-xs text-zinc-500 flex items-center gap-1.5">
        <Sparkles className="size-3" />
        Suggested next steps
      </p>
      <div className="flex flex-col gap-1.5">
        {prompts.map((prompt, i) => (
          <button
            key={i}
            onClick={() => onSelect(prompt)}
            className="text-left text-sm px-3 py-2 rounded-md bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 transition-colors"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
