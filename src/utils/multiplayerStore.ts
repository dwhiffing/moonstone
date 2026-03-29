import Peer, { type DataConnection, type PeerOptions } from 'peerjs'
import { create } from 'zustand'

function buildPeerConfig(): PeerOptions {
  const iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
  ]

  const turnUrl = import.meta.env.VITE_TURN_URL as string | undefined
  const turnUsername = import.meta.env.VITE_TURN_USERNAME as string | undefined
  const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL as
    | string
    | undefined

  const provided = [turnUrl, turnUsername, turnCredential].filter(Boolean)

  if (provided.length > 0 && provided.length < 3) {
    console.warn(
      '[PeerJS] Partial TURN configuration detected. ' +
        'Set all three of VITE_TURN_URL, VITE_TURN_USERNAME, and VITE_TURN_CREDENTIAL to enable TURN relay.',
    )
  } else if (
    turnUrl &&
    turnUsername &&
    turnCredential &&
    /^turns?:/.test(turnUrl)
  ) {
    iceServers.push({ urls: turnUrl, username: turnUsername, credential: turnCredential })
  } else if (turnUrl && !/^turns?:/.test(turnUrl)) {
    console.warn(
      `[PeerJS] VITE_TURN_URL "${turnUrl}" does not start with "turn:" or "turns:". TURN server will not be used.`,
    )
  }

  return { config: { iceServers } }
}

export type MoveData =
  | { phase: 'play'; cardId: number; targetPileIndex: number }
  | { phase: 'draw'; sourcePileIndex: number }

type PeerMessage =
  | { type: 'game-start'; seed: number }
  | { type: 'move'; move: MoveData }

export type LobbyPhase = 'menu' | 'hosting' | 'joining'

export interface MultiplayerState {
  mode: 'ai' | 'multiplayer'
  showLobbyModal: boolean
  lobbyPhase: LobbyPhase
  gameCode: string | null
  peerConnected: boolean
  error: string | null
}

interface MultiplayerStore extends MultiplayerState {
  openLobby: () => void
  closeLobby: () => void
  hostGame: () => void
  joinGame: (code: string) => void
  sendMove: (move: MoveData) => void
  disconnect: () => void
}

// Module-level PeerJS instances (not in Zustand to avoid serialization issues)
let peer: Peer | null = null
let conn: DataConnection | null = null

// Callbacks wired up by gameStore after both stores are created
let onRemoteMoveCallback: ((move: MoveData) => void) | null = null
let onGameStartCallback:
  | ((seed: number, localPlayerIndex: 0 | 1) => void)
  | null = null

export const setOnRemoteMove = (fn: (move: MoveData) => void) => {
  onRemoteMoveCallback = fn
}

export const setOnGameStart = (
  fn: (seed: number, localPlayerIndex: 0 | 1) => void,
) => {
  onGameStartCallback = fn
}

function generateCode(): string {
  // Avoid chars that look alike: I, O, 0, 1
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from(
    { length: 4 },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join('')
}

function peerIdFromCode(code: string): string {
  return `keltis26-${code.toUpperCase()}`
}

function handleConnClose() {
  conn = null
  useMultiplayerStore.setState({ peerConnected: false })
}

export const useMultiplayerStore = create<MultiplayerStore>((set, get) => ({
  mode: 'ai',
  showLobbyModal: false,
  lobbyPhase: 'menu',
  gameCode: null,
  peerConnected: false,
  error: null,

  openLobby: () =>
    set({ showLobbyModal: true, lobbyPhase: 'menu', error: null }),

  closeLobby: () => {
    if (!get().peerConnected) {
      peer?.destroy()
      peer = null
      conn = null
    }
    set({ showLobbyModal: false })
  },

  hostGame: () => {
    if (peer) {
      peer.destroy()
      peer = null
    }
    const code = generateCode()
    set({ lobbyPhase: 'hosting', gameCode: code, error: null })

    peer = new Peer(peerIdFromCode(code), buildPeerConfig())

    peer.on('connection', (connection) => {
      // Only accept one connection
      if (conn) {
        connection.close()
        return
      }
      conn = connection

      conn.on('open', () => {
        const seed = Date.now()
        conn!.send({ type: 'game-start', seed } satisfies PeerMessage)
        onGameStartCallback?.(seed, 0) // host is always player 0
        set({
          peerConnected: true,
          mode: 'multiplayer',
          showLobbyModal: false,
        })
      })

      conn.on('data', (raw) => {
        const msg = raw as PeerMessage
        if (msg.type === 'move') {
          onRemoteMoveCallback?.(msg.move)
        }
      })

      conn.on('close', handleConnClose)
      conn.on('error', handleConnClose)
    })

    peer.on('error', (err) => {
      const msg = (err as Error).message ?? String(err)
      if (msg.includes('unavailable-id')) {
        // Code collision — retry with a new code
        get().hostGame()
      } else {
        set({ error: `Error: ${msg}`, lobbyPhase: 'menu' })
      }
    })
  },

  joinGame: (code: string) => {
    if (peer) {
      peer.destroy()
      peer = null
    }
    set({ lobbyPhase: 'joining', error: null })

    peer = new Peer(buildPeerConfig())

    peer.on('open', () => {
      conn = peer!.connect(peerIdFromCode(code), { reliable: true })

      conn.on('data', (raw) => {
        const msg = raw as PeerMessage
        if (msg.type === 'game-start') {
          onGameStartCallback?.(msg.seed, 1) // guest is always player 1
          set({
            gameCode: code.toUpperCase(),
            peerConnected: true,
            mode: 'multiplayer',
            showLobbyModal: false,
          })
        } else if (msg.type === 'move') {
          onRemoteMoveCallback?.(msg.move)
        }
      })

      conn.on('close', handleConnClose)
      conn.on('error', () => {
        set({
          error: 'Could not connect. Check the code and try again.',
          lobbyPhase: 'joining',
        })
        handleConnClose()
      })
    })

    peer.on('error', (err) => {
      const msg = (err as Error).message ?? String(err)
      set({ error: `Error: ${msg}`, lobbyPhase: 'menu' })
    })
  },

  sendMove: (move: MoveData) => {
    conn?.send({ type: 'move', move } satisfies PeerMessage)
  },

  disconnect: () => {
    conn?.close()
    peer?.destroy()
    conn = null
    peer = null
    set({
      mode: 'ai',
      peerConnected: false,
      gameCode: null,
      lobbyPhase: 'menu',
    })
  },
}))
