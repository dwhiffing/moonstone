import { create } from "zustand";
import { getCardPilePosition, getPileSize } from ".";
import {
	CARD_TRANSITION_DURATION,
	CARDS,
	HAND_SIZE,
	NUM_DISCARD_PILES,
	NUM_SUITS,
} from "./constants";
import { seededShuffle } from "./seededShuffle";

type MouseParams = { clientX: number; clientY: number };

export interface GameState {
	cards: CardType[];
	activeCard: CardType | null;
	cursorState: { mouseX: number; mouseY: number; pressed: boolean };
	dealPhase: -1 | 0 | 1; // -1 = not dealing, 0 = cards in deck, 1 = dealing
	currentPlayerIndex: 0 | 1;
	turnPhase: 0 | 1; // 0 = play a card, 1 = draw a card
	lastPlayedPileIndex: number | null;
	showInstructionsModal: boolean;
}

interface GameStore extends GameState {
	newGame: () => void;
	onMouseDown: (params: MouseParams) => void;
	onMouseUp: (params: MouseParams) => void;
	onMouseMove: (params: MouseParams) => void;
	openInstructions: () => void;
	closeInstructions: () => void;
}

// tracks the initial cursor position when dragging starts
// so that we can tell how far the cursor moved and tell a click from a drag
let cursorDownAt = 0;
let lastClickedCardId: number | null = null;
let cursorDownPos = { x: 0, y: 0 };
// tracks the offset between the cursor and the card position
// so that when you drag, the card anchors to the mouse correctly
let cursorDelta = { x: 0, y: 0 };
let dealTimeout: number | null = null;
let aiTurnTimeout: number | null = null;
let lastDoubleClickAt = 0;

