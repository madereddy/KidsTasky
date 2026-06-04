import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/shared/ErrorBoundary.tsx';
import { clientLogger } from './services/clientLogger.ts';
import './index.css';
import './styles/wall.css';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch((error) => {
    clientLogger.warn('service_worker_register_failed', { error });
  });
}

window.addEventListener('error', (event) => {
  clientLogger.error('window_error', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error,
  });
});

window.addEventListener('unhandledrejection', (event) => {
  clientLogger.error('window_unhandled_rejection', {
    reason: event.reason instanceof Error
      ? { name: event.reason.name, message: event.reason.message, stack: event.reason.stack }
      : event.reason,
  });
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
