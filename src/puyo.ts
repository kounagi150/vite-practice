export const PUYO_COLS = 6
export const PUYO_VISIBLE_ROWS = 12
export const PUYO_ROWS = 13
export const PUYO_LOCK_DELAY = 500

export type PuyoColor = 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'garbage'
export type PuyoCell = PuyoColor | null
export type PuyoBoard = PuyoCell[][]
export type Pair = { axis: PuyoColor; child: PuyoColor }
export type ActivePair = Pair & { x: number; y: number; rotation: number }

export type PuyoState = {
  board: PuyoBoard
  active: ActivePair
  queue: Pair[]
  turn: number
  score: number
  chain: number
  garbage: number
  garbageRemainder: number
  status: 'playing' | 'paused' | 'resolving' | 'over'
  phase: 'idle' | 'fall' | 'highlight' | 'vanish'
  highlighted: string[]
  fallDistances: Record<string, number>
  phaseDuration: number
  groundedAt: number | null
  lastGravityAt: number
  lastFailedRotationAt: number
  lastFailedDirection: -1 | 0 | 1
  message: string
}

export const PUYO_COLORS: Record<PuyoColor, string> = {
  red: '#ff405f', blue: '#388bff', green: '#35d873', yellow: '#ffd83d',
  purple: '#a85cff', garbage: '#c8cfda',
}

const PLAY_COLORS: PuyoColor[] = ['red', 'blue', 'green', 'yellow']
const VECTORS = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const

export const createPuyoBoard = (): PuyoBoard => Array.from({ length: PUYO_ROWS }, () => Array<PuyoCell>(PUYO_COLS).fill(null))

const randomColor = (turn: number) => {
  const choices = turn < 2 ? PLAY_COLORS.slice(0, 3) : PLAY_COLORS
  return choices[Math.floor(Math.random() * choices.length)]
}

const makePair = (turn: number): Pair => ({ axis: randomColor(turn), child: randomColor(turn) })

const spawnPair = (pair: Pair): ActivePair => ({ ...pair, x: 2, y: 1, rotation: 0 })

export const pairCells = (pair: ActivePair) => {
  const [dx, dy] = VECTORS[pair.rotation]
  return [
    { x: pair.x, y: pair.y, color: pair.axis },
    { x: pair.x + dx, y: pair.y + dy, color: pair.child },
  ]
}

export const puyoCollides = (board: PuyoBoard, pair: ActivePair) =>
  pairCells(pair).some(({ x, y }) => x < 0 || x >= PUYO_COLS || y < 0 || y >= PUYO_ROWS || board[y][x] !== null)

const grounded = (board: PuyoBoard, pair: ActivePair) => puyoCollides(board, { ...pair, y: pair.y + 1 })

const resetLock = (state: PuyoState, active: ActivePair, now: number): PuyoState => ({
  ...state,
  active,
  groundedAt: grounded(state.board, active) ? now : null,
})

export const movePuyo = (state: PuyoState, direction: -1 | 1, now: number): PuyoState => {
  if (state.status !== 'playing') return state
  const active = { ...state.active, x: state.active.x + direction }
  return puyoCollides(state.board, active) ? state : resetLock(state, active, now)
}

export const rotatePuyo = (state: PuyoState, direction: -1 | 1, now: number): PuyoState => {
  if (state.status !== 'playing') return state
  const rotation = (state.active.rotation + direction + 4) % 4
  const kicks = [[0, 0], [-1, 0], [1, 0], [0, -1]]
  for (const [dx, dy] of kicks) {
    const active = { ...state.active, rotation, x: state.active.x + dx, y: state.active.y + dy }
    if (!puyoCollides(state.board, active)) {
      return { ...resetLock(state, active, now), lastFailedDirection: 0, lastFailedRotationAt: 0 }
    }
  }

  // 同方向を300ms以内に再入力した場合は、縦溝でのクイックターンを試す。
  if (state.lastFailedDirection === direction && now - state.lastFailedRotationAt <= 300) {
    const quickRotation = (state.active.rotation + 2) % 4
    for (const [dx, dy] of [[0, -1], [-1, -1], [1, -1]]) {
      const active = { ...state.active, rotation: quickRotation, x: state.active.x + dx, y: state.active.y + dy }
      if (!puyoCollides(state.board, active)) {
        return { ...resetLock(state, active, now), lastFailedDirection: 0, lastFailedRotationAt: 0 }
      }
    }
  }
  return { ...state, lastFailedDirection: direction, lastFailedRotationAt: now }
}

