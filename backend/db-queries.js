const { v4: uuidv4 } = require('uuid');
const prisma = require('./db').prisma;

// User queries
const createUser = async (userId, username, passwordHash) => {
  const user = await prisma.user.upsert({
    where: { username },
    update: {
      lastSeen: new Date(),
    },
    create: {
      user_id: userId,
      username,
      passwordHash,
    },
  });

  return {
    user_id: user.user_id,
    username: user.username,
    created_at: user.createdAt,
  };
};

const getUserById = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { user_id: userId },
  });

  if (!user) return null;

  return {
    user_id: user.user_id,
    username: user.username,
    password_hash: user.passwordHash,
    public_key: user.publicKey,
    socket_id: user.socketId,
  };
};

const getUserByUsername = async (username) => {
  // Try exact match first
  let user = await prisma.user.findUnique({
    where: { username },
  });

  // If not found, try case-insensitive search using raw query
  if (!user) {
    const users = await prisma.$queryRaw`
      SELECT * FROM users WHERE LOWER(username) = LOWER(${username}) LIMIT 1
    `;
    if (users && users.length > 0) {
      user = users[0];
    }
  }

  if (!user) return null;

  return {
    user_id: user.user_id,
    username: user.username,
    password_hash: user.passwordHash,
    public_key: user.publicKey,
    socket_id: user.socketId,
  };
};

const updateUserSocket = async (userId, socketId) => {
  await prisma.user.update({
    where: { user_id: userId },
    data: {
      socketId,
      lastSeen: new Date(),
    },
  });
};

const updateUserPublicKey = async (userId, publicKey) => {
  await prisma.user.update({
    where: { user_id: userId },
    data: { publicKey },
  });
};

const getOnlineUsers = async (excludeUserId) => {
  const users = await prisma.user.findMany({
    where: {
      socketId: { not: null },
      user_id: { not: excludeUserId },
    },
    select: {
      user_id: true,
      username: true,
      publicKey: true,
    },
    orderBy: {
      username: 'asc',
    },
  });

  return users.map((user) => ({
    userId: user.user_id,
    username: user.username,
    publicKey: user.publicKey,
  }));
};

const getAllUsers = async () => {
  const users = await prisma.user.findMany({
    select: {
      user_id: true,
      username: true,
      publicKey: true,
    },
    orderBy: {
      username: 'asc',
    },
  });

  return users.map((user) => ({
    userId: user.user_id,
    username: user.username,
    publicKey: user.publicKey,
  }));
};

const getAllUsersWithStatus = async (currentUserId) => {
  // Get all users except current user
  const users = await prisma.user.findMany({
    where: {
      user_id: { not: currentUserId },
    },
    select: {
      user_id: true,
      username: true,
      publicKey: true,
      socketId: true,
      lastSeen: true,
    },
  });

  // Get distinct user IDs that have messages with current user
  const messages = await prisma.message.findMany({
    where: {
      OR: [{ fromUserId: currentUserId }, { toUserId: currentUserId }],
    },
    select: {
      fromUserId: true,
      toUserId: true,
    },
    distinct: ['fromUserId', 'toUserId'],
  });

  const usersWithMessages = new Set();
  messages.forEach((msg) => {
    if (msg.fromUserId !== currentUserId) usersWithMessages.add(msg.fromUserId);
    if (msg.toUserId !== currentUserId) usersWithMessages.add(msg.toUserId);
  });

  // Sort users: online first, then by username
  return users
    .map((user) => ({
      userId: user.user_id,
      username: user.username,
      publicKey: user.publicKey,
      isOnline: user.socketId !== null,
      lastSeen: user.lastSeen,
      hasMessages: usersWithMessages.has(user.user_id),
    }))
    .sort((a, b) => {
      // Online users first
      if (a.isOnline !== b.isOnline) {
        return a.isOnline ? -1 : 1;
      }
      // Then alphabetically by username
      return a.username.localeCompare(b.username);
    });
};

