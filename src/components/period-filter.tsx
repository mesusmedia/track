"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

const OPTIONS = [
  { value: "7", label: "7 dias" },
  { value: "30", label: "30 dias" },
  { value: "90", label: "90 dias" },
  { value: "365", label: "1 ano" },
];

export function PeriodFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("period") ?? "30";
  const isCustom = !OPTIONS.some((opt) => opt.value === current);
  const [showCustom, setShowCustom] = useState(isCustom);

  function goToPeriod(days: number) {
    router.push(`${pathname}?period=${days}`);
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={showCustom ? "custom" : current}
        onChange={(e) => {
          if (e.target.value === "custom") {
            setShowCustom(true);
            return;
          }
          setShowCustom(false);
          goToPeriod(Number(e.target.value));
        }}
        className="bg-accent border rounded-lg py-1.5 px-2.5 text-xs text-muted-foreground focus:outline-none focus:border-primary transition-colors"
      >
        {OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            últimos {opt.label}
          </option>
        ))}
        <option value="custom">personalizado</option>
      </select>
      {showCustom && (
        <input
          type="date"
          aria-label="Buscar a partir de"
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => {
            if (!e.target.value) return;
            const days = Math.max(
              1,
              Math.ceil((Date.now() - new Date(e.target.value).getTime()) / (24 * 60 * 60 * 1000)),
            );
            goToPeriod(days);
          }}
          className="bg-accent border rounded-lg py-1.5 px-2.5 text-xs text-muted-foreground focus:outline-none focus:border-primary transition-colors"
        />
      )}
    </div>
  );
}