const applyGravity = (source: PuyoBoard) => {
  const board = createPuyoBoard()
  const distances: Record<string, number> = {}
  let maxDistance = 0
  for (let x = 0; x < PUYO_COLS; x += 1) {
    let targetY = PUYO_ROWS - 1
    for (let y = PUYO_ROWS - 1; y >= 0; y -= 1) {
      if (source[y][x]) {
        board[targetY][x] = source[y][x]
        const distance = targetY - y
        if (distance > 0) {
          distances[`${x},${targetY}`] = distance
          maxDistance = Math.max(maxDistance, distance)
        }
        targetY -= 1
      }
    }
  }
  return { board, distances, maxDistance }
}

const findGroups = (board: PuyoBoard) => {
  const visited = new Set<string>()
  const groups: { color: PuyoColor; cells: [number, number][] }[] = []
  for (let y = 0; y < PUYO_ROWS; y += 1) {
    for (let x = 0; x < PUYO_COLS; x += 1) {
      const color = board[y][x]
      const key = `${x},${y}`
      if (!color || color === 'garbage' || visited.has(key)) continue
      const cells: [number, number][] = []
      const queue: [number, number][] = [[x, y]]
      visited.add(key)
      while (queue.length) {
        const [cx, cy] = queue.shift() as [number, number]
        cells.push([cx, cy])
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx
          const ny = cy + dy
          const nextKey = `${nx},${ny}`
          if (nx >= 0 && nx < PUYO_COLS && ny >= 0 && ny < PUYO_ROWS && board[ny][nx] === color && !visited.has(nextKey)) {
            visited.add(nextKey)
            queue.push([nx, ny])
          }
        }
      }
      if (cells.length >= 4) groups.push({ color, cells })
    }
  }
  return groups
}

const CHAIN_BONUS = [0, 0, 8, 16, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448, 480, 512]
const connectionBonus = (size: number) => size <= 4 ? 0 : size === 5 ? 2 : size === 6 ? 3 : size === 7 ? 4 : size === 8 ? 5 : size === 9 ? 6 : size === 10 ? 7 : 10
const colorBonus = (count: number) => [0, 0, 3, 6, 12, 24][count] ?? 24

export const lockPuyo = (state: PuyoState, now: number): PuyoState => {
  const placed = state.board.map((row) => [...row])
  pairCells(state.active).forEach(({ x, y, color }) => { if (y >= 0) placed[y][x] = color })
  const fallen = applyGravity(placed)
  return {
    ...state,
    board: fallen.board,
    chain: 0,
    status: 'resolving',
    phase: 'fall',
    fallDistances: fallen.distances,
    highlighted: [],
    phaseDuration: Math.max(150, fallen.maxDistance * 75),
    groundedAt: null,
    lastGravityAt: now,
    message: '',
  }
}

const finishResolution = (state: PuyoState, now: number): PuyoState => {
  if (state.board[1][2] !== null) return { ...state, status: 'over', phase: 'idle', message: 'GAME OVER' }
  const [next, ...queue] = state.queue
  const replenished = [...queue, makePair(state.turn)]
  const active = spawnPair(next)
  if (puyoCollides(state.board, active)) return { ...state, active, status: 'over', phase: 'idle', message: 'GAME OVER' }
  return {
    ...state, active, queue: replenished, turn: state.turn + 1,
    status: 'playing', phase: 'idle', highlighted: [], fallDistances: {}, phaseDuration: 0,
    groundedAt: null, lastGravityAt: now,
    lastFailedDirection: 0, lastFailedRotationAt: 0,
  }
}

