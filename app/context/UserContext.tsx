"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

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

  // Hydrate from Supabase session + localStorage
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    // Migrate dietary prefs from localStorage (preserved from old flow)
    setDietaryPreferencesState(getStoredValue("crave_dietaryPreferences", []));
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
