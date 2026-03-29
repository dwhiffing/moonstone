import { useEffect, useState } from "react";
import { SUIT_NAMES } from "./constants";

export const useForceUpdate = () => {
	const [, setValue] = useState(0);
	return () => setValue((value) => ++value);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const useWindowEvent = (event: any, callback: any) => {
	useEffect(() => {
		window.addEventListener(event, callback);
		return () => window.removeEventListener(event, callback);
	}, [event, callback]);
};

export const getPileSize = () => {
	const pileEl = document.querySelector(".pile") as HTMLDivElement | null;
	return {
		width: pileEl?.offsetWidth ?? 0,
		height: pileEl?.offsetHeight ?? 0,
	};
};

const getPilePos = (pileIndex: number) => {
	const pileEl = document.querySelector(
		`.pile[data-pileindex="${pileIndex}"]`,
	) as HTMLDivElement | null;
	const pilePos = pileEl?.getBoundingClientRect();
	return { x: pilePos?.x ?? 0, y: pilePos?.y ?? 0 };
};

export const getCardPilePosition = (card: CardType) => {
	const pilePos = getPilePos(card.pileIndex);
	let offsetX = 0;
	let offsetY = 0;
	const pileType =
		card.pileIndex === 0
			? "deck"
			: card.pileIndex === 1 || card.pileIndex === SUIT_NAMES.length * 3 + 2
				? "hand"
				: card.pileIndex > 6 && card.pileIndex < 12
					? "discard"
					: "tableau";

	const CARD_Y_GAP = 0.25;
	const CARD_X_GAP = 0.3;
	let rotate = 0;
	if (pileType === "tableau") {
		const { width } = getPileSize();
		offsetY =
			card.cardPileIndex * (CARD_Y_GAP * width) * (card.pileIndex > 6 ? 1 : -1);
	}
	if (pileType === "hand") {
		const { width } = getPileSize();
		const gw = CARD_X_GAP * width;
		const ANGLE_STEP_DEG = 5;
		const distFromCenter = card.cardPileIndex - 3.5;
		const angleRad = distFromCenter * ANGLE_STEP_DEG * (Math.PI / 180);
		const R = gw / Math.sin(ANGLE_STEP_DEG * (Math.PI / 180));
		const yDirection = card.pileIndex === 1 ? -1 : 1;
		rotate = distFromCenter * ANGLE_STEP_DEG * yDirection;
		offsetX = R * Math.sin(angleRad);
		offsetY = R * (1 - Math.cos(angleRad)) * yDirection;
	}

	return {
		x: pilePos.x + offsetX,
		y: pilePos.y + offsetY,
		pileType,
		rotate,
	};
};

export const loadStorage = (key: string): any => {
	const saved = localStorage.getItem(key);
	return saved ? JSON.parse(saved) : {};
};

export const saveStorage = (key: string, value: any) =>
	localStorage.setItem(key, JSON.stringify(value));

export const cn = (...args: (string | false | null | undefined)[]) =>
	args.filter(Boolean).join(" ");
