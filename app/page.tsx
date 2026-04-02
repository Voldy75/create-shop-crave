"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useUser } from "./context/UserContext";
import { AuthButton } from "@/components/AuthButton";
import { MapPin, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const DIETARY_OPTIONS = [
  "Vegetarian",
  "Vegan",
  "Gluten-Free",
  "Dairy-Free",
  "Nut-Free",
  "Halal",
  "Keto",
];

export default function LandingPage() {
  const {
    user,
    hydrated,
    requestLocation,
    location,
    isLoadingLocation,
    locationError,
    dietaryPreferences,
    setDietaryPreferences,
  } = useUser();
  const router = useRouter();

  // If already signed in and location is captured, go to chat
  useEffect(() => {
    if (hydrated && user && location) {
      router.replace("/chat");
    }
  }, [hydrated, user, location, router]);

  const toggleDietaryPref = (pref: string) => {
    if (dietaryPreferences.includes(pref)) {
      setDietaryPreferences(dietaryPreferences.filter((p) => p !== pref));
    } else {
      setDietaryPreferences([...dietaryPreferences, pref]);
    }
  };

  const handleGetStarted = async () => {
    if (!location) {
      const success = await requestLocation();
      if (!success) return;
    }
    router.push("/chat");
  };

  // Show loading while hydrating
  if (!hydrated) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-white p-4 relative overflow-hidden" role="main">
      {/* Decorative Background */}
      <div className="absolute inset-0 overflow-hidden -z-10">
        <div className="absolute -top-[20%] -right-[10%] w-[600px] h-[600px] bg-indigo-50 rounded-full blur-3xl opacity-50" />
        <div className="absolute top-[40%] -left-[10%] w-[500px] h-[500px] bg-pink-50 rounded-full blur-3xl opacity-50" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-2xl text-center space-y-8"
      >
        <div className="space-y-4">
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-gray-900">
            Crave & <span className="text-indigo-600">Create</span>
          </h1>
          <p className="text-xl text-gray-500 max-w-lg mx-auto leading-relaxed">
            Your personal AI food companion. <br />
            Discover recipes, order ingredients, find restaurants, or book a ride.
          </p>
        </div>

        <div className="bg-white p-2 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-gray-100 max-w-md mx-auto">
          <div className="space-y-4 p-4">
            {!user ? (
              /* Not signed in — show OAuth buttons */
              <>
                <div className="space-y-1 text-left">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">
                    Sign in to get started
                  </p>
                  <p className="text-xs text-gray-400 ml-1">
                    2 free AI requests per day. Bring your own key for unlimited use.
                  </p>
                </div>
                <AuthButton />
              </>
            ) : (
              /* Signed in — show location + dietary prefs + enter button */
              <>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {(user.user_metadata?.full_name || user.email || "U")[0].toUpperCase()}
                  </div>
                  <div className="text-left min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {user.user_metadata?.full_name || user.email}
                    </p>
                    <p className="text-xs text-gray-400">Signed in</p>
                  </div>
                </div>

                {/* Dietary Preferences */}
                <div className="space-y-2 text-left">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">
                    Dietary Preferences{" "}
                    <span className="font-normal text-gray-400">(optional)</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {DIETARY_OPTIONS.map((pref) => {
                      const isSelected = dietaryPreferences.includes(pref);
                      return (
                        <button
                          key={pref}
                          type="button"
                          onClick={() => toggleDietaryPref(pref)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                            isSelected
                              ? "bg-indigo-600 text-white shadow-sm"
                              : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                          }`}
                        >
                          {pref}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Location status */}
                <div
                  className={`flex flex-col gap-2 text-sm p-3 rounded-xl ${
                    locationError ? "bg-red-50 text-red-600" : "bg-gray-50 text-gray-500"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <MapPin
                      className={`w-4 h-4 ${locationError ? "text-red-500" : "text-indigo-500"}`}
                    />
                    <span className="font-medium">
                      {location
                        ? "Location captured"
                        : locationError
                        ? "Location failed"
                        : "Location needed for restaurant suggestions"}
                    </span>
                  </div>
                  {locationError && (
                    <p className="text-xs ml-6">{locationError}</p>
                  )}
                </div>

                {/* Auth error from callback */}
                {typeof window !== "undefined" &&
                  new URLSearchParams(window.location.search).get("error") && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl text-sm text-red-600">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>Sign-in failed. Please try again.</span>
                    </div>
                  )}

                <div className="flex gap-2 pt-2">
                  <Button
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-lg h-14 rounded-xl shadow-lg shadow-indigo-200 transition-all duration-300 hover:scale-[1.02]"
                    onClick={handleGetStarted}
                    disabled={isLoadingLocation}
                  >
                    {isLoadingLocation ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Wait...
                      </>
                    ) : (
                      "Start Craving →"
                    )}
                  </Button>
                  {locationError && (
                    <Button
                      variant="ghost"
                      className="h-14 px-6 text-gray-500 hover:text-gray-900 rounded-xl"
                      onClick={() => router.push("/chat")}
                    >
                      Skip
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </main>
  );
}
