const { pool } = require('./db');
const { v4: uuidv4 } = require('uuid');

// User queries
const createUser = async (userId, username) => {
  const query = `
    INSERT INTO users (user_id, username)
    VALUES ($1, $2)
    ON CONFLICT (username)
    DO UPDATE SET last_seen = CURRENT_TIMESTAMP
    RETURNING user_id, username, created_at
  `;
  const result = await pool.query(query, [userId, username]);
  return result.rows[0];
};

const getUserById = async (userId) => {
  const query = 'SELECT user_id, username, public_key, socket_id FROM users WHERE user_id = $1';
  const result = await pool.query(query, [userId]);
  return result.rows[0];
};

const getUserByUsername = async (username) => {
  const query = 'SELECT user_id, username, public_key, socket_id FROM users WHERE LOWER(username) = LOWER($1)';
  const result = await pool.query(query, [username]);
  return result.rows[0];
};

const updateUserSocket = async (userId, socketId) => {
  const query = 'UPDATE users SET socket_id = $1, last_seen = CURRENT_TIMESTAMP WHERE user_id = $2';
  await pool.query(query, [socketId, userId]);
};

const updateUserPublicKey = async (userId, publicKey) => {
  const query = 'UPDATE users SET public_key = $1 WHERE user_id = $2';
  await pool.query(query, [JSON.stringify(publicKey), userId]);
};

const getOnlineUsers = async (excludeUserId) => {
  const query = `
    SELECT user_id, username, public_key
    FROM users
    WHERE socket_id IS NOT NULL AND user_id != $1
    ORDER BY username
  `;
  const result = await pool.query(query, [excludeUserId]);
  return result.rows.map(row => ({
    userId: row.user_id,
    username: row.username,
    publicKey: row.public_key
  }));
};

const getAllUsers = async () => {
  const query = 'SELECT user_id, username, public_key FROM users ORDER BY username';
  const result = await pool.query(query);
  return result.rows.map(row => ({
    userId: row.user_id,
    username: row.username,
    publicKey: row.public_key
  }));
};

const getAllUsersWithStatus = async (currentUserId) => {
  const query = `
    SELECT
      u.user_id,
      u.username,
      u.public_key,
      u.socket_id IS NOT NULL as is_online,
      u.last_seen,
      CASE
        WHEN EXISTS (
          SELECT 1 FROM messages m
          WHERE (m.from_user_id = $1 AND m.to_user_id = u.user_id)
             OR (m.from_user_id = u.user_id AND m.to_user_id = $1)
        ) THEN true
        ELSE false
      END as has_messages
    FROM users u
    WHERE u.user_id != $1
    ORDER BY
      u.socket_id IS NOT NULL DESC,
      u.username ASC
  `;
  const result = await pool.query(query, [currentUserId]);
  return result.rows.map(row => ({
    userId: row.user_id,
    username: row.username,
    publicKey: row.public_key,
    isOnline: row.is_online,
    lastSeen: row.last_seen,
    hasMessages: row.has_messages
  }));
};

const getUsersWithMessageHistory = async (currentUserId) => {
  const query = `
    SELECT DISTINCT
      u.user_id,
      u.username,
      u.public_key,
      u.socket_id IS NOT NULL as is_online,
      u.last_seen,
      (
        SELECT MAX(m.created_at)
        FROM messages m
        WHERE (m.from_user_id = $1 AND m.to_user_id = u.user_id)
           OR (m.from_user_id = u.user_id AND m.to_user_id = $1)
      ) as last_message_time
    FROM users u
    INNER JOIN messages m ON (
      (m.from_user_id = $1 AND m.to_user_id = u.user_id)
      OR (m.from_user_id = u.user_id AND m.to_user_id = $1)
    )
    WHERE u.user_id != $1
    ORDER BY last_message_time DESC, u.username ASC
  `;
  const result = await pool.query(query, [currentUserId]);
  return result.rows.map(row => ({
    userId: row.user_id,
    username: row.username,
    publicKey: row.public_key,
    isOnline: row.is_online,
    lastSeen: row.last_seen,
    lastMessageTime: row.last_message_time
  }));
};

const setUserOffline = async (userId) => {
  const query = 'UPDATE users SET socket_id = NULL, last_seen = CURRENT_TIMESTAMP WHERE user_id = $1';
  await pool.query(query, [userId]);
};

// Message queries
const saveMessage = async (fromUserId, toUserId, encryptedMessage, iv, tag) => {
  const messageId = uuidv4();
  const query = `
    INSERT INTO messages (message_id, from_user_id, to_user_id, encrypted_message, iv, tag)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING message_id, created_at
  `;

  // Convert arrays to Buffer for BYTEA storage
  const encryptedBuffer = Buffer.from(encryptedMessage);
  const ivBuffer = Buffer.from(iv);
  const tagBuffer = tag ? Buffer.from(tag) : null;

  const result = await pool.query(query, [
    messageId,
    fromUserId,
    toUserId,
    encryptedBuffer,
    ivBuffer,
    tagBuffer
  ]);

  return result.rows[0];
};

const getMessagesBetweenUsers = async (userId1, userId2, limit = 100) => {
  const query = `
    SELECT
      m.message_id,
      m.from_user_id,
      m.to_user_id,
      m.encrypted_message,
      m.iv,
      m.tag,
      m.created_at,
      u1.username as from_username,
      u2.username as to_username
    FROM messages m
    JOIN users u1 ON m.from_user_id = u1.user_id
    JOIN users u2 ON m.to_user_id = u2.user_id
    WHERE (m.from_user_id = $1 AND m.to_user_id = $2)
       OR (m.from_user_id = $2 AND m.to_user_id = $1)
    ORDER BY m.created_at ASC
    LIMIT $3
  `;

  const result = await pool.query(query, [userId1, userId2, limit]);

  return result.rows.map(row => ({
    messageId: row.message_id,
    fromUserId: row.from_user_id,
    toUserId: row.to_user_id,
    fromUsername: row.from_username,
    toUsername: row.to_username,
    encryptedMessage: Array.from(row.encrypted_message),
    iv: Array.from(row.iv),
    tag: row.tag ? Array.from(row.tag) : null,
    createdAt: row.created_at
  }));
};

const getAllMessages = async (limit = 100) => {
  const query = `
    SELECT
      m.message_id,
      m.from_user_id,
      m.to_user_id,
      m.encrypted_message,
      m.iv,
      m.tag,
      m.created_at,
      u1.username as from_username,
      u2.username as to_username
    FROM messages m
    JOIN users u1 ON m.from_user_id = u1.user_id
    JOIN users u2 ON m.to_user_id = u2.user_id
    ORDER BY m.created_at DESC
    LIMIT $1
  `;

  const result = await pool.query(query, [limit]);

  return result.rows.map(row => ({
    messageId: row.message_id,
    fromUserId: row.from_user_id,
    toUserId: row.to_user_id,
    fromUsername: row.from_username,
    toUsername: row.to_username,
    encryptedMessage: Array.from(row.encrypted_message),
    iv: Array.from(row.iv),
    tag: row.tag ? Array.from(row.tag) : null,
    createdAt: row.created_at
  }));
};

const getMessageCount = async () => {
  const query = 'SELECT COUNT(*) as count FROM messages';
  const result = await pool.query(query);
  return parseInt(result.rows[0].count);
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

