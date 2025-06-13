// src/main.tsx ou main.jsx
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { AuthProvider } from './contexts/AuthContext';
import { Toaster } from 'react-hot-toast';

// ✅ Registra o Service Worker ANTES de montar a UI
import { registerSW } from 'virtual:pwa-register';

registerSW({
  onNeedRefresh() {
    console.log('🔄 Nova versão disponível. Atualize!');
  },
  onOfflineReady() {
    console.log('✅ App pronto para uso offline!');
  }
});

// ✅ Monta a UI
createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <AuthProvider>
      <App />
      <Toaster position="top-right" />
    </AuthProvider>
  </BrowserRouter>
);