export const useGameStore = create<GameStore>((set, get) => {
	const newGame = () => {
		const { cards } = generateCards();
		set({ ...initializeGameState(), cards });
		if (dealTimeout) clearTimeout(dealTimeout);
		if (aiTurnTimeout) clearTimeout(aiTurnTimeout);
		dealTimeout = setTimeout(() => {
			set({ dealPhase: 1 });
			dealTimeout = setTimeout(
				() => {
					set({ dealPhase: -1, cards: sortHandCards(get().cards) });
				},
				(CARD_TRANSITION_DURATION / 2) * (HAND_SIZE * 2 + 1),
			);
		}, 500);
	};

	const hasSeenInstructions =
		localStorage.getItem("hasSeenInstructions") === "true";

	setTimeout(() => newGame(), 0);

	// if (
	// 	window.matchMedia("(any-pointer: coarse)").matches &&
	// 	!window.matchMedia("(display-mode: fullscreen), (display-mode: standalone)")
	// 		.matches
	// ) {
	// 	document.addEventListener("click", () => {
	// 		if (!document.fullscreenElement)
	// 			document.documentElement
	// 				.requestFullscreen({ navigationUI: "hide" })
	// 				.then(() =>
	// 					(screen.orientation as any).lock("portrait").catch(() => {}),
	// 				);
	// 	});
	// }

	if (!hasSeenInstructions) {
		localStorage.setItem("hasSeenInstructions", "true");
		setTimeout(() => set({ showInstructionsModal: true }), 1000);
	}

	return {
		cards: [],
		...initializeGameState(),

		newGame,
		onMouseDown: ({ clientX, clientY }: MouseParams) => {
			if (get().currentPlayerIndex !== 0) return;
			const { activeCard, cards, turnPhase } = get();

			// Draw phase: player must pick a pile to draw from
			if (turnPhase === 1) {
				const s = NUM_SUITS;
				const playerHandPile = 2 + s * 2 + NUM_DISCARD_PILES;
				const sourcePileIndex = getPileAtPoint(clientX, clientY, cards);
				const isDrawPile = sourcePileIndex === 0;
				const isDiscardPile =
					sourcePileIndex >= 2 + s &&
					sourcePileIndex < 2 + s + NUM_DISCARD_PILES;
				const sourceCard = getCardPile(sourcePileIndex, cards).at(-1);
				const isAllowed =
					(isDrawPile || isDiscardPile) &&
					sourceCard &&
					sourcePileIndex !== get().lastPlayedPileIndex;
				if (isAllowed) {
					set({ turnPhase: 0 });
					drawIntoHand(playerHandPile, sourceCard, 1, get, set);
					aiTurnTimeout = setTimeout(
						() => aiTakeTurn(get, set),
						CARD_TRANSITION_DURATION,
					);
				}
				return;
			}

			const clickedCard = getCardFromPoint(clientX, clientY, cards);
			const s = NUM_SUITS;
			const isDiscardCard =
				clickedCard &&
				clickedCard.pileIndex >= 2 + s &&
				clickedCard.pileIndex < 2 + s + NUM_DISCARD_PILES;
			const pickableCard =
				clickedCard &&
				isCardPickable(clickedCard) &&
				!(turnPhase === 0 && isDiscardCard)
					? clickedCard
					: undefined;

			const isDoubleClick =
				pickableCard?.id != null &&
				pickableCard.id === lastClickedCardId &&
				Date.now() - cursorDownAt < 350;

			if (isDoubleClick && pickableCard) {
				lastDoubleClickAt = Date.now();
				// moveCard(pickableCard, pileIndex, 0, get, set);
				// return;
			}

			if (activeCard) {
				const targetPileIndex = getPileAtPoint(clientX, clientY, cards);
				moveCard(activeCard, targetPileIndex, 0, get, set);
			}

			if (pickableCard) {
				set({ activeCard: activeCard ? null : pickableCard });
			}

			cursorDownPos = { x: clientX, y: clientY };
			cursorDownAt = Date.now();
			lastClickedCardId = pickableCard?.id ?? null;
			if (pickableCard) {
				const { x: cardX, y: cardY } = getCardPilePosition(pickableCard);
				cursorDelta = { x: clientX - cardX, y: clientY - cardY };
				set({ cursorState: { mouseX: cardX, mouseY: cardY, pressed: true } });
			}
		},
		onMouseUp: ({ clientX, clientY }: MouseParams) => {
			if (get().currentPlayerIndex !== 0) return;
			const { activeCard, cards } = get();
			const posDiff =
				Math.abs(cursorDownPos.x - clientX) +
				Math.abs(cursorDownPos.y - clientY);
			const timeDiff = Date.now() - cursorDownAt;

			if (
				activeCard &&
				(posDiff > 5 || timeDiff > 300) &&
				Date.now() - lastDoubleClickAt > 300
			) {
				const { width, height } = getPileSize();
				const x = clientX + (width / 2 - cursorDelta.x);
				const y = clientY + (height / 2 - cursorDelta.y);
				const targetPileIndex = getPileAtPoint(x, y, cards);
				moveCard(activeCard, targetPileIndex, 0, get, set);
			}

			cursorDownPos = { x: 0, y: 0 };
			cursorDelta = { x: 0, y: 0 };
			set({ cursorState: { ...get().cursorState, pressed: false } });
		},
		onMouseMove: ({ clientX, clientY }: MouseParams) => {
			const mouseX = clientX - cursorDelta.x;
			const mouseY = clientY - cursorDelta.y;
			set({ cursorState: { ...get().cursorState, mouseX, mouseY } });
		},
		openInstructions: () => {
			localStorage.setItem("hasSeenInstructions", "true");
			set({ showInstructionsModal: true });
		},
		closeInstructions: () => set({ showInstructionsModal: false }),
	};
});

function initializeGameState(): Omit<GameState, "cards"> {
	return {
		activeCard: null,
		cursorState: { mouseX: 0, mouseY: 0, pressed: false },
		dealPhase: 0,
		currentPlayerIndex: 0,
		turnPhase: 0,
		lastPlayedPileIndex: null,
		showInstructionsModal: false,
	};
}

function generateCards(): { cards: CardType[]; seed: number } {
	const seed = Date.now();
	const shuffledCards = seededShuffle(CARDS, seed);
	const dealtCards = shuffledCards.slice(30);
	const handCardCount = HAND_SIZE * 2;
	const playerHandPile = NUM_SUITS * 2 + NUM_DISCARD_PILES + 2;
	const cards = dealtCards.map((n, i) => {
		const id = i;
		if (i < handCardCount) {
			const pileIndex = i % 2 === 0 ? playerHandPile : 1;
			const cardPileIndex = Math.floor(i / 2);
			return { ...n, id, pileIndex, cardPileIndex };
		}
		return { ...n, id, pileIndex: 0, cardPileIndex: i - handCardCount };
	});

	return { cards, seed };
}

