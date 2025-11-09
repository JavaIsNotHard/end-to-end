import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import './ChatInterface.css';
import { EncryptionManager } from '../utils/encryption';
import { getApiUrl } from '../utils/config';

const ChatInterface = ({ userId, username, onLogout }) => {
  const [socket, setSocket] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [encryptionManager] = useState(() => new EncryptionManager());
  const [isEncrypted, setIsEncrypted] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const selectedUserRef = useRef(null);
  const keyPairRef = useRef(null);
  const usersRef = useRef([]);
  const isEncryptedRef = useRef(false);
  const pendingMessagesRef = useRef(null);

  useEffect(() => {
    // Get API URL (handles ngrok detection)
    const apiUrl = getApiUrl();
    const token = localStorage.getItem('token');
    
    if (!token) {
      console.error('No token found, redirecting to login');
      onLogout();
      return;
    }

    console.log('Connecting to backend at:', apiUrl);
    const newSocket = io(apiUrl, {
      auth: {
        token: token
      }
    });
    setSocket(newSocket);

    newSocket.on('connect', async () => {
      setConnectionStatus('connected');
      console.log('Connected to server');

      // Generate key pair
      const pair = await encryptionManager.generateKeyPair();
      keyPairRef.current = pair;

      // Register with server (userId is now in the token)
      newSocket.emit('register', {
        publicKey: pair.publicKeyJwk,
      });
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      if (error.message && error.message.includes('Authentication')) {
        setConnectionStatus('authentication_failed');
        alert('Authentication failed. Please login again.');
        onLogout();
      } else {
        setConnectionStatus('connection_failed');
      }
    });

    newSocket.on('registered', () => {
      console.log('Registered with server');
      newSocket.emit('get-users');
    });

    newSocket.on('users-list', (userList) => {
      setUsers(userList);
      usersRef.current = userList;
    });

    newSocket.on('message-history', async ({ targetUserId, messages, error }) => {
      if (error) {
        console.error('Error loading message history:', error);
        return;
      }

      if (selectedUserRef.current?.userId === targetUserId && messages.length > 0) {
        // Try to decrypt messages - first check if we have stored keys
        const hasStoredKeys = encryptionManager.hasStoredKeys(userId, targetUserId);

        if (!isEncryptedRef.current && hasStoredKeys) {
          // Load stored keys if available
          const loaded = await encryptionManager.loadStoredKeys(userId, targetUserId);
          if (loaded) {
            setIsEncrypted(true);
            isEncryptedRef.current = true;
          }
        }

        if (isEncryptedRef.current) {
          try {
            const decryptedMessages = [];
            let decryptedCount = 0;
            let failedCount = 0;

            for (const msg of messages) {
              try {
                const decrypted = await encryptionManager.decryptMessage(
                  msg.encryptedMessage,
                  msg.iv
                );
                decryptedMessages.push({
                  type: msg.fromUserId === userId ? 'sent' : 'received',
                  from: msg.fromUsername,
                  text: decrypted,
                  timestamp: msg.createdAt,
                });
                decryptedCount++;
              } catch (decryptError) {
                // Some messages might be from different key sessions
                failedCount++;
                console.warn('Could not decrypt message:', decryptError);
              }
            }

            if (decryptedCount > 0) {
              setMessages(decryptedMessages);
              if (failedCount > 0) {
                // Show a note that some messages couldn't be decrypted
                setMessages(prev => [
                  {
                    type: 'system',
                    text: `📜 Loaded ${decryptedCount} message(s). ${failedCount} message(s) could not be decrypted (may be from different encryption sessions).`,
                    timestamp: new Date().toISOString(),
                  },
                  ...prev
                ]);
              } else {
                setMessages(prev => [
                  {
                    type: 'system',
                    text: `📜 Loaded ${decryptedCount} message(s) from history.`,
                    timestamp: new Date().toISOString(),
                  },
                  ...prev
                ]);
              }
            } else {
              // No messages could be decrypted
              setMessages([{
                type: 'system',
                text: `📜 ${messages.length} message(s) found, but they cannot be decrypted. This may happen if the encryption keys have changed.`,
                timestamp: new Date().toISOString(),
              }]);
            }
          } catch (error) {
            console.error('Error processing message history:', error);
          }
        } else {
          // Encryption not established yet, store messages to decrypt later
          pendingMessagesRef.current = { targetUserId, messages };
        }
      }
    });

    newSocket.on('user-online', ({ userId: id, username: name }) => {
      console.log('User online:', name);
      newSocket.emit('get-users');
    });

    newSocket.on('user-offline', ({ userId: id }) => {
      console.log('User offline:', id);
      newSocket.emit('get-users');
    });

    newSocket.on('chat-request', async ({ fromUserId, fromUsername, publicKey }) => {
      console.log('Received chat-request from:', fromUsername, fromUserId);

      // If we haven't selected this user yet, auto-select them
      if (!selectedUserRef.current || selectedUserRef.current.userId !== fromUserId) {
        const requestingUser = usersRef.current.find(u => u.userId === fromUserId);
        if (requestingUser) {
          setSelectedUser(requestingUser);
          selectedUserRef.current = requestingUser;
          setMessages([]);
          setIsEncrypted(false);
          encryptionManager.reset();
        }
      }

      // Generate a key pair for this chat if we don't have one
      let currentKeyPair = keyPairRef.current;
      if (!currentKeyPair) {
        currentKeyPair = await encryptionManager.generateKeyPair();
        keyPairRef.current = currentKeyPair;
      }

      try {
        // Derive shared secret from peer's public key
        await encryptionManager.deriveSharedSecret(currentKeyPair.keyPair.privateKey, publicKey);

        // Send our public key back to complete the key exchange
        newSocket.emit('accept-chat', {
          targetUserId: fromUserId,
          publicKey: currentKeyPair.publicKeyJwk,
        });

        setIsEncrypted(true);
        isEncryptedRef.current = true;

        // Store keys for future sessions
        await encryptionManager.storeKeys(
          userId,
          fromUserId,
          currentKeyPair.keyPair.privateKey,
          publicKey
        );

        setMessages((prev) => [
          ...prev,
          {
            type: 'system',
            text: '🔒 End-to-end encryption established. Keys saved for message history.',
            timestamp: new Date().toISOString(),
          },
        ]);
        console.log('Encryption established, sent our public key back, keys stored');

        // Try to decrypt pending messages if any
        if (pendingMessagesRef.current) {
          const { targetUserId } = pendingMessagesRef.current;
          if (selectedUserRef.current?.userId === targetUserId) {
            // Decrypt pending messages
            setTimeout(() => {
              newSocket.emit('get-message-history', { targetUserId });
            }, 100);
          }
          pendingMessagesRef.current = null;
        }
      } catch (error) {
        console.error('Error establishing encryption:', error);
        setMessages((prev) => [
          ...prev,
          {
            type: 'error',
            text: 'Failed to establish encryption',
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    });

    newSocket.on('chat-accepted', async ({ fromUserId, publicKey }) => {
      console.log('Received chat-accepted from:', fromUserId);

      if (selectedUserRef.current?.userId === fromUserId && keyPairRef.current) {
        try {
          // Derive shared secret from peer's public key
          await encryptionManager.deriveSharedSecret(keyPairRef.current.keyPair.privateKey, publicKey);
          setIsEncrypted(true);
          isEncryptedRef.current = true;

          // Store keys for future sessions
          await encryptionManager.storeKeys(
            userId,
            fromUserId,
            keyPairRef.current.keyPair.privateKey,
            publicKey
          );

          setMessages((prev) => [
            ...prev,
            {
              type: 'system',
              text: '🔒 End-to-end encryption established. Keys saved for message history.',
              timestamp: new Date().toISOString(),
            },
          ]);
          console.log('Encryption established from chat-accepted, keys stored');

          // Try to decrypt pending messages if any
          if (pendingMessagesRef.current) {
            const { targetUserId } = pendingMessagesRef.current;
            if (selectedUserRef.current?.userId === targetUserId) {
              setTimeout(() => {
                newSocket.emit('get-message-history', { targetUserId });
              }, 100);
            }
            pendingMessagesRef.current = null;
          }
        } catch (error) {
          console.error('Error establishing encryption from chat-accepted:', error);
          setMessages((prev) => [
            ...prev,
            {
              type: 'error',
              text: 'Failed to establish encryption',
              timestamp: new Date().toISOString(),
            },
          ]);
        }
      }
    });

    newSocket.on('receive-message', async ({ fromUserId, fromUsername, encryptedMessage, iv, tag, timestamp }) => {
      try {
        const decrypted = await encryptionManager.decryptMessage(encryptedMessage, iv);
        setMessages((prev) => [
          ...prev,
          {
            type: 'received',
            from: fromUsername,
            text: decrypted,
            timestamp,
          },
        ]);
      } catch (error) {
        console.error('Decryption error:', error);
        setMessages((prev) => [
          ...prev,
          {
            type: 'error',
            text: 'Failed to decrypt message',
            timestamp,
          },
        ]);
      }
    });

    newSocket.on('disconnect', () => {
      setConnectionStatus('disconnected');
    });

    return () => {
      newSocket.close();
    };
  }, [userId, encryptionManager]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleUserSelect = async (user) => {
    setSelectedUser(user);
    selectedUserRef.current = user;
    setMessages([]);
    setIsEncrypted(false);
    isEncryptedRef.current = false;
    encryptionManager.reset();
    pendingMessagesRef.current = null;

    // Check if we have stored keys for this conversation
    const hasStoredKeys = encryptionManager.hasStoredKeys(userId, user.userId);

    if (hasStoredKeys) {
      // Try to load stored keys
      const loaded = await encryptionManager.loadStoredKeys(userId, user.userId);
      if (loaded) {
        setIsEncrypted(true);
        isEncryptedRef.current = true;
        setMessages([{
          type: 'system',
          text: '🔒 Encryption keys loaded from previous session. Message history available.',
          timestamp: new Date().toISOString(),
        }]);

        // Load and decrypt message history
        if (socket) {
          socket.emit('get-message-history', { targetUserId: user.userId });
        }
        return; // Don't initiate new key exchange
      }
    }

    // No stored keys - generate new key pair for this chat
    const pair = await encryptionManager.generateKeyPair();
    keyPairRef.current = pair;

    // Load message history first (will try to decrypt with stored keys if available)
    if (socket) {
      socket.emit('get-message-history', { targetUserId: user.userId });

      // Then initiate chat with the selected user
      socket.emit('initiate-chat', {
        targetUserId: user.userId,
        publicKey: pair.publicKeyJwk,
      });
    }
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedUser || !isEncrypted) {
      if (!isEncrypted) {
        alert('Please wait for encryption to be established...');
      }
      return;
    }

    try {
      const { encryptedMessage, iv, tag } = await encryptionManager.encryptMessage(messageInput);

      socket.emit('send-message', {
        targetUserId: selectedUser.userId,
        encryptedMessage,
        iv,
        tag,
      });

      setMessages((prev) => [
        ...prev,
        {
          type: 'sent',
          text: messageInput,
          timestamp: new Date().toISOString(),
        },
      ]);

      setMessageInput('');
    } catch (error) {
      console.error('Encryption error:', error);
      alert('Failed to encrypt message. Please try again.');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="chat-interface">
      <div className="chat-sidebar">
        <div className="sidebar-header">
          <h2>E2E Chat</h2>
          <div className="user-info">
            <span className="username">{username}</span>
            <span className={`status ${connectionStatus}`}>
              {connectionStatus === 'connected' ? '🟢' : '🔴'}
            </span>
          </div>
          <button onClick={onLogout} className="logout-button">
            Logout
          </button>
        </div>
        <div className="users-list">
          <h3>All Users</h3>
          {users.length === 0 ? (
            <p className="no-users">No other users</p>
          ) : (
            <>
              {users.filter(u => u.isOnline).length > 0 && (
                <div className="user-group">
                  <div className="user-group-header">Online</div>
                  {users
                    .filter(u => u.isOnline)
                    .map((user) => (
                      <div
                        key={user.userId}
                        className={`user-item ${selectedUser?.userId === user.userId ? 'selected' : ''}`}
                        onClick={() => handleUserSelect(user)}
                      >
                        <div className="user-avatar">{user.username[0].toUpperCase()}</div>
                        <div className="user-details">
                          <div className="user-name">{user.username}</div>
                          <div className="user-status">🟢 Online</div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
              {users.filter(u => !u.isOnline && u.hasMessages).length > 0 && (
                <div className="user-group">
                  <div className="user-group-header">Inactive (with messages)</div>
                  {users
                    .filter(u => !u.isOnline && u.hasMessages)
                    .map((user) => (
                      <div
                        key={user.userId}
                        className={`user-item inactive ${selectedUser?.userId === user.userId ? 'selected' : ''}`}
                        onClick={() => handleUserSelect(user)}
                      >
                        <div className="user-avatar">{user.username[0].toUpperCase()}</div>
                        <div className="user-details">
                          <div className="user-name">{user.username}</div>
                          <div className="user-status">⚫ Offline</div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
              {users.filter(u => !u.isOnline && !u.hasMessages).length > 0 && (
                <div className="user-group">
                  <div className="user-group-header">Offline</div>
                  {users
                    .filter(u => !u.isOnline && !u.hasMessages)
                    .map((user) => (
                      <div
                        key={user.userId}
                        className={`user-item ${selectedUser?.userId === user.userId ? 'selected' : ''}`}
                        onClick={() => handleUserSelect(user)}
                      >
                        <div className="user-avatar">{user.username[0].toUpperCase()}</div>
                        <div className="user-details">
                          <div className="user-name">{user.username}</div>
                          <div className="user-status">⚫ Offline</div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="chat-main">
        {selectedUser ? (
          <>
            <div className="chat-header">
              <div className="chat-user-info">
                <div className="chat-avatar">{selectedUser.username[0].toUpperCase()}</div>
                <div>
                  <div className="chat-username">
                    {selectedUser.username}
                    {selectedUser.isOnline ? ' 🟢' : ' ⚫'}
                  </div>
                  <div className="chat-status">
                    {isEncrypted ? '🔒 Encrypted' : '⏳ Establishing encryption...'}
                  </div>
                </div>
              </div>
            </div>
            <div className="chat-messages" ref={chatContainerRef}>
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`message ${msg.type === 'sent' ? 'sent' : msg.type === 'received' ? 'received' : 'system'}`}
                >
                  {msg.type === 'received' && <div className="message-sender">{msg.from}</div>}
                  <div className="message-text">{msg.text}</div>
                  <div className="message-time">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <div className="chat-input-container">
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={isEncrypted ? "Type a message..." : "Waiting for encryption..."}
                disabled={!isEncrypted}
                className="chat-input"
              />
              <button
                onClick={handleSendMessage}
                disabled={!isEncrypted || !messageInput.trim()}
                className="send-button"
              >
                Send
              </button>
            </div>
          </>
        ) : (
          <div className="no-chat-selected">
            <div className="welcome-message">
              <h2>Welcome to E2E Chat!</h2>
              <p>Select a user from the sidebar to start an encrypted conversation.</p>
              <div className="features">
                <div className="feature">
                  <span className="feature-icon">🔒</span>
                  <span>End-to-end encryption</span>
                </div>
                <div className="feature">
                  <span className="feature-icon">⚡</span>
                  <span>Real-time messaging</span>
                </div>
                <div className="feature">
                  <span className="feature-icon">🛡️</span>
                  <span>Secure key exchange</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatInterface;