export const advancePuyoPhase = (state: PuyoState, now: number): PuyoState => {
  if (state.status !== 'resolving') return state

  if (state.phase === 'fall') {
    const groups = findGroups(state.board)
    if (!groups.length) return finishResolution(state, now)
    return {
      ...state,
      phase: 'highlight',
      highlighted: groups.flatMap((group) => group.cells.map(([x, y]) => `${x},${y}`)),
      fallDistances: {},
      phaseDuration: 300,
    }
  }

  if (state.phase === 'highlight') {
    const groups = findGroups(state.board)
    if (!groups.length) return finishResolution(state, now)
    const chain = state.chain + 1
    const colors = new Set(groups.map((group) => group.color)).size
    const erased = groups.reduce((sum, group) => sum + group.cells.length, 0)
    const bonus = Math.max(1, (CHAIN_BONUS[chain] ?? 512) + groups.reduce((sum, group) => sum + connectionBonus(group.cells.length), 0) + colorBonus(colors))
    const gained = erased * 10 * bonus
    const garbagePoints = state.garbageRemainder + gained
    const erase = new Set(groups.flatMap((group) => group.cells.map(([x, y]) => `${x},${y}`)))
    groups.forEach((group) => group.cells.forEach(([x, y]) => {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx
        const ny = y + dy
        if (nx >= 0 && nx < PUYO_COLS && ny >= 0 && ny < PUYO_ROWS && state.board[ny][nx] === 'garbage') erase.add(`${nx},${ny}`)
      }
    }))
    return {
      ...state,
      phase: 'vanish',
      chain,
      score: state.score + gained,
      garbage: state.garbage + Math.floor(garbagePoints / 70),
      garbageRemainder: garbagePoints % 70,
      highlighted: [...erase],
      phaseDuration: 200,
      message: `${chain} CHAIN!`,
    }
  }

  if (state.phase === 'vanish') {
    const erasedBoard = state.board.map((row) => [...row])
    state.highlighted.forEach((key) => {
      const [x, y] = key.split(',').map(Number)
      erasedBoard[y][x] = null
    })
    const fallen = applyGravity(erasedBoard)
    return {
      ...state,
      board: fallen.board,
      phase: 'fall',
      highlighted: [],
      fallDistances: fallen.distances,
      phaseDuration: Math.max(150, fallen.maxDistance * 75),
    }
  }

  return finishResolution(state, now)
}

export const softDropPuyo = (state: PuyoState, now: number): PuyoState => {
  if (state.status !== 'playing') return state
  const active = { ...state.active, y: state.active.y + 1 }
  if (puyoCollides(state.board, active)) return state.groundedAt === null ? { ...state, groundedAt: now } : state
  return { ...state, active, score: state.score + 1, groundedAt: grounded(state.board, active) ? now : null, lastGravityAt: now }
}

export const tickPuyo = (state: PuyoState, now: number): PuyoState => {
  if (state.status !== 'playing') return state
  if (grounded(state.board, state.active)) {
    if (state.groundedAt === null) return { ...state, groundedAt: now }
    if (now - state.groundedAt >= PUYO_LOCK_DELAY) return lockPuyo(state, now)
    return state
  }
  if (now - state.lastGravityAt < 700) return state
  const active = { ...state.active, y: state.active.y + 1 }
  return { ...state, active, lastGravityAt: now, groundedAt: grounded(state.board, active) ? now : null }
}

export const createInitialPuyoState = (now = performance.now()): PuyoState => {
  const first = makePair(0)
  return {
    board: createPuyoBoard(), active: spawnPair(first), queue: [makePair(1), makePair(2)], turn: 3,
    score: 0, chain: 0, garbage: 0, garbageRemainder: 0, status: 'playing', phase: 'idle', highlighted: [],
    fallDistances: {}, phaseDuration: 0, groundedAt: null,
    lastGravityAt: now, lastFailedRotationAt: 0, lastFailedDirection: 0, message: '',
  }
}
