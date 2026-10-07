import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import PuyoGame from './PuyoGame'
import {
  BUFFER_ROWS, COLORS, SHAPES, VISIBLE_ROWS, cellsOf, createInitialState,
  ghostY, hardDrop, holdPiece, moveHorizontal, rotatePiece, softDrop, tick,
  type GameState, type PieceType, type TetrisMode,
} from './game'

type TimerSet = { delay?: number; repeat?: number }
type Action = 'left' | 'right' | 'soft' | 'hard' | 'rotateLeft' | 'rotateRight' | 'hold' | 'pause' | 'retry'
type Bindings = Record<Action, string>

const DEFAULT_BINDINGS: Bindings = {
  left: 'KeyA',
  right: 'KeyD',
  soft: 'KeyS',
  hard: 'Space',
  rotateLeft: 'KeyU',
  rotateRight: 'KeyI',
  hold: 'KeyP',
  pause: 'Escape',
  retry: 'KeyR',
}

const ACTION_LABELS: Record<Action, string> = {
  left: '左移動',
  right: '右移動',
  soft: 'ソフトドロップ',
  hard: 'ハードドロップ',
  rotateLeft: '左回転',
  rotateRight: '右回転',
  hold: 'ホールド',
  pause: '一時停止',
  retry: 'リトライ',
}

const displayKey = (code: string) => {
  if (code === 'Space') return 'SPACE'
  if (code === 'Escape') return 'ESC'
  if (code.startsWith('Key')) return code.slice(3)
  if (code.startsWith('Digit')) return code.slice(5)
  if (code.startsWith('Arrow')) return code.replace('Arrow', '').toUpperCase()
  return code.replace('Left', '').replace('Right', '').toUpperCase()
}

