import { useShallow } from 'zustand/react/shallow'
import { getScore, getScoreBreakdown, useGameStore } from '../utils/gameStore'
import { useMultiplayerStore } from '../utils/multiplayerStore'
import { Modal } from './Modal'
import { CircleSVG, FireSVG, LeafSVG, MoonSVG, StarSVG, WaterSVG } from './svg'

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
  stones,
}: {
  playerIndex: 0 | 1
  cards: CardType[]
  stones: [number[], number[]]
}) => {
  const rows = getScoreBreakdown(playerIndex, cards, stones)
  return (
    <div className="flex flex-col gap-0">
      {rows.map(({ suit, size, points }) => (
        <div
          key={suit ?? 'stones'}
          className="flex items-center justify-between text-lg font-bold text-shadow-2xs">
          <div className="flex items-center w-10">
            <div className="w-4 h-4 opacity-70">
              {typeof suit === 'number' ? SUIT_ICONS[suit] : <CircleSVG />}
            </div>
            <div className="flex items-center gap-0.5">
              <span className="opacity-60">×</span>
              <span className="opacity-60">{size}</span>
            </div>
          </div>
          <div className="h-px border-b border-dotted border-[#fff5] flex-1 mx-2" />
          <span
            className={`${
              points < 0
                ? 'text-red-300'
                : points !== 0
                  ? 'text-white'
                  : 'opacity-40'
            } w-4 text-right`}>
            {points > 0 ? '+' : ''}
            {points}
          </span>
        </div>
      ))}
    </div>
  )
}

export const GameOverModal = () => {
  const { gameOver, cards, newGame, localPlayerIndex, stones } = useGameStore(
    useShallow((state) => ({
      gameOver: state.gameOver,
      cards: state.cards,
      newGame: state.newGame,
      localPlayerIndex: state.localPlayerIndex,
      stones: state.stones,
    })),
  )
  const { mode, wins, disconnect } = useMultiplayerStore(
    useShallow((s) => ({
      mode: s.mode,
      wins: s.wins,
      disconnect: s.disconnect,
    })),
  )
  const isGuest = mode === 'multiplayer' && localPlayerIndex === 1

  const myIndex = localPlayerIndex
  const opponentIndex: 0 | 1 = myIndex === 0 ? 1 : 0
  const myScore = getScore(myIndex, cards, stones)
  const opponentScore = getScore(opponentIndex, cards, stones)
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
            <ScoreBreakdown
              playerIndex={myIndex}
              cards={cards}
              stones={stones}
            />
            <div className="text-2xl font-bold text-center mt-2">{myScore}</div>
          </div>
          <div className="w-px bg-current opacity-10" />
          <div className="flex-1">
            <div className="text-sm opacity-60 mb-2 text-center">Opponent</div>
            <ScoreBreakdown
              playerIndex={opponentIndex}
              cards={cards}
              stones={stones}
            />
            <div className="text-2xl font-bold text-center mt-2">
              {opponentScore}
            </div>
          </div>
        </div>

        <p className="text-center text-lg font-semibold">{winner}</p>

        <p className="text-center text-2xl font-bold">
          {wins[myIndex] ?? 0} - {wins[opponentIndex] ?? 0}
        </p>

        {isGuest ? (
          <p className="text-center text-sm opacity-60">
            Waiting for host to start a new game…
          </p>
        ) : (
          <button className="button" onClick={newGame}>
            New Game
          </button>
        )}

        {mode === 'multiplayer' && (
          <button className="button" onClick={disconnect}>
            Leave Game
          </button>
        )}
      </div>
    </Modal>
  )
}
