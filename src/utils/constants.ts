export const DEV_MODE = false;
export const HAND_SIZE = 8;
export const CARD_TRANSITION_DURATION = 300;
export const SUIT_COLORS: string[] = [
	"#e74c3c",
	"#4761ad",
	"#27ae60",
	"#9a54ae",
	"#e28d26",
];
export const SUIT_NAMES: string[] = ["fire", "water", "leaf", "moon", "star"];

export const NUM_RANKS = 10;
export const NUM_SUITS = 5;

const SUITS = Array.from({ length: NUM_SUITS }, (_, i) => i);
const VALUES = Array.from({ length: NUM_RANKS }, (_, i) => i);
export const CARDS = SUITS.map((s) =>
	VALUES.map((n) => ({ rank: n as Rank, suit: s as Suit })),
).flat();
