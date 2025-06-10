import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';

// Layouts
import GuardLayout from './layouts/GuardLayout';
import AdminLayout from './layouts/AdminLayout';
import AuthLayout from './layouts/AuthLayout';

// Pages
import LoginPage from './pages/auth/LoginPage';
import GuardDashboard from './pages/guard/GuardDashboard';
import QrScanner from './pages/guard/QrScanner';
import CheckpointHistory from './pages/guard/CheckpointHistory';
import AdminDashboard from './pages/admin/AdminDashboard';
import Users from './pages/admin/Users';
import Checkpoints from './pages/admin/Checkpoints';
import Reports from './pages/admin/Reports';
import NotFoundPage from './pages/NotFoundPage';
import Settings from './pages/settings/Settings';

// Guards for routes
const GuardRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  if (user?.role !== 'guard' && user?.role !== 'admin') {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  return <>{children}</>;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  if (user?.role !== 'admin') {
    return <Navigate to="/guard" state={{ from: location }} replace />;
  }
  
  return <>{children}</>;
};

function App() {
  const { user, isAuthenticated } = useAuth();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // Handle PWA install prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

// App.tsx - Atualize o handler do evento
const handleInstallClick = async () => {
  if (!deferredPrompt) return;
  
  try {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('Usuário aceitou a instalação');
    }
  } catch (error) {
    console.error('Erro ao instalar PWA:', error);
  } finally {
    setDeferredPrompt(null);
  }
};

  return (
    <>
      <Routes>
        {/* Public routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>

        {/* Guard routes */}
        <Route 
          path="/guard" 
          element={
            <GuardRoute>
              <GuardLayout />
            </GuardRoute>
          }
        >
          <Route index element={<GuardDashboard />} />
          <Route path="scan" element={<QrScanner />} />
          <Route path="history" element={<CheckpointHistory />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        {/* Admin routes */}
        <Route 
          path="/admin" 
          element={
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<Users />} />
          <Route path="checkpoints" element={<Checkpoints />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        {/* Redirects */}
        <Route path="/" element={
          isAuthenticated ? (
            user?.role === 'admin' 
              ? <Navigate to="/admin" replace /> 
              : <Navigate to="/guard" replace />
          ) : (
            <Navigate to="/login" replace />
          )
        } />
        
        {/* 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>

      {/* Install Prompt Button */}
      {deferredPrompt && isAuthenticated && (
        <button 
          onClick={handleInstallClick}
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            padding: '12px 24px',
            background: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            zIndex: 1000
          }}
        >
          ⬇️ Instalar App
        </button>
      )}
    </>
  );
}

export default App;