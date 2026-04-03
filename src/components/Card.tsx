import debounce from 'lodash/debounce'
import React, { memo, useEffect, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import {
  getCardPilePosition,
  getPileSize,
  useForceUpdate,
  useWindowEvent,
} from '../utils'
import {
  CARD_TRANSITION_DURATION,
  NEUTRAL_SUIT,
  NUM_DISCARD_PILES,
  NUM_SUITS,
  SUIT_COLORS,
  SUIT_NAMES,
} from '../utils/constants'
import { type GameState, useGameStore } from '../utils/gameStore'
import {
  CardBackSVG,
  CircleSVG,
  FireSVG,
  LeafSVG,
  MoonSVG,
  StarSVG,
  WaterSVG,
} from './svg'

const Card = ({ cardId }: { cardId: number }) => {
  const store = useGameStore(useShallow(getShallowCardState(cardId)))
  const [isActive, setIsActive] = useState(false)
  const [zIndex, setZIndex] = useState(store.zIndex)
  const [hasMounted, setHasMounted] = useState(false)
  useWindowEvent('resize', debounce(useForceUpdate(), 100))
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setHasMounted(true), [])

  // delay changes to zIndex until after transition completes
  useEffect(() => {
    const timeout = setTimeout(() => {
      setIsActive(store.isActive)
      setZIndex(store.zIndex)
    }, CARD_TRANSITION_DURATION / 2)
    return () => clearTimeout(timeout)
  }, [isActive, store.zIndex, store.isActive])

  if (!hasMounted) return null

  const translate = `${store.x}px ${store.y}px 0`
  const boxShadow =
    (!store.isFaceDown && store.pileType !== 'discard') ||
    store.cardPileIndex === 0
      ? '0 0 5px rgba(0, 0, 0, 0.25)'
      : 'none'
  const transitionTimingFunction = 'cubic-bezier(0.4, 0, 0.6, 1)'
  const transitionProperty = 'translate, rotate, scale, opacity, box-shadow'
  const delay = store.transitionDelay
  const dur = hasMounted ? CARD_TRANSITION_DURATION : 0
  const rotateDelay = store.isActive ? CARD_TRANSITION_DURATION : delay
  const translateDur = store.isActive ? 0 : dur
  const transitionDuration = `${translateDur}ms, ${dur}ms, ${dur}ms, ${dur}ms, ${dur}ms`
  const transitionDelay = `${delay}ms, ${rotateDelay}ms, ${delay}ms, ${delay}ms, ${delay}ms`

  return (
    <div
      data-id={store.opacity === 1 ? cardId : undefined}
      className={`card ${store.isFaceDown ? 'face-down' : ''} ${store.isDragging || store.opacity === 0 ? 'active' : 'inactive'}`}
      style={{
        zIndex,
        scale: store.scale,
        rotate: `${store.rotate}deg`,
        transitionProperty,
        transitionDuration,
        transitionTimingFunction,
        transitionDelay,
        translate,
        boxShadow,
        willChange: 'transform',
        opacity: store.opacity,
      }}>
      <CardFront suit={store.suit} rank={store.rank} />
      <div className="card-back" style={{ transitionDelay }}>
        <CardBackSVG />
      </div>

      <div
        className="card-disabled-overlay"
        style={{ opacity: store.disabled ? 1 : 0 }}
      />
    </div>
  )
}

const getShallowCardState =
  (cardId: number) =>
  (state: GameState): CardShallowState => {
    const card = state.cards[cardId]

    const { cardPileIndex, pileIndex, suit, rank } = card
    const { mouseX, mouseY, pressed } = state.cursorState
    const {
      x: xPos,
      y: yPos,
      pileType,
      rotate: rotatePos,
    } = getCardPilePosition(card, state.localPlayerIndex)
    const { width, height } = getPileSize()
    const isActive = cardId === state.activeCard?.id
    const isShuffling = state.dealPhase === 0
    const isInDeck = pileIndex === 0
    const opponentHandPile =
      state.localPlayerIndex === 0 ? 1 : NUM_SUITS * 2 + NUM_DISCARD_PILES + 2
    const isFaceDown = isInDeck || pileIndex === opponentHandPile || isShuffling
    const isDragging = isActive && pressed

    const deckX = window.innerWidth / 2 - width / 2
    const deckY = window.innerHeight / 2 - height / 2

    const x = isShuffling ? deckX : isDragging ? mouseX : xPos
    let y = isShuffling ? deckY : isDragging ? mouseY : yPos

    const isOwnHand = pileType === 'hand' && pileIndex !== opponentHandPile
    const isOurTurn = state.currentPlayerIndex === state.localPlayerIndex
    if (!isShuffling && isOwnHand && isOurTurn) y -= width * 0.8
    const scale = isShuffling
      ? 1
      : (isActive ? 1.15 : 1) * (isOwnHand ? 1.8 : 1)
    const rotate = isDragging || isShuffling ? 0 : rotatePos
    const zIndex = cardPileIndex + (pileType === 'hand' ? 9000 : 0)

    return {
      x,
      y,
      scale,
      rotate,
      isActive,
      isDragging,
      pileType,
      isFaceDown,
      opacity: 1,
      disabled:
        isOurTurn &&
        isOwnHand &&
        (state.turnPhase === 1 ||
          (state.stoneClaim !== null && card.rank !== state.stoneClaim.rank)),
      cardPileIndex,
      zIndex,
      suit,
      rank,
      transitionDelay:
        state.dealPhase === 1 ? card.id * (CARD_TRANSITION_DURATION / 5) : 0,
    }
  }

export default memo(Card)

const _CardFront = ({ suit, rank }: { suit: Suit; rank: Rank }) => {
  const isNeutral = suit === NEUTRAL_SUIT
  const color = isNeutral ? '#2c3e50' : SUIT_COLORS[suit]
  const suitName = isNeutral ? 'neutral' : SUIT_NAMES[suit]
  const rankLabel = rank === 11 ? 'X' : rank

  return (
    <div className="card-front" style={{ color }}>
      <div className={`${suitName} corner-rank tl`}>
        <div className={`rank ${rank === 10 ? 'rank-10' : ''}`}>
          <span>{rankLabel}</span>
        </div>
        <Suit suit={suit} />
      </div>
      <div className={`${suitName} corner-rank br`}>
        <div className={`rank ${rank === 10 ? 'rank-10' : ''}`}>
          <span>{rankLabel}</span>
        </div>
        <Suit suit={suit} />
      </div>

      <div className="center-suit">
        <Suit suit={suit} />
      </div>
    </div>
  )
}

const CardFront = React.memo(_CardFront)

const Suit = React.memo(({ suit }: { suit: Suit }) => {
  if (suit === 0) return <FireSVG />
  if (suit === 1) return <WaterSVG />
  if (suit === 2) return <LeafSVG />
  if (suit === 3) return <MoonSVG />
  if (suit === 4) return <StarSVG />
  if (suit === 5) return <CircleSVG />
  return null
})
