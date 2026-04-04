import { useShallow } from 'zustand/shallow'
import { useGameStore } from '../utils/gameStore'

export const Pile = ({
  pileIndex,
  pileType,
}: {
  pileIndex: number
  pileType: 'discard' | 'tableau' | 'hand' | 'deck'
}) => {
  const state = useGameStore(
    useShallow((state) => ({
      deckCount: state.cards.filter((c) => c.pileIndex === 0).length,
      showDeckCount: state.dealPhase === -1,
    })),
  )
  return (
    <div
      key={`pile-${pileIndex}`}
      className={`pile ${pileType} flex justify-center items-center`}
      data-pileindex={pileIndex}
      data-piletype={pileType}>
      {pileType === 'deck' && (
        <p
          className={`relative z-1000 text-white font-bold ${state.deckCount === 0 || !state.showDeckCount ? 'opacity-0' : ''} transition-opacity`}>
          {state.deckCount}
        </p>
      )}
    </div>
  )
}
