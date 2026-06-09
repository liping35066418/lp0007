const API_BASE = 'http://127.0.0.1:9607/api';

const DIFFICULTY_NAMES = {
  easy: '简单',
  normal: '普通',
  hard: '困难'
};

const state = {
  difficulty: 'normal',
  difficultyName: '普通',
  minRange: 1,
  maxRange: 100,
  attempts: 0,
  isFinished: false,
  history: [],
  bestScores: {
    easy: null,
    normal: null,
    hard: null
  }
};

const elements = {
  rangeDisplay: document.getElementById('rangeDisplay'),
  attemptsDisplay: document.getElementById('attemptsDisplay'),
  bestScoreDisplay: document.getElementById('bestScoreDisplay'),
  difficultyDisplay: document.getElementById('difficultyDisplay'),
  resultDisplay: document.getElementById('resultDisplay'),
  guessInput: document.getElementById('guessInput'),
  guessBtn: document.getElementById('guessBtn'),
  resetBtn: document.getElementById('resetBtn'),
  historyList: document.getElementById('historyList'),
  recordModal: document.getElementById('recordModal'),
  modalText: document.getElementById('modalText'),
  modalCloseBtn: document.getElementById('modalCloseBtn'),
  diffBtns: document.querySelectorAll('.diff-btn')
};

async function request(url, options = {}) {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json'
      },
      ...options
    });
    const data = await response.json();
    return data;
  } catch (error) {
    return {
      success: false,
      message: '网络连接失败，请确认后端服务已启动'
    };
  }
}

async function loadGameInfo() {
  const data = await request(`${API_BASE}/game/info`);
  if (data.success !== false) {
    state.difficulty = data.difficulty;
    state.difficultyName = data.difficultyName;
    state.minRange = data.minRange;
    state.maxRange = data.maxRange;
    state.attempts = data.attempts;
    state.isFinished = data.isFinished;
    if (data.bestScores) {
      state.bestScores = data.bestScores;
    }
    updateDifficultyButtons();
    updateDisplay();
  }
}

async function submitGuess() {
  try {
    const rawValue = elements.guessInput.value;

    if (!rawValue) {
      showResult('请输入一个数字再开始猜哦', '提示');
      return;
    }

    if (/\s/.test(rawValue)) {
      showResult('输入不能包含空格，请输入纯数字', '提示');
      return;
    }

    const guess = rawValue;

    if (guess.includes('-')) {
      showResult('请输入正整数，不能是负数', '提示');
      return;
    }

    if (guess.includes('.')) {
      showResult('请输入整数，不支持小数', '提示');
      return;
    }

    if (!/^\d+$/.test(guess)) {
      showResult('请输入有效的正整数，不能含字母或特殊字符', '提示');
      return;
    }

    const guessNum = Number(guess);

    if (!Number.isFinite(guessNum) || !Number.isSafeInteger(guessNum)) {
      showResult('数字太大啦，请输入较小的整数', '提示');
      return;
    }

    if (guessNum < state.minRange || guessNum > state.maxRange) {
      showResult(`请输入 ${state.minRange} 到 ${state.maxRange} 之间的整数`, '提示');
      return;
    }

    setLoading(true);

    const data = await request(`${API_BASE}/game/guess`, {
      method: 'POST',
      body: JSON.stringify({ guess: guessNum })
    });

    setLoading(false);

    if (!data.success) {
      showResult(data.message, '提示');
      return;
    }

    state.attempts = data.attempts;
    state.isFinished = data.isFinished;

    addHistory(guessNum, data.result);
    showResult(data.message, data.result);
    updateDisplay();

    elements.guessInput.value = '';

    if (data.bestScore !== undefined) {
      state.bestScores[state.difficulty] = data.bestScore;
      updateDisplay();
    }

    if (data.isNewRecord) {
      showRecordModal(data.attempts);
    }

    if (state.isFinished) {
      elements.guessInput.disabled = true;
    }
  } catch (err) {
    setLoading(false);
    console.error('submitGuess error:', err);
    showResult('处理出错，请重试', '提示');
  }
}

async function resetGame() {
  try {
    setLoading(true);

    const data = await request(`${API_BASE}/game/reset`, {
      method: 'POST',
      body: JSON.stringify({})
    });

    setLoading(false);

    if (!data.success) {
      showResult(data.message, '提示');
      return;
    }

    state.difficulty = data.difficulty;
    state.difficultyName = data.difficultyName;
    state.minRange = data.minRange;
    state.maxRange = data.maxRange;
    state.attempts = 0;
    state.isFinished = false;
    state.history = [];

    if (data.bestScore !== undefined) {
      state.bestScores[state.difficulty] = data.bestScore;
    }

    elements.guessInput.disabled = false;

    clearResult();
    updateDifficultyButtons();
    updateDisplay();
    renderHistory();
    elements.guessInput.focus();
  } catch (err) {
    setLoading(false);
    console.error('resetGame error:', err);
    showResult('重置出错，请重试', '提示');
  }
}

