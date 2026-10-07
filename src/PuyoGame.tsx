import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  PUYO_COLORS, PUYO_VISIBLE_ROWS, advancePuyoPhase, createInitialPuyoState, movePuyo, pairCells,
  rotatePuyo, softDropPuyo, tickPuyo, type Pair, type PuyoColor, type PuyoState,
} from './puyo'

type Timers = { delay?: number; repeat?: number }

function PairPreview({ pair }: { pair: Pair }) {
  return (
    <div className="puyo-pair-preview" aria-label={`${pair.axis}と${pair.child}の組ぷよ`}>
      <i className={`puyo-dot ${pair.child}`} style={{ '--puyo-color': PUYO_COLORS[pair.child] } as React.CSSProperties} />
      <i className={`puyo-dot ${pair.axis}`} style={{ '--puyo-color': PUYO_COLORS[pair.axis] } as React.CSSProperties} />
    </div>
  )
}

function PuyoGame() {
  const [game, setGame] = useState<PuyoState>(() => createInitialPuyoState())
  const timers = useRef<Record<string, Timers>>({})
  const held = useRef<Set<string>>(new Set())

  const retry = useCallback(() => setGame(createInitialPuyoState()), [])
  const move = useCallback((direction: -1 | 1) => setGame((state) => movePuyo(state, direction, performance.now())), [])
  const rotate = useCallback((direction: -1 | 1) => setGame((state) => rotatePuyo(state, direction, performance.now())), [])
  const soft = useCallback(() => setGame((state) => softDropPuyo(state, performance.now())), [])
  const pause = useCallback(() => setGame((state) => {
    if (state.status !== 'playing' && state.status !== 'paused') return state
    const now = performance.now()
    return { ...state, status: state.status === 'paused' ? 'playing' : 'paused', lastGravityAt: now, groundedAt: state.groundedAt === null ? null : now }
  }), [])

  useEffect(() => {
    let frame = requestAnimationFrame(function loop(now) {
      setGame((state) => tickPuyo(state, now))
      frame = requestAnimationFrame(loop)
    })
    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    if (game.status !== 'resolving') return
    const timer = window.setTimeout(() => {
      setGame((state) => advancePuyoPhase(state, performance.now()))
    }, game.phaseDuration)
    return () => window.clearTimeout(timer)
  }, [game.chain, game.phase, game.phaseDuration, game.status])

  useEffect(() => {
    const activeTimers = timers.current
    const heldKeys = held.current
    const clear = (code: string) => {
      const current = activeTimers[code]
      if (current?.delay) clearTimeout(current.delay)
      if (current?.repeat) clearInterval(current.repeat)
      delete activeTimers[code]
    }
    const repeat = (code: string, action: () => void, delay = 150, rate = 42) => {
      if (activeTimers[code]) return
      action()
      const current: Timers = {}
      current.delay = window.setTimeout(() => {
        action()
        current.repeat = window.setInterval(action, rate)
      }, delay)
      activeTimers[code] = current
    }
    const horizontal = (code: string) => code === 'KeyA' || code === 'ArrowLeft' || code === 'KeyD' || code === 'ArrowRight'
    const isLeft = (code: string) => code === 'KeyA' || code === 'ArrowLeft'
    const opposites = (code: string) => isLeft(code) ? ['KeyD', 'ArrowRight'] : ['KeyA', 'ArrowLeft']

    const keyDown = (event: KeyboardEvent) => {
      const controlled = horizontal(event.code) || ['KeyS', 'ArrowDown', 'KeyU', 'KeyZ', 'KeyI', 'KeyX', 'ArrowUp', 'Escape', 'KeyR'].includes(event.code)
      if (controlled) event.preventDefault()
      if (event.repeat) return
      if (horizontal(event.code)) {
        heldKeys.add(event.code)
        opposites(event.code).forEach(clear)
        repeat(event.code, () => move(isLeft(event.code) ? -1 : 1))
      } else if (event.code === 'KeyS' || event.code === 'ArrowDown') repeat(event.code, soft, 70, 30)
      else if (event.code === 'KeyU' || event.code === 'KeyZ') rotate(-1)
      else if (event.code === 'KeyI' || event.code === 'KeyX' || event.code === 'ArrowUp') rotate(1)
      else if (event.code === 'Escape') pause()
      else if (event.code === 'KeyR') retry()
    }
    const keyUp = (event: KeyboardEvent) => {
      clear(event.code)
      if (!horizontal(event.code)) return
      heldKeys.delete(event.code)
      const previous = opposites(event.code).find((code) => heldKeys.has(code))
      if (previous) repeat(previous, () => move(isLeft(previous) ? -1 : 1))
    }
    const blur = () => { Object.keys(activeTimers).forEach(clear); heldKeys.clear() }
    window.addEventListener('keydown', keyDown)
    window.addEventListener('keyup', keyUp)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', keyDown)
      window.removeEventListener('keyup', keyUp)
      window.removeEventListener('blur', blur)
      Object.keys(activeTimers).forEach(clear)
      heldKeys.clear()
    }
  }, [move, pause, retry, rotate, soft])

  const display = useMemo(() => {
    const board = game.board.slice(1).map((row) => [...row])
    if (game.status === 'playing' || game.status === 'paused') pairCells(game.active).forEach(({ x, y, color }) => {
      if (y >= 1 && y <= PUYO_VISIBLE_ROWS) board[y - 1][x] = color
    })
    return board
  }, [game])

  const garbageIcons = Math.min(12, game.garbage)

  return (
    <main className="puyo-page">
      <div className="puyo-sky" aria-hidden="true"><i /><i /><i /></div>
      <header className="puyo-header">
        <div><p>TSU RULE / ENDLESS</p><h1>PUYO<span>²</span></h1></div>
        <button onClick={retry}>RETRY <kbd>R</kbd></button>
      </header>

      <section className="puyo-layout" aria-label="ぷよぷよゲーム">
        <aside className="puyo-info">
          <div className="puyo-stat"><span>SCORE</span><strong>{game.score.toString().padStart(8, '0')}</strong></div>
          <div className="puyo-stat chain-stat"><span>CHAIN</span><strong>{game.chain}</strong></div>
          <div className="odata">
            <span>ODATA</span>
            <div>{Array.from({ length: garbageIcons }, (_, index) => <i className="ojama" key={index} />)}{game.garbage > 12 && <b>+{game.garbage - 12}</b>}</div>
          </div>
          <div className="puyo-controls">
            <p><kbd>A</kbd><kbd>D</kbd> MOVE</p>
            <p><kbd>S</kbd> FAST</p>
            <p><kbd>U</kbd><kbd>I</kbd> ROTATE</p>
            <p><kbd>ESC</kbd> PAUSE</p>
          </div>
        </aside>

        <div className="puyo-board-frame">
          <div className="death-marker" aria-hidden="true">×</div>
          <div className="puyo-board" role="grid" aria-label="6列12行のぷよぷよフィールド">
            {display.flatMap((row, y) => row.map((color, x) => {
              const boardKey = `${x},${y + 1}`
              const highlighted = game.highlighted.includes(boardKey)
              const falling = game.phase === 'fall' && Boolean(game.fallDistances[boardKey])
              return (
                <span className="puyo-cell" role="gridcell" key={`${y}-${x}`}>
                  {color && (
                    <i
                      className={`puyo-dot ${color}${highlighted && game.phase === 'highlight' ? ' highlighting' : ''}${highlighted && game.phase === 'vanish' ? ' vanishing' : ''}${falling ? ' falling' : ''}`}
                      style={{ '--puyo-color': PUYO_COLORS[color as PuyoColor], '--fall-rows': game.fallDistances[boardKey] ?? 0, '--fall-duration': `${Math.max(150, (game.fallDistances[boardKey] ?? 0) * 75)}ms` } as React.CSSProperties}
                    />
                  )}
                </span>
              )
            }))}
          </div>
          {game.message && game.status === 'resolving' && game.phase === 'vanish' && <div className="puyo-message" key={game.chain}>{game.message}</div>}
          {(game.status === 'paused' || game.status === 'over') && (
            <div className="puyo-overlay">
              <strong>{game.status === 'over' ? 'GAME OVER' : 'PAUSED'}</strong>
              <button onClick={game.status === 'over' ? retry : pause}>{game.status === 'over' ? 'RETRY' : 'RESUME'}</button>
            </div>
          )}
        </div>

        <aside className="puyo-next">
          <h2>NEXT</h2>
          {game.queue.slice(0, 2).map((pair, index) => (
            <div className="puyo-next-item" key={index}><span>{index ? 'NEXT 2' : 'NEXT'}</span><PairPreview pair={pair} /></div>
          ))}
        </aside>
      </section>

      <section className="puyo-touch" aria-label="ぷよぷよタッチ操作">
        <button onClick={() => move(-1)}>←</button>
        <button onClick={() => rotate(-1)}>↶</button>
        <button onClick={soft}>↓</button>
        <button onClick={() => rotate(1)}>↷</button>
        <button onClick={() => move(1)}>→</button>
      </section>
    </main>
  )
}

export default PuyoGame
