const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const https = require('https');
const fs = require('fs');

const app = express();
// const server = http.createServer(app);

const options = {
  key: fs.readFileSync('./private.key'),
  cert: fs.readFileSync('./certificate.crt')
};

const server = https.createServer(options, (req, res) => {
  res.writeHead(200);
  res.end('Hello, this is an HTTPS server!');
})



const io = require("socket.io")(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

io.on('connection', (socket) => {
  socket.on('offer', (offer) => {
    socket.broadcast.emit('offer', offer);
  });

  socket.on('answer', (answer) => {
    socket.broadcast.emit('answer', answer);
  });

  socket.on('candidate', (candidate) => {
    socket.broadcast.emit('candidate', candidate);
  });
});

const PORT = 5001;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
