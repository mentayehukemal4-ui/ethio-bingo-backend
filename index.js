const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

let drawnNumbers = [];
let takenCartelas = [];

// 75 Numbers draw logic
setInterval(() => {
  if (drawnNumbers.length < 75) {
    let num;
    do {
      num = Math.floor(Math.random() * 75) + 1;
    } while (drawnNumbers.includes(num));

    drawnNumbers.push(num);
    let letter = num <= 15 ? 'B' : num <= 30 ? 'I' : num <= 45 ? 'N' : num <= 60 ? 'G' : 'O';
    
    io.emit("number_drawn", {
      call: { number: num, fullCall: `${letter}-${num}` },
      history: drawnNumbers
    });
  }
}, 5000);

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.emit("taken_cartelas_update", takenCartelas);

  socket.on("select_cartela", (id) => {
    if (!takenCartelas.includes(id)) {
      takenCartelas.push(id);
      // Generate sample cartela data
      let cartela = {
        id: id,
        B: [7, 6, 11, 8, 3],
        I: [26, 20, 27, 16, 19],
        N: [34, 33, "FREE", 35, 45],
        G: [49, 55, 52, 47, 56],
        O: [71, 61, 66, 74, 70]
      };
      socket.emit("your_cartela", cartela);
      io.emit("taken_cartelas_update", takenCartelas);
    } else {
      socket.emit("cartela_error", "ይህ ካርቴላ ተይዟል!");
    }
  });

  socket.on("claim_bingo", () => {
    io.emit("bingo_winner", { message: "እንኳን ደስ አሎት! አሸናፊ ተገኝቷል! 🎉" });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
