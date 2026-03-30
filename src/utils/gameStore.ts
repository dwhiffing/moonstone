import { create } from 'zustand'
import { getCardPilePosition, getPileSize } from '.'
import {
  CARD_TRANSITION_DURATION,
  CARDS,
  END_CARD_RANK,
  HAND_SIZE,
  NEUTRAL_SUIT,
  NUM_DISCARD_PILES,
  NUM_SUITS,
} from './constants'
import {
  type MoveData,
  setOnGameStart,
  setOnRemoteMove,
  useMultiplayerStore,
} from './multiplayerStore'
import { seededShuffle } from './seededShuffle'

type MouseParams = { clientX: number; clientY: number }

export interface GameState {
  cards: CardType[]
  activeCard: CardType | null
  cursorState: { mouseX: number; mouseY: number; pressed: boolean }
  dealPhase: -1 | 0 | 1 // -1 = not dealing, 0 = cards in deck, 1 = dealing
  currentPlayerIndex: 0 | 1
  localPlayerIndex: 0 | 1 // 0 = AI mode or multiplayer host, 1 = multiplayer guest
  turnPhase: 0 | 1 // 0 = play a card, 1 = draw a card
  lastPlayedPileIndex: number | null
  turnsUntilEnd: number | null // null = deck not yet empty; counts down from 2 after last deck draw
  gameOver: boolean
  showInstructionsModal: boolean
}

interface GameStore extends GameState {
  newGame: () => void
  startMultiplayerGame: (seed: number, localPlayerIndex: 0 | 1) => void
  applyRemoteMove: (move: MoveData) => void
  onMouseDown: (params: MouseParams) => void
  onMouseUp: (params: MouseParams) => void
  onMouseMove: (params: MouseParams) => void
  openInstructions: () => void
  closeInstructions: () => void
}

// tracks the initial cursor position when dragging starts
// so that we can tell how far the cursor moved and tell a click from a drag
let cursorDownAt = 0
let lastClickedCardId: number | null = null
let cursorDownPos = { x: 0, y: 0 }
// tracks the offset between the cursor and the card position
// so that when you drag, the card anchors to the mouse correctly
let cursorDelta = { x: 0, y: 0 }
let dealTimeout: number | null = null
let aiTurnTimeout: number | null = null
let lastDoubleClickAt = 0

