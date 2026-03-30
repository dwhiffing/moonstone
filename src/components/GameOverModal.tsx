import { useShallow } from 'zustand/react/shallow'
import { getScore, getScoreBreakdown, useGameStore } from '../utils/gameStore'
import { useMultiplayerStore } from '../utils/multiplayerStore'
import { FireSVG, LeafSVG, MoonSVG, StarSVG, WaterSVG } from './svg'
import { Modal } from './Modal'

const SUIT_ICONS = [
  <FireSVG />,
  <WaterSVG />,
  <LeafSVG />,
  <MoonSVG />,
  <StarSVG />,
]

const ScoreBreakdown = ({
  playerIndex,
  cards,
}: {
  playerIndex: 0 | 1
  cards: CardType[]
}) => {
  const rows = getScoreBreakdown(playerIndex, cards)
  return (
    <div className="flex flex-col gap-1">
      {rows.map(({ suit, size, points }) => (
        <div
          key={suit}
          className="flex items-center justify-between text-base font-bold text-shadow-sm">
          <div className="flex items-center">
            <div className="w-4 h-4 opacity-70">{SUIT_ICONS[suit]}</div>
            <div className="flex items-center gap-0.5">
              <span className="opacity-60">×</span>
              <span className="opacity-60">{size}</span>
            </div>
          </div>
          <span
            className={
              points < 0
                ? 'text-red-400'
                : points > 0
                  ? 'text-green-400'
                  : 'opacity-40'
            }>
            {points > 0 ? '+' : ''}
            {points}
          </span>
        </div>
      ))}
    </div>
  )
}

export const GameOverModal = () => {
  const { gameOver, cards, newGame, localPlayerIndex } = useGameStore(
    useShallow((state) => ({
      gameOver: state.gameOver,
      cards: state.cards,
      newGame: state.newGame,
      localPlayerIndex: state.localPlayerIndex,
    })),
  )
  const { mode } = useMultiplayerStore(useShallow((s) => ({ mode: s.mode })))
  const isGuest = mode === 'multiplayer' && localPlayerIndex === 1

  const myIndex = localPlayerIndex
  const opponentIndex: 0 | 1 = myIndex === 0 ? 1 : 0
  const myScore = getScore(myIndex, cards)
  const opponentScore = getScore(opponentIndex, cards)
  const winner =
    myScore > opponentScore
      ? 'You win!'
      : opponentScore > myScore
        ? 'Opponent wins!'
        : "It's a tie!"

  return (
    <Modal show={gameOver}>
      <div className="flex flex-col gap-6 bg-surface rounded-lg shadow-xl w-[calc(100vw-40px)] min-w-72 max-w-sm p-6">
        <h2 className="text-2xl font-bold text-center">Game Over</h2>

        <div className="flex justify-around gap-4">
          <div className="flex-1">
            <div className="text-sm opacity-60 mb-2 text-center">You</div>
            <ScoreBreakdown playerIndex={myIndex} cards={cards} />
            <div className="text-2xl font-bold text-center mt-2">{myScore}</div>
          </div>
          <div className="w-px bg-current opacity-10" />
          <div className="flex-1">
            <div className="text-sm opacity-60 mb-2 text-center">Opponent</div>
            <ScoreBreakdown playerIndex={opponentIndex} cards={cards} />
            <div className="text-2xl font-bold text-center mt-2">
              {opponentScore}
            </div>
          </div>
        </div>

        <p className="text-center text-lg font-semibold">{winner}</p>

        {isGuest ? (
          <p className="text-center text-sm opacity-60">
            Waiting for host to start a new game…
          </p>
        ) : (
          <button
            className="w-full py-2 px-4 rounded bg-primary text-white font-bold"
            onClick={newGame}>
            New Game
          </button>
        )}
      </div>
    </Modal>
  )
}
