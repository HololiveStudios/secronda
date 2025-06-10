import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import ConnectionErrorComponent from '../../layouts/ConnectionErrorComponent';

interface Checkpoint {
  id: number;
  name: string;
  location: string;
  status: 'pending' | 'completed';
  latitude: number;
  longitude: number;
}
 
interface Checkin {
  id: number;
  timestamp: string;
  status: string;
  checkpoint_name: string;
  location: string;
}

const GuardDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [recentCheckins, setRecentCheckins] = useState<Checkin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  
  // Refs para controlar os intervals
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isVisibleRef = useRef(true);

  const fetchCheckpoints = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      setError(null);
      
      const response = await api.get('/api/guard/checkpoints');
      setCheckpoints(response.data);
      
      // Also get recent checkins
      const recentResponse = await api.get('/api/guard/checkins/recent');
      setRecentCheckins(recentResponse.data);
      
      setLastUpdate(new Date());
      setLoading(false);
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError(err?.response?.data?.message || 'Erro ao carregar dados');
      setLoading(false);
    }
  };

  // Função para atualizar apenas se houver mudanças
  const fetchIfChanged = async () => {
    try {
      // Faz uma requisição leve para verificar se há mudanças
      const response = await api.get('/api/guard/checkpoints/status');
      const lastModified = response.headers['last-modified'] || response.data.lastUpdate;
      
      if (lastModified && new Date(lastModified) > lastUpdate) {
        await fetchCheckpoints(false); // Não mostra loading para atualizações automáticas
      }
    } catch (err) {
      console.error('Error checking for updates:', err);
    }
  };

  // Configurar polling automático
  useEffect(() => {
    // Buscar dados inicialmente
    fetchCheckpoints();

    // Configurar polling a cada 5 segundos
    intervalRef.current = setInterval(() => {
      if (isVisibleRef.current) {
        fetchIfChanged();
      }
    }, 5000);

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Detectar quando a página fica visível/invisível para otimizar polling
  useEffect(() => {
    const handleVisibilityChange = () => {
      isVisibleRef.current = !document.hidden;
      
      // Quando a página volta a ser visível, atualiza imediatamente
      if (!document.hidden) {
        fetchCheckpoints(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Função para navegar até a página de escaneamento
  const handleNavigateToScan = (checkpointId: number) => {
    navigate(`/guard/scan?checkpoint=${checkpointId}`);
  };

  // Função para forçar atualização manual
  const handleRefresh = () => {
    fetchCheckpoints(true);
  };

  // Hook para atualizar quando retorna de outras páginas
  useEffect(() => {
    const handleFocus = () => {
      fetchCheckpoints(false);
    };

    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return <ConnectionErrorComponent message={error} onRetry={fetchCheckpoints} />;
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Painel do Guarda</h1>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleRefresh}
            className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded-md text-sm transition-colors"
          >
            🔄 Atualizar
          </button>
          <span className="text-xs text-gray-500">
            Última atualização: {lastUpdate.toLocaleTimeString('pt-BR')}
          </span>
        </div>
      </div>
      
      {/* Checkpoint status cards */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-3">Pontos de Verificação</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {checkpoints.map((checkpoint) => (
            <div 
              key={checkpoint.id} 
              className={`border rounded-lg p-4 shadow-sm transition-all duration-300 ${
                checkpoint.status === 'completed' 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-yellow-50 border-yellow-200'
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium">{checkpoint.name}</h3>
                  <p className="text-sm text-gray-600">{checkpoint.location}</p>
                </div>
                <span 
                  className={`px-2 py-1 text-xs rounded-full transition-all duration-300 ${
                    checkpoint.status === 'completed' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-yellow-100 text-yellow-800'
                  }`}
                >
                  {checkpoint.status === 'completed' ? 'Verificado' : 'Pendente'}
                </span>
              </div>
              
              {checkpoint.status === 'pending' && (
                <button 
                  className="mt-2 w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md text-sm transition-colors"
                  onClick={() => handleNavigateToScan(checkpoint.id)}
                >
                  Verificar Ponto
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
      
      {/* Recent checkins */}
      <div>
        <h2 className="text-xl font-semibold mb-3">Verificações Recentes</h2>
        {recentCheckins.length > 0 ? (
          <div className="bg-white border rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ponto</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Localização</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data/Hora</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {recentCheckins.map((checkin) => (
                  <tr key={checkin.id} className="transition-all duration-300 hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{checkin.checkpoint_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{checkin.location}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(checkin.timestamp).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        checkin.status === 'success' 
                          ? 'bg-green-100 text-green-800' 
                          : checkin.status === 'offline'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {checkin.status === 'success' 
                          ? 'Sucesso' 
                          : checkin.status === 'offline'
                          ? 'Offline'
                          : 'Falha'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center text-gray-500">
            Nenhuma verificação recente encontrada.
          </div>
        )}
      </div>
    </div>
  );
};

export default GuardDashboard;