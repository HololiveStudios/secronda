import { useState, useEffect } from 'react';
import { Users, MapPin, CheckCircle, AlertTriangle, Shield } from 'lucide-react';
import api from '../../services/api';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalCheckpoints: 0,
    completedToday: 0,
    pendingToday: 0,
  });
  const [recentCheckins, setRecentCheckins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [pieData, setPieData] = useState<any[]>([]);

useEffect(() => {
  const fetchDashboardData = async () => {
    try {
      const statsResponse = await api.get('/api/admin/dashboard/stats');
      setStats(statsResponse.data);

      const checkinsResponse = await api.get('/api/admin/dashboard/recent-checkins');
      setRecentCheckins(checkinsResponse.data);

      // Chart data for checkins by hour
      const chartResponse = await api.get('/api/admin/dashboard/chart-data');
      setChartData(chartResponse.data.hourlyCheckins);
      setPieData([
        { name: 'Verificados', value: statsResponse.data.completedToday, color: '#22C55E' },
        { name: 'Pendentes', value: statsResponse.data.pendingToday, color: '#F97316' }
      ]);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Erro ao carregar dados do dashboard. Tente novamente mais tarde.');
    } finally {
      setLoading(false);
    }
  };

  fetchDashboardData();
}, []);

  // Format the current date in Portuguese
  const currentDate = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR });
  const capitalizedDate = currentDate.charAt(0).toUpperCase() + currentDate.slice(1);

  return (
    <div className="space-y-6">
      {/* Header with date */}
      <div className="bg-white shadow rounded-lg p-4 sm:p-6">
        <div>
          <h2 className="text-lg sm:text-xl font-medium text-gray-900">Dashboard administrativo</h2>
          <p className="text-lg sm:text-xl font-medium text-secondary-700">{capitalizedDate}</p>
        </div>
      </div>

      {/* Stats overview */}
      {loading ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-secondary-600"></div>
        </div>
      ) : error ? (
        <div className="bg-error-50 border border-error-200 text-error-700 px-4 py-3 rounded">
          {error}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Total users */}
            <div className="bg-white shadow rounded-lg p-4 sm:p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Users className="h-8 w-8 text-secondary-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Total de Guardas
                    </dt>
                    <dd>
                      <div className="text-lg font-medium text-gray-900">{stats.totalUsers}</div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>

            {/* Total checkpoints */}
            <div className="bg-white shadow rounded-lg p-4 sm:p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <MapPin className="h-8 w-8 text-secondary-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Pontos de Verificação
                    </dt>
                    <dd>
                      <div className="text-lg font-medium text-gray-900">{stats.totalCheckpoints}</div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>

            {/* Completed today */}
            <div className="bg-white shadow rounded-lg p-4 sm:p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <CheckCircle className="h-8 w-8 text-success-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Pontos Verificados Hoje
                    </dt>
                    <dd>
                      <div className="text-lg font-medium text-gray-900">{stats.completedToday}</div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>

            {/* Pending today */}
            <div className="bg-white shadow rounded-lg p-4 sm:p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <AlertTriangle className="h-8 w-8 text-warning-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Pontos Pendentes Hoje
                    </dt>
                    <dd>
                      <div className="text-lg font-medium text-gray-900">{stats.pendingToday}</div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {/* Charts section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bar chart */}
            <div className="bg-white shadow rounded-lg p-4 sm:p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Verificações por hora</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="hour" />
                    <YAxis allowDecimals={false} />
                    <Tooltip 
                      formatter={(value: number) => [value, 'Verificações']} 
                      labelFormatter={(label: string) => `${label}h`} 
                    />
                    <Bar dataKey="count" fill="#14532D" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Pie chart */}
            <div className="bg-white shadow rounded-lg p-4 sm:p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Status dos pontos hoje</h3>
              <div className="h-72 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={110}
                      paddingAngle={5}
                      dataKey="value"
                      label={({name, percent}) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [value, 'Pontos']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Recent check-ins */}
          <div className="bg-white shadow rounded-lg p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Verificações recentes</h3>
              <a href="/admin/reports" className="text-sm font-medium text-secondary-600 hover:text-secondary-700">
                Ver todos
              </a>
            </div>

            {recentCheckins.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Nenhum registro recente encontrado.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Guarda
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ponto
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Data/Hora
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {recentCheckins.map((checkin) => (
                      <tr key={checkin.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-8 w-8 rounded-full bg-secondary-100 flex items-center justify-center">
                              <Shield className="h-4 w-4 text-secondary-600" />
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">{checkin.guard_name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{checkin.checkpoint_name}</div>
                          <div className="text-sm text-gray-500">{checkin.location}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {format(new Date(checkin.timestamp), 'dd/MM/yyyy HH:mm')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {checkin.status === 'success' ? (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-success-100 text-success-800">
                              Verificado
                            </span>
                          ) : checkin.status === 'failed' ? (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-error-100 text-error-800">
                              Falha
                            </span>
                          ) : (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-warning-100 text-warning-800">
                              {checkin.status}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default AdminDashboard;