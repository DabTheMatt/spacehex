/** TODO RULE CLARIFICATION T3 — prowizoryczne wartości, żeby tura była grywalna. */
export const STARTING_FUEL = 6
export const FUEL_COST_MOVE = 1
export const FUEL_COST_EXPLORE = 1
/** Stay spends one cell unless the ship is on a refuel hex. */
export const FUEL_COST_SKIP = 1
/** Tank cap uses the starting allotment until T3 specifies otherwise. */
export const FUEL_TANK = STARTING_FUEL
/** TODO RULE CLARIFICATION T7 — planet/EVA refuel; 1 CR per fuel cell. */
export const FUEL_BUY_PRICE = 1
/** TODO RULE CLARIFICATION T7 — EVA hull repair; 2 CR per pip. */
export const REPAIR_PRICE = 2
export const GAME_STATE_VERSION = 3

/** Loser of a combat contest takes this many hull points. */
export const COMBAT_DAMAGE = 1
export const MAX_ATTACKS_PER_TURN = 1

export const PLAYER_IDS = ['player-1', 'player-2'] as const

/** Maciej: 2 sondy na statek; wystrzał zamiast ruchu. */
export const STARTING_PROBES = 2
