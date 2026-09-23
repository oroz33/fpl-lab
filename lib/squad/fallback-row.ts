import type { PlayerRow } from "@/lib/types";

/**
 * Build a zero-stats PlayerRow that keeps identity / fixtures metadata.
 * Used when a squad member has no apps/mins in the selected GW range.
 */
export function buildEmptyPlayerRow(base: PlayerRow): PlayerRow {
  return {
    id: base.id,
    name: base.name,
    teamId: base.teamId,
    team: base.team,
    teamShort: base.teamShort,
    position: base.position,
    nextFixtures: base.nextFixtures,
    apps: 0,
    mins: 0,
    shots: 0,
    shotsOnTarget: 0,
    shotsInsideBox: 0,
    bigChances: 0,
    xG: 0,
    goals: 0,
    xGI: 0,
    npxGI: 0,
    gi: 0,
    actualReturns: 0,
    xGiVariance: 0,
    regressionStatus: "ALIGNED",
    keyPasses: 0,
    bigChancesCreated: 0,
    xA: 0,
    assists: 0,
    corners: 0,
    freeKicksTaken: 0,
    freeKickGoals: 0,
    penaltyGoals: 0,
    clearances: 0,
    blocks: 0,
    interceptions: 0,
    tackles: 0,
    recoveries: 0,
    cleanSheets: 0,
    saves: null,
    dcPerGame: null,
  };
}
