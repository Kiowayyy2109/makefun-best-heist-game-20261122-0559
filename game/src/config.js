// The Velvet Vault — tuning constants. One place for every number the
// designers argue about: sizes, speeds, detection rates, tool costs.
export const TILE = 40;
export const COLS = 32;
export const ROWS = 18;
export const VIEW_W = COLS * TILE; // 1280
export const VIEW_H = ROWS * TILE; // 720
export const STEP = 1 / 60;

export const PLAYER_RADIUS = 11;
export const PLAYER_WALK = 168;
export const PLAYER_SNEAK = 96;
export const PLAYER_RUN = 252;
export const PLAYER_NOISE_RADIUS = 150;

export const GUARD_RADIUS = 12;
export const GUARD_PATROL_SPEED = 62;
export const GUARD_CHASE_SPEED = 132;
export const GUARD_INVESTIGATE_SPEED = 88;
export const GUARD_CONE_RANGE = 205;
export const GUARD_CONE_HALF = 0.62; // radians, ~35 degrees each side
export const GUARD_PAUSE = 1.2; // seconds waiting at each patrol point

export const CAMERA_RANGE = 235;
export const CAMERA_CONE_HALF = 0.44;
export const CAMERA_SWEEP_SPEED = 0.55; // radians per second

// Suspicion 0..1 per guard. Rates are per second while the thief is visible.
export const SUSPICION_NEAR_RATE = 1.5; // within 90px
export const SUSPICION_FAR_RATE = 0.7; // beyond 90px
export const SUSPICION_DECAY = 0.22;
export const SUSPICION_WARN = 0.55; // "?" — guard investigates
export const SUSPICION_ALERT = 1.0; // "!" — guard chases
export const SNEAK_SUSPICION_MULT = 0.55;
export const RUN_SUSPICION_MULT = 1.6;
export const SHADOW_SUSPICION_MULT = 0.5;
export const SHADOW_RANGE_MULT = 0.55; // shadow shrinks how far a guard can spot you
export const SMOKE_BLOCKS_VISION = true;

export const ALARM_PER_ALERTED_GUARD = 15; // per second
export const ALARM_PER_CAMERA = 11; // per second while a camera sees you
export const ALARM_PER_SUSPICIOUS_GUARD = 3; // per second
export const ALARM_DECAY = 7; // per second while nobody sees you
export const ALARM_CONTACT_BUMP = 45; // walking into a guard
export const ALARM_MAX = 100;

export const COIN_START = 3;
export const COIN_THROW_RANGE = 150;
export const COIN_ATTRACT_RADIUS = 290;
export const SMOKE_START = 2;
export const SMOKE_RADIUS = 95;
export const SMOKE_DURATION = 4.5;
export const LOCKPICK_SECONDS = 1.6;
export const LOOT_PICKUP_RADIUS = 42;

export const COIN_SCORE = 25;
export const SMOKE_SCORE = 40;
export const TIME_BONUS_PER_SECOND = 5;

/** How close the thief must get to the exit centre to slip out. */
export const EXIT_TRIGGER_RADIUS = 34;

export const BEST_KEY = 'velvet-vault-best';
export const HUD_H = 64;
