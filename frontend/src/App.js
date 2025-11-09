import React, { useState } from 'react';
import './App.css';
import Login from './components/Login';
import ChatInterface from './components/ChatInterface';
import { getApiUrl } from './utils/config';

function App() {
  const [userId, setUserId] = useState(() => {
    return localStorage.getItem('userId') || null;
  });
  const [username, setUsername] = useState(() => {
    return localStorage.getItem('username') || '';
  });

  const handleLogin = async (username) => {
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/users/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Server error' }));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setUserId(data.userId);
      setUsername(data.username);
      localStorage.setItem('userId', data.userId);
      localStorage.setItem('username', data.username);
    } catch (error) {
      console.error('Login error:', error);
      const apiUrl = getApiUrl();
      const errorMessage = error.message || `Failed to register. Please make sure the server is running at ${apiUrl}.`;
      alert(errorMessage);
    }
  };

  const handleLogout = () => {
    setUserId(null);
    setUsername('');
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
  };

  if (!userId) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <ChatInterface
      userId={userId}
      username={username}
      onLogout={handleLogout}
    />
  );
}

export default App;

