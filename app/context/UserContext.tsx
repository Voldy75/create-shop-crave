"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { nativePlatform } from "@/lib/native-bridge";
import {
  mergeLogs,
  pullMealLogs,
  pullNutritionGoals,
  pushLocalState,
} from "@/lib/meal-sync";
import {
  getMealLogs,
  getNutritionGoals,
  saveNutritionGoals,
} from "@/lib/storage";

const MEAL_LOGS_KEY = "crave_mealLogs";
export const TRACKER_SYNC_EVENT = "crave:tracker-synced";

interface Location {
  lat: number;
  lng: number;
}

interface UserContextType {
  // Auth
  user: User | null;
  session: Session | null;
  userName: string;
  hydrated: boolean;
  signOut: () => Promise<void>;
  // Location
  location: Location | null;
  setLocation: (location: Location | null) => void;
  isLoadingLocation: boolean;
  locationError: string | null;
  requestLocation: () => Promise<boolean>;
  // Preferences
  dietaryPreferences: string[];
  setDietaryPreferences: (prefs: string[]) => void;
  favoriteCuisines: string[];
  setFavoriteCuisines: (cuisines: string[]) => void;
  // True while a just-signed-in session's meal logs/goals are being pulled
  // from Supabase and merged with local state. Onboarding's post-sign-in
  // hand-off loader (`/m?welcome=1`) gates on this so it reflects real work
  // in flight, not a fixed timer.
  syncing: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

function getStoredValue<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const supabase = createClient();

  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [location, setLocation] = useState<Location | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [dietaryPreferences, setDietaryPreferencesState] = useState<string[]>([]);
  const [favoriteCuisines, setFavoriteCuisinesState] = useState<string[]>([]);
  const [syncing, setSyncing] = useState(false);

  // Hydrate from Supabase session + localStorage
  useEffect(() => {
    let lastSyncedUserId: string | null = null;

    const syncTracker = async (userId: string) => {
      if (lastSyncedUserId === userId) return; // already synced this session
      lastSyncedUserId = userId;
      setSyncing(true);
      try {
        const [remoteLogs, remoteGoals] = await Promise.all([
          pullMealLogs(userId),
          pullNutritionGoals(userId),
        ]);
        const localLogs = getMealLogs();
        const localGoals = getNutritionGoals();
        const merged = mergeLogs(localLogs, remoteLogs);
        if (typeof window !== "undefined") {
          localStorage.setItem(MEAL_LOGS_KEY, JSON.stringify(merged));
        }
        // Server goals win if present; otherwise push local up (first sign-in).
        if (remoteGoals) {
          saveNutritionGoals(remoteGoals);
        }
        // Backfill: any local rows not on server get pushed. mergeLogs preserves them.
        const remoteIds = new Set(remoteLogs.map((l) => l.id));
        const localOnly = merged.filter((l) => !remoteIds.has(l.id));
        if (localOnly.length > 0 || (!remoteGoals && localGoals)) {
          pushLocalState(userId, localOnly, !remoteGoals ? localGoals : null).catch(() => {});
        }
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent(TRACKER_SYNC_EVENT));
        }
      } catch (e) {
        // Sync is best-effort; never block the UI.
        console.error("Tracker sync failed:", e instanceof Error ? e.message : e);
      } finally {
        setSyncing(false);
      }
    };

    // Records web vs ios vs android against the user's profile so the admin
    // console can answer "which platform is this user on". Fire-and-forget:
    // a failure must never affect sign-in.
    const pingPlatform = () => {
      void fetch("/api/session/ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: nativePlatform() }),
      }).catch(() => {});
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        syncTracker(session.user.id);
        pingPlatform();
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      // Sync on actual sign-in only — not on every token refresh.
      if (event === "SIGNED_IN" && session?.user) {
        syncTracker(session.user.id);
        pingPlatform();
      }
      if (event === "SIGNED_OUT") {
        lastSyncedUserId = null;
      }
    });

    // Migrate dietary prefs from localStorage (preserved from old flow)
    setDietaryPreferencesState(getStoredValue("crave_dietaryPreferences", []));
    setFavoriteCuisinesState(getStoredValue("crave_favoriteCuisines", []));
    // Clean up the old userName key since it's now from OAuth profile
    if (typeof window !== "undefined") {
      localStorage.removeItem("crave_userName");
    }

    setHydrated(true);

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = async () => {
    // Clear BYOK keys on sign out
    if (typeof window !== "undefined") {
      localStorage.removeItem("crave_byok_provider");
      localStorage.removeItem("crave_byok_key");
    }
    await supabase.auth.signOut();
  };

  const setDietaryPreferences = (prefs: string[]) => {
    setDietaryPreferencesState(prefs);
    if (typeof window !== "undefined") {
      localStorage.setItem("crave_dietaryPreferences", JSON.stringify(prefs));
    }
  };

  const setFavoriteCuisines = (cuisines: string[]) => {
    setFavoriteCuisinesState(cuisines);
    if (typeof window !== "undefined") {
      localStorage.setItem("crave_favoriteCuisines", JSON.stringify(cuisines));
    }
  };

  const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "";

  const requestLocation = async (): Promise<boolean> => {
    setIsLoadingLocation(true);
    setLocationError(null);
    return new Promise<boolean>((resolve) => {
      if (!("geolocation" in navigator)) {
        const msg = "Geolocation is not supported by this browser.";
        setLocationError(msg);
        setIsLoadingLocation(false);
        resolve(false);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
          setIsLoadingLocation(false);
          resolve(true);
        },
        (error) => {
          let errorMessage = "Failed to get location.";
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = "Location permission denied. Please enable it in your browser settings.";
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = "Location information is unavailable.";
              break;
            case error.TIMEOUT:
              errorMessage = "The request to get user location timed out.";
              break;
          }
          setLocationError(errorMessage);
          setIsLoadingLocation(false);
          resolve(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  };

  return (
    <UserContext.Provider
      value={{
        user,
        session,
        userName,
        hydrated,
        signOut,
        location,
        setLocation,
        isLoadingLocation,
        locationError,
        requestLocation,
        dietaryPreferences,
        setDietaryPreferences,
        favoriteCuisines,
        setFavoriteCuisines,
        syncing,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
};
