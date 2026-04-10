"use client";

import { Share2 } from "lucide-react";
import { toast } from "sonner";

interface ShareButtonProps {
  title: string;
  text: string;
}

export function ShareButton({ title, text }: ShareButtonProps) {
  const handleShare = async () => {
    const shareData = {
      title: `Crave & Create: ${title}`,
      text,
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          fallbackCopy(`${shareData.title}\n${shareData.text}\n${shareData.url}`);
        }
      }
    } else {
      fallbackCopy(`${shareData.title}\n${shareData.text}\n${shareData.url}`);
    }
  };

  const fallbackCopy = (content: string) => {
    navigator.clipboard.writeText(content).then(
      () => toast("Link copied!"),
      () => toast("Could not copy. Try sharing manually.")
    );
  };

  return (
    <button
      onClick={handleShare}
      className="p-1.5 rounded-full transition-colors"
      style={{ color: "var(--cc-text-tertiary)", background: "var(--cc-surface-2)" }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--cc-surface-3)")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--cc-surface-2)")}
      aria-label="Share"
    >
      <Share2 className="w-4 h-4" />
    </button>
  );
}
