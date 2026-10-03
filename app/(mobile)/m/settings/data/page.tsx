"use client";

/**
 * /m/settings/data — "Your data", built to F10 10f.
 *
 * Generated on request, like web (decided 2026-10-03): 10f's "You can close
 * this screen. It will be here when ready." is NOT used — nothing persists the
 * file, so it would be false. The real "Preparing" lasts the seconds the
 * request takes.
 *
 * SAVING THE FILE. In the native app a normal browser download does nothing
 * inside the WebView, and @capacitor/filesystem (which @capacitor/share would
 * need to share a file from memory) is not installed. So: where the WebView
 * supports sharing a File through the Web Share API, use that — on iOS that is
 * the system sheet with "Save to Files"; otherwise fall back to a normal
 * download, which works in mobile browsers. UNVERIFIED ON A DEVICE — the
 * native path cannot be exercised until the app runs on hardware.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, FileArchive } from "lucide-react";
import { useUser } from "@/app/context/UserContext";
import { type ExportFile, formatBytes, requestExport } from "@/lib/account-client";

const shell: React.CSSProperties = {
  minHeight: "100dvh",
  background: "var(--m-cream)",
  padding: "calc(env(safe-area-inset-top, 12px) + 10px) 20px calc(env(safe-area-inset-bottom, 0px) + 24px)",
  gap: 14,
};

type State = { kind: "idle" } | { kind: "preparing"; at: Date } | { kind: "ready"; file: ExportFile } | { kind: "error" };
const time = (d: Date) => d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

export default function MobileDataPage() {
  const router = useRouter();
  const { user, hydrated } = useUser();
  const [state, setState] = useState<State>({ kind: "idle" });
  const [saveNote, setSaveNote] = useState<string | null>(null);

  useEffect(() => {
    if (hydrated && !user) router.replace("/m/profile");
  }, [hydrated, user, router]);

  useEffect(() => {
    return () => {
      if (state.kind === "ready") URL.revokeObjectURL(state.file.url);
    };
  }, [state]);

  const start = async () => {
    setSaveNote(null);
    setState({ kind: "preparing", at: new Date() });
    try {
      setState({ kind: "ready", file: await requestExport() });
    } catch {
      setState({ kind: "error" });
    }
  };

  const save = async (file: ExportFile) => {
    setSaveNote(null);
    try {
      const blob = await (await fetch(file.url)).blob();
      const f = new File([blob], file.filename, { type: "application/zip" });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.canShare?.({ files: [f] })) {
        await nav.share({ files: [f], title: file.filename });
        return;
      }
    } catch (e) {
      // The user dismissing the share sheet is not an error worth showing.
      if (e instanceof DOMException && e.name === "AbortError") return;
    }
    const a = document.createElement("a");
    a.href = file.url;
    a.download = file.filename;
    a.click();
    setSaveNote("If nothing downloaded, request your export from meshi on the web instead.");
  };

  return (
    <div className="vstack" style={shell}>
      <div className="hstack">
        <button className="icon-btn" onClick={() => router.back()} aria-label="Back">
          <ArrowLeft width={20} height={20} />
        </button>
        <span className="t-h1 grow" style={{ marginLeft: 10 }}>Your data</span>
      </div>

      <div className="card vstack" style={{ padding: "18px 18px", gap: 12 }}>
        <div className="hstack" style={{ gap: 12 }}>
          <span className="icon-btn tint-green" style={{ boxShadow: "none", color: "var(--figure-accent)", flex: "none" }} aria-hidden>
            <Download width={20} height={20} />
          </span>
          <div className="vstack grow" style={{ gap: 1 }}>
            <span className="t-h2">Download your data</span>
            <span className="t-cap">One ZIP · JSON and CSV</span>
          </div>
        </div>
        <span className="t-cap">
          Saved recipes, meal logs, goals and preferences — what we hold for your account, plus what’s saved on this
          device. Access tokens and keys are never included.
        </span>

        {(state.kind === "idle" || state.kind === "error") && (
          <button type="button" className="pill-primary" onClick={() => void start()}>
            Request export
          </button>
        )}
        {state.kind === "error" && (
          <span className="t-cap" role="alert" style={{ color: "var(--text-red)" }}>
            Couldn’t prepare your export. Please try again.
          </span>
        )}
        {state.kind === "preparing" && (
          <div className="hstack" role="status" style={{ gap: 12, padding: "12px 14px", borderRadius: 14, background: "var(--m-cream-2)" }}>
            <span className="dlsp" aria-hidden />
            <div className="vstack grow" style={{ gap: 1 }}>
              <span className="t-h2">Preparing your export</span>
              <span className="t-cap">Requested {time(state.at)}. This takes a few seconds.</span>
            </div>
          </div>
        )}
      </div>

      {state.kind === "ready" && (
        <>
          <span className="t-micro">Ready</span>
          <div className="card vstack" style={{ padding: "18px 18px", gap: 12 }}>
            <div className="hstack" style={{ gap: 12 }}>
              <FileArchive width={22} height={22} style={{ color: "var(--figure-accent)", flex: "none" }} aria-hidden />
              <div className="vstack grow" style={{ gap: 1, minWidth: 0 }}>
                <span className="t-h2" style={{ overflowWrap: "anywhere" }}>{state.file.filename}</span>
                <span className="t-cap">
                  Prepared {time(state.file.preparedAt)} · {formatBytes(state.file.bytes)}
                </span>
              </div>
            </div>
            <button type="button" className="pill-primary" onClick={() => void save(state.file)}>
              <Download width={17} height={17} aria-hidden />
              Download
            </button>
            <button type="button" className="chip" style={{ alignSelf: "center" }} onClick={() => void start()}>
              Request a new one
            </button>
            {saveNote && <span className="t-cap">{saveNote}</span>}
          </div>
        </>
      )}
    </div>
  );
}
