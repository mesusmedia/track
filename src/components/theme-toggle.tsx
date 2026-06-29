"use client";

import { useTheme } from "next-themes";
import { Sun, Sunset, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";

const ORDER = ["light", "ocaso", "dark"] as const;
const ICONS = { light: Sun, ocaso: Sunset, dark: Moon };
const LABELS = { light: "claro", ocaso: "ocaso", dark: "escuro" };

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const current = (theme as (typeof ORDER)[number]) ?? "dark";
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
  const Icon = ICONS[current] ?? Moon;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(next)}
      aria-label={`Tema atual: ${LABELS[current]}. Trocar para ${LABELS[next]}`}
    >
      <Icon className="size-4" />
    </Button>
  );
}
