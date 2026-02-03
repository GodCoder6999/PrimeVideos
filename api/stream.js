import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// A simple Error Boundary to catch crashes
const ErrorFallback = ({ error }) => (
  <div style={{ padding: '20px', backgroundColor: '#0f171e', color: 'white', height: '100vh', fontFamily: 'sans-serif' }}>
    <h2 style={{ color: '#ff4444' }}>Something went wrong.</h2>
    <pre style={{ backgroundColor: '#000', padding: '15px', borderRadius: '5px', overflow: 'auto', border: '1px solid #333' }}>
      {error?.message}
    </pre>
    <p style={{ marginTop: '1rem' }}>Check the developer console (F12) for details.</p>
    <button onClick={() => window.location.reload()} style={{ padding: '10px 20px', marginTop: '10px', cursor: 'pointer', fontWeight: 'bold' }}>
      Reload App
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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)