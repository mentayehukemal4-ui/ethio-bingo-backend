const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const TelegramBot = require('node-telegram-bot-api');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// የ ቦት Token
const token = '8950953716:AAFyQhK0_DSKysJc4WU1i_UnRnQVSEsYd2k';
const bot = new TelegramBot(token);

// Render የሚሰራበትን የዘመነ URL (Render Auto URL ወይም Environment Variable)
const RENDER_URL = process.env.RENDER_EXTERNAL_URL || `https://ethio-bingo-backend-ix2f.onrender.com`;

// Webhook ን ከ Render ሰርቨር ጋር ማያያዝ
bot.setWebHook(`${RENDER_URL}/bot${token}`);

// የቴሌግራም Webhook Endpoint
app.post(`/bot${token}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Telegram Bot Start Command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  
  bot.sendMessage(chatId, "እንኳን ወደ Beteseb Bingo በሰላም መጡ! 🎲🎉\n\nታች ያለውን አዝራር በመጫን ጨዋታውን ይጀምሩ።", {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "🎮 Ethio Bingo ጀምር (Play)",
            web_app: { url: "https://ethio-bingo-frontend.vercel.app" }
          }
        ]
      ]
    }
  });
});

app.get('/', (req, res) => {
  res.send('Ethio Bingo Backend is running!');
});

// የካርቴላ ማመንጫ logic
function generateSingleCartela(id) {
  const getPartition = (min, max, count) => {
    let nums = [];
    while (nums.length < count) {
      let r = Math.floor(Math.random() * (max - min + 1)) + min;
      if (!nums.includes(r)) nums.push(r);
    }
    return nums;
  };

  return {
    id: id,
    B: getPartition(1, 15, 5),
    I: getPartition(16, 30, 5),
    N: [...getPartition(31, 45, 2), "FREE", ...getPartition(31, 45, 2)],
    G: getPartition(46, 60, 5),
    O: getPartition(61, 75, 5)
  };
}

const ALL_CARTELAS = {};
for (let i = 1; i <= 200; i++) {
  ALL_CARTELAS[i] = generateSingleCartela(i);
}

let takenCartelas = {};

function checkBingoWin(cartela, drawnNumbers) {
  const drawnSet = new Set(drawnNumbers);
  drawnSet.add("FREE");

  const grid = [];
  const keys = ["B", "I", "N", "G", "O"];
  for (let r = 0; r < 5; r++) {
    grid[r] = [];
    for (let c = 0; c < 5; c++) {
      grid[r][c] = cartela[keys[c]][r];
    }
  }

  for (let r = 0; r < 5; r++) {
    if (grid[r].every(num => drawnSet.has(num))) return true;
  }
  for (let c = 0; c < 5; c++) {
    let win = true;
    for (let r = 0; r < 5; r++) {
      if (!drawnSet.has(grid[r][c])) { win = false; break; }
    }
    if (win) return true;
  }
  let diag1 = true, diag2 = true;
  for (let i = 0; i < 5; i++) {
    if (!drawnSet.has(grid[i][i])) diag1 = false;
    if (!drawnSet.has(grid[i][4 - i])) diag2 = false;
  }
  return diag1 || diag2;
}

let drawnNumbers = [];
let availableNumbers = Array.from({ length: 75 }, (_, i) => i + 1);
let gameInterval = null;

function startNewGame() {
  drawnNumbers = [];
  availableNumbers = Array.from({ length: 75 }, (_, i) => i + 1);
  console.log("🎮 አዲስ የ Ethio-Bingo ጨዋታ ተጀምሯል!");

  if (gameInterval) clearInterval(gameInterval);

  gameInterval = setInterval(() => {
    if (availableNumbers.length === 0) {
      clearInterval(gameInterval);
      io.emit("game_over", "ሁሉም ቁጥሮች አልቀዋል!");
      return;
    }

    const randomIndex = Math.floor(Math.random() * availableNumbers.length);
    const drawn = availableNumbers.splice(randomIndex, 1)[0];
    drawnNumbers.push(drawn);

    let letter = drawn <= 15 ? "B" : drawn <= 30 ? "I" : drawn <= 45 ? "N" : drawn <= 60 ? "G" : "O";
    const callData = { letter, number: drawn, fullCall: `${letter}-${drawn}` };

    io.emit("number_drawn", { call: callData, history: drawnNumbers });
  }, 3000);
}

io.on("connection", (socket) => {
  socket.emit("taken_cartelas_update", Object.keys(takenCartelas).map(Number));

  socket.on("select_cartela", (cartelaId) => {
    if (takenCartelas[cartelaId]) {
      socket.emit("cartela_error", "ይህ ካርቴላ ተይዟል! እባክዎ ሌላ ይምረጡ።");
      return;
    }
    takenCartelas[cartelaId] = socket.id;
    socket.selectedCartela = ALL_CARTELAS[cartelaId];

    socket.emit("your_cartela", socket.selectedCartela);
    io.emit("taken_cartelas_update", Object.keys(takenCartelas).map(Number));
  });

  socket.on("claim_bingo", () => {
    if (!socket.selectedCartela) {
      socket.emit("false_bingo", "❌ በመጀመሪያ ካርቴላ ይምረጡ!");
      return;
    }
    const isWin = checkBingoWin(socket.selectedCartela, drawnNumbers);
    if (isWin) {
      io.emit("bingo_winner", { winnerId: socket.id, message: `🎉 ቢንጎ! ካርቴላ #${socket.selectedCartela.id} አሸናፊ ሆኗል!` });
      clearInterval(gameInterval);
    } else {
      socket.emit("false_bingo", "❌ ገና አልሞሉም! ጨዋታው ይቀጥላል።");
    }
  });

  socket.on("disconnect", () => {
    for (let id in takenCartelas) {
      if (takenCartelas[id] === socket.id) {
        delete takenCartelas[id];
        break;
      }
    }
    io.emit("taken_cartelas_update", Object.keys(takenCartelas).map(Number));
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  startNewGame();
});
