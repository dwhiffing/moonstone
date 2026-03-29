import { create } from "zustand";
import { getCardPilePosition, getPileSize } from ".";
import { CARD_TRANSITION_DURATION, CARDS, SUIT_NAMES } from "./constants";
import { seededShuffle } from "./seededShuffle";

type MouseParams = { clientX: number; clientY: number };

export interface GameState {
	cards: CardType[];
	activeCard: CardType | null;
	cursorState: { mouseX: number; mouseY: number; pressed: boolean };
	dealPhase: -1 | 0 | 1; // -1 = not dealing, 0 = cards in deck, 1 = dealing
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
let lastDoubleClickAt = 0;

export const useGameStore = create<GameStore>((set, get) => {
	const newGame = () => {
		const { cards } = generateCards();
		set({ ...initializeGameState(), cards });
		if (dealTimeout) clearTimeout(dealTimeout);
		dealTimeout = setTimeout(() => {
			set({ dealPhase: 1 });
			dealTimeout = setTimeout(
				() => set({ dealPhase: -1 }),
				cards.length * 10 + CARD_TRANSITION_DURATION,
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
			const { activeCard, cards } = get();
			const clickedCard = getCardFromPoint(clientX, clientY, get().cards);

			const isDoubleClick =
				clickedCard?.id != null &&
				clickedCard.id === lastClickedCardId &&
				Date.now() - cursorDownAt < 350;

			if (isDoubleClick && clickedCard) {
				const pileIndex = findValidPile(clickedCard, cards);
				if (pileIndex !== null) {
					lastDoubleClickAt = Date.now();
					moveCard(clickedCard, pileIndex, get, set);
					return;
				}
			}

			if (activeCard) {
				const targetPileIndex = getPileAtPoint(clientX, clientY, cards);
				moveCard(activeCard, targetPileIndex, get, set);
			}

			if (
				clickedCard
				// clickedCard?.cardPileIndex ===
				// 	getCardPile(clickedCard.pileIndex, cards).length - 1 &&
			) {
				set({ activeCard: activeCard ? null : clickedCard });
			}

			cursorDownPos = { x: clientX, y: clientY };
			cursorDownAt = Date.now();
			lastClickedCardId = clickedCard?.id ?? null;
			if (clickedCard) {
				const { x: cardX, y: cardY } = getCardPilePosition(clickedCard);
				cursorDelta = { x: clientX - cardX, y: clientY - cardY };
				set({ cursorState: { mouseX: cardX, mouseY: cardY, pressed: true } });
			}
		},
		onMouseUp: ({ clientX, clientY }: MouseParams) => {
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
				moveCard(activeCard, targetPileIndex, get, set);
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
		showInstructionsModal: false,
	};
}

function generateCards(): { cards: CardType[]; seed: number } {
	const selectedCards = CARDS;
	const seed = Date.now();
	const shuffledCards = seededShuffle(selectedCards, seed);
	const cards = shuffledCards.map((n, i) => {
		const id = i;
		if (i < 16) {
			const pileIndex = i % 2 === 0 ? 17 : 1;
			const cardPileIndex = Math.floor(i / 2);
			return { ...n, id, pileIndex, cardPileIndex };
		}
		return { ...n, id, pileIndex: 0, cardPileIndex: i - 16 };
	});

	return { cards, seed };
}

const getPileAtPoint = (x: number, y: number, cards: CardType[]) =>
	getCardFromPoint(x, y, cards)?.pileIndex ?? getPileFromPoint(x, y);

const moveCard = (
	activeCard: CardType | null,
	pileIndex: number,
	get: () => GameStore,
	set: (state: Partial<GameStore>) => void,
) => {
	const { cards } = get();
	if (!activeCard || pileIndex === -1) return set({ cards, activeCard: null });

	const cardsInTargetPile = getCardPile(pileIndex, cards);
	const targetCard = cardsInTargetPile.at(-1) ?? null;
	// const sourcePileIndex = activeCard.pileIndex;

	const movingCards = [activeCard];

	const pile = document.querySelector(
		`.pile[data-pileindex="${pileIndex}"]`,
	) as HTMLDivElement | null;
	const pileType = pile?.dataset.piletype || "tableau";

	const suitsMatch = movingCards.every((c) => c.suit === targetCard?.suit);
	const isValid =
		!targetCard ||
		(isAdjacentInValue([targetCard, ...movingCards]) && suitsMatch);

	if (pileType === "discard") {
		// if (isFoundationPileDisabled(pileIndex, cards)) {
		// 	return set({ cards, activeCard: null });
		// }
	}

	if (!isValid) return set({ cards, activeCard: null });

	set({
		activeCard: null,
		cards: cards.map((card) => {
			let cardPileIndex = movingCards.findIndex((c) => c.id === card.id);
			if (cardPileIndex === -1) return card;

			if (targetCard) cardPileIndex += targetCard.cardPileIndex + 1;

			return { ...card, pileIndex: pileIndex, cardPileIndex };
		}),
	});
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

const isAdjacentInValue = (cards: CardType[]) =>
	isDescending(cards) || isAscending(cards);

const isDescending = (cards: CardType[]) =>
	cards.filter((card, i) =>
		cards[i + 1] ? card.rank === cards[i + 1].rank + 1 : true,
	).length === cards.length;

const isAscending = (cards: CardType[]) =>
	cards.filter((card, i) =>
		cards[i + 1] ? card.rank === cards[i + 1].rank - 1 : true,
	).length === cards.length;

const getCardPile = (pileIndex: number, cards: CardType[]) => {
	const pile = cards.filter((c) => c.pileIndex === pileIndex);
	return pile.sort((a, b) => a.cardPileIndex - b.cardPileIndex);
};

const findValidPile = (card: CardType, cards: CardType[]): number | null => {
	for (let i = 0; i < SUIT_NAMES.length; i++) {
		const pileIndex = i;

		const foundationCards = getCardPile(pileIndex, cards);
		const topCard = foundationCards.at(-1);

		if (!topCard) continue;

		const suitsMatch = card.suit === topCard.suit;
		const ranksAdjacent = isAdjacentInValue([topCard, card]);

		if (suitsMatch && ranksAdjacent) {
			return pileIndex;
		}
	}

	return null;
};
