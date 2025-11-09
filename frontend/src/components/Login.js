import React, { useState } from 'react';
import './Login.css';

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (username.trim()) {
      onLogin(username.trim());
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>🔒 E2E Chat</h1>
        <p className="subtitle">End-to-End Encrypted Messaging</p>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Enter your username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="username-input"
            autoFocus
          />
          <button type="submit" className="login-button">
            Start Chatting
          </button>
        </form>
        <p className="info-text">
          Your messages are encrypted end-to-end. Only you and the recipient can read them.
        </p>
      </div>
    </div>
  );
};

export default Login;

