const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { initSchema } = require('./db');
const db = require('./db-queries');

const app = express();
const server = http.createServer(app);

// CORS configuration - allow localhost and ngrok domains
const allowedOrigins = [
  "http://localhost:3000",
  /^https:\/\/.*\.ngrok\.io$/,
  /^https:\/\/.*\.ngrok-free\.app$/,
  /^https:\/\/.*\.ngrok\.app$/
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Check if origin matches allowed patterns
    const isAllowed = allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') {
        return origin === allowed;
      } else if (allowed instanceof RegExp) {
        return allowed.test(origin);
      }
      return false;
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
};

const io = socketIo(server, {
  cors: {
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      const isAllowed = allowedOrigins.some(allowed => {
        if (typeof allowed === 'string') {
          return origin === allowed;
        } else if (allowed instanceof RegExp) {
          return allowed.test(origin);
        }
        return false;
      });
      callback(null, isAllowed);
    },
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use(cors(corsOptions));
app.use(express.json());

// In-memory socket tracking (for real-time communication)
const socketToUserId = new Map(); // socketId -> userId
const userIdToSocket = new Map(); // userId -> socketId

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// REST API routes
app.post('/api/users/register', async (req, res) => {
  try {
    const { username } = req.body;

    if (!username || username.trim() === '') {
      return res.status(400).json({ error: 'Username is required' });
    }

    // Check if username already exists
    const existingUser = await db.getUserByUsername(username.trim());

    if (existingUser) {
      // Return existing user instead of creating new one
      return res.json({
        userId: existingUser.user_id,
        username: existingUser.username
      });
    }

    const userId = uuidv4();
    await db.createUser(userId, username.trim());

    console.log(`User registered: ${username} (${userId})`);
    res.json({ userId, username: username.trim() });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await db.getUserById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      userId: user.user_id,
      username: user.username,
      publicKey: user.public_key
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const userList = await db.getAllUsers();
    res.json(userList.map(user => ({
      userId: user.userId,
      username: user.username,
      publicKey: user.publicKey
    })));
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/users/all', async (req, res) => {
  try {
    const currentUserId = req.query.userId;
    if (!currentUserId) {
      return res.status(400).json({ error: 'userId query parameter is required' });
    }
    const userList = await db.getAllUsersWithStatus(currentUserId);
    res.json(userList);
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/messages/:userId1/:userId2', async (req, res) => {
  try {
    const { userId1, userId2 } = req.params;
    const limit = parseInt(req.query.limit) || 100;
    const messages = await db.getMessagesBetweenUsers(userId1, userId2, limit);
    res.json({ messages });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin endpoints to verify encryption
app.get('/api/admin/messages', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const messages = await db.getAllMessages(limit);

    res.json({
      count: messages.length,
      messages: messages.map(msg => ({
        messageId: msg.messageId,
        from: msg.fromUsername,
        to: msg.toUsername,
        encryptedMessage: msg.encryptedMessage,
        iv: msg.iv,
        tag: msg.tag,
        createdAt: msg.createdAt,
        // Note: The server cannot decrypt these messages - they are end-to-end encrypted
        // Only the client with the correct key can decrypt them
      }))
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/admin/messages/:userId1/:userId2', async (req, res) => {
  try {
    const { userId1, userId2 } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const messages = await db.getMessagesBetweenUsers(userId1, userId2, limit);

    res.json({
      count: messages.length,
      messages: messages.map(msg => ({
        messageId: msg.messageId,
        from: msg.fromUsername,
        to: msg.toUsername,
        encryptedMessage: msg.encryptedMessage,
        iv: msg.iv,
        tag: msg.tag,
        createdAt: msg.createdAt,
      }))
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/admin/stats', async (req, res) => {
  try {
    const messageCount = await db.getMessageCount();
    const userCount = (await db.getAllUsers()).length;

    res.json({
      totalMessages: messageCount,
      totalUsers: userCount,
      note: 'All messages are stored encrypted. The server cannot read the plaintext content.'
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('register', async ({ userId, publicKey }) => {
    try {
      const user = await db.getUserById(userId);
      if (user) {
        await db.updateUserSocket(userId, socket.id);
        await db.updateUserPublicKey(userId, publicKey);
        socketToUserId.set(socket.id, userId);
        userIdToSocket.set(userId, socket.id);
        socket.userId = userId;
        socket.emit('registered', { success: true });
        io.emit('user-online', { userId, username: user.username });
      }
    } catch (error) {
      console.error('Registration error:', error);
      socket.emit('registered', { success: false, error: 'Registration failed' });
    }
  });

  socket.on('get-users', async () => {
    try {
      const userList = await db.getAllUsersWithStatus(socket.userId);
      socket.emit('users-list', userList);
    } catch (error) {
      console.error('Get users error:', error);
    }
  });

  socket.on('get-message-history', async ({ targetUserId }) => {
    try {
      const messages = await db.getMessagesBetweenUsers(socket.userId, targetUserId, 100);
      socket.emit('message-history', {
        targetUserId,
        messages: messages.reverse() // Reverse to show oldest first
      });
    } catch (error) {
      console.error('Get message history error:', error);
      socket.emit('message-history', {
        targetUserId,
        messages: [],
        error: 'Failed to load message history'
      });
    }
  });

  socket.on('initiate-chat', async ({ targetUserId, publicKey }) => {
    try {
      const targetSocketId = userIdToSocket.get(targetUserId);
      if (targetSocketId) {
        const fromUser = await db.getUserById(socket.userId);
        io.to(targetSocketId).emit('chat-request', {
          fromUserId: socket.userId,
          fromUsername: fromUser?.username,
          publicKey
        });
      }
    } catch (error) {
      console.error('Initiate chat error:', error);
    }
  });

  socket.on('accept-chat', async ({ targetUserId, publicKey }) => {
    try {
      const targetSocketId = userIdToSocket.get(targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('chat-accepted', {
          fromUserId: socket.userId,
          publicKey
        });
      }
    } catch (error) {
      console.error('Accept chat error:', error);
    }
  });

  socket.on('send-message', async ({ targetUserId, encryptedMessage, iv, tag }) => {
    try {
      // Save message to database (encrypted)
      await db.saveMessage(
        socket.userId,
        targetUserId,
        encryptedMessage,
        iv,
        tag
      );
      console.log(`Message saved to database (encrypted) from ${socket.userId} to ${targetUserId}`);

      // Forward message to recipient if online
      const targetSocketId = userIdToSocket.get(targetUserId);
      if (targetSocketId) {
        const fromUser = await db.getUserById(socket.userId);
        io.to(targetSocketId).emit('receive-message', {
          fromUserId: socket.userId,
          fromUsername: fromUser?.username,
          encryptedMessage,
          iv,
          tag,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Send message error:', error);
    }
  });

  socket.on('disconnect', async () => {
    console.log('User disconnected:', socket.id);
    if (socket.userId) {
      try {
        await db.setUserOffline(socket.userId);
        socketToUserId.delete(socket.id);
        userIdToSocket.delete(socket.userId);
        io.emit('user-offline', { userId: socket.userId });
      } catch (error) {
        console.error('Disconnect error:', error);
      }
    }
  });
});

// Initialize database and start server
const startServer = async () => {
  try {
    await initSchema();
    const PORT = process.env.PORT || 5002;
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Database: PostgreSQL`);
      console.log(`Admin endpoints available at /api/admin/*`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
