import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { TenantProvider } from './contexts/TenantContext'; // <-- Import the Provider

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TenantProvider> {/* <-- Wrap the App! */}
      <App />
    </TenantProvider>
  </React.StrictMode>,
);