import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from '@/shared/components/common/ErrorBoundary'
import './index.css'
import 'katex/dist/katex.min.css'

/**
 * Clean up stale service workers on app load to prevent caching issues after builds
 */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations: ServiceWorkerRegistration[]) => {
    registrations.forEach((registration: ServiceWorkerRegistration) => {
      registration.unregister();
    });
  }).catch((err: Error) => {
    console.warn('Failed to unregister service workers:', err);
  });
}

/**
 * Render the application with error boundary
 */
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary
      onError={(error: Error, errorInfo: React.ErrorInfo) => {
        console.error('Global error:', error, errorInfo);
      }}
    >
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
