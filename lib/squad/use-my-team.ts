"use client";

import { useCallback, useEffect, useState } from "react";
import type { SquadPlayerId } from "@/lib/types";
import { normalizeSquadIds } from "@/lib/squad/rules";

export const MY_TEAM_STORAGE_KEY = "fpl_lab_my_team";

function readSquadFromStorage(): SquadPlayerId[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(MY_TEAM_STORAGE_KEY);
    if (!raw) return [];
    return normalizeSquadIds(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

function writeSquadToStorage(ids: SquadPlayerId[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MY_TEAM_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Quota / private mode — ignore
  }
}

export function useMyTeamSquad() {
  const [playerIds, setPlayerIds] = useState<SquadPlayerId[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setPlayerIds(readSquadFromStorage());
    setHydrated(true);
  }, []);

  const persist = useCallback((next: SquadPlayerId[]) => {
    const normalized = normalizeSquadIds(next);
    setPlayerIds(normalized);
    writeSquadToStorage(normalized);
  }, []);

  const addPlayer = useCallback((id: SquadPlayerId) => {
    setPlayerIds((prev) => {
      if (prev.includes(id)) return prev;
      if (prev.length >= 15) return prev;
      const next = normalizeSquadIds([...prev, id]);
      writeSquadToStorage(next);
      return next;
    });
  }, []);

  const removePlayer = useCallback((id: SquadPlayerId) => {
    setPlayerIds((prev) => {
      const next = prev.filter((x) => x !== id);
      writeSquadToStorage(next);
      return next;
    });
  }, []);

  const clearSquad = useCallback(() => {
    persist([]);
  }, [persist]);

  const setSquad = useCallback(
    (ids: SquadPlayerId[]) => {
      persist(ids);
    },
    [persist]
  );

  return {
    playerIds,
    hydrated,
    addPlayer,
    removePlayer,
    clearSquad,
    setSquad,
  };
}
