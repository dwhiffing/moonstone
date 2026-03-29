import { useState } from 'react'
import { useMultiplayerStore } from '../utils/multiplayerStore'
import { Modal } from './Modal'

export function LobbyModal() {
  const {
    showLobbyModal,
    lobbyPhase,
    gameCode,
    error,
    closeLobby,
    hostGame,
    joinGame,
  } = useMultiplayerStore()
  const [inputCode, setInputCode] = useState('')

  return (
    <Modal show={showLobbyModal} onClose={closeLobby}>
      <div className="flex flex-col gap-6 bg-surface rounded-lg shadow-xl w-[calc(100vw-40px)] min-w-72 max-w-sm p-6">
        <h2 className="text-2xl font-bold text-center">Multiplayer</h2>

        {lobbyPhase === 'menu' && (
          <div className="flex flex-col gap-3">
            <button
              className="w-full py-2 px-4 rounded bg-primary text-white font-bold"
              onClick={hostGame}>
              Create Game
            </button>
            <button
              className="w-full py-2 px-4 rounded bg-on-surface text-white font-bold"
              onClick={() =>
                useMultiplayerStore.setState({ lobbyPhase: 'joining' })
              }>
              Join Game
            </button>
          </div>
        )}

        {lobbyPhase === 'hosting' && (
          <div className="flex flex-col gap-4 items-center">
            <p className="text-center text-sm opacity-70">
              Share this code with your opponent:
            </p>
            <div className="text-5xl font-mono font-bold tracking-widest text-primary">
              {gameCode}
            </div>
            <p className="text-center text-sm opacity-70">
              Waiting for opponent to join…
            </p>
            <button
              className="w-full py-2 px-4 rounded bg-on-surface text-white"
              onClick={closeLobby}>
              Cancel
            </button>
          </div>
        )}

        {lobbyPhase === 'joining' && (
          <div className="flex flex-col gap-4">
            <p className="text-center text-sm opacity-70">
              Enter the game code:
            </p>
            <input
              className="w-full py-2 px-4 rounded bg-on-surface text-white text-center text-2xl font-mono tracking-widest uppercase"
              maxLength={4}
              placeholder="XXXX"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && inputCode.length === 4)
                  joinGame(inputCode)
              }}
              autoFocus
            />
            {error && (
              <p className="text-red-400 text-sm text-center">{error}</p>
            )}
            <button
              className="w-full py-2 px-4 rounded bg-primary text-white font-bold disabled:opacity-40"
              disabled={inputCode.length < 4}
              onClick={() => joinGame(inputCode)}>
              Connect
            </button>
            <button
              className="w-full py-2 px-4 rounded bg-on-surface text-white"
              onClick={() =>
                useMultiplayerStore.setState({
                  lobbyPhase: 'menu',
                  error: null,
                })
              }>
              Back
            </button>
          </div>
        )}

        {error && lobbyPhase !== 'joining' && (
          <p className="text-red-400 text-sm text-center">{error}</p>
        )}
      </div>
    </Modal>
  )
}