export const useGameStore = create<GameStore>((set, get) => {
  const startGame = (seed?: number, localPlayerIndex: 0 | 1 = 0) => {
    const { cards } = generateCards(seed)
    set({ ...initializeGameState(), cards, localPlayerIndex })
    if (dealTimeout) clearTimeout(dealTimeout)
    if (aiTurnTimeout) clearTimeout(aiTurnTimeout)
    dealTimeout = setTimeout(() => {
      set({ dealPhase: 1 })
      dealTimeout = setTimeout(
        () => {
          set({ dealPhase: -1, cards: sortHandCards(get().cards) })
        },
        (CARD_TRANSITION_DURATION / 2) * (HAND_SIZE * 2 + 1),
      )
    }, 500)
  }

  const newGame = () => {
    const { mode } = useMultiplayerStore.getState()
    if (mode === 'multiplayer') {
      if (get().localPlayerIndex === 0) {
        useMultiplayerStore.getState().startNewGame()
      }
    } else {
      startGame()
    }
  }

  const hasSeenInstructions =
    localStorage.getItem('hasSeenInstructions') === 'true'

  if (
    window.matchMedia('(any-pointer: coarse)').matches &&
    !window.matchMedia('(display-mode: fullscreen), (display-mode: standalone)')
      .matches
  ) {
    document.addEventListener('click', () => {
      if (!document.fullscreenElement)
        document.documentElement
          .requestFullscreen({ navigationUI: 'hide' })
          .then(() =>
            (screen.orientation as any).lock('portrait').catch(() => {}),
          )
    })
  }

  if (!hasSeenInstructions) {
    localStorage.setItem('hasSeenInstructions', 'true')
    setTimeout(() => set({ showInstructionsModal: true }), 1000)
  }

  return {
    cards: [],
    ...initializeGameState(),

    newGame,
    startMultiplayerGame: (seed: number, localPlayerIndex: 0 | 1) =>
      startGame(seed, localPlayerIndex),
    applyRemoteMove: (move: MoveData) => {
      const state = get()
      const remotePlayerIndex: 0 | 1 = state.localPlayerIndex === 0 ? 1 : 0
      const s = NUM_SUITS
      if (move.phase === 'play') {
        const card = state.cards.find((c) => c.id === move.cardId)
        if (!card) return
        moveCard(card, move.targetPileIndex, remotePlayerIndex, get, set, true)
        const { turnsUntilEnd } = get()
        if (turnsUntilEnd !== null && turnsUntilEnd <= 4) {
          setTimeout(
            () => advanceTurnNoDraw(remotePlayerIndex, get, set),
            CARD_TRANSITION_DURATION,
          )
        }
      } else {
        const sourceCard = getCardPile(move.sourcePileIndex, state.cards).at(-1)
        if (!sourceCard) return
        const remoteHandPile =
          remotePlayerIndex === 0 ? 2 + s * 2 + NUM_DISCARD_PILES : 1
        const nextPlayerIndex: 0 | 1 = remotePlayerIndex === 0 ? 1 : 0
        set({ turnPhase: 0 })
        drawIntoHand(remoteHandPile, sourceCard, nextPlayerIndex, get, set)
        if (useMultiplayerStore.getState().mode === 'multiplayer') {
          navigator.vibrate?.(100)
        }
      }
    },
    onMouseDown: ({ clientX, clientY }: MouseParams) => {
      const localPlayerIndex = get().localPlayerIndex
      if (get().currentPlayerIndex !== localPlayerIndex || get().gameOver)
        return
      const { activeCard, cards, turnPhase } = get()

      // Draw phase: player must pick a pile to draw from
      if (turnPhase === 1) {
        const s = NUM_SUITS
        const playerHandPile =
          localPlayerIndex === 0 ? 2 + s * 2 + NUM_DISCARD_PILES : 1
        const nextPlayerIndex: 0 | 1 = localPlayerIndex === 0 ? 1 : 0
        const sourcePileIndex = getPileAtPoint(clientX, clientY, cards)
        const isDrawPile = sourcePileIndex === 0
        const isDiscardPile =
          sourcePileIndex >= 2 + s &&
          sourcePileIndex < 2 + s + NUM_DISCARD_PILES
        const sourceCard = getCardPile(sourcePileIndex, cards).at(-1)
        const isAllowed =
          (isDrawPile || isDiscardPile) &&
          sourceCard &&
          sourcePileIndex !== get().lastPlayedPileIndex
        if (isAllowed) {
          set({ turnPhase: 0 })
          drawIntoHand(playerHandPile, sourceCard, nextPlayerIndex, get, set)
          const { mode } = useMultiplayerStore.getState()
          if (mode === 'multiplayer') {
            useMultiplayerStore
              .getState()
              .sendMove({ phase: 'draw', sourcePileIndex })
          } else {
            aiTurnTimeout = setTimeout(
              () => aiTakeTurn(get, set),
              CARD_TRANSITION_DURATION,
            )
          }
        }
        return
      }

      const clickedCard = getCardFromPoint(clientX, clientY, cards)
      const s = NUM_SUITS
      const isDiscardCard =
        clickedCard &&
        clickedCard.pileIndex >= 2 + s &&
        clickedCard.pileIndex < 2 + s + NUM_DISCARD_PILES
      const pickableCard =
        clickedCard &&
        isCardPickable(clickedCard, localPlayerIndex) &&
        !(turnPhase === 0 && isDiscardCard)
          ? clickedCard
          : undefined

      const isDoubleClick =
        pickableCard?.id != null &&
        pickableCard.id === lastClickedCardId &&
        Date.now() - cursorDownAt < 350

      if (isDoubleClick && pickableCard) {
        lastDoubleClickAt = Date.now()
        // moveCard(pickableCard, pileIndex, 0, get, set);
        // return;
      }

      if (activeCard) {
        const targetPileIndex = getPileAtPoint(clientX, clientY, cards)
        moveCard(activeCard, targetPileIndex, localPlayerIndex, get, set)
      }

      if (pickableCard) {
        set({ activeCard: activeCard ? null : pickableCard })
      }

      cursorDownPos = { x: clientX, y: clientY }
      cursorDownAt = Date.now()
      lastClickedCardId = pickableCard?.id ?? null
      if (pickableCard) {
        const { x: cardX, y: cardY } = getCardPilePosition(
          pickableCard,
          localPlayerIndex,
        )
        cursorDelta = { x: clientX - cardX, y: clientY - cardY }
        set({ cursorState: { mouseX: cardX, mouseY: cardY, pressed: true } })
      }
    },
    onMouseUp: ({ clientX, clientY }: MouseParams) => {
      const localPlayerIndex = get().localPlayerIndex
      if (get().currentPlayerIndex !== localPlayerIndex) return
      const { activeCard, cards } = get()
      const posDiff =
        Math.abs(cursorDownPos.x - clientX) +
        Math.abs(cursorDownPos.y - clientY)
      const timeDiff = Date.now() - cursorDownAt

      if (
        activeCard &&
        (posDiff > 5 || timeDiff > 300) &&
        Date.now() - lastDoubleClickAt > 300
      ) {
        const { width, height } = getPileSize()
        const x = clientX + (width / 2 - cursorDelta.x)
        const y = clientY + (height / 2 - cursorDelta.y)
        const targetPileIndex = getPileAtPoint(x, y, cards)
        moveCard(activeCard, targetPileIndex, localPlayerIndex, get, set)
      }

      cursorDownPos = { x: 0, y: 0 }
      cursorDelta = { x: 0, y: 0 }
      set({ cursorState: { ...get().cursorState, pressed: false } })
    },
    onMouseMove: ({ clientX, clientY }: MouseParams) => {
      const mouseX = clientX - cursorDelta.x
      const mouseY = clientY - cursorDelta.y
      set({ cursorState: { ...get().cursorState, mouseX, mouseY } })
    },
    openInstructions: () => {
      localStorage.setItem('hasSeenInstructions', 'true')
      set({ showInstructionsModal: true })
    },
    closeInstructions: () => set({ showInstructionsModal: false }),
  }
})

