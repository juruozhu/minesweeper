/* ===== 经典扫雷 游戏逻辑 ===== */
(function () {
  "use strict";

  // ---------- 难度配置 ----------
  const DIFFS = {
    beginner:      { name: "初级", rows: 9,  cols: 9,  mines: 10 },
    intermediate:  { name: "中级", rows: 16, cols: 16, mines: 40 }
  };

  // 自定义难度上限（保证可容纳于手机屏幕）
  const CUSTOM_MAX = 20;

  let cfg = DIFFS.beginner;

  // ---------- 游戏状态 ----------
  let grid = [];          // 二维数组：每格 {mine, revealed, flagged}
  let cellEls = [];       // 格子的 DOM 缓存（索引 = r * cols + c），避免反复查询
  let state = "idle";     // idle | playing | won | lost
  let minesLeft = 0;      // 剩余可插旗数
  let safeCells = 0;      // 未翻开的非雷格数量
  let startTime = 0;
  let elapsedSec = 0;     // 已用秒数（供胜利提示使用）
  let timerId = null;
  let clickMode = "reveal"; // reveal 排雷 | flag 插旗

  // ---------- DOM ----------
  const boardEl = document.getElementById("board");
  const resetBtn = document.getElementById("resetBtn");
  const minesDisp = document.getElementById("minesDisp");
  const timerDisp = document.getElementById("timerDisp");
  const msgEl = document.getElementById("msg");
  const hintEl = document.getElementById("hint");
  const diffBtns = document.querySelectorAll("#difficulty button");
  const toolRevealBtn = document.getElementById("toolReveal");
  const toolFlagBtn = document.getElementById("toolFlag");
  const toolRevealIcon = document.getElementById("toolRevealIcon");
  const toolFlagIcon = document.getElementById("toolFlagIcon");
  const customRowsEl = document.getElementById("customRows");
  const customColsEl = document.getElementById("customCols");
  const customMinesEl = document.getElementById("customMines");
  const applyCustomBtn = document.getElementById("applyCustom");
  const settingsOverlay = document.getElementById("settingsOverlay");
  const closeSettingsBtn = document.getElementById("close-settings");

  // 创建一张像素素材图
  //  - draggable=false + CSS -webkit-user-drag:none：禁用 <img> 原生拖拽，
  //    否则桌面端按住格子拖动会触发原生 dragstart 而非 pointermove，
  //    导致 dragged 标志不置位，松手时误触发一次单击动作。
  function createPixelImg(src, className, alt) {
    const img = document.createElement("img");
    img.className = className;
    img.src = src;
    img.alt = alt || "";
    img.draggable = false;
    img.decoding = "async";
    return img;
  }

  let curFace = null; // 当前表情，避免重复重建 DOM

  function setFace(face) {
    // face: idle(正常) | win(墨镜) | lose(X_X)
    // 素材对应：MS_FACES[0]=正常、[1]=胜利墨镜、[2]=失败
    if (curFace === face) return;
    curFace = face;
    const map = { idle: 0, win: 1, lose: 2 };
    const idx = map[face] != null ? map[face] : 0;
    resetBtn.innerHTML = "";
    resetBtn.appendChild(createPixelImg(MS_FACES[idx], "face-pixel", ""));
  }

  // ---------- 初始化棋盘 ----------
  function initGrid() {
    grid = [];
    for (let r = 0; r < cfg.rows; r++) {
      const row = [];
      for (let c = 0; c < cfg.cols; c++) {
        row.push({ mine: false, revealed: false, flagged: false, n: 0 });
      }
      grid.push(row);
    }
  }

  // 随机布雷（首次点击的格子及周围 3×3 区域内不放雷）
  // 用「候选池洗牌」代替 while 重试，确保任何雷数下都不会死循环
  function placeMines(excludeR, excludeC) {
    const total = cfg.rows * cfg.cols;
    const all = [];
    const nearFirst = new Set();
    for (let r = 0; r < cfg.rows; r++) {
      for (let c = 0; c < cfg.cols; c++) {
        const key = r * cfg.cols + c;
        all.push(key);
        if (Math.abs(r - excludeR) <= 1 && Math.abs(c - excludeC) <= 1) nearFirst.add(key);
      }
    }

    // 优先排除 3×3 安全区；若雷数太多放不下，退化为只排除首击格本身
    let pool = all.filter((k) => !nearFirst.has(k));
    if (pool.length < cfg.mines) {
      const firstKey = excludeR * cfg.cols + excludeC;
      pool = all.filter((k) => k !== firstKey);
    }

    // Fisher–Yates 洗牌后取前 N 个
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = pool[i]; pool[i] = pool[j]; pool[j] = t;
    }
    for (let i = 0; i < cfg.mines; i++) {
      const k = pool[i];
      grid[Math.floor(k / cfg.cols)][k % cfg.cols].mine = true;
    }
    calculateNumbers();
  }

  // 计算每个格子周围的地雷数
  function calculateNumbers() {
    for (let r = 0; r < cfg.rows; r++) {
      for (let c = 0; c < cfg.cols; c++) {
        if (grid[r][c].mine) { grid[r][c].n = -1; continue; }
        let n = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < cfg.rows && nc >= 0 && nc < cfg.cols && grid[nr][nc].mine) {
              n++;
            }
          }
        }
        grid[r][c].n = n;
      }
    }
  }

  // ---------- 渲染 ----------
  // 自适应格子尺寸：保证棋盘（含自定义上限）完整容纳于手机屏幕
  function fitCellSize() {
    const maxW = Math.min(window.innerWidth * 0.90, 760);
    const maxH = Math.min(window.innerHeight * 0.55, 620);
    const byW = Math.floor(maxW / cfg.cols);
    const byH = Math.floor(maxH / cfg.rows);
    let size = Math.min(32, byW, byH);
    size = Math.max(12, size);
    document.documentElement.style.setProperty("--cell-size", size + "px");
  }

  function renderBoard() {
    fitCellSize();
    boardEl.style.gridTemplateColumns = `repeat(${cfg.cols}, var(--cell-size))`;
    boardEl.innerHTML = "";
    cellEls = [];
    for (let r = 0; r < cfg.rows; r++) {
      for (let c = 0; c < cfg.cols; c++) {
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.dataset.r = r;
        cell.dataset.c = c;
        updateCell(cell, grid[r][c]);
        boardEl.appendChild(cell);
        cellEls.push(cell);
      }
    }
    updateCounters();
  }

  function updateCell(el, data) {
    el.className = "cell";
    el.innerHTML = "";
    el.removeAttribute("aria-label");

    if (data.flagged) {
      el.appendChild(createPixelImg(MS_FLAG, "grid-flag", "旗帜"));
    } else if (data.revealed) {
      el.classList.add("revealed");
      if (data.mine) {
        el.appendChild(createPixelImg(MS_MINE, "grid-mine", "地雷"));
      } else if (data.n > 0) {
        // 数字是纯装饰性图像，alt 留空避免读屏朗读数字噪音
        el.appendChild(createPixelImg(MS_GRID_DIGITS[data.n - 1], "grid-digit", ""));
        el.setAttribute("aria-label", "周围 " + data.n + " 个雷");
      }
    }
  }

  // ---------- 计数器 / 计时 ----------
  // 把三位数字字符串渲染成 LED 像素图（复用已有节点，只改 src，避免每 200ms 重建 DOM）
  function renderLed(el, numStr) {
    el.classList.add("pixel-led");
    const s = String(numStr);
    // 节点数量变化时（如位数不同）才重建
    if (el.childElementCount !== s.length) {
      el.innerHTML = "";
      for (let i = 0; i < s.length; i++) {
        const img = document.createElement("img");
        img.className = "led-digit";
        img.alt = "";
        img.draggable = false;
        img.decoding = "async";
        el.appendChild(img);
      }
    }
    for (let i = 0; i < s.length; i++) {
      const src = MS_LED_DIGITS[+s[i]];
      const img = el.children[i];
      if (img.getAttribute("src") !== src) img.src = src;
    }
  }

  function updateCounters() {
    renderLed(minesDisp, String(minesLeft).padStart(3, "0"));
  }

  function resetTimer() {
    clearInterval(timerId);
    renderLed(timerDisp, "000");
    startTime = 0;
    elapsedSec = 0;
    timerId = null;
  }

  function startTimer() {
    if (timerId) return;
    startTime = Date.now();
    elapsedSec = 0;
    timerId = setInterval(() => {
      const sec = Math.min(999, Math.floor((Date.now() - startTime) / 1000));
      elapsedSec = sec;
      renderLed(timerDisp, String(sec).padStart(3, "0"));
    }, 200);
  }

  function stopTimer() {
    clearInterval(timerId);
    timerId = null;
    if (startTime) {
      elapsedSec = Math.min(999, Math.floor((Date.now() - startTime) / 1000));
    }
  }

  // ---------- 翻开 ----------
  function floodReveal(r, c) {
    const cell = grid[r][c];
    if (cell.revealed || cell.flagged) return;
    cell.revealed = true;
    if (!cell.mine) safeCells--;

    if (cell.n === 0 && !cell.mine) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < cfg.rows && nc >= 0 && nc < cfg.cols && !grid[nr][nc].revealed && !grid[nr][nc].mine) {
            floodReveal(nr, nc);
          }
        }
      }
    }
  }

  function revealCell(r, c) {
    const cell = grid[r][c];
    if (cell.revealed || cell.flagged || state === "won" || state === "lost") return;

    // 第一次点击才开始布雷 + 计时
    if (state === "idle") {
      placeMines(r, c);
      state = "playing";
      startTimer();
    }

    if (cell.mine) {
      cell.revealed = true;
      gameOver(r, c);
      return;
    }

    floodReveal(r, c);
    syncRevealed();

    // 胜利判定
    if (safeCells <= 0) {
      winGame();
      return;
    }
  }

  // 把当前所有已翻开但 DOM 未同步的格子更新一遍（含泛洪区域）
  function syncRevealed() {
    for (let r = 0; r < cfg.rows; r++) {
      for (let c = 0; c < cfg.cols; c++) {
        const data = grid[r][c];
        if (data.revealed && !data.flagged) {
          applyCellState(r, c);
        }
      }
    }
  }

  // 将逻辑状态同步到 DOM 的单个格子
  function applyCellState(r, c) {
    const el = getCellEl(r, c);
    if (el) updateCell(el, grid[r][c]);
  }

  function getCellEl(r, c) {
    return cellEls[r * cfg.cols + c] || null;
  }

  // ---------- 插旗 / 取消 ----------
  function toggleFlag(r, c) {
    const cell = grid[r][c];
    if (state !== "playing" && state !== "idle") return;
    if (cell.revealed) return;

    if (cell.flagged) {
      cell.flagged = false;
      minesLeft++;
    } else {
      if (minesLeft <= 0) return; // 无旗可用
      cell.flagged = true;
      minesLeft--;
    }
    applyCellState(r, c);
    updateCounters();
  }

  // ---------- 输 / 赢 ----------
  function gameOver(hitR, hitC) {
    state = "lost";
    stopTimer();

    // 翻开所有雷，标出错误旗
    for (let r = 0; r < cfg.rows; r++) {
      for (let c = 0; c < cfg.cols; c++) {
        const data = grid[r][c];
        if (data.mine) {
          data.revealed = true;
          applyCellState(r, c); // 重绘，让全部地雷都显示出来
        } else if (data.flagged) {
          // 错误的旗 → 标记
          const el = getCellEl(r, c);
          if (el) { el.textContent = "❌"; el.classList.add("revealed"); el.style.background = "#e88"; }
        }
      }
    }

    // 被踩中的那颗雷单独标红底（地雷图已由上面的 applyCellState 绘制，这里不再重复添加）
    const hitEl = getCellEl(hitR, hitC);
    if (hitEl) hitEl.classList.add("mine-hit");

    setFace("lose");
    msgEl.textContent = "踩到地雷了，游戏结束！可点击表情重开。";
  }

  function winGame() {
    state = "won";
    stopTimer();

    // 胜利收尾：清掉非雷格上的误插旗，并把所有地雷补上旗
    for (let r = 0; r < cfg.rows; r++) {
      for (let c = 0; c < cfg.cols; c++) {
        const data = grid[r][c];
        if (data.mine && !data.flagged) {
          data.flagged = true;
          applyCellState(r, c);
        } else if (!data.mine && data.flagged) {
          data.flagged = false;
          applyCellState(r, c);
        }
      }
    }
    minesLeft = 0;
    updateCounters();
    setFace("win");
    msgEl.textContent = "你赢了，用时" + elapsedSec + "秒！点击表情重新开始。";
  }

  // ---------- 重新开始 ----------
  function newGame() {
    resetTimer();
    state = "idle";
    initGrid();
    minesLeft = cfg.mines;
    safeCells = cfg.rows * cfg.cols - cfg.mines;
    setFace("idle");
    msgEl.textContent = "";
    renderBoard();
  }

  // ---------- 事件绑定 ----------
  function cellFromEvent(e) {
    const cell = e.target.closest(".cell");
    return cell;
  }

  // 长按识别为「插旗」（对应桌面右键）。时长(ms)与允许位移(px)
  const LONG_PRESS_MS = 450;
  const TAP_DRAG_THRESHOLD = 8;

  // 棋盘主交互：统一鼠标 + 触摸（Pointer Events）
  //   - 单击（短按、基本不移动）      → 排雷模式=翻开 / 插旗模式=插旗
  //   - 长按（按住 LONG_PRESS_MS 不动）→ 插旗 / 取消旗（对应右键）
  //   - 桌面右键                      → 插旗 / 取消旗
  //   - 拖动                          → 不触发任何操作（插旗只支持单击）
  boardEl.addEventListener("pointerdown", (e) => {
    if (!e.isPrimary) return;
    const cell = cellFromEvent(e);
    if (!cell) return;
    const r = +cell.dataset.r, c = +cell.dataset.c;

    // 桌面右键 → 立即插旗
    if (e.pointerType === "mouse" && e.button === 2) {
      toggleFlag(r, c);
      return;
    }
    if (e.button === 2) return; // 非主键触摸一律忽略
    e.preventDefault();

    const startX = e.clientX, startY = e.clientY;
    let longFired = false;
    let dragged = false;

    // 长按定时器 → 触发插旗
    let cancelLongFired = false;
    const longTimer = setTimeout(() => {
      longFired = true;
      cancelLongFired = true;
      toggleFlag(r, c); // 长按插旗 / 取消
      setFace(state === "won" ? "win" : state === "lost" ? "lose" : "idle");
    }, LONG_PRESS_MS);

    const moveHandler = (ev) => {
      if (!ev.isPrimary) return;
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) > TAP_DRAG_THRESHOLD) {
        dragged = true;
        // 移动超过阈值 → 取消长按
        if (!cancelLongFired) { clearTimeout(longTimer); cancelLongFired = true; }
      }
    };

    const upHandler = (ev) => {
      window.removeEventListener("pointermove", moveHandler);
      window.removeEventListener("pointerup", upHandler);
      boardEl.removeEventListener("pointerleave", leaveHandler);
      if (!cancelLongFired) { clearTimeout(longTimer); cancelLongFired = true; }
      setFace(state === "won" ? "win" : state === "lost" ? "lose" : "idle");

      const cc = cellFromEvent(ev);
      // 已长按插旗过 → 不再做单击动作
      if (longFired) return;
      // 已拖动 → 不做单击动作
      if (dragged) return;
      if (!cc) return;
      const rr = +cc.dataset.r, rrr = +cc.dataset.c;
      // 单击动作
      if (clickMode === "reveal") revealCell(rr, rrr);
      else toggleFlag(rr, rrr); // 插旗模式下单击 = 插旗
    };

    const leaveHandler = () => {
      window.removeEventListener("pointermove", moveHandler);
      window.removeEventListener("pointerup", upHandler);
      boardEl.removeEventListener("pointerleave", leaveHandler);
      if (!cancelLongFired) { clearTimeout(longTimer); cancelLongFired = true; }
      if (state !== "lost" && state !== "won") setFace("idle");
    };

    boardEl.addEventListener("pointermove", moveHandler);
    window.addEventListener("pointerup", upHandler);
    boardEl.addEventListener("pointerleave", leaveHandler);
  });

  // 右键禁用系统菜单，避免打扰（配合 pointerdown 中 button===2 处理）
  boardEl.addEventListener("contextmenu", (e) => e.preventDefault());
  // 兜底：禁止棋盘内任何原生拖拽（img 已设 draggable=false，这里再兜一层）
  boardEl.addEventListener("dragstart", (e) => e.preventDefault());

  resetBtn.addEventListener("click", newGame);

  // ---------- 难度切换 ----------
  function setDifficulty(diff) {
    diffBtns.forEach((b) => b.classList.remove("active"));
    if (diff === "custom") {
      // 应用自定义参数
      const r = clampInt(customRowsEl.value, 5, CUSTOM_MAX);
      const c = clampInt(customColsEl.value, 5, CUSTOM_MAX);
      // 至少留出首击的 3×3 安全区，避免雷数塞满导致无处布雷
      const m = clampInt(customMinesEl.value, 1, Math.max(1, r * c - 9));
      cfg = { name: "自定义", rows: r, cols: c, mines: m };
      customRowsEl.value = r;
      customColsEl.value = c;
      customMinesEl.value = m;
      const customBtn = document.querySelector('#difficulty [data-diff="custom"]');
      if (customBtn) customBtn.classList.add("active");
    } else {
      cfg = DIFFS[diff];
      const btn = document.querySelector(`#difficulty [data-diff="${diff}"]`);
      if (btn) btn.classList.add("active");
    }
    newGame();
  }

  function clampInt(v, min, max) {
    let n = parseInt(v, 10);
    if (isNaN(n)) n = min;
    return Math.max(min, Math.min(n, max));
  }

  // 难度按钮：自定义 → 打开设置弹窗（设置功能并入自定义按钮）；其余切难度
  diffBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.diff === "custom") {
        openSettings();
      } else {
        setDifficulty(btn.dataset.diff);
      }
    });
  });

  // 应用自定义按钮
  applyCustomBtn.addEventListener("click", () => setDifficulty("custom"));

  // ---------- 单击模式切换（排雷 / 插旗） ----------
  function setClickMode(mode) {
    clickMode = mode;
    toolRevealBtn.classList.toggle("active", mode === "reveal");
    toolFlagBtn.classList.toggle("active", mode === "flag");
    hintEl.innerHTML = mode === "reveal"
      ? '单击：翻开 &nbsp;|&nbsp; 长按：插旗 / 取消旗'
      : '单击：插旗 / 取消旗';
  }
  // 主界面工具栏图标：单击切换模式
  toolRevealIcon.src = MS_ICON_REVEAL; // 素材统一从 assets.js 取，避免两套路径通道
  toolFlagIcon.src = MS_ICON_FLAG;
  toolRevealBtn.addEventListener("click", () => setClickMode("reveal"));
  toolFlagBtn.addEventListener("click", () => setClickMode("flag"));
  setClickMode("reveal");

  // ---------- 设置弹窗开关 ----------
  function openSettings() {
    settingsOverlay.classList.add("open");
  }
  function closeSettings() {
    settingsOverlay.classList.remove("open");
  }
  closeSettingsBtn.addEventListener("click", closeSettings);
  // 点击遮罩空白处关闭（触摸/鼠标通用）
  settingsOverlay.addEventListener("pointerdown", (e) => {
    if (e.target === settingsOverlay) closeSettings();
  });
  // Esc 关闭
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSettings();
  });

  // 窗口尺寸变化时重新适配格子大小（手机旋转 / 缩放）
  window.addEventListener("resize", fitCellSize);

  // 启动
  newGame();
})();