import { readStore, writeStore, buildSnapshotFromRaw } from "../lib/store/db.ts";

async function main() {
  const store = await readStore();
  const beforePlayers = store.snapshots.reduce((n, s) => n + s.players.length, 0);

  store.snapshots = store.snapshots.map((s) => {
    const rebuilt = buildSnapshotFromRaw({
      throughGameweek: s.throughGameweek,
      seasonStatsRaw: s.seasonStatsRaw,
      expectedGoalsRaw: s.expectedGoalsRaw,
    });
    rebuilt.uploadedAt = s.uploadedAt;
    return rebuilt;
  });

  const afterPlayers = store.snapshots.reduce((n, s) => n + s.players.length, 0);
  await writeStore(store);

  const marmoush = [];
  for (const s of store.snapshots) {
    for (const p of s.players) {
      if (p.displayName === "Omar Marmoush") {
        marmoush.push({
          gw: s.throughGameweek,
          team: s.shortName,
          apps: p.stats.apps,
          bc: p.stats.bigChances,
          shots: p.stats.shots,
        });
      }
    }
  }

  const map = new Map<string, string[]>();
  for (const s of store.snapshots.filter((x) => x.throughGameweek === 4)) {
    for (const p of s.players) {
      const list = map.get(p.id) ?? [];
      list.push(s.shortName);
      map.set(p.id, list);
    }
  }
  const multi = [...map.entries()].filter(([, teams]) => new Set(teams).size > 1);

  console.log(
    JSON.stringify(
      {
        beforePlayers,
        afterPlayers,
        removed: beforePlayers - afterPlayers,
        marmoush,
        multiTeamGw4: multi.length,
        multiTeams: multi.map(([, teams]) => teams.join("+")),
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
