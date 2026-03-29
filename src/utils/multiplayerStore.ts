import Peer, { type DataConnection, type PeerOptions } from 'peerjs'
import { create } from 'zustand'

function readTurnConfig() {
  return {
    turnUsername: import.meta.env.VITE_TURN_USERNAME as string | undefined,
    turnCredential: import.meta.env.VITE_TURN_CREDENTIAL as string | undefined,
  }
}

function getTurnConfigError(): string | null {
  const { turnUsername, turnCredential } = readTurnConfig()
  const provided = [turnUsername, turnCredential].filter(Boolean)

  if (provided.length > 0 && provided.length < 2) {
    return 'Partial TURN configuration: set VITE_TURN_USERNAME and VITE_TURN_CREDENTIAL to enable TURN relay.'
  }
  return null
}

function buildPeerConfig(): PeerOptions {
  const iceServers: RTCIceServer[] = [
    // Public STUN — no cost, handles most NAT traversal
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]

  // Only add TURN if explicitly configured via env vars
  const { turnUsername, turnCredential } = readTurnConfig()
  if (!getTurnConfigError() && turnUsername && turnCredential) {
    iceServers.push(
      {
        urls: 'turn:global.relay.metered.ca:80',
        username: turnUsername,
        credential: turnCredential,
      },
      // {
      //   urls: 'turn:global.relay.metered.ca:80?transport=tcp',
      //   username: turnUsername,
      //   credential: turnCredential,
      // },
      // {
      //   urls: 'turn:global.relay.metered.ca:443',
      //   username: turnUsername,
      //   credential: turnCredential,
      // },
      // {
      //   urls: 'turns:global.relay.metered.ca:443?transport=tcp',
      //   username: turnUsername,
      //   credential: turnCredential,
      // },
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

export function isTurnConfigured(): boolean {
  const { turnUsername, turnCredential } = readTurnConfig()
  return !!(turnUsername && turnCredential && !getTurnConfigError())
}

export type LobbyPhase = 'menu' | 'hosting' | 'joining' | 'connecting'

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
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
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
    set({
      showLobbyModal: true,
      lobbyPhase: 'menu',
      error: getTurnConfigError(),
    }),

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
      set({ lobbyPhase: 'connecting' })
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
      set({ error: `Error: ${msg}`, lobbyPhase: 'joining' })
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
