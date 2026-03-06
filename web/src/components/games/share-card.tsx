"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Copy, ExternalLink } from "lucide-react";

interface ShareCardProps {
  slug: string;
}

export function ShareCard({ slug }: ShareCardProps) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined"
    ? `${window.location.origin}/play/${slug}`
    : `/play/${slug}`;

  function handleCopy() {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <p className="text-sm font-medium">Share this link</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-xs bg-muted px-2 py-1.5 rounded truncate">
          {url}
        </code>
        <Button variant="outline" size="icon" className="size-8 shrink-0" onClick={handleCopy}>
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </Button>
        <Button variant="outline" size="icon" className="size-8 shrink-0" asChild>
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="size-3.5" />
          </a>
        </Button>
      </div>
    </div>
  );
}
