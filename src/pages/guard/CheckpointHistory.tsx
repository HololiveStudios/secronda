import React, { useState, useEffect } from 'react';
import { Clock, Filter, Calendar, Search, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import api from '../../services/api';

interface Checkin {
  id: number;
  checkpoint_id: number;
  checkpoint_name: string;
  location: string;
  timestamp: string;
  status: 'success' | 'failed' | 'offline';
}

const CheckpointHistory = () => {
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    const fetchCheckins = async () => {
      setLoading(true);
      try {
        const response = await api.get('/api/guard/checkins', {
          params: {
            date: dateFilter,
            status: statusFilter !== 'all' ? statusFilter : undefined,
            search: searchQuery || undefined,
          }
        });
        setCheckins(response.data);
      } catch (err: any) {
        console.error('Error fetching checkins:', err);
        setError('Erro ao carregar histórico. Tente novamente mais tarde.');
      } finally {
        setLoading(false);
      }
    };

    fetchCheckins();
  }, [dateFilter, statusFilter, searchQuery]);

  const formatDateTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return format(date, 'dd/MM/yyyy HH:mm:ss');
  };

  // Group checkins by date for display
  const groupedCheckins: { [key: string]: Checkin[] } = {};
  checkins.forEach(checkin => {
    const date = format(new Date(checkin.timestamp), 'dd/MM/yyyy');
    if (!groupedCheckins[date]) {
      groupedCheckins[date] = [];
    }
    groupedCheckins[date].push(checkin);
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-success-500" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-error-500" />;
      default:
        return <Clock className="h-5 w-5 text-warning-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'success':
        return 'Verificado';
      case 'failed':
        return 'Falha';
      case 'offline':
        return 'Pendente';
      default:
        return status;
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-4 sm:p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
          <Clock className="mr-2 h-5 w-5 text-primary-600" />
          Histórico de Verificações
        </h3>
        
        {/* Filters */}
        <div className="mb-6 space-y-4 sm:space-y-0 sm:flex sm:items-center sm:justify-between">
          <div className="flex flex-col sm:flex-row sm:space-x-4 space-y-4 sm:space-y-0">
            <div className="flex items-center">
              <Calendar className="h-5 w-5 text-gray-400 mr-2" />
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="shadow-sm focus:ring-primary-500 focus:border-primary-500 block sm:text-sm border-gray-300 rounded-md"
              />
            </div>
            
            <div className="flex items-center">
              <Filter className="h-5 w-5 text-gray-400 mr-2" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md"
              >
                <option value="all">Todos</option>
                <option value="success">Verificados</option>
                <option value="failed">Falhas</option>
                <option value="offline">Pendentes</option>
              </select>
            </div>
          </div>
          
          <div className="relative flex items-center">
            <Search className="h-5 w-5 text-gray-400 absolute left-3" />
            <input
              type="text"
              placeholder="Buscar ponto..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md"
            />
          </div>
        </div>
        
        {/* Results */}
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : error ? (
          <div className="bg-error-50 border border-error-200 text-error-700 px-4 py-3 rounded">
            {error}
          </div>
        ) : checkins.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Nenhum registro encontrado para os filtros selecionados.
          </div>
        ) : (
          <div className="space-y-6">
            {Object.keys(groupedCheckins).sort((a, b) => new Date(b).getTime() - new Date(a).getTime()).map(date => (
              <div key={date} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                  <h4 className="font-medium text-gray-700">{date}</h4>
                </div>
                <div className="divide-y divide-gray-200">
                  {groupedCheckins[date].map(checkin => (
                    <div key={checkin.id} className="p-4 flex items-start sm:items-center justify-between flex-col sm:flex-row">
                      <div className="flex items-start sm:items-center mb-2 sm:mb-0">
                        <div className="mr-3 flex-shrink-0 mt-1">{getStatusIcon(checkin.status)}</div>
                        <div>
                          <h5 className="text-sm font-medium text-gray-900">{checkin.checkpoint_name}</h5>
                          <p className="text-sm text-gray-500">{checkin.location}</p>
                        </div>
                      </div>
                      <div className="flex flex-col sm:items-end w-full sm:w-auto">
                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                          checkin.status === 'success' ? 'bg-success-100 text-success-800' :
                          checkin.status === 'failed' ? 'bg-error-100 text-error-800' :
                          'bg-warning-100 text-warning-800'
                        }`}>
                          {getStatusText(checkin.status)}
                        </div>
                        <span className="text-xs text-gray-500 mt-1">
                          {format(new Date(checkin.timestamp), 'HH:mm:ss')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CheckpointHistory;