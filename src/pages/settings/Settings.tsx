import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, User, Shield, Moon, Sun, Monitor } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';

const Settings = () => {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') || 'system';
    }
    return 'system';
  });

  useEffect(() => {
    // Set initial user data
    if (user) {
      setFormData(prev => ({
        ...prev,
        name: user.name,
        email: user.email,
      }));
    }

    // Apply theme
    applyTheme(theme);
  }, [user]);

  const applyTheme = (theme: string) => {
    localStorage.setItem('theme', theme);
    
    if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleChangeTheme = (newTheme: string) => {
    setTheme(newTheme);
    applyTheme(newTheme);
    toast.success(`Tema alterado para ${
      newTheme === 'light' ? 'claro' : 
      newTheme === 'dark' ? 'escuro' : 
      'sistema'
    }`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validation
    if (formData.newPassword && formData.newPassword !== formData.confirmPassword) {
      setError('As senhas não coincidem');
      setLoading(false);
      return;
    }

    try {
      const dataToSend = {
        name: formData.name,
        currentPassword: formData.currentPassword,
        ...(formData.newPassword ? { newPassword: formData.newPassword } : {}),
      };

      await api.put('/api/user/profile', dataToSend);
      
      toast.success('Perfil atualizado com sucesso!');
      setFormData({
        ...formData,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setError(err.response?.data?.message || 'Erro ao atualizar perfil. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    toast.success('Sessão encerrada com sucesso!');
  };

  // Detect install prompt for PWA
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const prompt = (window as any).deferredPrompt;
      if (prompt) {
        setInstallPrompt(prompt);
      }
    }
  }, []);

  const handleInstallApp = async () => {
    if (!installPrompt) return;
    
    // Show the installation prompt
    installPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await installPrompt.userChoice;
    
    // Clear the deferred prompt variable
    (window as any).deferredPrompt = null;
    setInstallPrompt(null);
    
    if (outcome === 'accepted') {
      toast.success('Aplicativo instalado com sucesso!');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-4 sm:p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-6 flex items-center">
          <SettingsIcon className="mr-2 h-5 w-5 text-secondary-600" />
          Configurações da Conta
        </h3>

        {error && (
          <div className="mb-4 bg-error-50 border border-error-200 text-error-700 px-4 py-3 rounded relative">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-gray-50 px-4 py-5 sm:p-6 rounded-md">
            <h4 className="text-base font-medium text-gray-900 mb-4 flex items-center">
              <User className="mr-2 h-4 w-4 text-secondary-600" />
              Informações Pessoais
            </h4>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Nome
                </label>
                <input
                  type="text"
                  name="name"
                  id="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-secondary-500 focus:border-secondary-500 sm:text-sm"
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  id="email"
                  disabled
                  value={formData.email}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 bg-gray-100 cursor-not-allowed sm:text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">O email não pode ser alterado</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 px-4 py-5 sm:p-6 rounded-md">
            <h4 className="text-base font-medium text-gray-900 mb-4 flex items-center">
              <Shield className="mr-2 h-4 w-4 text-secondary-600" />
              Segurança
            </h4>
            <div className="space-y-4">
              <div>
                <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700">
                  Senha Atual
                </label>
                <input
                  type="password"
                  name="currentPassword"
                  id="currentPassword"
                  value={formData.currentPassword}
                  onChange={handleInputChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-secondary-500 focus:border-secondary-500 sm:text-sm"
                />
              </div>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">
                    Nova Senha
                  </label>
                  <input
                    type="password"
                    name="newPassword"
                    id="newPassword"
                    value={formData.newPassword}
                    onChange={handleInputChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-secondary-500 focus:border-secondary-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                    Confirmar Nova Senha
                  </label>
                  <input
                    type="password"
                    name="confirmPassword"
                    id="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-secondary-500 focus:border-secondary-500 sm:text-sm"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500">Deixe em branco para manter a senha atual</p>
            </div>
          </div>

          <div className="bg-gray-50 px-4 py-5 sm:p-6 rounded-md">
            <h4 className="text-base font-medium text-gray-900 mb-4">Aparência</h4>
            <div className="flex space-x-4">
              <button
                type="button"
                onClick={() => handleChangeTheme('light')}
                className={`flex items-center justify-center p-2 rounded-md ${
                  theme === 'light' 
                    ? 'bg-primary-100 text-primary-800 border border-primary-300' 
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                <Sun className="h-5 w-5 mr-2" />
                Claro
              </button>
              <button
                type="button"
                onClick={() => handleChangeTheme('dark')}
                className={`flex items-center justify-center p-2 rounded-md ${
                  theme === 'dark' 
                    ? 'bg-primary-100 text-primary-800 border border-primary-300' 
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                <Moon className="h-5 w-5 mr-2" />
                Escuro
              </button>
              <button
                type="button"
                onClick={() => handleChangeTheme('system')}
                className={`flex items-center justify-center p-2 rounded-md ${
                  theme === 'system' 
                    ? 'bg-primary-100 text-primary-800 border border-primary-300' 
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                <Monitor className="h-5 w-5 mr-2" />
                Sistema
              </button>
            </div>
          </div>

          {installPrompt && (
            <div className="bg-primary-50 px-4 py-5 sm:p-6 rounded-md border border-primary-200">
              <h4 className="text-base font-medium text-primary-800 mb-2">Instalar aplicativo</h4>
              <p className="text-sm text-primary-700 mb-4">
                Você pode instalar o aplicativo no seu dispositivo para acessá-lo offline e com uma experiência melhor.
              </p>
              <button
                type="button"
                onClick={handleInstallApp}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                Instalar agora
              </button>
            </div>
          )}

          <div className="flex justify-between">
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary-500"
            >
              Sair
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-secondary-600 hover:bg-secondary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary-500 disabled:opacity-75 disabled:cursor-not-allowed"
            >
              {loading ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Settings;