async function changeDifficulty(difficulty) {
  try {
    setLoading(true);

    const data = await request(`${API_BASE}/game/difficulty`, {
      method: 'POST',
      body: JSON.stringify({ difficulty })
    });

    setLoading(false);

    if (!data.success) {
      showResult(data.message, '提示');
      return;
    }

    state.difficulty = data.difficulty;
    state.difficultyName = data.difficultyName;
    state.minRange = data.minRange;
    state.maxRange = data.maxRange;
    state.attempts = 0;
    state.isFinished = false;
    state.history = [];

    if (data.bestScores) {
      state.bestScores = data.bestScores;
    }

    elements.guessInput.disabled = false;

    updateDifficultyButtons();
    clearResult();
    showResult(data.message, '提示');
    updateDisplay();
    renderHistory();
    elements.guessInput.focus();
  } catch (err) {
    setLoading(false);
    console.error('changeDifficulty error:', err);
    showResult('切换难度出错，请重试', '提示');
  }
}

function showResult(message, type) {
  elements.resultDisplay.classList.remove('too-high', 'too-low', 'correct');

  let emoji = '';
  let resultClass = '';

  switch (type) {
    case 'too_high':
      emoji = '📈';
      resultClass = 'too-high';
      break;
    case 'too_low':
      emoji = '📉';
      resultClass = 'too-low';
      break;
    case 'correct':
      emoji = '🎉';
      resultClass = 'correct';
      break;
    default:
      emoji = '💡';
  }

  if (resultClass) {
    elements.resultDisplay.classList.add(resultClass);
  }
  elements.resultDisplay.innerHTML = `
    <div>
      <span class="result-emoji">${emoji}</span>
      <span class="result-text">${message}</span>
    </div>
  `;
}

function clearResult() {
  elements.resultDisplay.classList.remove('too-high', 'too-low', 'correct');
  elements.resultDisplay.innerHTML = '<span class="result-placeholder">输入数字开始游戏</span>';
}

function addHistory(guess, result) {
  state.history.unshift({ guess, result, attempt: state.attempts });
  renderHistory();
}

function renderHistory() {
  if (state.history.length === 0) {
    elements.historyList.innerHTML = '<li class="history-empty">暂无记录</li>';
    return;
  }

  elements.historyList.innerHTML = state.history.map(item => {
    let resultText, resultClass;
    switch (item.result) {
      case 'too_high':
        resultText = '偏大';
        resultClass = 'high';
        break;
      case 'too_low':
        resultText = '偏小';
        resultClass = 'low';
        break;
      case 'correct':
        resultText = '猜对';
        resultClass = 'correct';
        break;
      default:
        resultText = '-';
        resultClass = '';
    }

    return `
      <li class="history-item">
        <span class="history-guess">第${item.attempt}次：${item.guess}</span>
        <span class="history-result ${resultClass}">${resultText}</span>
      </li>
    `;
  }).join('');
}

function updateDifficultyButtons() {
  elements.diffBtns.forEach(btn => {
    const diff = btn.getAttribute('data-difficulty');
    btn.classList.remove('active');
    if (diff === state.difficulty) {
      btn.classList.add('active');
    }
  });
}

function updateDisplay() {
  elements.rangeDisplay.textContent = `${state.minRange} - ${state.maxRange}`;
  elements.attemptsDisplay.textContent = state.attempts;
  elements.difficultyDisplay.textContent = state.difficultyName;

  const best = state.bestScores[state.difficulty];
  elements.bestScoreDisplay.textContent = best !== null ? `${best}次` : '--';
}

function setLoading(loading) {
  if (loading) {
    elements.guessBtn.disabled = true;
    elements.resetBtn.disabled = true;
    elements.diffBtns.forEach(btn => btn.disabled = true);
    elements.guessBtn.textContent = '提交中...';
  } else {
    elements.guessBtn.disabled = state.isFinished;
    elements.resetBtn.disabled = false;
    elements.diffBtns.forEach(btn => btn.disabled = false);
    elements.guessBtn.textContent = '猜一下';
  }
}

function showRecordModal(attempts) {
  elements.modalText.textContent = `恭喜！你在${state.difficultyName}难度下仅用 ${attempts} 次就猜中了答案，创造了新纪录！`;
  elements.recordModal.classList.add('show');
}

function hideRecordModal() {
  elements.recordModal.classList.remove('show');
}

elements.guessBtn.addEventListener('click', submitGuess);
elements.resetBtn.addEventListener('click', resetGame);
elements.modalCloseBtn.addEventListener('click', hideRecordModal);
elements.recordModal.addEventListener('click', (e) => {
  if (e.target === elements.recordModal) {
    hideRecordModal();
  }
});

elements.diffBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const diff = btn.getAttribute('data-difficulty');
    if (diff !== state.difficulty) {
      changeDifficulty(diff);
    }
  });
});

elements.guessInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !state.isFinished) {
    submitGuess();
  }
});

loadGameInfo();