const getPileAtPoint = (x: number, y: number, cards: CardType[]) =>
	getCardFromPoint(x, y, cards)?.pileIndex ?? getPileFromPoint(x, y);

const moveCard = (
	activeCard: CardType | null,
	pileIndex: number,
	playerIndex: 0 | 1,
	get: () => GameStore,
	set: (state: Partial<GameStore>) => void,
) => {
	const { cards } = get();
	if (!activeCard || pileIndex === -1) return set({ cards, activeCard: null });

	const s = NUM_SUITS;
	const handPile = playerIndex === 0 ? 2 + s * 2 + NUM_DISCARD_PILES : 1;

	const cardsInTargetPile = getCardPile(pileIndex, cards);
	const targetCard = cardsInTargetPile.at(-1) ?? null;

	const pile = document.querySelector(
		`.pile[data-pileindex="${pileIndex}"]`,
	) as HTMLDivElement | null;
	const pileType = pile?.dataset.piletype || "tableau";

	const isValid =
		pileType !== "hand" &&
		(pileType === "discard" || isValidPlay(cardsInTargetPile, activeCard));

	if (!isValid) return set({ cards, activeCard: null });

	// Move played card to target pile
	set({
		activeCard: null,
		lastPlayedPileIndex: pileType === "discard" ? pileIndex : null,
		cards: cards.map((card) => {
			if (activeCard.id === card.id) {
				return {
					...card,
					pileIndex: pileIndex,
					cardPileIndex: targetCard ? targetCard.cardPileIndex + 1 : 0,
				};
			}
			return card;
		}),
	});

	if (activeCard.pileIndex === handPile) {
		// Both player and AI must choose a pile to draw from
		setTimeout(() => {
			set({ turnPhase: 1 });
			if (playerIndex === 1) {
				aiTurnTimeout = setTimeout(
					() => aiTakeTurn(get, set),
					CARD_TRANSITION_DURATION,
				);
			}
		}, CARD_TRANSITION_DURATION);
	}
};

const aiTakeTurn = (
	get: () => GameStore,
	set: (state: Partial<GameStore>) => void,
) => {
	const { cards, turnPhase } = get();
	const s = NUM_SUITS;
	const opponentHandPile = 1;

	if (turnPhase === 0) {
		// Play phase: move a random hand card to a random discard pile
		const discardPileIndices = Array.from(
			{ length: NUM_DISCARD_PILES },
			(_, i) => 2 + s + i,
		);
		const handCards = getCardPile(opponentHandPile, cards);
		if (handCards.length === 0) return;
		const randomCard = handCards[Math.floor(Math.random() * handCards.length)];
		const randomDiscardPile =
			discardPileIndices[Math.floor(Math.random() * discardPileIndices.length)];
		moveCard(randomCard, randomDiscardPile, 1, get, set);
	} else {
		// Draw phase: randomly pick a non-empty source pile (deck or discard, excluding just-played pile)
		const discardPileIndices = Array.from(
			{ length: NUM_DISCARD_PILES },
			(_, i) => 2 + s + i,
		);
		const nonEmptyDiscards = discardPileIndices.filter(
			(i) =>
				getCardPile(i, cards).length > 0 && i !== get().lastPlayedPileIndex,
		);
		const deckCard = getCardPile(0, cards).at(-1);
		const drawOptions = [...(deckCard ? [0] : []), ...nonEmptyDiscards];
		const sourcePileIndex =
			drawOptions[Math.floor(Math.random() * drawOptions.length)];
		const sourceCard = getCardPile(sourcePileIndex, cards).at(-1);
		if (sourceCard) {
			set({ turnPhase: 0 });
			drawIntoHand(opponentHandPile, sourceCard, 0, get, set);
		}
	}
};

