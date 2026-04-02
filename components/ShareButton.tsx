"use client";

import { Share2 } from "lucide-react";

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
        // User cancelled or error
        if ((err as Error).name !== "AbortError") {
          fallbackCopy(shareData.text);
        }
      }
    } else {
      fallbackCopy(`${shareData.title}\n${shareData.text}\n${shareData.url}`);
    }
  };

  const fallbackCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => alert("Copied to clipboard!"),
      () => alert("Could not copy. Try sharing manually.")
    );
  };

  return (
    <button
      onClick={handleShare}
      className="p-1.5 rounded-full text-gray-400 bg-gray-50 hover:bg-gray-100 hover:text-gray-600 transition-colors"
      aria-label="Share"
    >
      <Share2 className="w-4 h-4" />
    </button>
  );
}
