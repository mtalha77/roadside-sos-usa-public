"use client";

import { BigToggle } from "@rsos/ui/big-toggle";
import { inputClass } from "@rsos/ui/input";
import { useState, useSyncExternalStore } from "react";

const KEY = "rsos_online";
const read = () => localStorage.getItem(KEY) === "1";
const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  window.addEventListener("rsos:online", cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener("rsos:online", cb);
  };
};

/** Go online toggle and truck or operator choice (RSOS-053; kept on this device in demo mode). */
export function OnlinePanel({
  labels,
  trucks,
}: {
  labels: {
    online: string;
    offline: string;
    onlineHint: string;
    offlineHint: string;
    truck: string;
  };
  trucks: string[];
}) {
  const online = useSyncExternalStore(subscribe, read, () => false);
  const [truck, setTruck] = useState(trucks[0] ?? "");
  const set = (v: boolean) => {
    localStorage.setItem(KEY, v ? "1" : "0");
    window.dispatchEvent(new Event("rsos:online"));
  };
  return (
    <div className="flex flex-col gap-3">
      <BigToggle
        online={online}
        onChange={set}
        onLabel={labels.online}
        offLabel={labels.offline}
        onHint={labels.onlineHint}
        offHint={labels.offlineHint}
      />
      <label className="flex flex-col gap-2 text-sm font-medium">
        {labels.truck}
        <select value={truck} onChange={(e) => setTruck(e.target.value)} className={inputClass}>
          {trucks.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