const drawIntoHand = (
	handPileIndex: number,
	deckTopCard: CardType,
	nextPlayerIndex: 0 | 1,
	get: () => GameStore,
	set: (state: Partial<GameStore>) => void,
) => {
	const current = get().cards;
	const handCards = getCardPile(handPileIndex, current);
	const merged = [...handCards, deckTopCard].sort((a, b) =>
		a.suit !== b.suit ? a.suit - b.suit : a.rank - b.rank,
	);
	const updatedCards = current.map((card) => {
		const newIdx = merged.findIndex((c) => c.id === card.id);
		if (newIdx === -1) return card;
		return { ...card, pileIndex: handPileIndex, cardPileIndex: newIdx };
	});
	set({
		currentPlayerIndex: nextPlayerIndex,
		lastPlayedPileIndex: null,
		cards: updatedCards,
	});
	console.log(
		`Turn end — Player 0: ${getScore(0, updatedCards)}, Player 1: ${getScore(1, updatedCards)}`,
	);
};

const PILE_SCORE = [0, -4, -3, -2, 1, 2, 3, 6, 7, 10];

const getPileScore = (length: number): number =>
	PILE_SCORE[Math.min(length, PILE_SCORE.length - 1)];

const getScore = (playerIndex: 0 | 1, cards: CardType[]): number => {
	const s = NUM_SUITS;
	const tableauStart = playerIndex === 0 ? 2 + s + NUM_DISCARD_PILES : 2;
	return Array.from({ length: s }, (_, i) =>
		getPileScore(getCardPile(tableauStart + i, cards).length),
	).reduce((a, b) => a + b, 0);
};

const getCardFromPoint = (x: number, y: number, cards: CardType[]) => {
	const elementUnder = document.elementFromPoint(x, y) as HTMLDivElement;

	if (elementUnder?.dataset.id) {
		return cards[+elementUnder.dataset.id];
	}

	return undefined;
};

const getPileFromPoint = (x: number, y: number) => {
	const elementUnder = document.elementFromPoint(x, y) as HTMLDivElement;

	return +(elementUnder?.dataset.pileindex || "-1");
};

const isValidPlay = (pile: CardType[], card: CardType): boolean => {
	const topCard = pile.at(-1);
	if (!topCard) return true;
	if (card.rank === topCard.rank) return true;
	const direction = getPileDirection(pile);
	if (direction === null) return true;
	if (direction === "asc") return card.rank > topCard.rank;
	return card.rank < topCard.rank;
};

const getPileDirection = (pile: CardType[]): "asc" | "desc" | null => {
	for (let i = 0; i < pile.length - 1; i++) {
		if (pile[i].rank < pile[i + 1].rank) return "asc";
		if (pile[i].rank > pile[i + 1].rank) return "desc";
	}
	return null;
};

const sortHandCards = (cards: CardType[]): CardType[] => {
	let result = cards;
	const handPileIndices = [1, 2 + NUM_SUITS * 2 + NUM_DISCARD_PILES];
	for (const handPileIndex of handPileIndices) {
		const handCards = getCardPile(handPileIndex, result);
		const sorted = [...handCards].sort((a, b) =>
			a.suit !== b.suit ? a.suit - b.suit : a.rank - b.rank,
		);
		result = result.map((card) => {
			const sortedIndex = sorted.findIndex((c) => c.id === card.id);
			if (sortedIndex === -1) return card;
			return { ...card, cardPileIndex: sortedIndex };
		});
	}
	return result;
};

const getCardPile = (pileIndex: number, cards: CardType[]) => {
	const pile = cards.filter((c) => c.pileIndex === pileIndex);
	return pile.sort((a, b) => a.cardPileIndex - b.cardPileIndex);
};

// Piles the local player owns and can pick cards from:
//   pile 17 = player hand, piles 7–11 = discard
// Disabled: deck (0), opponent hand (1), opponent tableau (2–6), player's own tableau (12–16)
const isCardPickable = (card: CardType): boolean => {
	const s = NUM_SUITS;
	if (card.pileIndex === 0) return false; // deck
	if (card.pileIndex === 1) return false; // opponent hand
	if (card.pileIndex >= 2 && card.pileIndex < 2 + s) return false; // opponent tableau
	if (
		card.pileIndex >= 2 + s + NUM_DISCARD_PILES &&
		card.pileIndex < 2 + s * 2 + NUM_DISCARD_PILES
	)
		return false; // player's own tableau (already played)
	return true;
};