function initializeGameState(): Omit<GameState, 'cards'> {
  return {
    activeCard: null,
    cursorState: { mouseX: 0, mouseY: 0, pressed: false },
    dealPhase: 0,
    currentPlayerIndex: 0,
    localPlayerIndex: 0,
    turnPhase: 0,
    lastPlayedPileIndex: null,
    turnsUntilEnd: null,
    gameOver: false,
    showInstructionsModal: false,
  }
}

function generateCards(seedInput?: number): {
  cards: CardType[]
  seed: number
} {
  const seed = seedInput ?? Date.now()
  const shuffledCards = seededShuffle(CARDS, seed)
  const dealtCards = shuffledCards.slice(30)
  // const dealtCards = shuffledCards.slice(82)
  const handCardCount = HAND_SIZE * 2
  const playerHandPile = NUM_SUITS * 2 + NUM_DISCARD_PILES + 2
  const cards = dealtCards.map((n, i) => {
    const id = i
    if (i < handCardCount) {
      const pileIndex = i % 2 === 0 ? playerHandPile : 1
      const cardPileIndex = Math.floor(i / 2)
      return { ...n, id, pileIndex, cardPileIndex }
    }
    return { ...n, id, pileIndex: 0, cardPileIndex: i - handCardCount }
  })

  return { cards, seed }
}

const getPileAtPoint = (x: number, y: number, cards: CardType[]) =>
  getCardFromPoint(x, y, cards)?.pileIndex ?? getPileFromPoint(x, y)

const advanceTurnNoDraw = (
  playerIndex: 0 | 1,
  get: () => GameStore,
  set: (state: Partial<GameStore>) => void,
) => {
  const nextPlayerIndex: 0 | 1 = playerIndex === 0 ? 1 : 0
  const prev = get().turnsUntilEnd
  const turnsUntilEnd = prev !== null ? prev - 1 : null
  const gameOver = turnsUntilEnd === 0
  set({
    currentPlayerIndex: nextPlayerIndex,
    turnPhase: 0,
    lastPlayedPileIndex: null,
    turnsUntilEnd,
    gameOver,
  })
  if (gameOver) recordMultiplayerResult(get)
  const { localPlayerIndex } = get()
  if (
    !gameOver &&
    nextPlayerIndex === localPlayerIndex &&
    useMultiplayerStore.getState().mode === 'multiplayer'
  ) {
    navigator.vibrate?.(60)
  }
}

