const http = require('http');

const PORT = 9607;
const HOST = '127.0.0.1';
const ALLOWED_ORIGIN = `http://${HOST}:3607`;

let gameState = {
  answer: null,
  minRange: 1,
  maxRange: 100,
  attempts: 0,
  isFinished: false
};

function generateAnswer(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function initGame(min = 1, max = 100) {
  gameState = {
    answer: generateAnswer(min, max),
    minRange: min,
    maxRange: max,
    attempts: 0,
    isFinished: false
  };
}

initGame();

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
    sendJSON(res, 200, {
      minRange: gameState.minRange,
      maxRange: gameState.maxRange,
      attempts: gameState.attempts,
      isFinished: gameState.isFinished,
      answer: gameState.isFinished ? gameState.answer : null
    });
    return;
  }

  if (method === 'POST' && url === '/api/game/guess') {
    try {
      const body = await parseBody(req);
      const { guess } = body;

      if (gameState.isFinished) {
        sendJSON(res, 400, {
          success: false,
          message: '游戏已结束，请重置开启新游戏'
        });
        return;
      }

      const guessNum = parseInt(guess, 10);

      if (isNaN(guessNum)) {
        sendJSON(res, 400, {
          success: false,
          message: '请输入有效的数字'
        });
        return;
      }

      if (guessNum < gameState.minRange || guessNum > gameState.maxRange) {
        sendJSON(res, 400, {
          success: false,
          message: `请输入 ${gameState.minRange} 到 ${gameState.maxRange} 之间的数字`
        });
        return;
      }

      gameState.attempts++;

      let result;
      let message;

      if (guessNum === gameState.answer) {
        gameState.isFinished = true;
        result = 'correct';
        message = `猜对答案！答案是 ${gameState.answer}，共猜了 ${gameState.attempts} 次`;
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
        answer: gameState.isFinished ? gameState.answer : null
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
      const body = await parseBody(req);
      const { min, max } = body || {};
      const newMin = min ? parseInt(min, 10) : 1;
      const newMax = max ? parseInt(max, 10) : 100;

      if (isNaN(newMin) || isNaN(newMax) || newMin >= newMax) {
        sendJSON(res, 400, {
          success: false,
          message: '无效的数值范围'
        });
        return;
      }

      initGame(newMin, newMax);

      sendJSON(res, 200, {
        success: true,
        message: '新游戏已开始',
        minRange: gameState.minRange,
        maxRange: gameState.maxRange
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
});
