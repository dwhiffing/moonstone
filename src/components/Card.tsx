import debounce from "lodash/debounce";
import React, { memo, useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import {
	getCardPilePosition,
	getPileSize,
	useForceUpdate,
	useWindowEvent,
} from "../utils";
import {
	CARD_TRANSITION_DURATION,
	SUIT_COLORS,
	SUIT_NAMES,
} from "../utils/constants";
import {
	type GameState,
	isPileComplete,
	useGameStore,
} from "../utils/gameStore";
import {
	CardBackSVG,
	FireSVG,
	LeafSVG,
	MoonSVG,
	StarSVG,
	WaterSVG,
} from "./svg";

const Card = ({ cardId }: { cardId: number }) => {
	const store = useGameStore(useShallow(getShallowCardState(cardId)));
	const [isActive, setIsActive] = useState(false);
	const [zIndex, setZIndex] = useState(store.cardPileIndex);
	const [hasMounted, setHasMounted] = useState(false);
	useWindowEvent("resize", debounce(useForceUpdate(), 100));
	// eslint-disable-next-line react-hooks/set-state-in-effect
	useEffect(() => setHasMounted(true), []);

	// delay changes to zIndex until after transition completes
	useEffect(() => {
		const timeout = setTimeout(
			() => {
				setIsActive(store.isActive);
				setZIndex(store.cardPileIndex);
			},
			!isActive && store.isActive ? 0 : CARD_TRANSITION_DURATION,
		);
		return () => clearTimeout(timeout);
	}, [isActive, store.cardPileIndex, store.isActive]);

	if (!hasMounted) return null;

	const translate = `${store.x}px ${store.y}px 0`;
	const boxShadow =
		(!store.isFaceDown && store.pileType !== "discard") ||
		store.cardPileIndex === 0
			? "0 0 5px rgba(0, 0, 0, 0.25)"
			: "none";
	const transitionDuration = CARD_TRANSITION_DURATION + "ms";
	const transitionTimingFunction = "cubic-bezier(0.4, 0, 0.6, 1)";
	const transitionProperty = !hasMounted
		? "none"
		: store.isActive
			? "scale, rotate"
			: "scale, translate, rotate, box-shadow";
	const transitionDelay = `${store.transitionDelay}ms`;

	return (
		<div
			data-id={cardId}
			className={`card ${store.isFaceDown ? "face-down" : ""} ${store.isDragging ? "active" : "inactive"}`}
			style={{
				zIndex,
				scale: store.scale,
				rotate: `${store.rotate}deg`,
				transitionProperty,
				transitionDuration,
				transitionTimingFunction,
				transitionDelay,
				translate,
				boxShadow,
				willChange: "transform",
			}}
		>
			<CardFront suit={store.suit} rank={store.rank} />
			<div className="card-back" style={{ transitionDelay }}>
				<CardBackSVG />
			</div>
		</div>
	);
};

const getShallowCardState =
	(cardId: number) =>
	(state: GameState): CardShallowState => {
		const card = state.cards[cardId];

		const { cardPileIndex, pileIndex, suit, rank } = card;
		const { mouseX, mouseY, pressed } = state.cursorState;
		const {
			x: xPos,
			y: yPos,
			pileType,
			rotate: rotatePos,
		} = getCardPilePosition(card);
		const { width, height } = getPileSize();
		const isActive = cardId === state.activeCard?.id;
		const isShuffling = state.dealPhase === 0;
		const isInCompletedPile = isPileComplete(card.pileIndex, state.cards);
		const isFaceDown =
			pileIndex === 0 || pileIndex === 1 || isShuffling || isInCompletedPile;
		const isDragging = isActive && pressed;

		const deckX = window.innerWidth / 2 - width / 2;
		const deckY = window.innerHeight / 2 - height / 2;

		const x = isShuffling ? deckX : isDragging ? mouseX : xPos;
		const y = isShuffling ? deckY : isDragging ? mouseY : yPos;
		const scale = isActive ? 1.15 : 1;
		const rotate = isDragging || isShuffling ? 0 : rotatePos;

		return {
			x,
			y,
			scale,
			rotate,
			isActive,
			isDragging,
			pileType,
			isFaceDown,
			cardPileIndex,
			suit,
			rank,
			transitionDelay: state.dealPhase === 1 ? card.id * 150 : 0,
		};
	};

export default memo(Card);

const _CardFront = ({ suit, rank }: { suit: Suit; rank: Rank }) => {
	const color = SUIT_COLORS[suit];
	const suitName = SUIT_NAMES[suit];

	return (
		<div className="card-front" style={{ color }}>
			<div className={`${suitName} corner-rank tl`}>
				<div className="rank">
					<span>{rank}</span>
				</div>
				<Suit suit={suit} />
			</div>
			<div className={`${suitName} corner-rank br`}>
				<div className="rank">
					<span>{rank}</span>
				</div>
				<Suit suit={suit} />
			</div>

			<div className="center-suit">
				<Suit suit={suit} />
			</div>
		</div>
	);
};

const CardFront = React.memo(_CardFront);

const Suit = React.memo(({ suit }: { suit: Suit }) => {
	if (suit === 0) return <FireSVG />;
	if (suit === 1) return <WaterSVG />;
	if (suit === 2) return <LeafSVG />;
	if (suit === 3) return <MoonSVG />;
	if (suit === 4) return <StarSVG />;
	return null;
});