const moveCard = (
  activeCard: CardType | null,
  pileIndex: number,
  playerIndex: 0 | 1,
  get: () => GameStore,
  set: (state: Partial<GameStore>) => void,
  isRemote = false,
) => {
  const { cards } = get()
  if (!activeCard || pileIndex === -1) return set({ cards, activeCard: null })

  const s = NUM_SUITS
  const d = NUM_DISCARD_PILES
  const handPile = playerIndex === 0 ? 2 + s * 2 + d : 1
  const ownTableauStart = playerIndex === 0 ? 2 + s + d : 2
  const ownTableauEnd = ownTableauStart + s - 1 // inclusive

  const cardsInTargetPile = getCardPile(pileIndex, cards)
  const targetCard = cardsInTargetPile.at(-1) ?? null

  const pile = document.querySelector(
    `.pile[data-pileindex="${pileIndex}"]`,
  ) as HTMLDivElement | null
  const pileType = pile?.dataset.piletype || 'tableau'

  const isOwnTableau =
    pileType === 'tableau' &&
    pileIndex >= ownTableauStart &&
    pileIndex <= ownTableauEnd

  // Neutral cards can be played into any tableau pile (own or opponent's not applicable —
  // they still go to own tableau, but not restricted to suit. isValidPlay handles rank check.)
  const isNeutral = activeCard.suit === NEUTRAL_SUIT
  // Prevent starting a second pile for the same suit
  const suitAlreadyHasPile =
    !isNeutral &&
    cardsInTargetPile.length === 0 &&
    cards.some(
      (c) =>
        c.pileIndex >= ownTableauStart &&
        c.pileIndex <= ownTableauEnd &&
        c.pileIndex !== pileIndex &&
        c.suit === activeCard.suit,
    )
  const isValidTableau =
    pileType === 'tableau' &&
    !suitAlreadyHasPile &&
    (isNeutral
      ? pileIndex >= ownTableauStart && pileIndex <= ownTableauEnd
      : isOwnTableau) &&
    isValidPlay(cardsInTargetPile, activeCard)

  const isValid =
    pileType !== 'hand' && (pileType === 'discard' || isValidTableau)

  if (!isValid) return set({ cards, activeCard: null })

  // Move played card to target pile
  set({
    activeCard: null,
    lastPlayedPileIndex: pileType === 'discard' ? pileIndex : null,
    cards: cards.map((card) => {
      if (activeCard.id === card.id) {
        return {
          ...card,
          pileIndex: pileIndex,
          cardPileIndex: targetCard ? targetCard.cardPileIndex + 1 : 0,
        }
      }
      return card
    }),
  })

  if (activeCard.pileIndex === handPile) {
    // Send move to peer in multiplayer (only for local moves)
    if (!isRemote) {
      const { mode, sendMove } = useMultiplayerStore.getState()
      if (mode === 'multiplayer') {
        sendMove({
          phase: 'play',
          cardId: activeCard.id,
          targetPileIndex: pileIndex,
        })
      }
    }
    // Both player and AI must choose a pile to draw from.
    // For remote moves, the draw message will arrive separately and drawIntoHand
    // handles the transition — no need to set turnPhase: 1 here.
    if (!isRemote) {
      setTimeout(() => {
        const { turnsUntilEnd } = get()
        if (turnsUntilEnd !== null && turnsUntilEnd <= 4) {
          advanceTurnNoDraw(playerIndex, get, set)
          if (!get().gameOver && playerIndex === 0) {
            const { mode } = useMultiplayerStore.getState()
            if (mode === 'ai') {
              aiTurnTimeout = setTimeout(
                () => aiTakeTurn(get, set),
                CARD_TRANSITION_DURATION,
              )
            }
          }
        } else {
          set({ turnPhase: 1 })
          if (playerIndex === 1) {
            const { mode } = useMultiplayerStore.getState()
            if (mode === 'ai') {
              aiTurnTimeout = setTimeout(
                () => aiTakeTurn(get, set),
                CARD_TRANSITION_DURATION,
              )
            }
          }
        }
      }, CARD_TRANSITION_DURATION)
    }
  }
}

