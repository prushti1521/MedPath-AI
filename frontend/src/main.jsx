import React, { Suspense } from 'react';
import { createRoot } from 'react-dom/client';
const App = React.lazy(() => import('./App.jsx'));

import './global.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      const formatError = (err) => {
        try {
          if (!err) return String(err);
          if (err.stack) return err.stack;
          if (err.message) return String(err.message);
          if (typeof err === 'object') return JSON.stringify(err, Object.getOwnPropertyNames(err), 2);
          return String(err);
        } catch (e) {
          try { return JSON.stringify(err); } catch (e2) { return 'Unknown error'; }
        }
      };

      return (
        <div style={{ padding: 24 }}>
          <h2>App failed to render</h2>
          <pre style={{ whiteSpace: 'pre-wrap', color: '#b9382a' }}>{formatError(this.state.error)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const root = document.getElementById('root');
createRoot(root).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Suspense fallback={<div style={{ padding: 20 }}>Loading app…</div>}>
        <App />
      </Suspense>
    </ErrorBoundary>
  </React.StrictMode>
);
