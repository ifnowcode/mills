const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const resetBtn = document.getElementById('resetBtn');
const statusEl = document.getElementById('status');

const EMPTY = 0;
const WHITE = 1; // human
const BLACK = 2; // AI

// 24 positions, indexed 0–23
// Coordinates laid out on 3 concentric squares
const POSITIONS = [
  { x: 50,  y: 50  }, // 0
  { x: 300, y: 50  }, // 1
  { x: 550, y: 50  }, // 2
  { x: 550, y: 300 }, // 3
  { x: 550, y: 550 }, // 4
  { x: 300, y: 550 }, // 5
  { x: 50,  y: 550 }, // 6
  { x: 50,  y: 300 }, // 7

  { x: 125, y: 125 }, // 8
  { x: 300, y: 125 }, // 9
  { x: 475, y: 125 }, // 10
  { x: 475, y: 300 }, // 11
  { x: 475, y: 475 }, // 12
  { x: 300, y: 475 }, // 13
  { x: 125, y: 475 }, // 14
  { x: 125, y: 300 }, // 15

  { x: 200, y: 200 }, // 16
  { x: 300, y: 200 }, // 17
  { x: 400, y: 200 }, // 18
  { x: 400, y: 300 }, // 19
  { x: 400, y: 400 }, // 20
  { x: 300, y: 400 }, // 21
  { x: 200, y: 400 }, // 22
  { x: 200, y: 300 }  // 23
];

// Lines between positions (for drawing and adjacency)
const LINES = [
  [0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,0],
  [8,9],[9,10],[10,11],[11,12],[12,13],[13,14],[14,15],[15,8],
  [16,17],[17,18],[18,19],[19,20],[20,21],[21,22],[22,23],[23,16],
  [0,8],[8,16],[1,9],[9,17],[2,10],[10,18],
  [3,11],[11,19],[4,12],[12,20],[5,13],[13,21],[6,14],[14,22],[7,15],[15,23]
];

// Mills: all triplets that count as a mill
const MILLS = [
  [0,1,2],[2,3,4],[4,5,6],[6,7,0],
  [8,9,10],[10,11,12],[12,13,14],[14,15,8],
  [16,17,18],[18,19,20],[20,21,22],[22,23,16],
  [0,8,16],[1,9,17],[2,10,18],[3,11,19],
  [4,12,20],[5,13,21],[6,14,22],[7,15,23]
];

// Adjacency for sliding moves
const ADJ = {};
for (const [a,b] of LINES) {
  if (!ADJ[a]) ADJ[a] = [];
  if (!ADJ[b]) ADJ[b] = [];
  ADJ[a].push(b);
  ADJ[b].push(a);
}

let board;
let currentPlayer;
let whitePiecesToPlace;
let blackPiecesToPlace;
let selectedPos = null;
let mustRemove = false; // current player must remove opponent piece after forming mill
let gameOver = false;

function initGame() {
  board = Array(24).fill(EMPTY);
  currentPlayer = WHITE;
  whitePiecesToPlace = 9;
  blackPiecesToPlace = 9;
  selectedPos = null;
  mustRemove = false;
  gameOver = false;
  statusEl.textContent = "Placing phase. You are White. Click an empty point.";
  drawBoard();
}

function drawBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#1b1b1b";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "#888";
  ctx.lineWidth = 2;
  for (const [a,b] of LINES) {
    const p1 = POSITIONS[a];
    const p2 = POSITIONS[b];
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }

  for (let i = 0; i < POSITIONS.length; i++) {
    const p = POSITIONS[i];
    ctx.beginPath();
    ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
    ctx.fillStyle = "#333";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#555";
    ctx.stroke();
  }

  for (let i = 0; i < board.length; i++) {
    if (board[i] !== EMPTY) {
      const p = POSITIONS[i];
      ctx.beginPath();
      ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
      ctx.fillStyle = board[i] === WHITE ? "#f5f5f5" : "#d22";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#000";
      ctx.stroke();
    }
  }

  if (selectedPos !== null && !mustRemove) {
    const p = POSITIONS[selectedPos];
    ctx.beginPath();
    ctx.arc(p.x, p.y, 18, 0, Math.PI * 2);
    ctx.strokeStyle = "yellow";
    ctx.lineWidth = 3;
    ctx.stroke();
  }
}

