"use client";

import { useRouter, useSearchParams } from "next/navigation";

const OPTIONS = [
  { value: "7", label: "7 dias" },
  { value: "30", label: "30 dias" },
  { value: "90", label: "90 dias" },
];

export function PeriodFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("period") ?? "30";

  return (
    <select
      value={current}
      onChange={(e) => router.push(`/admin?period=${e.target.value}`)}
      className="bg-accent border rounded-lg py-1.5 px-2.5 text-xs text-muted-foreground focus:outline-none focus:border-primary transition-colors"
    >
      {OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          últimos {opt.label}
        </option>
      ))}
    </select>
  );
}
