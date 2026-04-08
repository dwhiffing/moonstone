import { type MouseEvent, useState } from 'react'
import { useGameStore } from '../utils/gameStore'
import { Modal } from './Modal'

const ScoringTable = ({
  allowZero,
  scores,
  topRowLabel,
  bottomRowLabel,
}: {
  allowZero?: boolean
  scores: number[]
  topRowLabel?: string
  bottomRowLabel?: string
}) => {
  const showRowLabels = Boolean(topRowLabel || bottomRowLabel)

  return (
    <div
      className={`rounded border border-white/20 overflow-hidden text-sm lg:text-base ${showRowLabels ? 'grid grid-cols-[auto_1fr]' : ''}`}>
      {showRowLabels ? (
        <>
          <div className="w-30 px-3 py-1 bg-white/5 border-r border-white/20 font-semibold">
            {topRowLabel ?? ''}
          </div>
          <div
            className="grid bg-white/5"
            style={{
              gridTemplateColumns: `repeat(${scores.length}, minmax(0, 1fr))`,
            }}>
            {scores.map((_score, index) => (
              <div
                key={`top-${index}`}
                className={`px-2 py-1 font-black text-center border-white/20 ${index === scores.length - 1 ? '' : 'border-r'}`}>
                {index + (allowZero ? 0 : 1)}
                {index === scores.length - 1 ? '+' : ''}
              </div>
            ))}
          </div>
          <div className="w-30 px-3 py-1 border-r border-t border-white/20 font-semibold">
            {bottomRowLabel ?? ''}
          </div>
          <div
            className="grid border-t border-white/20 font-semibold"
            style={{
              gridTemplateColumns: `repeat(${scores.length}, minmax(0, 1fr))`,
            }}>
            {scores.map((score, index) => (
              <div
                key={`bottom-${index}`}
                className={`px-2 py-1 font-black text-center border-white/20 ${index === scores.length - 1 ? '' : 'border-r'} ${score <= 0 ? 'text-red-300' : ''}`}>
                {score}
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <div
            className="grid bg-white/5"
            style={{
              gridTemplateColumns: `repeat(${scores.length}, minmax(0, 1fr))`,
            }}>
            {scores.map((_score, index) => (
              <div
                key={`top-${index}`}
                className={`px-2 py-1 text-center border-white/20 ${index === scores.length - 1 ? '' : 'border-r'}`}>
                {index + (allowZero ? 0 : 1)}
                {index === scores.length - 1 ? '+' : ''}
              </div>
            ))}
          </div>
          <div
            className="grid border-t border-white/20 font-semibold"
            style={{
              gridTemplateColumns: `repeat(${scores.length}, minmax(0, 1fr))`,
            }}>
            {scores.map((score, index) => (
              <div
                key={`bottom-${index}`}
                className={`px-2 py-1 text-center border-white/20 ${index === scores.length - 1 ? '' : 'border-r'}`}>
                {score}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

const INSTRUCTION_PAGES = [
  {
    title: 'Welcome to Moonstone!',
    content: (
      <>
        <div className="flex flex-col gap-4">
          <p>
            Your goal is to make <b>suited ordered piles</b> to gain points. Use{' '}
            <b>pairs</b> to claim <b>moonstones</b> for bonus points.
          </p>
          <p>
            On your turn, <b>play a card</b>, then <b>draw a card</b>.
          </p>
          <p>
            The game ends when the <b>deck is empty</b>, each player plays{' '}
            <b>2 final cards</b>.
          </p>
        </div>
      </>
    ),
  },
  {
    title: 'Play a card',
    content: (
      <>
        <div className="flex flex-col gap-2">
          <p>
            Either play a card in one of the <b>5 tableau piles</b> in front of
            you:
          </p>
          <ul>
            <li>
              It must be <b>one suit</b> and either <b>ascend</b> or{' '}
              <b>descend</b>.
            </li>
            <li className="font-bold">
              <span className="font-normal">Eg,</span> 3
              <span className="text-[#6ad195]">♠</span>, 4
              <span className="text-[#6ad195]">♠</span>, 6
              <span className="text-[#6ad195]">♠</span>, 6
              <span className="text-[#6ad195]">♠</span>, 7
              <span className="text-[#6ad195]">♠</span>
            </li>
            <li className="font-bold">
              <span className="font-normal">Or,</span> 10
              <span className="text-[#6ad195]">♠</span>, 9
              <span className="text-[#6ad195]">♠</span>, 7
              <span className="text-[#6ad195]">♠</span>, 7
              <span className="text-[#6ad195]">♠</span>, 6
              <span className="text-[#6ad195]">♠</span>
            </li>
          </ul>
          <p>
            Or play on one of <b>4 discard piles</b> next to the deck.
          </p>
        </div>
        <div className="flex flex-col gap-1 mt-3 md:mt-5">
          <h2 className="text-2xl font-bold mb-1">Draw a card</h2>
          <p>
            Draw from the <b>deck</b>, or draw from a <b>discard pile</b>. You
            cannot draw a card you <b>discarded this turn</b>.
          </p>
        </div>
      </>
    ),
  },
  {
    title: 'Wild cards',
    content: (
      <>
        <p>
          <b>Black cards</b> are <b>wild</b>, playable in <b>any pile</b> on a
          card of <b>equal rank</b>.
        </p>
        <ul>
          <li className="font-bold">
            <span className="font-normal">Eg,</span> 10
            <span className="text-[#6ad195]">♠</span>, 9
            <span className="text-[#6ad195]">♠</span>, 6
            <span className="text-[#6ad195]">♠</span>, 6
            <span className="text-[#222] leading-0 text-3xl relative top-[2.5px]">
              ●
            </span>
            , 4<span className="text-[#6ad195]">♠</span>
          </li>
        </ul>
        <div>
          <h2 className="text-2xl font-bold mt-3 md:mt-5 mb-1">End cards</h2>
          <p>
            <b>End cards</b> are <b>rank X</b>. Only <b>another end card</b> can
            be played on top.
          </p>
          <ul>
            <li className="font-bold">
              <span className="font-normal">Eg,</span> 9
              <span className="text-[#6ad195]">♠</span>, 6
              <span className="text-[#6ad195]">♠</span>, 5
              <span className="text-[#6ad195]">♠</span>, X
              <span className="text-[#6ad195]">♠</span>, X
              <span className="text-[#6ad195]">♠</span>
            </li>
          </ul>
        </div>

        <div className="flex flex-col mt-3 md:mt-5">
          <h2 className="text-2xl font-bold mb-1">Moonstones</h2>
          <p>
            If you have <b>2 cards</b> of <b>equal rank</b>, claim a moonstone
            by <b>tapping it</b>.
          </p>
          <p>
            Then <b>discard both cards</b> and <b>draw 2 new cards</b>.
          </p>
        </div>
      </>
    ),
  },
  {
    title: 'Deck composition',
    content: (
      <div className="flex flex-col gap-4">
        <div>
          <p>
            There are <b>5 suits</b> with <b>18 cards</b> each:
          </p>
          <ul>
            <li>
              <b>One</b> each of <b>0,1,2</b> and <b>8,9,10</b>
            </li>
            <li>
              <b>Two</b> each of <b>3,4,5,6,7</b>
            </li>
            <li>
              <b>Two</b> each of special <b>end cards</b>.
            </li>
          </ul>
        </div>
        <p>
          Also, there are <b>11 wild cards</b> ranked <b>0-10</b>.
        </p>
        <p>
          <b>30</b> of the <b>101</b> cards are removed before dealing{' '}
          <b>8 cards</b> to each player
        </p>
      </div>
    ),
  },
  {
    title: 'Scoring',
    content: (
      <div className="flex flex-col gap-3">
        <p>
          Short piles{' '}
          <b>
            <i>lose points</i>
          </b>
          . You need <b>at least 4</b> cards to gain points.
        </p>
        <h2 className="font-bold text-2xl -mb-1">Piles</h2>
        <ScoringTable
          topRowLabel="# of Cards"
          bottomRowLabel="Points"
          scores={[-4, -3, -2, 1, 2, 3, 6, 7, 10]}
        />
        <h2 className="font-bold text-2xl -mb-1">Moonstones</h2>
        <ScoringTable
          allowZero
          topRowLabel="# of Stones"
          bottomRowLabel="Points"
          scores={[-4, -1, 0, 4, 6, 10]}
        />
      </div>
    ),
  },
]

export const InstructionsModal = () => {
  const [currentPage, setCurrentPage] = useState(0)
  const showInstructionsModal = useGameStore(
    (state) => state.showInstructionsModal,
  )
  const closeInstructions = useGameStore((state) => state.closeInstructions)

  const handleNext = () => {
    if (currentPage < INSTRUCTION_PAGES.length - 1) {
      setCurrentPage(currentPage + 1)
    } else {
      closeInstructions()
    }
  }

  const handlePrev = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1)
    }
  }

  const handleClose = () => {
    closeInstructions()
  }

  const handleModalClick = (e: MouseEvent<HTMLDivElement>) => {
    const { left, width } = e.currentTarget.getBoundingClientRect()
    const clickedLeftHalf = e.clientX - left < width / 2

    if (clickedLeftHalf) {
      handlePrev()
      return
    }

    handleNext()
  }

  return (
    <Modal show={showInstructionsModal} onClose={handleClose}>
      <div
        className={`flex flex-col justify-between bg-surface rounded-lg shadow-xl w-[calc(100vw-40px)] min-w-90 max-w-140 p-4 lg:p-6 ${currentPage === 0 ? '' : 'min-h-115'}`}
        onClick={handleModalClick}>
        <div className="flex-1">
          <h2 className="text-2xl font-bold mb-1">
            {INSTRUCTION_PAGES[currentPage].title}
          </h2>
          <div className="text-base lg:text-lg leading-relaxed whitespace-pre-line">
            {INSTRUCTION_PAGES[currentPage].content}
          </div>
        </div>

        <div className="flex items-center justify-between mt-6">
          <button
            className={`button ${currentPage === 0 ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
            onClick={(e) => {
              e.stopPropagation()
              handlePrev()
            }}
            disabled={currentPage === 0}>
            Previous
          </button>

          <div className="flex gap-2">
            {INSTRUCTION_PAGES.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-colors ${index === currentPage ? 'bg-white/90' : 'bg-white/30'}`}
              />
            ))}
          </div>

          <button
            className="button"
            onClick={(e) => {
              e.stopPropagation()
              handleNext()
            }}>
            {currentPage === INSTRUCTION_PAGES.length - 1 ? 'Play' : 'Next'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
