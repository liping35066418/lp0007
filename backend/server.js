const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 9607;
const HOST = '127.0.0.1';
const ALLOWED_ORIGIN = `http://${HOST}:3607`;
const BEST_SCORES_FILE = path.join(__dirname, 'best_scores.json');

const DIFFICULTY_CONFIG = {
  easy: { name: '简单', min: 1, max: 50 },
  normal: { name: '普通', min: 1, max: 100 },
  hard: { name: '困难', min: 1, max: 500 }
};

let currentDifficulty = 'normal';

let gameStates = {};

let bestScores = loadBestScores();

function loadBestScores() {
  try {
    if (fs.existsSync(BEST_SCORES_FILE)) {
      const data = fs.readFileSync(BEST_SCORES_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      return {
        easy: parsed.easy || null,
        normal: parsed.normal || null,
        hard: parsed.hard || null
      };
    }
  } catch (e) {
    console.error('加载最佳成绩失败:', e.message);
  }
  return { easy: null, normal: null, hard: null };
}

function saveBestScores() {
  try {
    fs.writeFileSync(BEST_SCORES_FILE, JSON.stringify(bestScores, null, 2), 'utf-8');
  } catch (e) {
    console.error('保存最佳成绩失败:', e.message);
  }
}

function generateAnswer(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function initGame(difficulty) {
  const config = DIFFICULTY_CONFIG[difficulty];
  gameStates[difficulty] = {
    answer: generateAnswer(config.min, config.max),
    minRange: config.min,
    maxRange: config.max,
    attempts: 0,
    isFinished: false
  };
}

function getCurrentGameState() {
  if (!gameStates[currentDifficulty]) {
    initGame(currentDifficulty);
  }
  return gameStates[currentDifficulty];
}

function sendJSON(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 1e6) {
        reject(new Error('请求体过大'));
        req.connection.destroy();
      }
    });
    req.on('end', () => {
      if (!data) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(new Error('JSON解析失败'));
      }
    });
    req.on('error', reject);
  });
}

function handleOptions(req, res) {
  res.writeHead(204, {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400'
  });
  res.end();
}

