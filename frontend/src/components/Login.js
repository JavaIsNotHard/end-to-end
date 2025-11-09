import React, { useState } from 'react';
import './Login.css';

const Login = ({ onLogin, onRegister, error }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!username.trim()) {
      alert('Username is required');
      return;
    }

    if (!password) {
      alert('Password is required');
      return;
    }

    if (!isLogin && password.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }

    if (!isLogin && password !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    setIsLoading(true);
    
    try {
      if (isLogin) {
        await onLogin(username.trim(), password);
      } else {
        await onRegister(username.trim(), password);
      }
    } catch (err) {
      console.error('Auth error:', err);
    } finally {
      setIsLoading(false);
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
            disabled={isLoading}
          />
          <input
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="username-input"
            disabled={isLoading}
          />
          {!isLogin && (
            <input
              type="password"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="username-input"
              disabled={isLoading}
            />
          )}
          {error && <div className="error-message">{error}</div>}
          <button type="submit" className="login-button" disabled={isLoading}>
            {isLoading ? 'Please wait...' : (isLogin ? 'Login' : 'Register')}
          </button>
        </form>
        <div className="auth-toggle">
          <p>
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setPassword('');
                setConfirmPassword('');
              }}
              className="toggle-button"
              disabled={isLoading}
            >
              {isLogin ? 'Register' : 'Login'}
            </button>
          </p>
        </div>
        <p className="info-text">
          Your messages are encrypted end-to-end. Only you and the recipient can read them.
        </p>
      </div>
    </div>
  );
};

export default Login;

