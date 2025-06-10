import React, { useState } from 'react';

interface ConnectionErrorProps {
  message?: string;
  onRetry?: () => void;
}

const ConnectionErrorComponent: React.FC<ConnectionErrorProps> = ({ 
  message = 'Não foi possível conectar ao servidor',
  onRetry
}) => {
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    if (!onRetry) return;
    
    setIsRetrying(true);
    try {
      await onRetry();
    } catch (error) {
      console.error('Retry failed:', error);
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 my-4 flex flex-col items-center justify-center text-center">
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        className="h-10 w-10 text-red-500 mb-2" 
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
        />
      </svg>
      
      <h3 className="text-lg font-medium text-red-800 mb-1">Erro de conexão</h3>
      <p className="text-red-700">{message}</p>
      
      {navigator.onLine ? (
        <p className="text-sm text-red-600 mt-1">
          Seu dispositivo está online, mas não conseguimos acessar o servidor.
        </p>
      ) : (
        <p className="text-sm text-red-600 mt-1">
          Seu dispositivo está offline. Verifique sua conexão com a internet.
        </p>
      )}

      {onRetry && (
        <button
          className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50"
          onClick={handleRetry}
          disabled={isRetrying}
        >
          {isRetrying ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Tentando novamente...
            </span>
          ) : (
            'Tentar novamente'
          )}
        </button>
      )}
    </div>
  );
};

export default ConnectionErrorComponent;