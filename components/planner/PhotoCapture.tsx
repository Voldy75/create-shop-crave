"use client";

import React, { useRef, useState } from "react";
import { Camera, Upload, X, Loader2 } from "lucide-react";

interface Props {
  imageDataUrl: string | null;
  onChange: (dataUrl: string | null) => void;
  disabled?: boolean;
}

const MAX_EDGE = 1024;

async function downscaleToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available");
  ctx.drawImage(bitmap, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.82);
}

export function PhotoCapture({ imageDataUrl, onChange, disabled }: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleFiles = async (files: FileList | null) => {
    setErr(null);
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith("image/")) {
      setErr("That doesn't look like an image.");
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await downscaleToDataUrl(file);
      onChange(dataUrl);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't read that image.");
    } finally {
      setBusy(false);
    }
  };

  if (imageDataUrl) {
    return (
      <div className="relative inline-block w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageDataUrl}
          alt="Meal preview"
          style={{
            width: "100%",
            maxHeight: "240px",
            objectFit: "cover",
            borderRadius: "12px",
            border: "1px solid var(--m-ink-faint)",
          }}
        />
        <button
          onClick={() => onChange(null)}
          disabled={disabled}
          className="absolute top-2 right-2 p-1.5 rounded-full"
          style={{
            background: "color-mix(in srgb, var(--m-forest-2) 55%, transparent)",
            color: "var(--m-on-deep)",
            backdropFilter: "blur(8px)",
          }}
          aria-label="Remove photo"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => cameraRef.current?.click()}
          disabled={disabled || busy}
          className="flex flex-col items-center gap-1.5 py-5 transition-colors"
          style={{
            background: "var(--m-cream-2)",
            border: "1px dashed var(--m-ink-faint)",
            borderRadius: "12px",
            color: "var(--m-ink-soft)",
            opacity: disabled || busy ? 0.5 : 1,
            cursor: disabled || busy ? "not-allowed" : "pointer",
          }}
        >
          {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
          <span style={{ fontSize: "12px", fontWeight: 600 }}>Take photo</span>
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={disabled || busy}
          className="flex flex-col items-center gap-1.5 py-5 transition-colors"
          style={{
            background: "var(--m-cream-2)",
            border: "1px dashed var(--m-ink-faint)",
            borderRadius: "12px",
            color: "var(--m-ink-soft)",
            opacity: disabled || busy ? 0.5 : 1,
            cursor: disabled || busy ? "not-allowed" : "pointer",
          }}
        >
          {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
          <span style={{ fontSize: "12px", fontWeight: 600 }}>Upload</span>
        </button>
      </div>
      {err && (
        <p className="t-cap" style={{ color: "var(--m-red)" }}>{err}</p>
      )}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