const getUsersWithMessageHistory = async (currentUserId) => {
  // Get messages involving current user, grouped by other user
  const messages = await prisma.message.findMany({
    where: {
      OR: [{ fromUserId: currentUserId }, { toUserId: currentUserId }],
    },
    select: {
      fromUserId: true,
      toUserId: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  // Get unique user IDs and their last message time
  const userMessageMap = new Map();
  messages.forEach((msg) => {
    const otherUserId =
      msg.fromUserId === currentUserId ? msg.toUserId : msg.fromUserId;
    if (
      !userMessageMap.has(otherUserId) ||
      userMessageMap.get(otherUserId) < msg.createdAt
    ) {
      userMessageMap.set(otherUserId, msg.createdAt);
    }
  });

  // Get user details
  const userIds = Array.from(userMessageMap.keys());
  const users = await prisma.user.findMany({
    where: {
      user_id: { in: userIds },
    },
    select: {
      user_id: true,
      username: true,
      publicKey: true,
      socketId: true,
      lastSeen: true,
    },
  });

  // Combine and sort by last message time
  return users
    .map((user) => ({
      userId: user.user_id,
      username: user.username,
      publicKey: user.publicKey,
      isOnline: user.socketId !== null,
      lastSeen: user.lastSeen,
      lastMessageTime: userMessageMap.get(user.user_id),
    }))
    .sort((a, b) => {
      if (a.lastMessageTime && b.lastMessageTime) {
        return new Date(b.lastMessageTime) - new Date(a.lastMessageTime);
      }
      return a.username.localeCompare(b.username);
    });
};

const setUserOffline = async (userId) => {
  await prisma.user.update({
    where: { user_id: userId },
    data: {
      socketId: null,
      lastSeen: new Date(),
    },
  });
};

// Message queries
const saveMessage = async (fromUserId, toUserId, encryptedMessage, iv, tag) => {
  const messageId = uuidv4();

  // Convert arrays to Buffer for BYTEA storage
  const encryptedBuffer = Buffer.from(encryptedMessage);
  const ivBuffer = Buffer.from(iv);
  const tagBuffer = tag ? Buffer.from(tag) : null;

  const message = await prisma.message.create({
    data: {
      message_id: messageId,
      fromUserId,
      toUserId,
      encryptedMessage: encryptedBuffer,
      iv: ivBuffer,
      tag: tagBuffer,
    },
  });

  return {
    message_id: message.message_id,
    created_at: message.createdAt,
  };
};

const getMessagesBetweenUsers = async (userId1, userId2, limit = 100) => {
  const messages = await prisma.message.findMany({
    where: {
      OR: [
        { fromUserId: userId1, toUserId: userId2 },
        { fromUserId: userId2, toUserId: userId1 },
      ],
    },
    include: {
      fromUser: {
        select: {
          username: true,
        },
      },
      toUser: {
        select: {
          username: true,
        },
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
    take: limit,
  });

  return messages.map((msg) => ({
    messageId: msg.message_id,
    fromUserId: msg.fromUserId,
    toUserId: msg.toUserId,
    fromUsername: msg.fromUser.username,
    toUsername: msg.toUser.username,
    encryptedMessage: Array.from(msg.encryptedMessage),
    iv: Array.from(msg.iv),
    tag: msg.tag ? Array.from(msg.tag) : null,
    createdAt: msg.createdAt,
  }));
};

const getAllMessages = async (limit = 100) => {
  const messages = await prisma.message.findMany({
    include: {
      fromUser: {
        select: {
          username: true,
        },
      },
      toUser: {
        select: {
          username: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
  });

  return messages.map((msg) => ({
    messageId: msg.message_id,
    fromUserId: msg.fromUserId,
    toUserId: msg.toUserId,
    fromUsername: msg.fromUser.username,
    toUsername: msg.toUser.username,
    encryptedMessage: Array.from(msg.encryptedMessage),
    iv: Array.from(msg.iv),
    tag: msg.tag ? Array.from(msg.tag) : null,
    createdAt: msg.createdAt,
  }));
};

const getMessageCount = async () => {
  return await prisma.message.count();
};

module.exports = {
  // User queries
  createUser,
  getUserById,
  getUserByUsername,
  updateUserSocket,
  updateUserPublicKey,
  getOnlineUsers,
  getAllUsers,
  getAllUsersWithStatus,
  getUsersWithMessageHistory,
  setUserOffline,

  // Message queries
  saveMessage,
  getMessagesBetweenUsers,
  getAllMessages,
  getMessageCount,
};
