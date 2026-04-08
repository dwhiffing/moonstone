import debounce from 'lodash/debounce'
import { useShallow } from 'zustand/react/shallow'
import { useForceUpdate, useWindowEvent } from '../utils'
import { NUM_DISCARD_PILES, NUM_SUITS } from '../utils/constants'
import { useGameStore } from '../utils/gameStore'
import { useMultiplayerStore } from '../utils/multiplayerStore'
import Card from './Card'
import { GameLengthModal } from './GameLengthModal'
import { GameOverModal } from './GameOverModal'
import { Header } from './Header'
import { InstructionsModal } from './InstructionsModal'
import { LobbyModal } from './LobbyModal'
import { NetworkDebugPanel } from './NetworkDebugPanel'
import { Pile } from './Pile'
import { WishingStonePile } from './WishingStonePile'

function App() {
  const { showLobbyModal, openLobby, hostGame } = useMultiplayerStore()
  const state = useGameStore(
    useShallow((state) => ({
      cardCount: state.cards.length,
      newGame: state.newGame,
      onMouseUp: state.onMouseUp,
      onMouseDown: state.onMouseDown,
      onMouseMove: state.onMouseMove,
      localPlayerIndex: state.localPlayerIndex,
    })),
  )

  useWindowEvent('resize', debounce(useForceUpdate(), 100))
  useWindowEvent('pointerup', state.onMouseUp)
  useWindowEvent('pointerdown', state.onMouseDown)
  useWindowEvent('pointermove', state.onMouseMove)

  const suitCount = NUM_SUITS
  const discardCount = NUM_DISCARD_PILES
  const suitArray = Array.from({ length: suitCount })
  const lp = state.localPlayerIndex
  const topHandPile = lp === 0 ? 1 : 2 + suitCount * 2 + discardCount
  const bottomHandPile = lp === 0 ? 2 + suitCount * 2 + discardCount : 1
  const topTableauStart = lp === 0 ? 2 : 2 + suitCount + discardCount
  const bottomTableauStart = lp === 0 ? 2 + suitCount + discardCount : 2

  return (
    <div className="bg-surface absolute inset-0">
      <div id="ui" className="absolute inset-0">
        <Header />

        <div
          className={`flex flex-col justify-center h-full absolute inset-0 transition-opacity duration-500 ${state.cardCount === 0 ? 'opacity-0' : ''}`}>
          <div className="absolute top-0 inset-x-0 transform -translate-y-2/5 flex justify-center items-center">
            <Pile pileIndex={topHandPile} pileType="hand" />
          </div>

          <div className="w-full flex flex-col gap-board items-start justify-center">
            <div className="w-full flex gap-board items-start justify-center">
              {suitArray.map((_, index) => (
                <Pile
                  key={index}
                  pileIndex={topTableauStart + index}
                  pileType="tableau"
                />
              ))}
            </div>

            <WishingStonePile
              playerIndex={state.localPlayerIndex === 0 ? 1 : 0}
            />

            <div className="w-full flex gap-board items-start justify-center">
              {[0, 1].map((index) => (
                <Pile
                  key={index}
                  pileIndex={index + 2 + suitCount}
                  pileType="discard"
                />
              ))}
              <Pile pileIndex={0} pileType="deck" />
              {[2, 3].map((index) => (
                <Pile
                  key={index}
                  pileIndex={index + 2 + suitCount}
                  pileType="discard"
                />
              ))}
            </div>

            <WishingStonePile playerIndex={state.localPlayerIndex} />

            <div className="w-full flex gap-board items-start justify-center">
              {suitArray.map((_, index) => (
                <Pile
                  key={index}
                  pileIndex={bottomTableauStart + index}
                  pileType="tableau"
                />
              ))}
            </div>
          </div>

          <div className="absolute bottom-0 inset-x-0 transform translate-y-4/5 flex justify-center items-center">
            <Pile pileIndex={bottomHandPile} pileType="hand" />
          </div>
        </div>
      </div>

      <div
        id="cards"
        className="fixed inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: state.cardCount }).map((_, cardId) => (
          <Card key={`card-${cardId}`} cardId={cardId} />
        ))}
      </div>

      <div
        className={`flex flex-col justify-center items-center h-full gap-4 absolute inset-0 text-2xl transition-opacity duration-500 ${state.cardCount === 0 ? '' : 'opacity-0 pointer-events-none'}`}>
        <button
          className="button font-medium px-4 py-3"
          onClick={() => {
            openLobby('hosting')
            hostGame()
          }}>
          Host Game
        </button>
        <button
          className="button font-medium px-4 py-3"
          onClick={() => openLobby('joining')}>
          Join Game
        </button>
        <button
          className="button font-medium px-4 py-3"
          onClick={state.newGame}>
          Local Game vs AI
        </button>
      </div>

      <InstructionsModal />
      <GameLengthModal />
      <GameOverModal />
      <LobbyModal key={showLobbyModal ? 'show' : 'hide'} />
      <NetworkDebugPanel />
    </div>
  )
}

export default App
