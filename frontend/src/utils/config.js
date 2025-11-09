// Configuration utility for API URL
// Handles both localhost and ngrok scenarios

export const getApiUrl = () => {
  // Check for environment variable first (set at build time)
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }

  // Check if we're running on ngrok
  const hostname = window.location.hostname;
  const isNgrok = hostname.includes('ngrok') || hostname.includes('ngrok-free') || hostname.includes('ngrok.io');

  if (isNgrok) {
    // Try to get backend URL from localStorage (set by user)
    const storedBackendUrl = localStorage.getItem('backend_ngrok_url');
    if (storedBackendUrl) {
      return storedBackendUrl;
    }

    // Try to get from URL query parameter (e.g., ?backend=https://xyz.ngrok.io)
    const urlParams = new URLSearchParams(window.location.search);
    const backendParam = urlParams.get('backend');
    if (backendParam) {
      localStorage.setItem('backend_ngrok_url', backendParam);
      return backendParam;
    }

    // If no backend URL is configured, show a prompt
    const userBackendUrl = prompt(
      'Please enter your backend ngrok URL (e.g., https://abc123.ngrok.io):\n\n' +
      'This will be saved for this session.',
      localStorage.getItem('backend_ngrok_url') || ''
    );

    if (userBackendUrl && userBackendUrl.trim()) {
      const cleanUrl = userBackendUrl.trim().replace(/\/$/, ''); // Remove trailing slash
      localStorage.setItem('backend_ngrok_url', cleanUrl);
      return cleanUrl;
    }

    // Fallback: try to construct from frontend URL (won't work but better than nothing)
    console.warn('No backend ngrok URL configured. Please set it using ?backend=URL or in localStorage.');
    return 'http://localhost:5002'; // Fallback
  }

  // Default to localhost for local development
  return 'http://localhost:5002';
};

// Helper to update backend URL
export const setBackendUrl = (url) => {
  const cleanUrl = url.trim().replace(/\/$/, '');
  localStorage.setItem('backend_ngrok_url', cleanUrl);
  return cleanUrl;
};

// Helper to get current backend URL
export const getCurrentBackendUrl = () => {
  return localStorage.getItem('backend_ngrok_url') || getApiUrl();
};

