import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// A simple Error Boundary to catch crashes
const ErrorFallback = ({ error }) => (
  <div style={{ padding: '20px', backgroundColor: '#0f171e', color: 'white', height: '100vh' }}>
    <h2 style={{ color: '#ff4444' }}>Something went wrong.</h2>
    <pre style={{ backgroundColor: '#000', padding: '10px', borderRadius: '5px', overflow: 'auto' }}>
      {error.message}
    </pre>
    <p>Check the console for more details.</p>
    <button onClick={() => window.location.reload()} style={{ padding: '10px 20px', marginTop: '10px' }}>
      Reload
    </button>
  </div>
);

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}

import React from 'react';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)