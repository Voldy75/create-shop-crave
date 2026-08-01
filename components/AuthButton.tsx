"use client";

import React from "react";
import { createClient } from "@/lib/supabase/client";
import { signInWithProvider } from "@/lib/native-auth";
import { Github } from "lucide-react";

function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function AuthButton() {
  const supabase = createClient();

  // Routes through lib/native-auth so the native shell opens the consent
  // screen in the system browser. Google returns `disallowed_useragent` for an
  // embedded WebView, so calling signInWithOAuth directly here would be a dead
  // end on iOS and Android. On web this is unchanged.
  const signInWithGoogle = async () => {
    await signInWithProvider(supabase, "google");
  };

  const signInWithGitHub = async () => {
    await signInWithProvider(supabase, "github");
  };

  const btnStyle: React.CSSProperties = {
    width: "100%",
    height: "48px",
    color: "var(--cc-text-primary, #f5f5f5)",
    border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: "999px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    fontSize: "15px",
    fontWeight: 500,
    cursor: "pointer",
    transition: "background 0.15s ease",
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      <button
        onClick={signInWithGoogle}
        style={btnStyle}
        className="bg-[var(--cc-surface-2,#232323)] hover:bg-[#2c2c2c]"
      >
        <GoogleIcon />
        Continue with Google
      </button>
      <button
        onClick={signInWithGitHub}
        style={btnStyle}
        className="bg-[var(--cc-surface-2,#232323)] hover:bg-[#2c2c2c]"
      >
        <Github className="w-5 h-5" />
        Continue with GitHub
      </button>
    </div>
  );
}
