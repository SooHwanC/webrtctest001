const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const https = require('https');
const fs = require('fs');
const morgan = require('morgan'); // 로깅 미들웨어

const app = express();

// HTTP 요청 로깅
app.use(morgan('dev'));

const options = {
  key: fs.readFileSync('./private.key'),
  cert: fs.readFileSync('./certificate.crt')
};


// const server = http.createServer(app);
// HTTPS 서버 생성
const server = https.createServer(options, app);

const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log('New WebSocket connection established');

  socket.on('offer', (offer) => {
    console.log('Received an offer');
    socket.broadcast.emit('offer', offer);
  });

  socket.on('answer', (answer) => {
    console.log('Received an answer');
    socket.broadcast.emit('answer', answer);
  });

  socket.on('candidate', (candidate) => {
    console.log('Received an ICE candidate');
    socket.broadcast.emit('candidate', candidate);
  });
});

const PORT = 5001;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
