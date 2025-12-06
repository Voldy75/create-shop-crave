"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

interface Location {
  lat: number;
  lng: number;
}

interface UserContextType {
  userName: string;
  setUserName: (name: string) => void;
  location: Location | null;
  setLocation: (location: Location | null) => void;
  isLoadingLocation: boolean;
  locationError: string | null;
  requestLocation: () => Promise<boolean>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [userName, setUserName] = useState("");
  const [location, setLocation] = useState<Location | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const requestLocation = async (): Promise<boolean> => {
    setIsLoadingLocation(true);
    setLocationError(null); // Reset error before new request
    return new Promise<boolean>((resolve, reject) => {
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            });
            setIsLoadingLocation(false);
            resolve(true);
          },
          (error) => {
            console.error("Error getting location:", error);
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
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          }
        );
      } else {
        const msg = "Geolocation is not supported by this browser.";
        console.error(msg);
        setLocationError(msg);
        setIsLoadingLocation(false);
        resolve(false);
      }
    });
  };

  return (
    <UserContext.Provider
      value={{
        userName,
        setUserName,
        location,
        setLocation,
        isLoadingLocation,
        locationError,
        requestLocation,
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
