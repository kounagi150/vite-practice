export const COLS = 10
export const VISIBLE_ROWS = 20
export const BUFFER_ROWS = 2
export const ROWS = VISIBLE_ROWS + BUFFER_ROWS
export const LOCK_DELAY = 500
export const MAX_LOCK_RESETS = 15

export type PieceType = 'I' | 'J' | 'L' | 'O' | 'S' | 'T' | 'Z'
export type Cell = PieceType | null
export type Board = Cell[][]
export type Status = 'countdown' | 'playing' | 'paused' | 'over' | 'cleared'
export type TetrisMode = 'sprint' | 'marathon'

export type ActivePiece = {
  type: PieceType
  rotation: number
  x: number
  y: number
  lastMoveWasRotation: boolean
}

export type GameState = {
  mode: TetrisMode
  board: Board
  active: ActivePiece
  queue: PieceType[]
  bag: PieceType[]
  hold: PieceType | null
  canHold: boolean
  score: number
  lines: number
  level: number
  backToBack: boolean
  status: Status
  groundedAt: number | null
  lockResets: number
  lastGravityAt: number
  lastTimerAt: number
  elapsed: number
  message: string
}

export const COLORS: Record<PieceType, string> = {
  I: '#00f0f0',
  O: '#f0f000',
  T: '#a000f0',
  S: '#00f000',
  Z: '#f00000',
  J: '#0000f0',
  L: '#f0a000',
}

const TYPES: PieceType[] = ['I', 'J', 'L', 'O', 'S', 'T', 'Z']