const server = http.createServer(async (req, res) => {
  const { method, url } = req;

  if (method === 'OPTIONS') {
    handleOptions(req, res);
    return;
  }

  if (method === 'GET' && url === '/api/game/info') {
    const gameState = getCurrentGameState();
    const config = DIFFICULTY_CONFIG[currentDifficulty];
    sendJSON(res, 200, {
      difficulty: currentDifficulty,
      difficultyName: config.name,
      minRange: gameState.minRange,
      maxRange: gameState.maxRange,
      attempts: gameState.attempts,
      isFinished: gameState.isFinished,
      answer: gameState.isFinished ? gameState.answer : null,
      bestScores: bestScores,
      difficultyConfig: DIFFICULTY_CONFIG
    });
    return;
  }

  if (method === 'POST' && url === '/api/game/difficulty') {
    try {
      const body = await parseBody(req);
      const { difficulty } = body;

      if (!DIFFICULTY_CONFIG[difficulty]) {
        sendJSON(res, 400, {
          success: false,
          message: '无效的难度级别'
        });
        return;
      }

      currentDifficulty = difficulty;
      initGame(difficulty);

      const gameState = getCurrentGameState();
      const config = DIFFICULTY_CONFIG[difficulty];

      sendJSON(res, 200, {
        success: true,
        message: `已切换到${config.name}难度（${config.min}-${config.max}），新游戏已开始`,
        difficulty: currentDifficulty,
        difficultyName: config.name,
        minRange: gameState.minRange,
        maxRange: gameState.maxRange,
        bestScores: bestScores
      });
    } catch (err) {
      sendJSON(res, 400, {
        success: false,
        message: err.message || '请求处理失败'
      });
    }
    return;
  }

  if (method === 'POST' && url === '/api/game/guess') {
    try {
      const gameState = getCurrentGameState();
      const body = await parseBody(req);
      const { guess } = body;

      if (gameState.isFinished) {
        sendJSON(res, 400, {
          success: false,
          message: '游戏已结束，请重置开启新游戏'
        });
        return;
      }

      let guessNum;

      if (typeof guess === 'number') {
        if (!Number.isFinite(guess)) {
          sendJSON(res, 400, {
            success: false,
            message: '请输入有效的整数'
          });
          return;
        }
        if (!Number.isInteger(guess)) {
          sendJSON(res, 400, {
            success: false,
            message: '请输入整数，不支持小数'
          });
          return;
        }
        if (guess < 0) {
          sendJSON(res, 400, {
            success: false,
            message: '请输入正整数，不能是负数'
          });
          return;
        }
        guessNum = guess;
      } else if (typeof guess === 'string') {
        if (!guess) {
          sendJSON(res, 400, {
            success: false,
            message: '请输入一个数字再开始猜哦'
          });
          return;
        }
        if (/\s/.test(guess)) {
          sendJSON(res, 400, {
            success: false,
            message: '输入不能包含空格，请输入纯数字'
          });
          return;
        }
        if (guess.includes('-')) {
          sendJSON(res, 400, {
            success: false,
            message: '请输入正整数，不能是负数'
          });
          return;
        }
        if (guess.includes('.')) {
          sendJSON(res, 400, {
            success: false,
            message: '请输入整数，不支持小数'
          });
          return;
        }
        if (!/^\d+$/.test(guess)) {
          sendJSON(res, 400, {
            success: false,
            message: '请输入有效的正整数，不能含字母或特殊字符'
          });
          return;
        }
        guessNum = Number(guess);
      } else {
        sendJSON(res, 400, {
          success: false,
          message: '请输入有效的正整数'
        });
        return;
      }

      if (!Number.isFinite(guessNum) || !Number.isSafeInteger(guessNum)) {
        sendJSON(res, 400, {
          success: false,
          message: '数字太大啦，请输入较小的整数'
        });
        return;
      }

      if (guessNum < gameState.minRange || guessNum > gameState.maxRange) {
        sendJSON(res, 400, {
          success: false,
          message: `请输入 ${gameState.minRange} 到 ${gameState.maxRange} 之间的整数`
        });
        return;
      }

      gameState.attempts++;

      let result;
      let message;
      let isNewRecord = false;

      if (guessNum === gameState.answer) {
        gameState.isFinished = true;
        result = 'correct';

        const currentBest = bestScores[currentDifficulty];
        if (currentBest === null || gameState.attempts < currentBest) {
          bestScores[currentDifficulty] = gameState.attempts;
          saveBestScores();
          isNewRecord = true;
        }

        const recordText = isNewRecord ? ' 🏆新纪录！' : '';
        message = `猜对答案！答案是 ${gameState.answer}，共猜了 ${gameState.attempts} 次${recordText}`;
      } else if (guessNum > gameState.answer) {
        result = 'too_high';
        message = '数字偏大';
      } else {
        result = 'too_low';
        message = '数字偏小';
      }

      sendJSON(res, 200, {
        success: true,
        result,
        message,
        attempts: gameState.attempts,
        isFinished: gameState.isFinished,
        answer: gameState.isFinished ? gameState.answer : null,
        isNewRecord,
        bestScore: bestScores[currentDifficulty]
      });
    } catch (err) {
      sendJSON(res, 400, {
        success: false,
        message: err.message || '请求处理失败'
      });
    }
    return;
  }

  if (method === 'POST' && url === '/api/game/reset') {
    try {
      initGame(currentDifficulty);
      const gameState = getCurrentGameState();

      sendJSON(res, 200, {
        success: true,
        message: '新游戏已开始',
        difficulty: currentDifficulty,
        difficultyName: DIFFICULTY_CONFIG[currentDifficulty].name,
        minRange: gameState.minRange,
        maxRange: gameState.maxRange,
        bestScore: bestScores[currentDifficulty]
      });
    } catch (err) {
      sendJSON(res, 400, {
        success: false,
        message: err.message || '请求处理失败'
      });
    }
    return;
  }

  sendJSON(res, 404, {
    success: false,
    message: '接口不存在'
  });
});

server.listen(PORT, HOST, () => {
  console.log(`猜数字游戏后端服务已启动: http://${HOST}:${PORT}`);
  console.log(`难度配置: 简单(1-50) 普通(1-100) 困难(1-500)`);
  console.log(`最佳成绩存储: ${BEST_SCORES_FILE}`);
});
