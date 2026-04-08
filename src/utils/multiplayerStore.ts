import Peer, { type DataConnection, type PeerOptions } from 'peerjs'
import { create } from 'zustand'

const STORAGE_KEY = 'moonstone-mp-state'

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
  | { phase: 'claim-stone'; rank: number }

export type GameLength = 'test' | 'short' | 'medium' | 'long'

export interface SavedGameState {
  cards: CardType[]
  currentPlayerIndex: 0 | 1
  turnPhase: 0 | 1
  lastPlayedPileIndex: number | null
  turnsUntilEnd: number | null
  gameOver: boolean
  wins: [number, number]
  stones: [number[], number[]]
  stoneClaim: {
    rank: number
    cardsDrawn: number
    discardPiles: number[]
  } | null
}

type PeerMessage =
  | {
      type: 'game-start'
      seed: number
      wins: [number, number]
      gameLength: GameLength
    }
  | {
      type: 'new-game'
      seed: number
      wins: [number, number]
      gameLength: GameLength
    }
  | { type: 'game-resume'; state: SavedGameState }
  | { type: 'move'; move: MoveData }
  | { type: 'leave' }

export function isTurnConfigured(): boolean {
  const { turnUsername, turnCredential } = readTurnConfig()
  return !!(turnUsername && turnCredential && !getTurnConfigError())
}

export type LobbyPhase = 'hosting' | 'joining' | 'connecting'

export interface MultiplayerState {
  mode: 'ai' | 'multiplayer'
  showLobbyModal: boolean
  lobbyPhase: LobbyPhase
  gameCode: string | null
  peerConnected: boolean
  reconnecting: boolean
  error: string | null
  wins: [number, number]
}

interface MultiplayerStore extends MultiplayerState {
  openLobby: (phase: Exclude<LobbyPhase, 'connecting'>) => void
  closeLobby: () => void
  hostGame: (code?: string) => void
  joinGame: (code: string) => void
  startNewGame: (gameLength?: GameLength) => void
  recordResult: (winnerIndex: 0 | 1) => void
  sendMove: (move: MoveData) => void
  disconnect: () => void
}

// Module-level PeerJS instances (not in Zustand to avoid serialization issues)
let peer: Peer | null = null
let conn: DataConnection | null = null

// Callbacks wired up by gameStore after both stores are created
let onRemoteMoveCallback: ((move: MoveData) => void) | null = null
let onGameStartCallback:
  | ((seed: number, localPlayerIndex: 0 | 1, gameLength: GameLength) => void)
  | null = null
let onGameResumeCallback:
  | ((state: SavedGameState, localPlayerIndex: 0 | 1) => void)
  | null = null

let onDisconnectCallback: (() => void) | null = null
let onHostReadyToStartCallback: (() => void) | null = null
let intentionalDisconnect = false
let remoteLeft = false
let reconnectInterval: number | null = null

function watchConnection(c: DataConnection) {
  const pc = c.peerConnection
  pc.oniceconnectionstatechange = () => {
    if (
      pc.iceConnectionState === 'disconnected' ||
      pc.iceConnectionState === 'failed'
    ) {
      handleConnClose()
    }
  }
}

export const setOnRemoteMove = (fn: (move: MoveData) => void) => {
  onRemoteMoveCallback = fn
}

export const setOnGameStart = (
  fn: (seed: number, localPlayerIndex: 0 | 1, gameLength: GameLength) => void,
) => {
  onGameStartCallback = fn
}

export const setOnHostReadyToStart = (fn: () => void) => {
  onHostReadyToStartCallback = fn
}

export const setOnGameResume = (
  fn: (state: SavedGameState, localPlayerIndex: 0 | 1) => void,
) => {
  onGameResumeCallback = fn
}

export const setOnDisconnect = (fn: () => void) => {
  onDisconnectCallback = fn
}

function stopReconnecting() {
  if (reconnectInterval) {
    clearInterval(reconnectInterval)
    reconnectInterval = null
  }
}

// URL param helpers
function setUrlParam(key: string, value: string) {
  const url = new URL(window.location.href)
  // clear both params, only one should be set at a time
  url.searchParams.delete('host')
  url.searchParams.delete('join')
  url.searchParams.set(key, value)
  history.replaceState(null, '', url.toString())
}