// SRSで定義される4つの向き（0, R, 2, L）。
export const SHAPES: Record<PieceType, number[][][]> = {
  I: [
    [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
    [[0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0]],
    [[0, 0, 0, 0], [0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0]],
    [[0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0]],
  ],
  J: [
    [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
    [[0, 1, 1], [0, 1, 0], [0, 1, 0]],
    [[0, 0, 0], [1, 1, 1], [0, 0, 1]],
    [[0, 1, 0], [0, 1, 0], [1, 1, 0]],
  ],
  L: [
    [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
    [[0, 1, 0], [0, 1, 0], [0, 1, 1]],
    [[0, 0, 0], [1, 1, 1], [1, 0, 0]],
    [[1, 1, 0], [0, 1, 0], [0, 1, 0]],
  ],
  O: [
    [[0, 1, 1, 0], [0, 1, 1, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
    [[0, 1, 1, 0], [0, 1, 1, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
    [[0, 1, 1, 0], [0, 1, 1, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
    [[0, 1, 1, 0], [0, 1, 1, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
  ],
  S: [
    [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
    [[0, 1, 0], [0, 1, 1], [0, 0, 1]],
    [[0, 0, 0], [0, 1, 1], [1, 1, 0]],
    [[1, 0, 0], [1, 1, 0], [0, 1, 0]],
  ],
  T: [
    [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
    [[0, 1, 0], [0, 1, 1], [0, 1, 0]],
    [[0, 0, 0], [1, 1, 1], [0, 1, 0]],
    [[0, 1, 0], [1, 1, 0], [0, 1, 0]],
  ],
  Z: [
    [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
    [[0, 0, 1], [0, 1, 1], [0, 1, 0]],
    [[0, 0, 0], [1, 1, 0], [0, 1, 1]],
    [[0, 1, 0], [1, 1, 0], [1, 0, 0]],
  ],
}

type Kick = [number, number]

const JLSTZ_KICKS: Record<string, Kick[]> = {
  '0>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '1>0': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '1>2': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '2>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '2>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '3>2': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '3>0': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '0>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
}

const I_KICKS: Record<string, Kick[]> = {
  '0>1': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '1>0': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '1>2': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  '2>1': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '2>3': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '3>2': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '3>0': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '0>3': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
}

export const createBoard = (): Board => Array.from({ length: ROWS }, () => Array<Cell>(COLS).fill(null))

const shuffledBag = (): PieceType[] => {
  const bag = [...TYPES]
  for (let i = bag.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[bag[i], bag[j]] = [bag[j], bag[i]]
  }
  return bag
}

const fillQueue = (queue: PieceType[], sourceBag: PieceType[], length = 6) => {
  const nextQueue = [...queue]
  let bag = [...sourceBag]
  while (nextQueue.length < length) {
    if (bag.length === 0) bag = shuffledBag()
    nextQueue.push(bag.shift() as PieceType)
  }
  return { queue: nextQueue, bag }
}

export const spawnPiece = (type: PieceType): ActivePiece => ({
  type,
  rotation: 0,
  x: type === 'O' ? 3 : 3,
  y: 1,
  lastMoveWasRotation: false,
})

export const cellsOf = (piece: ActivePiece) => {
  const cells: { x: number; y: number }[] = []
  SHAPES[piece.type][piece.rotation].forEach((row, rowIndex) => {
    row.forEach((value, columnIndex) => {
      if (value) cells.push({ x: piece.x + columnIndex, y: piece.y + rowIndex })
    })
  })
  return cells
}

export const collides = (board: Board, piece: ActivePiece) =>
  cellsOf(piece).some(({ x, y }) => x < 0 || x >= COLS || y >= ROWS || y < 0 || board[y][x] !== null)

const isGrounded = (board: Board, piece: ActivePiece) => collides(board, { ...piece, y: piece.y + 1 })

const withLockReset = (state: GameState, active: ActivePiece, now: number): GameState => {
  const wasGrounded = isGrounded(state.board, state.active)
  const grounded = isGrounded(state.board, active)
  const canReset = wasGrounded && state.lockResets < MAX_LOCK_RESETS
  return {
    ...state,
    active,
    groundedAt: grounded ? (canReset ? now : state.groundedAt ?? now) : null,
    lockResets: canReset ? state.lockResets + 1 : state.lockResets,
  }
}

export const moveHorizontal = (state: GameState, direction: -1 | 1, now: number): GameState => {
  if (state.status !== 'playing') return state
  const active = { ...state.active, x: state.active.x + direction, lastMoveWasRotation: false }
  return collides(state.board, active) ? state : withLockReset(state, active, now)
}

export const rotatePiece = (state: GameState, direction: -1 | 1, now: number): GameState => {
  if (state.status !== 'playing') return state
  const from = state.active.rotation
  const to = (from + direction + 4) % 4
  if (state.active.type === 'O') return withLockReset(state, { ...state.active, rotation: to, lastMoveWasRotation: true }, now)
  const table = state.active.type === 'I' ? I_KICKS : JLSTZ_KICKS
  for (const [offsetX, offsetY] of table[`${from}>${to}`]) {
    // SRSのY座標は上向きが正。画面座標では符号を反転する。
    const active = { ...state.active, rotation: to, x: state.active.x + offsetX, y: state.active.y - offsetY, lastMoveWasRotation: true }
    if (!collides(state.board, active)) return withLockReset(state, active, now)
  }
  return state
}

export const ghostY = (board: Board, piece: ActivePiece) => {
  let y = piece.y
  while (!collides(board, { ...piece, y: y + 1 })) y += 1
  return y
}

const detectTSpin = (board: Board, piece: ActivePiece) => {
  if (piece.type !== 'T' || !piece.lastMoveWasRotation) return false
  const centerX = piece.x + 1
  const centerY = piece.y + 1
  const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]]
  const occupied = corners.filter(([dx, dy]) => {
    const x = centerX + dx
    const y = centerY + dy
    return x < 0 || x >= COLS || y < 0 || y >= ROWS || board[y][x] !== null
  }).length
  return occupied >= 3
}

const pullNext = (queue: PieceType[], bag: PieceType[]) => {
  const filled = fillQueue(queue, bag, 6)
  const [type, ...rest] = filled.queue
  const replenished = fillQueue(rest, filled.bag, 5)
  return { type, queue: replenished.queue, bag: replenished.bag }
}

export const lockPiece = (state: GameState, now: number): GameState => {
  const cells = cellsOf(state.active)
  const lockedAboveField = cells.every(({ y }) => y < BUFFER_ROWS)
  if (lockedAboveField) return { ...state, status: 'over', message: 'LOCK OUT' }

  const tSpin = detectTSpin(state.board, state.active)
  const merged = state.board.map((row) => [...row])
  cells.forEach(({ x, y }) => { if (y >= 0) merged[y][x] = state.active.type })
  const remaining = merged.filter((row) => row.some((cell) => cell === null))
  const cleared = ROWS - remaining.length
  const board = [...Array.from({ length: cleared }, () => Array<Cell>(COLS).fill(null)), ...remaining]

  const normalPoints = [0, 100, 300, 500, 800]
  const tSpinPoints = [400, 800, 1200, 1600]
  let base = tSpin ? (tSpinPoints[cleared] ?? 0) : normalPoints[cleared]
  const difficult = cleared > 0 && (tSpin || cleared === 4)
  if (difficult && state.backToBack) base = Math.floor(base * 1.5)
  const score = state.score + base * state.level
  const lines = state.lines + cleared
  const level = state.mode === 'sprint' ? 1 : Math.min(15, Math.floor(lines / 10) + 1)
  const backToBack = difficult ? true : cleared > 0 ? false : state.backToBack
  const message = tSpin ? `T-SPIN${cleared ? ` ${cleared}` : ''}` : cleared === 4 ? 'TETRIS' : cleared ? `${cleared} LINE` : ''

  const next = pullNext(state.queue, state.bag)
  const active = spawnPiece(next.type)
  const target = state.mode === 'sprint' ? 40 : 150
  if (lines >= target) {
    return {
      ...state, board, active, queue: next.queue, bag: next.bag, score, lines, level,
      backToBack, status: 'cleared', message: state.mode === 'sprint' ? '40 LINES CLEAR' : 'MARATHON CLEAR',
    }
  }
  if (collides(board, active)) {
    return { ...state, board, active, queue: next.queue, bag: next.bag, score, lines, level, backToBack, status: 'over', message: 'BLOCK OUT' }
  }
  return {
    ...state, board, active, queue: next.queue, bag: next.bag, canHold: true,
    score, lines, level, backToBack, groundedAt: null, lockResets: 0,
    lastGravityAt: now, message,
  }
}

export const softDrop = (state: GameState, now: number): GameState => {
  if (state.status !== 'playing') return state
  const active = { ...state.active, y: state.active.y + 1, lastMoveWasRotation: false }
  if (collides(state.board, active)) return state.groundedAt === null ? { ...state, groundedAt: now } : state
  return { ...state, active, score: state.score + 1, groundedAt: isGrounded(state.board, active) ? now : null, lastGravityAt: now }
}

export const hardDrop = (state: GameState, now: number): GameState => {
  if (state.status !== 'playing') return state
  const timedState = { ...state, elapsed: state.elapsed + Math.max(0, now - state.lastTimerAt), lastTimerAt: now }
  const y = ghostY(timedState.board, timedState.active)
  const distance = y - timedState.active.y
  return lockPiece({ ...timedState, active: { ...timedState.active, y }, score: timedState.score + distance * 2 }, now)
}

export const holdPiece = (state: GameState, now: number): GameState => {
  if (state.status !== 'playing' || !state.canHold) return state
  let active: ActivePiece
  let queue = state.queue
  let bag = state.bag
  if (state.hold) active = spawnPiece(state.hold)
  else {
    const next = pullNext(queue, bag)
    active = spawnPiece(next.type)
    queue = next.queue
    bag = next.bag
  }
  if (collides(state.board, active)) return { ...state, active, hold: state.active.type, status: 'over', message: 'BLOCK OUT' }
  return { ...state, active, queue, bag, hold: state.active.type, canHold: false, groundedAt: null, lockResets: 0, lastGravityAt: now, message: '' }
}

const GRAVITY_MS = [1000, 1000, 793, 618, 467, 333, 233, 150, 100, 67, 50, 33, 25, 20, 18, 16.6]
export const gravityInterval = (level: number, mode: TetrisMode = 'marathon') => mode === 'sprint' ? 1000 : GRAVITY_MS[Math.min(15, Math.max(1, level))]

export const tick = (state: GameState, now: number): GameState => {
  if (state.status !== 'playing') return state
  const timedState = { ...state, elapsed: state.elapsed + Math.max(0, now - state.lastTimerAt), lastTimerAt: now }
  if (isGrounded(timedState.board, timedState.active)) {
    if (timedState.groundedAt === null) return { ...timedState, groundedAt: now }
    if (now - timedState.groundedAt >= LOCK_DELAY) return lockPiece(timedState, now)
    return timedState
  }
  if (now - timedState.lastGravityAt < gravityInterval(timedState.level, timedState.mode)) return timedState
  const active = { ...timedState.active, y: timedState.active.y + 1, lastMoveWasRotation: false }
  return { ...timedState, active, lastGravityAt: now, groundedAt: isGrounded(timedState.board, active) ? now : null }
}

export const createInitialState = (now = performance.now(), mode: TetrisMode = 'marathon'): GameState => {
  const filled = fillQueue([], [], 6)
  const [type, ...queue] = filled.queue
  return {
    mode, board: createBoard(), active: spawnPiece(type), queue, bag: filled.bag,
    hold: null, canHold: true, score: 0, lines: 0, level: 1,
    backToBack: false, status: 'countdown', groundedAt: null,
    lockResets: 0, lastGravityAt: now, lastTimerAt: now, elapsed: 0, message: '',
  }
}
