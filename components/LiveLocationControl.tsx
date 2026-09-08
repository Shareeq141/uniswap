"use client";

import { useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Navigation } from "lucide-react";

export type LiveLocation = {
  latitude: number;
  longitude: number;
};

type LocationStatus = "idle" | "loading" | "denied" | "unsupported";

type Props = {
  value: LiveLocation | null;
  onChange: (location: LiveLocation | null) => void;
  compact?: boolean;
};

export default function LiveLocationControl({ value, onChange, compact = false }: Props) {
  const [status, setStatus] = useState<LocationStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  function requestLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      onChange(null);
      setStatus("unsupported");
      setError("Live location is not supported by this browser.");
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setStatus("loading");
    setError(null);

    try {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (requestId !== requestIdRef.current) return;

          const latitude = position.coords.latitude;
          const longitude = position.coords.longitude;
          if (
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude) ||
            latitude < -90 ||
            latitude > 90 ||
            longitude < -180 ||
            longitude > 180
          ) {
            onChange(null);
            setStatus("idle");
            setError("Your browser returned an invalid location. Please try again.");
            return;
          }

          onChange({ latitude, longitude });
          setStatus("idle");
        },
        (locationError) => {
          if (requestId !== requestIdRef.current) return;

          onChange(null);
          if (locationError.code === locationError.PERMISSION_DENIED) {
            setStatus("denied");
            setError("Location permission was denied. You can continue using UniSwap without nearby filtering.");
          } else if (locationError.code === locationError.TIMEOUT) {
            setStatus("idle");
            setError("Getting your location took too long. Please try again or continue without nearby filtering.");
          } else {
            setStatus("idle");
            setError("Your current location is unavailable. Please try again or continue without nearby filtering.");
          }
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
      );
    } catch {
      if (requestId !== requestIdRef.current) return;
      onChange(null);
      setStatus("unsupported");
      setError("Live location could not be started in this browser. You can continue using UniSwap normally.");
    }
  }

  function disableLocation() {
    requestIdRef.current += 1;
    onChange(null);
    setStatus("idle");
    setError(null);
  }

  const statusMessage = value
    ? "Live Location Enabled"
    : status === "unsupported"
    ? "Live location is unavailable"
    : status === "denied"
    ? "Live location permission denied"
    : null;

  return (
    <div className={compact ? "space-y-2" : "rounded-2xl border border-teal-200 bg-teal-50 p-4 space-y-2"}>
      <button
        type="button"
        onClick={requestLocation}
        disabled={status === "loading"}
        aria-busy={status === "loading"}
        aria-pressed={Boolean(value)}
        className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60 ${
          value
            ? "border-teal-200 bg-teal-100 text-teal-800"
            : "border-teal-500 bg-teal-500 text-white hover:bg-teal-600"
        }`}
      >
        {status === "loading" ? (
          <Loader2 size={16} className="animate-spin" />
        ) : value ? (
          <CheckCircle2 size={16} />
        ) : (
          <Navigation size={16} />
        )}
        <span>{value ? "Refresh Live Location" : "Turn On Live Location"}</span>
      </button>

      <div aria-live="polite">
        {statusMessage && (
          <p className={`flex items-start gap-1.5 text-xs ${value ? "text-teal-800" : "text-amber-700"}`}>
            {value ? <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> : <AlertCircle size={14} className="mt-0.5 shrink-0" />}
            <span>{statusMessage}</span>
          </p>
        )}

        {error && <p className="text-xs leading-5 text-slate-600">{error}</p>}
      </div>

      {value && (
        <div className="space-y-1.5">
          <p className="text-xs text-teal-800">
            Nearby results use this one-time browser location within 1.5 km. Your location is not continuously tracked.
          </p>
          <button type="button" onClick={disableLocation} className="text-xs font-semibold text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline">
            Turn Off Live Location
          </button>
        </div>
      )}
    </div>
  );
}
