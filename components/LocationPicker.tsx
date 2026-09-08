"use client";

import { MapPin } from "lucide-react";
import LiveLocationControl, { LiveLocation } from "./LiveLocationControl";

export type LocationData = LiveLocation;

type Props = {
  value: LocationData | null;
  onChange: (location: LocationData | null) => void;
};

export default function LocationPicker({ value, onChange }: Props) {
  return (
    <div className="w-full space-y-3">
      <div>
        <label className="block text-sm font-semibold text-slate-900">Exchange Location</label>
        <p className="mt-0.5 text-xs text-slate-500">Optional browser location for 1.5 km nearby matching. It is requested only when you click the button.</p>
      </div>
      <LiveLocationControl
        value={value}
        onChange={onChange}
      />
      {value && (
        <p className="flex items-center gap-1.5 text-xs text-slate-500">
          <MapPin size={14} className="text-teal-600" />
          Coordinates saved: {value.latitude.toFixed(4)}, {value.longitude.toFixed(4)}
        </p>
      )}
    </div>
  );
}
