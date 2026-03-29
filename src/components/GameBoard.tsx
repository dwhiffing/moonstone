import debounce from "lodash/debounce";
import { useShallow } from "zustand/react/shallow";
import { useForceUpdate, useWindowEvent } from "../utils";
import { SUIT_NAMES } from "../utils/constants";
import { useGameStore } from "../utils/gameStore";
import Card from "./Card";
import { Header } from "./Header";
import { InstructionsModal } from "./InstructionsModal";
import { Pile } from "./Pile";

function App() {
	const state = useGameStore(
		useShallow((state) => ({
			cardCount: state.cards.length,
			onMouseUp: state.onMouseUp,
			onMouseDown: state.onMouseDown,
			onMouseMove: state.onMouseMove,
		})),
	);

	useWindowEvent("resize", debounce(useForceUpdate(), 100));
	useWindowEvent("pointerup", state.onMouseUp);
	useWindowEvent("pointerdown", state.onMouseDown);
	useWindowEvent("pointermove", state.onMouseMove);

	const suitCount = SUIT_NAMES.length;
	const suitArray = Array.from({ length: suitCount });
	return (
		<div className="bg-surface absolute inset-0">
			<div id="ui" className="absolute inset-0">
				<Header />

				<div className="flex flex-col justify-center h-full absolute inset-0">
					<div className="absolute inset-0 flex justify-center items-center">
						<Pile pileIndex={0} pileType="deck" />
					</div>
					<div className="absolute top-0 inset-x-0 transform -translate-y-1/2 flex justify-center items-center">
						<Pile pileIndex={1} pileType="hand" />
					</div>

					<div className="w-full flex flex-col gap-board items-start justify-center">
						<div className="w-full flex gap-board items-start justify-center">
							{suitArray.map((_, index) => (
								<Pile key={index} pileIndex={index + 2} pileType="tableau" />
							))}
						</div>

						<div className="w-full flex gap-board items-start justify-center">
							{suitArray.map((_, index) => (
								<Pile
									key={index}
									pileIndex={index + 2 + suitCount}
									pileType="discard"
								/>
							))}
						</div>

						<div className="w-full flex gap-board items-start justify-center">
							{suitArray.map((_, index) => (
								<Pile
									key={index}
									pileIndex={index + 2 + suitCount * 2}
									pileType="tableau"
								/>
							))}
						</div>
					</div>

					<div className="absolute bottom-0 inset-x-0 transform translate-y-1/2 flex justify-center items-center">
						<Pile pileIndex={2 + suitCount * 3} pileType="hand" />
					</div>
				</div>
			</div>

			<div
				id="cards"
				className="fixed inset-0 pointer-events-none overflow-hidden"
			>
				{Array.from({ length: state.cardCount }).map((_, cardId) => (
					<Card key={`card-${cardId}`} cardId={cardId} />
				))}
			</div>

			<InstructionsModal />
		</div>
	);
}

export default App;