const aiTakeTurn = (
  get: () => GameStore,
  set: (state: Partial<GameStore>) => void,
) => {
  const { cards, turnPhase, gameOver } = get()
  if (gameOver) return
  if (useMultiplayerStore.getState().mode === 'multiplayer') return
  const s = NUM_SUITS
  const opponentHandPile = 1

  if (turnPhase === 0) {
    // Play phase: move a random hand card to a random discard pile
    const discardPileIndices = Array.from(
      { length: NUM_DISCARD_PILES },
      (_, i) => 2 + s + i,
    )
    const handCards = getCardPile(opponentHandPile, cards)
    if (handCards.length === 0) return
    const randomCard = handCards[Math.floor(Math.random() * handCards.length)]
    const randomDiscardPile =
      discardPileIndices[Math.floor(Math.random() * discardPileIndices.length)]
    moveCard(randomCard, randomDiscardPile, 1, get, set)
  } else {
    // Draw phase: randomly pick a non-empty source pile (deck or discard, excluding just-played pile)
    const discardPileIndices = Array.from(
      { length: NUM_DISCARD_PILES },
      (_, i) => 2 + s + i,
    )
    const nonEmptyDiscards = discardPileIndices.filter(
      (i) =>
        getCardPile(i, cards).length > 0 && i !== get().lastPlayedPileIndex,
    )
    const deckCard = getCardPile(0, cards).at(-1)
    const drawOptions = [...(deckCard ? [0] : []), ...nonEmptyDiscards]
    const sourcePileIndex =
      drawOptions[Math.floor(Math.random() * drawOptions.length)]
    const sourceCard = getCardPile(sourcePileIndex, cards).at(-1)
    if (sourceCard) {
      set({ turnPhase: 0 })
      drawIntoHand(opponentHandPile, sourceCard, 0, get, set)
    }
  }
}

const drawIntoHand = (
  handPileIndex: number,
  deckTopCard: CardType,
  nextPlayerIndex: 0 | 1,
  get: () => GameStore,
  set: (state: Partial<GameStore>) => void,
) => {
  const current = get().cards
  const handCards = getCardPile(handPileIndex, current)
  const merged = [...handCards, deckTopCard].sort((a, b) =>
    a.suit !== b.suit ? a.suit - b.suit : a.rank - b.rank,
  )
  const updatedCards = current.map((card) => {
    const newIdx = merged.findIndex((c) => c.id === card.id)
    if (newIdx === -1) return card
    return { ...card, pileIndex: handPileIndex, cardPileIndex: newIdx }
  })

  const drewFromDeck = deckTopCard.pileIndex === 0
  const deckNowEmpty = getCardPile(0, updatedCards).length === 0
  const prevTurnsUntilEnd = get().turnsUntilEnd
  let turnsUntilEnd: number | null = prevTurnsUntilEnd
  if (drewFromDeck && deckNowEmpty && turnsUntilEnd === null) {
    turnsUntilEnd = 4
  } else if (turnsUntilEnd !== null) {
    turnsUntilEnd = turnsUntilEnd - 1
  }
  const gameOver = turnsUntilEnd === 0

  set({
    currentPlayerIndex: nextPlayerIndex,
    turnPhase: 0,
    lastPlayedPileIndex: null,
    turnsUntilEnd,
    gameOver,
    cards: updatedCards,
  })
  if (gameOver) recordMultiplayerResult(get)
}

const PILE_SCORE = [0, -4, -3, -2, 1, 2, 3, 6, 7, 10]

const recordMultiplayerResult = (get: () => GameStore) => {
  const { recordResult } = useMultiplayerStore.getState()
  const { cards, localPlayerIndex } = get()
  const myScore = getScore(localPlayerIndex, cards)
  const opponentScore = getScore(localPlayerIndex === 0 ? 1 : 0, cards)
  if (myScore !== opponentScore) recordResult(myScore > opponentScore)
}

const getPileScore = (length: number): number =>
  PILE_SCORE[Math.min(length, PILE_SCORE.length - 1)]

export const getScore = (playerIndex: 0 | 1, cards: CardType[]): number => {
  const s = NUM_SUITS
  const tableauStart = playerIndex === 0 ? 2 + s + NUM_DISCARD_PILES : 2
  return Array.from({ length: s }, (_, i) =>
    getPileScore(getCardPile(tableauStart + i, cards).length),
  ).reduce((a, b) => a + b, 0)
}