const formatSprintTime = (milliseconds: number) => {
  const total = Math.max(0, Math.floor(milliseconds))
  const minutes = Math.floor(total / 60000)
  const seconds = Math.floor((total % 60000) / 1000)
  const millis = total % 1000
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`
}

const formatMarathonTime = (milliseconds: number) => {
  const totalSeconds = Math.floor(Math.max(0, milliseconds) / 1000)
  return `${String(Math.floor(totalSeconds / 60)).padStart(2, '0')}:${String(totalSeconds % 60).padStart(2, '0')}`
}

function MiniPiece({ type, muted = false }: { type: PieceType | null; muted?: boolean }) {
  const cells = useMemo(() => {
    if (!type) return new Set<string>()
    const shape = SHAPES[type][0]
    const occupied: [number, number][] = []
    shape.forEach((row, y) => row.forEach((value, x) => { if (value) occupied.push([x, y]) }))
    const minX = Math.min(...occupied.map(([x]) => x))
    const maxX = Math.max(...occupied.map(([x]) => x))
    const minY = Math.min(...occupied.map(([, y]) => y))
    const maxY = Math.max(...occupied.map(([, y]) => y))
    const offsetX = Math.floor((4 - (maxX - minX + 1)) / 2) - minX
    const offsetY = Math.floor((3 - (maxY - minY + 1)) / 2) - minY
    return new Set(occupied.map(([x, y]) => `${x + offsetX}-${y + offsetY}`))
  }, [type])

  return (
    <div className={`mini-grid${muted ? ' muted' : ''}`} aria-label={type ? `${type}ミノ` : '空'}>
      {Array.from({ length: 12 }, (_, index) => {
        const x = index % 4
        const y = Math.floor(index / 4)
        const filled = cells.has(`${x}-${y}`)
        return <span className={filled ? 'mini-cell filled' : 'mini-cell'} style={filled && type ? { '--cell-color': COLORS[type] } as React.CSSProperties : undefined} key={index} />
      })}
    </div>
  )
}

function TetrisGame() {
  const [selectedMode, setSelectedMode] = useState<TetrisMode | null>(null)
  const [countdown, setCountdown] = useState<number | 'GO' | null>(null)
  const [game, setGame] = useState<GameState>(() => createInitialState(performance.now(), 'marathon'))
  const [bindings, setBindings] = useState<Bindings>(() => {
    try {
      const saved = localStorage.getItem('tetris-key-bindings')
      return saved ? { ...DEFAULT_BINDINGS, ...JSON.parse(saved) } : DEFAULT_BINDINGS
    } catch {
      return DEFAULT_BINDINGS
    }
  })
  const [configOpen, setConfigOpen] = useState(false)
  const [listeningAction, setListeningAction] = useState<Action | null>(null)
  const inputTimers = useRef<Record<string, TimerSet>>({})
  const heldHorizontal = useRef<Set<string>>(new Set())
  const resumeAfterConfig = useRef(false)

  const startMode = useCallback((mode: TetrisMode) => {
    setSelectedMode(mode)
    setCountdown(3)
    setGame(createInitialState(performance.now(), mode))
  }, [])
  const newGame = useCallback(() => {
    if (selectedMode) startMode(selectedMode)
  }, [selectedMode, startMode])
  const returnToModeSelect = useCallback(() => {
    setGame((state) => ({ ...state, status: 'paused' }))
    setSelectedMode(null)
    setCountdown(null)
  }, [])
  const move = useCallback((direction: -1 | 1) => setGame((state) => moveHorizontal(state, direction, performance.now())), [])
  const rotate = useCallback((direction: -1 | 1) => setGame((state) => rotatePiece(state, direction, performance.now())), [])
  const soft = useCallback(() => setGame((state) => softDrop(state, performance.now())), [])
  const drop = useCallback(() => setGame((state) => hardDrop(state, performance.now())), [])
  const hold = useCallback(() => setGame((state) => holdPiece(state, performance.now())), [])
  const togglePause = useCallback(() => setGame((state) => {
    if (state.status !== 'playing' && state.status !== 'paused') return state
    const now = performance.now()
    if (state.status === 'playing') {
      return { ...state, status: 'paused', elapsed: state.elapsed + Math.max(0, now - state.lastTimerAt), lastTimerAt: now }
    }
    return {
      ...state,
      status: 'playing',
      lastGravityAt: now,
      lastTimerAt: now,
      groundedAt: state.groundedAt === null ? null : now,
    }
  }), [])

  const openConfig = useCallback(() => {
    setGame((state) => {
      resumeAfterConfig.current = state.status === 'playing'
      if (state.status !== 'playing') return state
      const now = performance.now()
      return { ...state, status: 'paused', elapsed: state.elapsed + Math.max(0, now - state.lastTimerAt), lastTimerAt: now }
    })
    setConfigOpen(true)
  }, [])

  const closeConfig = useCallback(() => {
    setConfigOpen(false)
    setListeningAction(null)
    if (resumeAfterConfig.current) {
      const now = performance.now()
      setGame((state) => state.status === 'paused' ? { ...state, status: 'playing', lastGravityAt: now, lastTimerAt: now, groundedAt: state.groundedAt === null ? null : now } : state)
    }
    resumeAfterConfig.current = false
  }, [])

  useEffect(() => {
    localStorage.setItem('tetris-key-bindings', JSON.stringify(bindings))
  }, [bindings])

  useEffect(() => {
    if (!selectedMode) return
    const root = document.documentElement
    root.classList.add('tetris-playing')
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    return () => root.classList.remove('tetris-playing')
  }, [selectedMode])

  useEffect(() => {
    if (game.status !== 'countdown' || !selectedMode) return
    let value = 3
    const interval = window.setInterval(() => {
      value -= 1
      if (value > 0) {
        setCountdown(value)
        return
      }
      window.clearInterval(interval)
      setCountdown('GO')
      const now = performance.now()
      setGame((state) => ({ ...state, status: 'playing', lastGravityAt: now, lastTimerAt: now, elapsed: 0 }))
      window.setTimeout(() => setCountdown(null), 550)
    }, 1000)
    return () => window.clearInterval(interval)
  }, [game.status, selectedMode])

  useEffect(() => {
    let frame = 0
    const loop = (now: number) => {
      setGame((state) => tick(state, now))
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    const activeTimers = inputTimers.current
    const horizontalKeys = heldHorizontal.current
    const clearTimer = (code: string) => {
      const timer = activeTimers[code]
      if (timer?.delay) window.clearTimeout(timer.delay)
      if (timer?.repeat) window.clearInterval(timer.repeat)
      delete activeTimers[code]
    }

    const beginRepeat = (code: string, action: () => void, delay = 160, rate = 40) => {
      if (activeTimers[code]) return
      action()
      const timers: TimerSet = {}
      timers.delay = window.setTimeout(() => {
        action()
        timers.repeat = window.setInterval(action, rate)
      }, delay)
      activeTimers[code] = timers
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (listeningAction) {
        event.preventDefault()
        if (event.code === 'Escape') {
          setListeningAction(null)
          return
        }
        setBindings((current) => {
          const duplicate = (Object.keys(current) as Action[]).find((action) => action !== listeningAction && current[action] === event.code)
          const next = { ...current, [listeningAction]: event.code }
          if (duplicate) next[duplicate] = current[listeningAction]
          return next
        })
        setListeningAction(null)
        return
      }
      if (configOpen) return
      // ゲーム中は未割り当ての矢印キーもブラウザのスクロールに渡さない。
      const browserScrollKeys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space']
      if (Object.values(bindings).includes(event.code) || browserScrollKeys.includes(event.code)) event.preventDefault()
      if (event.repeat) return
      if (event.code === bindings.left || event.code === bindings.right) {
        const isLeft = event.code === bindings.left
        const oppositeCode = isLeft ? bindings.right : bindings.left
        horizontalKeys.add(event.code)
        // SOCDは後入力優先。先に押されていた反対方向のDAS/ARRを停止する。
        clearTimer(oppositeCode)
        beginRepeat(event.code, () => move(isLeft ? -1 : 1))
      }
      else if (event.code === bindings.soft) beginRepeat(event.code, soft, 80, 35)
      else if (event.code === bindings.rotateRight) rotate(1)
      else if (event.code === bindings.rotateLeft) rotate(-1)
      else if (event.code === bindings.hard) drop()
      else if (event.code === bindings.hold) hold()
      else if (event.code === bindings.pause) togglePause()
      else if (event.code === bindings.retry) newGame()
    }
    const onKeyUp = (event: KeyboardEvent) => {
      clearTimer(event.code)
      if (event.code !== bindings.left && event.code !== bindings.right) return
      horizontalKeys.delete(event.code)
      const oppositeCode = event.code === bindings.left ? bindings.right : bindings.left
      if (horizontalKeys.has(oppositeCode)) {
        beginRepeat(oppositeCode, () => move(oppositeCode === bindings.left ? -1 : 1))
      }
    }
    const onBlur = () => {
      Object.keys(activeTimers).forEach(clearTimer)
      horizontalKeys.clear()
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      Object.keys(activeTimers).forEach(clearTimer)
      horizontalKeys.clear()
    }
  }, [bindings, configOpen, drop, hold, listeningAction, move, newGame, rotate, soft, togglePause])

  const display = useMemo(() => {
    const cells = game.board.slice(BUFFER_ROWS).map((row) => row.map((type) => ({ type, ghost: false, active: false })))
    if (game.status !== 'over') {
      const landingY = ghostY(game.board, game.active)
      cellsOf({ ...game.active, y: landingY }).forEach(({ x, y }) => {
        const visibleY = y - BUFFER_ROWS
        if (visibleY >= 0 && visibleY < VISIBLE_ROWS && cells[visibleY][x].type === null) cells[visibleY][x] = { type: game.active.type, ghost: true, active: false }
      })
      cellsOf(game.active).forEach(({ x, y }) => {
        const visibleY = y - BUFFER_ROWS
        if (visibleY >= 0 && visibleY < VISIBLE_ROWS) cells[visibleY][x] = { type: game.active.type, ghost: false, active: true }
      })
    }
    return cells
  }, [game])

  if (!selectedMode) {
    return (
      <main className="tetris-mode-page">
        <section className="tetris-mode-card">
          <p className="mode-kicker">SELECT GAME MODE</p>
          <h1>TETRIS<span>_</span></h1>
          <div className="mode-options">
            <button onClick={() => startMode('sprint')}>
              <span>01</span><strong>40 LINES</strong>
              <small>40ラインを消すまでのタイムアタック</small><i>SPRINT →</i>
            </button>
            <button onClick={() => startMode('marathon')}>
              <span>02</span><strong>MARATHON</strong>
              <small>レベル15・150ラインの持久戦</small><i>150 LINES →</i>
            </button>
          </div>
          <p className="mode-note">モード選択後、3・2・1・GOで計測を開始します。</p>
        </section>
      </main>
    )
  }

  return (
    <main className="game-page">
      <div className="page-grid" aria-hidden="true" />
      <header className="game-header">
        <div className="title-group">
          <span className="title-index">01</span>
          <div><p>GUIDELINE BLOCK GAME</p><h1>TETRIS<span>_</span></h1></div>
        </div>
        <div className="header-actions">
          <button className="key-config-button" onClick={returnToModeSelect}>MODE SELECT</button>
          <button className="key-config-button" onClick={openConfig}>KEY CONFIG</button>
          <button className="new-game top-button" onClick={newGame}>NEW GAME <span>↗</span></button>
        </div>
      </header>

      <section className="game-layout" aria-label="テトリスゲーム">
        <aside className="side-panel left-panel">
          <section className="panel-box hold-box">
            <div className="panel-title"><span>HOLD</span><small>{game.canHold ? 'READY' : 'USED'}</small></div>
            <MiniPiece type={game.hold} muted={!game.canHold} />
            <kbd>{displayKey(bindings.hold)}</kbd>
          </section>
        </aside>

        <div className="board-column">
          <div className="board-frame">
            <div className="board" role="grid" aria-label="10列20行のゲームフィールド">
              {display.flatMap((row, y) => row.map((cell, x) => (
                <span
                  className={`cell${cell.type ? ' filled' : ''}${cell.ghost ? ' ghost' : ''}${cell.active ? ' active-piece' : ''}`}
                  style={cell.type ? { '--cell-color': COLORS[cell.type] } as React.CSSProperties : undefined}
                  role="gridcell"
                  key={`${y}-${x}`}
                />
              )))}
            </div>
            {game.message && game.status === 'playing' && <div className="clear-message">{game.message}</div>}
            {countdown && (game.status === 'countdown' || countdown === 'GO') && (
              <div className="countdown-overlay" key={countdown}><strong>{countdown}</strong></div>
            )}
            {(game.status === 'over' || game.status === 'paused' || game.status === 'cleared') && (
              <div className="overlay">
                <p>{game.status === 'over' ? 'GAME OVER' : game.status === 'cleared' ? 'CLEAR!' : 'PAUSED'}</p>
                <strong>
                  {game.status === 'cleared'
                    ? selectedMode === 'sprint' ? formatSprintTime(game.elapsed) : `${game.lines} LINES`
                    : game.status === 'over' ? game.message : 'BREAK TIME'}
                </strong>
                <button onClick={game.status === 'paused' ? togglePause : newGame}>{game.status === 'paused' ? 'RESUME' : 'PLAY AGAIN'}</button>
              </div>
            )}
          </div>
          <section className="stats" aria-label="ゲーム情報">
            <div className="main-stat">
              <span>TIMER</span>
              <strong>{selectedMode === 'sprint' ? formatSprintTime(game.elapsed) : formatMarathonTime(game.elapsed)}</strong>
            </div>
            <div className="stat-pair">
              {selectedMode === 'sprint' ? (
                <>
                  <div><span>REMAIN</span><strong>{Math.max(0, 40 - game.lines)}</strong></div>
                  <div><span>SCORE</span><strong>{game.score.toString().padStart(6, '0')}</strong></div>
                </>
              ) : (
                <>
                  <div><span>LEVEL</span><strong>{String(game.level).padStart(2, '0')}</strong></div>
                  <div><span>LINES</span><strong>{game.lines} / 150</strong></div>
                </>
              )}
            </div>
            <div className={`b2b ${game.backToBack ? 'active' : ''}`}>
              <i /> {selectedMode === 'marathon' ? `SCORE ${game.score.toString().padStart(7, '0')} · ` : ''}BACK TO BACK
            </div>
          </section>
        </div>

        <aside className="side-panel right-panel">
          <section className="panel-box next-box">
            <div className="panel-title"><span>NEXT</span><small>5 PIECES</small></div>
            <div className="next-list">
              {game.queue.slice(0, 5).map((type, index) => (
                <div className="next-item" key={`${type}-${index}`}><span>{String(index + 1).padStart(2, '0')}</span><MiniPiece type={type} /></div>
              ))}
            </div>
          </section>

          <section className="key-guide">
            <h2>CONTROLS</h2>
            <p><span>MOVE</span><kbd>{displayKey(bindings.left)}</kbd><kbd>{displayKey(bindings.right)}</kbd></p>
            <p><span>SOFT</span><kbd>{displayKey(bindings.soft)}</kbd></p>
            <p><span>ROTATE</span><kbd>{displayKey(bindings.rotateLeft)}</kbd><kbd>{displayKey(bindings.rotateRight)}</kbd></p>
            <p><span>DROP</span><kbd>{displayKey(bindings.hard)}</kbd></p>
            <p><span>HOLD</span><kbd>{displayKey(bindings.hold)}</kbd></p>
            <p><span>PAUSE</span><kbd>{displayKey(bindings.pause)}</kbd></p>
            <p><span>RETRY</span><kbd>{displayKey(bindings.retry)}</kbd></p>
            <button className="edit-keys" onClick={openConfig}>EDIT KEYS</button>
          </section>
        </aside>
      </section>

      <section className="touch-controls" aria-label="タッチ操作">
        <button onClick={() => move(-1)} aria-label="左へ移動">←</button>
        <button onClick={() => rotate(-1)} aria-label="左回転">↶</button>
        <button onClick={soft} aria-label="ソフトドロップ">↓</button>
        <button onClick={() => rotate(1)} aria-label="右回転">↷</button>
        <button onClick={() => move(1)} aria-label="右へ移動">→</button>
        <button className="hold-touch" onClick={hold} disabled={!game.canHold}>HOLD</button>
        <button className="drop-touch" onClick={drop}>HARD DROP</button>
        <button className="pause-touch" onClick={togglePause}>PAUSE</button>
      </section>
      <div className="mobile-actions">
        <button className="key-config-button" onClick={returnToModeSelect}>MODE</button>
        <button className="key-config-button" onClick={openConfig}>KEY CONFIG</button>
        <button className="new-game mobile-new" onClick={newGame}>NEW GAME <span>↗</span></button>
      </div>

      {configOpen && (
        <div className="config-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeConfig() }}>
          <section className="config-dialog" role="dialog" aria-modal="true" aria-labelledby="config-title">
            <div className="config-heading">
              <div><p>INPUT SETTINGS</p><h2 id="config-title">キーアサイン</h2></div>
              <button onClick={closeConfig} aria-label="設定を閉じる">×</button>
            </div>
            <p className="config-help">変更する操作を選び、割り当てたいキーを押してください。重複した場合はキーが入れ替わります。</p>
            <div className="binding-list">
              {(Object.keys(ACTION_LABELS) as Action[]).map((action) => (
                <div className="binding-row" key={action}>
                  <span>{ACTION_LABELS[action]}</span>
                  <button className={listeningAction === action ? 'listening' : ''} onClick={() => setListeningAction(action)}>
                    {listeningAction === action ? 'キーを入力…' : displayKey(bindings[action])}
                  </button>
                </div>
              ))}
            </div>
            <div className="config-footer">
              <button className="reset-keys" onClick={() => { setBindings(DEFAULT_BINDINGS); setListeningAction(null) }}>初期設定に戻す</button>
              <button className="save-keys" onClick={closeConfig}>完了</button>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}

function App() {
  const [mode, setMode] = useState<'tetris' | 'puyo'>(() => localStorage.getItem('game-mode') === 'puyo' ? 'puyo' : 'tetris')

  const selectMode = (nextMode: 'tetris' | 'puyo') => {
    localStorage.setItem('game-mode', nextMode)
    setMode(nextMode)
  }

  return (
    <>
      <nav className="game-mode-switch" aria-label="ゲーム選択">
        <button className={mode === 'tetris' ? 'active' : ''} onClick={() => selectMode('tetris')}>TETRIS</button>
        <button className={mode === 'puyo' ? 'active' : ''} onClick={() => selectMode('puyo')}>PUYO PUYO</button>
      </nav>
      {mode === 'tetris' ? <TetrisGame /> : <PuyoGame />}
    </>
  )
}

export default App
