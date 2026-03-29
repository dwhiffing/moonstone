type Suit = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
type Rank = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

interface CardType {
	id: number;
	pileIndex: number;
	cardPileIndex: number;
	suit: Suit;
	rank: Rank;
}

interface CardShallowState {
	x: number;
	y: number;
	scale: number;
	rotate: number;
	isActive: boolean;
	isDragging: boolean;
	pileType: string;
	isFaceDown: boolean;
	cardPileIndex: number;
	suit: Suit;
	rank: Rank;
	transitionDelay: number;
}
