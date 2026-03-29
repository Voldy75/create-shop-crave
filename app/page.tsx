"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useUser } from "./context/UserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapPin, ArrowRight, Loader2 } from "lucide-react";

export default function LandingPage() {
  const { userName, setUserName, requestLocation, location, isLoadingLocation, locationError } = useUser();
  const router = useRouter();
  const [error, setError] = useState("");

  const handleStart = async () => {
    if (!userName.trim()) {
      setError("Please enter your name to continue.");
      return;
    }

    // Request location if not already present
    if (!location) {
      const success = await requestLocation();
      if (!success) {
        // Do not navigate if location failed. Error is shown in UI.
        return;
      }
    }

    // Navigate to chat
    router.push("/chat");
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-white p-4 relative overflow-hidden" role="main">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
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
            Discover recipes or find the perfect spot to dine.
          </p>
        </div>

        <div className="bg-white p-2 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-gray-100 max-w-md mx-auto">
          <div className="space-y-4 p-4">
            <div className="space-y-2 text-left">
              <label htmlFor="name" className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">
                What should we call you?
              </label>
              <Input
                id="name"
                placeholder="Enter your name"
                value={userName}
                onChange={(e) => {
                  setUserName(e.target.value);
                  setError("");
                }}
                className="border-0 bg-gray-50 text-lg py-6 px-4 rounded-xl focus-visible:ring-0 focus-visible:bg-gray-100 transition-all"
              />
              {error && <p className="text-sm text-red-500 ml-1">{error}</p>}
            </div>

            <div className={`flex flex-col gap-2 text-sm p-3 rounded-xl ${locationError ? "bg-red-50 text-red-600" : "bg-gray-50 text-gray-500"}`}>
              <div className="flex items-center gap-2">
                <MapPin className={`w-4 h-4 ${locationError ? "text-red-500" : "text-indigo-500"}`} />
                <span className="font-medium">
                  {location
                    ? "Location captured"
                    : locationError
                      ? "Location failed"
                      : "Locating you..."}
                </span>
              </div>
              {locationError && (
                <p className="text-xs ml-6">
                  {locationError}
                </p>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-lg h-14 rounded-xl shadow-lg shadow-indigo-200 transition-all duration-300 hover:scale-[1.02]"
                onClick={handleStart}
                disabled={isLoadingLocation}
              >
                {isLoadingLocation ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Wait...
                  </>
                ) : (
                  <>
                    Get Started <ArrowRight className="ml-2 h-5 w-5" />
                  </>
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
          </div>
        </div>
      </motion.div>
    </main>
  );
}
