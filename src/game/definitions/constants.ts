/** TODO RULE CLARIFICATION T3 — prowizoryczne wartości, żeby tura była grywalna. */
export const STARTING_FUEL = 6
export const FUEL_COST_MOVE = 1
export const FUEL_COST_EXPLORE = 1
export const FUEL_COST_SKIP = 0
/** Tank cap uses the starting allotment until T3 specifies otherwise. */
export const FUEL_TANK = STARTING_FUEL
/** TODO RULE CLARIFICATION T7 — planet refuel; no price in spec. 1 CR per 1 fuel. */
export const FUEL_BUY_PRICE = 1

/** TODO RULE CLARIFICATION T5 */
export const COMBAT_DAMAGE = 1
export const MAX_ATTACKS_PER_TURN = 1

export const PLAYER_IDS = ['player-1', 'player-2'] as const

/** Maciej: 2 sondy na statek; wystrzał zamiast ruchu. */
export const STARTING_PROBES = 2

export const GAME_STATE_VERSION = 2
