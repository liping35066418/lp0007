#!/bin/zsh

cd "$(dirname "$0")"

echo "🚀 正在启动猜数字游戏服务..."
echo ""

echo "🎮 启动后端服务 (端口 9607)..."
node backend/server.js &
BACKEND_PID=$!

sleep 1

echo "🌐 启动前端服务 (端口 3607)..."
node frontend/server.js &
FRONTEND_PID=$!

sleep 1

echo ""
echo "✅ 服务启动完成！"
echo "   前端地址: http://127.0.0.1:3607"
echo "   后端地址: http://127.0.0.1:9607"
echo ""
echo "按 Ctrl+C 停止所有服务"

cleanup() {
  echo ""
  echo "🛑 正在停止服务..."
  kill $BACKEND_PID 2>/dev/null
  kill $FRONTEND_PID 2>/dev/null
  wait $BACKEND_PID 2>/dev/null
  wait $FRONTEND_PID 2>/dev/null
  echo "✅ 所有服务已停止"
  exit 0
}

trap cleanup SIGINT SIGTERM

wait
