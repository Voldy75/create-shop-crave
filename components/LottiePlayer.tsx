"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";

const DotLottieReact = dynamic(
  () => import("@lottiefiles/dotlottie-react").then((m) => m.DotLottieReact),
  { ssr: false }
);

interface LottiePlayerProps {
  // Paste the src URL from your LottieFiles embed code here
  src: string;
  width?: number | string;
  height?: number | string;
  loop?: boolean;
  autoplay?: boolean;
  className?: string;
}

export function LottiePlayer({
  src,
  width = 240,
  height = 240,
  loop = true,
  autoplay = true,
  className,
}: LottiePlayerProps) {
  return (
    <div
      className={className}
      style={{ width, height, display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <DotLottieReact
        src={src}
        loop={loop}
        autoplay={autoplay}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
