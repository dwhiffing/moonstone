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
export const NUM_SUITS = SUIT_NAMES.length;
export const NUM_DISCARD_PILES = 4;

const SUITS = Array.from({ length: NUM_SUITS }, (_, i) => i);
const RANK_COUNTS: [Rank, number][] = [
	[0, 1],
	[1, 1],
	[2, 1],
	[3, 2],
	[4, 3],
	[5, 3],
	[6, 2],
	[7, 1],
	[8, 1],
	[9, 1],
];
const RANKS_EXPANDED = RANK_COUNTS.flatMap(([rank, count]) =>
	Array.from({ length: count }, () => rank),
);
export const CARDS = SUITS.map((s) =>
	RANKS_EXPANDED.map((n) => ({ rank: n as Rank, suit: s as Suit })),
).flat();