function clearUrlParams() {
  const url = new URL(window.location.href)
  url.searchParams.delete('host')
  url.searchParams.delete('join')
  history.replaceState(null, '', url.toString())
}

// localStorage helpers for host game state persistence
export function saveGameState(state: SavedGameState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function loadGameState(): SavedGameState | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as SavedGameState
  } catch {
    return null
  }
}

export function clearGameState() {
  localStorage.removeItem(STORAGE_KEY)
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  return Array.from(
    { length: 4 },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join('')
}

function peerIdFromCode(code: string): string {
  return `ms-${code.toUpperCase()}`
}

function handleConnClose() {
  conn = null
  if (intentionalDisconnect) return
  if (remoteLeft) {
    remoteLeft = false
    useMultiplayerStore.getState().disconnect()
    return
  }
  const state = useMultiplayerStore.getState()
  if (state.mode === 'multiplayer' && state.gameCode) {
    console.log('Connection lost, attempting to reconnect...') // --- IGNORE ---
    useMultiplayerStore.setState({ peerConnected: false, reconnecting: true })
    const isGuest = new URLSearchParams(window.location.search).has('join')
    if (isGuest) {
      console.log('Guest connection lost, attempting to reconnect as guest...') // --- IGNORE ---
      // Guest must re-establish peer and reconnect to host
      peer?.destroy()
      peer = null
      const code = state.gameCode
      stopReconnecting()
      reconnectInterval = setInterval(() => {
        useMultiplayerStore.getState().joinGame(code)
      }, 3000)
      state.joinGame(code)
    }
  }
}

export const useMultiplayerStore = create<MultiplayerStore>((set, get) => ({
  mode: 'ai',
  showLobbyModal: false,
  lobbyPhase: 'joining' as LobbyPhase,
  gameCode: null,
  peerConnected: false,
  reconnecting: false,
  error: null,
  wins: [0, 0],
  openLobby: (phase: Exclude<LobbyPhase, 'connecting'>) =>
    set({
      showLobbyModal: true,
      lobbyPhase: phase,
      error: getTurnConfigError(),
    }),

  closeLobby: () => {
    if (!get().peerConnected) {
      peer?.destroy()
      peer = null
      conn = null
    }
    set({ showLobbyModal: false })
    clearUrlParams()
  },

  hostGame: (existingCode?: string) => {
    if (peer) {
      peer.destroy()
      peer = null
    }
    const code = existingCode || generateCode()
    set({
      lobbyPhase: 'hosting',
      gameCode: code,
      error: null,
      ...(existingCode ? {} : { wins: [0, 0] as [number, number] }),
    })
    setUrlParam('host', code)

    peer = new Peer(peerIdFromCode(code), buildPeerConfig())

    peer.on('connection', (connection) => {
      // Only accept one connection
      if (conn) {
        connection.close()
        return
      }
      conn = connection

      conn.on('open', () => {
        stopReconnecting()
        watchConnection(conn!)
        // If we have a saved game state, resume it instead of starting fresh
        const saved = loadGameState()
        const wins = get().wins
        if (saved && !saved.gameOver) {
          conn!.send({
            type: 'game-resume',
            state: { ...saved, wins },
          } satisfies PeerMessage)
          set({ wins: saved.wins })
          onGameResumeCallback?.(saved, 0) // host is always player 0
        } else {
          onHostReadyToStartCallback?.()
        }
        set({
          peerConnected: true,
          reconnecting: false,
          mode: 'multiplayer',
          showLobbyModal: false,
        })
      })

      conn.on('data', (raw) => {
        const msg = raw as PeerMessage
        if (msg.type === 'move') {
          onRemoteMoveCallback?.(msg.move)
        } else if (msg.type === 'leave') {
          remoteLeft = true
        }
      })

      conn.on('close', handleConnClose)
      conn.on('error', handleConnClose)
    })

    peer.on('error', (err) => {
      const msg = (err as Error).message ?? String(err)
      if (msg.includes('unavailable-id')) {
        if (existingCode) {
          // Can't resume with this code — it's taken by someone else
          set({
            error: 'Could not reconnect with previous code.',
            lobbyPhase: 'hosting',
          })
        } else {
          // Code collision — retry with a new code
          get().hostGame()
        }
      } else {
        set({ error: `Error: ${msg}`, lobbyPhase: 'joining' })
      }
    })
  },

  joinGame: (code: string) => {
    if (peer) {
      peer.destroy()
      peer = null
    }
    const isReconnecting = get().reconnecting
    if (!isReconnecting) {
      set({ lobbyPhase: 'joining', error: null, wins: [0, 0] })
    }
    setUrlParam('join', code.toUpperCase())

    peer = new Peer(buildPeerConfig())

    peer.on('open', () => {
      console.log('Peer open with ID:', peer!.id)
      set({ lobbyPhase: 'connecting' })
      conn = peer!.connect(peerIdFromCode(code), { reliable: true })

      const joinTimeout = setTimeout(() => {
        if (!get().peerConnected && !get().reconnecting) {
          set({
            error: 'Could not connect. Check the code and try again.',
            lobbyPhase: 'joining',
          })
          handleConnClose()
        }
      }, 5000)

      conn.on('open', () => {
        clearTimeout(joinTimeout)
        watchConnection(conn!)
      })

      conn.on('data', (raw) => {
        const msg = raw as PeerMessage
        if (msg.type === 'game-start' || msg.type === 'new-game') {
          onGameStartCallback?.(msg.seed, 1, msg.gameLength) // guest is always player 1
          set({
            gameCode: code.toUpperCase(),
            peerConnected: true,
            mode: 'multiplayer',
            showLobbyModal: false,
            wins: msg.wins,
          })
        } else if (msg.type === 'game-resume') {
          stopReconnecting()
          onGameResumeCallback?.(msg.state, 1) // guest is always player 1
          set({
            gameCode: code.toUpperCase(),
            peerConnected: true,
            reconnecting: false,
            mode: 'multiplayer',
            showLobbyModal: false,
            wins: msg.state.wins,
          })
        } else if (msg.type === 'move') {
          onRemoteMoveCallback?.(msg.move)
        } else if (msg.type === 'leave') {
          remoteLeft = true
        }
      })

      conn.on('close', handleConnClose)
      conn.on('error', () => {
        if (!get().reconnecting) {
          set({
            error: 'Could not connect. Check the code and try again.',
            lobbyPhase: 'joining',
          })
        }
        // During reconnection, don't fully disconnect — the interval will retry
        if (!get().reconnecting) handleConnClose()
      })
    })

    peer.on('error', (err) => {
      console.log('Peer error:', err)
      const msg = (err as Error).message ?? String(err)
      // Suppress errors during reconnection — the interval will retry
      if (!get().reconnecting) {
        set({ error: `Error: ${msg}`, lobbyPhase: 'joining' })
      }
    })
  },

  recordResult: (winnerIndex: 0 | 1) => {
    set((s) => {
      const wins: [number, number] = [...s.wins]
      wins[winnerIndex]++
      return { wins }
    })
  },

  sendMove: (move: MoveData) => {
    conn?.send({ type: 'move', move } satisfies PeerMessage)
  },

  startNewGame: (gameLength: GameLength = 'medium') => {
    clearGameState()
    const seed = Date.now()
    const wins = get().wins
    conn?.send({
      type: 'new-game',
      seed,
      wins,
      gameLength,
    } satisfies PeerMessage)
    onGameStartCallback?.(seed, 0, gameLength)
  },

  disconnect: () => {
    stopReconnecting()
    intentionalDisconnect = true
    // Clear URL params before closing connection so handleConnClose
    // won't see ?join and start reconnecting
    clearUrlParams()
    clearGameState()
    conn?.send({ type: 'leave' } satisfies PeerMessage)
    conn?.close()
    peer?.destroy()
    conn = null
    peer = null
    intentionalDisconnect = false
    set({
      mode: 'ai',
      peerConnected: false,
      reconnecting: false,
      gameCode: null,
      lobbyPhase: 'joining' as LobbyPhase,
      wins: [0, 0],
    })
    onDisconnectCallback?.()
  },
}))

// Auto-connect from URL params on page load
export function autoConnect() {
  const params = new URLSearchParams(window.location.search)
  const hostCode = params.get('host')
  const joinCode = params.get('join')
  if (hostCode) {
    useMultiplayerStore.getState().openLobby('hosting')
    useMultiplayerStore.getState().hostGame(hostCode)
  } else if (joinCode) {
    useMultiplayerStore.getState().openLobby('joining')
    useMultiplayerStore.getState().joinGame(joinCode)
  }
}