function pixelToPos(x, y) {
  let best = null;
  let bestDist = Infinity;
  for (let i = 0; i < POSITIONS.length; i++) {
    const p = POSITIONS[i];
    const dx = x - p.x;
    const dy = y - p.y;
    const d = Math.sqrt(dx*dx + dy*dy);
    if (d < 20 && d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

function countPieces(player) {
  return board.filter(v => v === player).length;
}

function isMillAt(pos, player, b = board) {
  for (const mill of MILLS) {
    if (mill.includes(pos)) {
      if (mill.every(i => b[i] === player)) return true;
    }
  }
  return false;
}

function playerHasAnyMill(player, b = board) {
  for (const mill of MILLS) {
    if (mill.every(i => b[i] === player)) return true;
  }
  return false;
}

function canRemoveAt(pos, player) {
  if (board[pos] !== player) return false;
  const opponent = player === WHITE ? BLACK : WHITE;
  if (board[pos] !== opponent) return false;
  const opponentPieces = board.reduce((acc, v, i) => v === opponent ? acc.concat(i) : acc, []);
  const nonMillPieces = opponentPieces.filter(i => !isMillAt(i, opponent));
  if (nonMillPieces.length > 0) {
    return !isMillAt(pos, opponent);
  } else {
    return true;
  }
}

function getRemovablePositions(opponent) {
  const opponentPieces = board.reduce((acc, v, i) => v === opponent ? acc.concat(i) : acc, []);
  const nonMillPieces = opponentPieces.filter(i => !isMillAt(i, opponent));
  if (nonMillPieces.length > 0) return nonMillPieces;
  return opponentPieces;
}

function hasLegalMoves(player) {
  const pieces = board.reduce((acc, v, i) => v === player ? acc.concat(i) : acc, []);
  const count = pieces.length;
  if (count <= 2) return false;
  if (player === WHITE ? whitePiecesToPlace > 0 : blackPiecesToPlace > 0) {
    return board.some(v => v === EMPTY);
  }
  if (count === 3) {
    return board.some((v, i) => v === EMPTY);
  }
  for (const pos of pieces) {
    for (const n of ADJ[pos] || []) {
      if (board[n] === EMPTY) return true;
    }
  }
  return false;
}

function checkWin() {
  // Do NOT check win conditions during placing phase
  if (whitePiecesToPlace > 0 || blackPiecesToPlace > 0) {
    return false;
  }

  const whiteCount = countPieces(WHITE);
  const blackCount = countPieces(BLACK);

  if (whiteCount <= 2 || !hasLegalMoves(WHITE)) {
    gameOver = true;
    statusEl.textContent = "Black (AI) wins.";
    return true;
  }
  if (blackCount <= 2 || !hasLegalMoves(BLACK)) {
    gameOver = true;
    statusEl.textContent = "You win!";
    return true;
  }
  return false;
}

function handleClick(evt) {
  if (gameOver) return;
  if (currentPlayer !== WHITE) return;

  const rect = canvas.getBoundingClientRect();
  const x = (evt.clientX - rect.left) * (canvas.width / rect.width);
  const y = (evt.clientY - rect.top) * (canvas.height / rect.height);
  const pos = pixelToPos(x, y);
  if (pos === null) return;

  if (mustRemove) {
    const opponent = BLACK;
    const removable = getRemovablePositions(opponent);
    if (!removable.includes(pos)) {
      statusEl.textContent = "You must remove a valid Black piece.";
      return;
    }
    board[pos] = EMPTY;
    mustRemove = false;
    drawBoard();
    if (checkWin()) return;
    currentPlayer = BLACK;
    statusEl.textContent = "AI thinking...";
    setTimeout(aiMove, 400);
    return;
  }

  if (whitePiecesToPlace > 0) {
    if (board[pos] !== EMPTY) return;
    board[pos] = WHITE;
    whitePiecesToPlace--;
    drawBoard();

    if (isMillAt(pos, WHITE)) {
      mustRemove = true;
      statusEl.textContent = "You formed a mill! Click a Black piece to remove.";
      return;
    }

    if (checkWin()) return;
    currentPlayer = BLACK;
    statusEl.textContent = "AI thinking...";
    setTimeout(aiMove, 400);
  } else {
    if (selectedPos === null) {
      if (board[pos] !== WHITE) return;
      selectedPos = pos;
      statusEl.textContent = "Select a destination.";
      drawBoard();
    } else {
      if (pos === selectedPos) {
        selectedPos = null;
        statusEl.textContent = "Move cancelled. Select a piece.";
        drawBoard();
        return;
      }
      if (board[pos] !== EMPTY) return;

      const whiteCount = countPieces(WHITE);
      let legal = false;
      if (whiteCount === 3) {
        legal = true;
      } else {
        legal = (ADJ[selectedPos] || []).includes(pos);
      }
      if (!legal) return;

      board[selectedPos] = EMPTY;
      board[pos] = WHITE;
      selectedPos = null;
      drawBoard();

      if (isMillAt(pos, WHITE)) {
        mustRemove = true;
        statusEl.textContent = "You formed a mill! Click a Black piece to remove.";
        return;
      }

      if (checkWin()) return;
      currentPlayer = BLACK;
      statusEl.textContent = "AI thinking...";
      setTimeout(aiMove, 400);
    }
  }
}

function aiMove() {
  if (gameOver || currentPlayer !== BLACK) return;

  if (mustRemove) {
    const removable = getRemovablePositions(WHITE);
    const choice = removable[Math.floor(Math.random() * removable.length)];
    board[choice] = EMPTY;
    mustRemove = false;
    drawBoard();
    if (checkWin()) return;
    currentPlayer = WHITE;
    statusEl.textContent = "Your turn.";
    return;
  }

  if (blackPiecesToPlace > 0) {
    const moves = [];
    for (let i = 0; i < 24; i++) {
      if (board[i] === EMPTY) moves.push(i);
    }
    if (moves.length === 0) {
      if (checkWin()) return;
      currentPlayer = WHITE;
      statusEl.textContent = "Your turn.";
      return;
    }

    let bestMoves = [];
    let bestScore = -Infinity;

    for (const pos of moves) {
      const bCopy = board.slice();
      bCopy[pos] = BLACK;
      let score = 0;
      if (isMillAt(pos, BLACK, bCopy)) score += 10;
      for (const [a,b,c] of MILLS) {
        if (bCopy[a] === WHITE && bCopy[b] === WHITE && bCopy[c] === EMPTY) score += 2;
        if (bCopy[a] === WHITE && bCopy[b] === EMPTY && bCopy[c] === WHITE) score += 2;
        if (bCopy[a] === EMPTY && bCopy[b] === WHITE && bCopy[c] === WHITE) score += 2;
      }
      if (score > bestScore) {
        bestScore = score;
        bestMoves = [pos];
      } else if (score === bestScore) {
        bestMoves.push(pos);
      }
    }

    const choice = bestMoves[Math.floor(Math.random() * bestMoves.length)];
    board[choice] = BLACK;
    blackPiecesToPlace--;
    drawBoard();

    if (isMillAt(choice, BLACK)) {
      mustRemove = true;
      statusEl.textContent = "AI formed a mill and will remove one of your pieces.";
      setTimeout(aiMove, 400);
      return;
    }

    if (checkWin()) return;
    currentPlayer = WHITE;
    statusEl.textContent = "Your turn.";
  } else {
    const pieces = board.reduce((acc, v, i) => v === BLACK ? acc.concat(i) : acc, []);
    const count = pieces.length;
    const moves = [];

    for (const from of pieces) {
      if (count === 3) {
        for (let to = 0; to < 24; to++) {
          if (board[to] === EMPTY) moves.push({ from, to });
        }
      } else {
        for (const to of ADJ[from] || []) {
          if (board[to] === EMPTY) moves.push({ from, to });
        }
      }
    }

    if (moves.length === 0) {
      if (checkWin()) return;
      currentPlayer = WHITE;
      statusEl.textContent = "Your turn.";
      return;
    }

    let bestMoves = [];
    let bestScore = -Infinity;

    for (const { from, to } of moves) {
      const bCopy = board.slice();
      bCopy[from] = EMPTY;
      bCopy[to] = BLACK;
      let score = 0;
      if (isMillAt(to, BLACK, bCopy)) score += 10;
      for (const [a,b,c] of MILLS) {
        if (bCopy[a] === WHITE && bCopy[b] === WHITE && bCopy[c] === EMPTY) score += 2;
        if (bCopy[a] === WHITE && bCopy[b] === EMPTY && bCopy[c] === WHITE) score += 2;
        if (bCopy[a] === EMPTY && bCopy[b] === WHITE && bCopy[c] === WHITE) score += 2;
      }
      if (score > bestScore) {
        bestScore = score;
        bestMoves = [{ from, to }];
      } else if (score === bestScore) {
        bestMoves.push({ from, to });
      }
    }

    const choice = bestMoves[Math.floor(Math.random() * bestMoves.length)];
    board[choice.from] = EMPTY;
    board[choice.to] = BLACK;
    drawBoard();

    if (isMillAt(choice.to, BLACK)) {
      mustRemove = true;
      statusEl.textContent = "AI formed a mill and will remove one of your pieces.";
      setTimeout(aiMove, 400);
      return;
    }

    if (checkWin()) return;
    currentPlayer = WHITE;
    statusEl.textContent = "Your turn.";
  }
}

canvas.addEventListener('click', handleClick);
resetBtn.addEventListener('click', initGame);

initGame();