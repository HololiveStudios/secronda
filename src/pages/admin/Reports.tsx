import React, { useState, useEffect } from 'react';
import { FileText, Download, Filter, Calendar, Search, User, Clock, CheckCircle, XCircle } from 'lucide-react';
import api from '../../services/api';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { createColumnHelper, getCoreRowModel, useReactTable, flexRender, getPaginationRowModel, getSortedRowModel, SortingState } from '@tanstack/react-table';
import { ptBR } from 'date-fns/locale';

interface Checkin {
  id: number;
  guard_id: number;
  guard_name: string;
  checkpoint_id: number;
  checkpoint_name: string;
  location: string;
  timestamp: string;
  status: 'success' | 'failed' | 'offline';
  latitude: number;
  longitude: number;
}

const Reports = () => {
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>(format(new Date(new Date().setDate(new Date().getDate() - 7)), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [guardFilter, setGuardFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [guards, setGuards] = useState<{id: number, name: string}[]>([]);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'timestamp', desc: true }]);

  const columnHelper = createColumnHelper<Checkin>();
  
  const columns = [
    columnHelper.accessor('guard_name', {
      header: 'Guarda',
      cell: info => info.getValue(),
    }),
    columnHelper.accessor('checkpoint_name', {
      header: 'Ponto',
      cell: info => (
        <div>
          <div className="font-medium">{info.getValue()}</div>
          <div className="text-xs text-gray-500">{info.row.original.location}</div>
        </div>
      ),
    }),
    columnHelper.accessor('timestamp', {
      header: 'Data/Hora',
      cell: info => format(new Date(info.getValue()), 'dd/MM/yyyy HH:mm:ss'),
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: info => {
        const status = info.getValue();
        return (
          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
            status === 'success' ? 'bg-success-100 text-success-800' :
            status === 'failed' ? 'bg-error-100 text-error-800' :
            'bg-warning-100 text-warning-800'
          }`}>
            {status === 'success' ? 'Verificado' : 
             status === 'failed' ? 'Falha' : 'Pendente'}
          </span>
        );
      },
    }),
  ];

  const table = useReactTable({
    data: checkins,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  useEffect(() => {
    fetchGuards();
    fetchCheckins();
  }, []);

  const fetchGuards = async () => {
    try {
      const response = await api.get('/api/admin/users');
      // Filter only guards
      const guardsList = response.data.filter((user: any) => user.role === 'guard' || user.role === 'admin');
      setGuards(guardsList);
    } catch (err) {
      console.error('Error fetching guards:', err);
    }
  };

  const fetchCheckins = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/admin/reports/checkins', {
        params: {
          startDate,
          endDate,
          guardId: guardFilter !== 'all' ? guardFilter : undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          search: searchQuery || undefined,
        }
      });
      setCheckins(response.data);
    } catch (err: any) {
      console.error('Error fetching checkins:', err);
      setError('Erro ao carregar relatório. Tente novamente mais tarde.');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = () => {
    fetchCheckins();
  };

  const exportToCsv = async () => {
    try {
      const response = await api.get('/api/admin/reports/export', {
        params: {
          startDate,
          endDate,
          guardId: guardFilter !== 'all' ? guardFilter : undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          search: searchQuery || undefined,
          format: 'csv'
        },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `relatorio-${format(new Date(), 'yyyy-MM-dd')}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('Relatório exportado com sucesso!');
    } catch (err) {
      console.error('Error exporting report:', err);
      toast.error('Erro ao exportar relatório.');
    }
  };

  const exportToPdf = async () => {
    try {
      const response = await api.get('/api/admin/reports/export', {
        params: {
          startDate,
          endDate,
          guardId: guardFilter !== 'all' ? guardFilter : undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          search: searchQuery || undefined,
          format: 'pdf'
        },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `relatorio-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('Relatório exportado com sucesso!');
    } catch (err) {
      console.error('Error exporting report:', err);
      toast.error('Erro ao exportar relatório.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-4 sm:p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-medium text-gray-900 flex items-center">
            <FileText className="mr-2 h-5 w-5 text-secondary-600" />
            Relatórios
          </h3>
          <div className="flex space-x-2">
            <button
              onClick={exportToCsv}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary-500"
            >
              <Download className="mr-2 h-5 w-5" />
              CSV
            </button>
            <button
              onClick={exportToPdf}
              className="inline-flex items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-secondary-600 hover:bg-secondary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary-500"
            >
              <Download className="mr-2 h-5 w-5" />
              PDF
            </button>
          </div>
        </div>
        
        {/* Filters */}
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
              <Calendar className="h-4 w-4 mr-1" />
              Data inicial
            </label>
            <input
              type="date"
              id="startDate"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="shadow-sm focus:ring-secondary-500 focus:border-secondary-500 block w-full sm:text-sm border-gray-300 rounded-md"
            />
          </div>
          
          <div>
            <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
              <Calendar className="h-4 w-4 mr-1" />
              Data final
            </label>
            <input
              type="date"
              id="endDate"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="shadow-sm focus:ring-secondary-500 focus:border-secondary-500 block w-full sm:text-sm border-gray-300 rounded-md"
            />
          </div>
          
          <div>
            <label htmlFor="guardFilter" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
              <User className="h-4 w-4 mr-1" />
              Guarda
            </label>
            <select
              id="guardFilter"
              value={guardFilter}
              onChange={(e) => setGuardFilter(e.target.value)}
              className="shadow-sm focus:ring-secondary-500 focus:border-secondary-500 block w-full sm:text-sm border-gray-300 rounded-md"
            >
              <option value="all">Todos</option>
              {guards.map(guard => (
                <option key={guard.id} value={guard.id}>{guard.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label htmlFor="statusFilter" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
              <CheckCircle className="h-4 w-4 mr-1" />
              Status
            </label>
            <select
              id="statusFilter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="shadow-sm focus:ring-secondary-500 focus:border-secondary-500 block w-full sm:text-sm border-gray-300 rounded-md"
            >
              <option value="all">Todos</option>
              <option value="success">Verificados</option>
              <option value="failed">Falhas</option>
              <option value="offline">Pendentes</option>
            </select>
          </div>
          
          <div>
            <label htmlFor="searchQuery" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
              <Search className="h-4 w-4 mr-1" />
              Buscar
            </label>
            <div className="relative">
              <input
                type="text"
                id="searchQuery"
                placeholder="Ponto ou localização..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="shadow-sm focus:ring-secondary-500 focus:border-secondary-500 block w-full sm:text-sm border-gray-300 rounded-md"
              />
            </div>
          </div>
        </div>
        
        <div className="flex justify-end mb-6">
          <button
            onClick={handleFilterChange}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-secondary-600 hover:bg-secondary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary-500"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filtrar
          </button>
        </div>
        
        {/* Results */}
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-secondary-600"></div>
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
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map(header => (
                      <th 
                        key={header.id}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {{
                          asc: ' 🔼',
                          desc: ' 🔽',
                        }[header.column.getIsSorted() as string] ?? null}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {table.getRowModel().rows.map(row => (
                  <tr key={row.id}>
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} className="px-6 py-4 whitespace-nowrap">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            
            {/* Pagination */}
            <div className="py-3 flex items-center justify-between">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Anterior
                </button>
                <button
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Próximo
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Mostrando <span className="font-medium">{table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}</span> a <span className="font-medium">
                      {Math.min(
                        (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                        checkins.length
                      )}
                    </span> de <span className="font-medium">{checkins.length}</span> resultados
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                    <button
                      onClick={() => table.previousPage()}
                      disabled={!table.getCanPreviousPage()}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="sr-only">Anterior</span>
                      <Clock className="h-5 w-5" />
                    </button>
                    {Array.from({ length: table.getPageCount() }, (_, i) => (
                      <button
                        key={i}
                        onClick={() => table.setPageIndex(i)}
                        className={`relative inline-flex items-center px-4 py-2 border ${
                          table.getState().pagination.pageIndex === i
                            ? 'border-secondary-500 bg-secondary-50 text-secondary-600'
                            : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                        } text-sm font-medium`}
                      >
                        {i + 1}
                      </button>
                    ))}
                    <button
                      onClick={() => table.nextPage()}
                      disabled={!table.getCanNextPage()}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="sr-only">Próximo</span>
                      <Clock className="h-5 w-5 transform rotate-180" />
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;