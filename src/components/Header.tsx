import { useGameStore } from '../utils/gameStore'
import { useMultiplayerStore } from '../utils/multiplayerStore'
import { Dropdown } from './Dropdown'
import { HamburgerSVG } from './svg'

export function Header() {
  const newGame = useGameStore((s) => s.newGame)
  const openInstructions = useGameStore((s) => s.openInstructions)
  const { mode, peerConnected, openLobby, disconnect } = useMultiplayerStore()

  return (
    <div className="flex justify-between items-center text-white py-2 px-3 lg:p-5 relative z-header pointer-events-none">
      <div className="flex-1 flex items-center gap-3 pointer-events-auto">
        <span className="text-lg lg:text-2xl whitespace-nowrap font-bold">
          Keltis
        </span>
        <button onClick={openInstructions} title="Instructions">
          ?
        </button>
      </div>

      <div className="flex-1 flex justify-center pointer-events-auto cursor-pointer">
        {mode === 'multiplayer' && (
          <span className="text-xs opacity-60">
            {peerConnected ? 'Online' : 'Disconnected'}
          </span>
        )}
      </div>

      <div className="flex-1 flex items-center justify-end gap-2 pointer-events-auto">
        <Dropdown
          className="w-10"
          label={<HamburgerSVG />}
          items={[
            {
              label: 'New Game (vs AI)',
              onClick: () => {
                if (mode === 'multiplayer') disconnect()
                newGame()
              },
            },
            {
              label:
                mode === 'multiplayer' ? 'Leave Multiplayer' : 'Multiplayer',
              onClick: () => {
                if (mode === 'multiplayer') {
                  disconnect()
                  newGame()
                } else {
                  openLobby()
                }
              },
            },
          ]}
        />
      </div>
    </div>
  )
}
