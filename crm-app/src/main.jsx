import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import './index.css'
import '@fontsource/outfit/400.css';
import '@fontsource/outfit/500.css';
import '@fontsource/outfit/700.css';
import App from './App.jsx'
import { initAnalytics } from './services/analytics'
import { getWorkspaceConfig } from './services/workspaceConfig'
import { applyWorkspaceTheme, watchSystemTheme } from './services/themeService'

initAnalytics()
const workspace = getWorkspaceConfig()
document.title = workspace.businessName ? `${workspace.businessName} CRM` : 'CRM Workspace'
applyWorkspaceTheme(workspace)
watchSystemTheme()

const queryClient = new QueryClient()

// Register Service Worker for PWA
if ('serviceWorker' in navigator && !('__TAURI_INTERNALS__' in window)) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('✅ ServiceWorker registered:', registration.scope);

        // Check for updates periodically
        setInterval(() => {
          registration.update();
        }, 60000); // Check every minute
      })
      .catch(error => {
        console.log('❌ ServiceWorker registration failed:', error);
      });
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster />
    </QueryClientProvider>
  </StrictMode>,
)