export const getScoreBreakdown = (
  playerIndex: 0 | 1,
  cards: CardType[],
): { suit: Suit; size: number; points: number }[] => {
  const s = NUM_SUITS
  const tableauStart = playerIndex === 0 ? 2 + s + NUM_DISCARD_PILES : 2
  const piles = Array.from({ length: s }, (_, i) =>
    getCardPile(tableauStart + i, cards),
  )
  return Array.from({ length: s }, (_, i) => {
    const size = piles.find((p) => p[0]?.suit === i)?.length || 0
    return { suit: i as Suit, size, points: getPileScore(size) }
  })
}

const getCardFromPoint = (x: number, y: number, cards: CardType[]) => {
  const elementUnder = document.elementFromPoint(x, y) as HTMLDivElement

  if (elementUnder?.dataset.id) {
    return cards[+elementUnder.dataset.id]
  }

  return undefined
}

const getPileFromPoint = (x: number, y: number) => {
  const elementUnder = document.elementFromPoint(x, y) as HTMLDivElement

  return +(elementUnder?.dataset.pileindex || '-1')
}

const isValidPlay = (pile: CardType[], card: CardType): boolean => {
  const topCard = pile.at(-1)
  const pileHasEndCard = pile.some((c) => c.rank === END_CARD_RANK)
  // Once an end card is in the pile, only end cards can be played
  if (pileHasEndCard) return card.rank === END_CARD_RANK
  // End cards can always be played into a pile that has no end card yet
  if (card.rank === END_CARD_RANK) return true
  // Neutral cards: can only be played where the top card has the same rank
  if (card.suit === NEUTRAL_SUIT)
    return topCard !== undefined && card.rank === topCard.rank
  if (!topCard) return true
  if (card.rank === topCard.rank) return true
  const direction = getPileDirection(pile)
  if (direction === null) return true
  if (direction === 'asc') return card.rank > topCard.rank
  return card.rank < topCard.rank
}

const getPileDirection = (pile: CardType[]): 'asc' | 'desc' | null => {
  for (let i = 0; i < pile.length - 1; i++) {
    if (pile[i].rank < pile[i + 1].rank) return 'asc'
    if (pile[i].rank > pile[i + 1].rank) return 'desc'
  }
  return null
}

const sortHandCards = (cards: CardType[]): CardType[] => {
  let result = cards
  const handPileIndices = [1, 2 + NUM_SUITS * 2 + NUM_DISCARD_PILES]
  for (const handPileIndex of handPileIndices) {
    const handCards = getCardPile(handPileIndex, result)
    const sorted = [...handCards].sort((a, b) =>
      a.suit !== b.suit ? a.suit - b.suit : a.rank - b.rank,
    )
    result = result.map((card) => {
      const sortedIndex = sorted.findIndex((c) => c.id === card.id)
      if (sortedIndex === -1) return card
      return { ...card, cardPileIndex: sortedIndex }
    })
  }
  return result
}

const getCardPile = (pileIndex: number, cards: CardType[]) => {
  const pile = cards.filter((c) => c.pileIndex === pileIndex)
  return pile.sort((a, b) => a.cardPileIndex - b.cardPileIndex)
}

// Piles the local player can pick cards from.
// localPlayerIndex=0: own hand=17, can pick 17 + discard(7-11)
// localPlayerIndex=1: own hand=1,  can pick 1  + discard(7-11)
const isCardPickable = (card: CardType, localPlayerIndex: 0 | 1): boolean => {
  const s = NUM_SUITS
  const d = NUM_DISCARD_PILES
  if (card.pileIndex === 0) return false // deck
  if (localPlayerIndex === 0) {
    if (card.pileIndex === 1) return false // opponent hand
    if (card.pileIndex >= 2 && card.pileIndex < 2 + s) return false // opponent tableau
    if (card.pileIndex >= 2 + s + d && card.pileIndex < 2 + s * 2 + d)
      return false // own played tableau
  } else {
    if (card.pileIndex === 2 + s * 2 + d) return false // opponent hand
    if (card.pileIndex >= 2 + s + d && card.pileIndex < 2 + s * 2 + d)
      return false // opponent tableau
    if (card.pileIndex >= 2 && card.pileIndex < 2 + s) return false // own played tableau
  }
  return true
}

// Wire multiplayer callbacks after both stores are initialised
setOnRemoteMove((move) => useGameStore.getState().applyRemoteMove(move))
setOnGameStart((seed, localPlayerIndex) =>
  useGameStore.getState().startMultiplayerGame(seed, localPlayerIndex),
)
