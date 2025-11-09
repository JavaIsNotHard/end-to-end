import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import './App.css';
import Login from './components/Login';
import ChatInterface from './components/ChatInterface';
import PrivateRoute from './components/PrivateRoute';
import { getApiUrl } from './utils/config';

function AppContent() {
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (username, password) => {
    try {
      setError('');
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Server error: ${response.status}`);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      // Store token and user info
      localStorage.setItem('token', data.token);
      localStorage.setItem('userId', data.userId);
      localStorage.setItem('username', data.username);

      // Navigate to chat
      navigate('/chat');
    } catch (error) {
      console.error('Login error:', error);
      setError(error.message || 'Failed to login. Please check your credentials.');
    }
  };

  const handleRegister = async (username, password) => {
    try {
      setError('');
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Server error: ${response.status}`);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      // Store token and user info
      localStorage.setItem('token', data.token);
      localStorage.setItem('userId', data.userId);
      localStorage.setItem('username', data.username);

      // Navigate to chat
      navigate('/chat');
    } catch (error) {
      console.error('Registration error:', error);
      setError(error.message || 'Failed to register. Please try again.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    navigate('/login');
  };

  // Check if user is already logged in
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');
    if (token && userId && window.location.pathname === '/') {
      navigate('/chat');
    }
  }, [navigate]);

  return (
    <Routes>
      <Route path="/login" element={
        localStorage.getItem('token') ? (
          <Navigate to="/chat" replace />
        ) : (
          <Login onLogin={handleLogin} onRegister={handleRegister} error={error} />
        )
      } />
      <Route path="/chat" element={
        <PrivateRoute>
          <ChatInterface
            userId={localStorage.getItem('userId')}
            username={localStorage.getItem('username')}
            onLogout={handleLogout}
          />
        </PrivateRoute>
      } />
      <Route path="/" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;

