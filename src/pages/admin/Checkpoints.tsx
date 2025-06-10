import React, { useState, useEffect } from 'react';
import { MapPin, Download, Plus, Pencil, Trash2, QrCode, Printer } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for Leaflet marker icons
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface Checkpoint {
  id: number;
  name: string;
  location: string;
  description: string;
  latitude: number;
  longitude: number;
  active: boolean;
}

const Checkpoints = () => {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showAllQRCodesModal, setShowAllQRCodesModal] = useState(false);
  const [currentCheckpoint, setCurrentCheckpoint] = useState<Checkpoint | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [allQRCodes, setAllQRCodes] = useState<{id: number, name: string, location: string, qrCodeUrl: string}[]>([]);
  const [loadingAllQRCodes, setLoadingAllQRCodes] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [mapCenter, setMapCenter] = useState<[number, number]>([-23.55052, -46.633308]); // São Paulo by default
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    description: '',
    latitude: 0,
    longitude: 0,
    active: true,
  });

  useEffect(() => {
    fetchCheckpoints();
  }, []);

  const fetchCheckpoints = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/admin/checkpoints');
      setCheckpoints(response.data);
      
      // Set map center to first checkpoint if available
      if (response.data.length > 0) {
        setMapCenter([response.data[0].latitude, response.data[0].longitude]);
      }
    } catch (err: any) {
      console.error('Error fetching checkpoints:', err);
      setError('Erro ao carregar pontos de verificação. Tente novamente mais tarde.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    });
  };

  const resetForm = () => {
    setFormData({
      name: '',
      location: '',
      description: '',
      latitude: 0,
      longitude: 0,
      active: true,
    });
  };

  const openAddModal = () => {
    resetForm();
    setShowAddModal(true);
  };

  const openEditModal = (checkpoint: Checkpoint) => {
    setCurrentCheckpoint(checkpoint);
    setFormData({
      name: checkpoint.name,
      location: checkpoint.location,
      description: checkpoint.description,
      latitude: checkpoint.latitude,
      longitude: checkpoint.longitude,
      active: checkpoint.active,
    });
    setShowEditModal(true);
  };

  const openDeleteModal = (checkpoint: Checkpoint) => {
    setCurrentCheckpoint(checkpoint);
    setShowDeleteModal(true);
  };

  const openQRModal = async (checkpoint: Checkpoint) => {
    setCurrentCheckpoint(checkpoint);
    setShowQRModal(true);
    
    try {
      const response = await api.get(`/api/admin/checkpoints/${checkpoint.id}/qrcode`);
      setQrCodeUrl(response.data.qrCodeUrl);
    } catch (error) {
      console.error('Error fetching QR code:', error);
      toast.error('Erro ao gerar QR code');
    }
  };

  const openAllQRCodesModal = async () => {
    setShowAllQRCodesModal(true);
    setLoadingAllQRCodes(true);
    
    try {
      // Fetch all QR codes for active checkpoints
      const qrPromises = checkpoints
        .filter(cp => cp.active)
        .map(async (checkpoint) => {
          const response = await api.get(`/api/admin/checkpoints/${checkpoint.id}/qrcode`);
          return {
            id: checkpoint.id,
            name: checkpoint.name,
            location: checkpoint.location,
            qrCodeUrl: response.data.qrCodeUrl
          };
        });
      
      const results = await Promise.all(qrPromises);
      setAllQRCodes(results);
    } catch (error) {
      console.error('Error fetching all QR codes:', error);
      toast.error('Erro ao carregar QR codes');
    } finally {
      setLoadingAllQRCodes(false);
    }
  };

  const handleAddCheckpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await api.post('/api/admin/checkpoints', formData);
      setCheckpoints([...checkpoints, response.data]);
      setShowAddModal(false);
      resetForm();
      toast.success('Ponto de verificação adicionado com sucesso!');
    } catch (err: any) {
      console.error('Error adding checkpoint:', err);
      toast.error(err.response?.data?.message || 'Erro ao adicionar ponto de verificação.');
    }
  };

  const handleEditCheckpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCheckpoint) return;

    try {
      const response = await api.put(`/api/admin/checkpoints/${currentCheckpoint.id}`, formData);
      setCheckpoints(checkpoints.map(cp => (cp.id === currentCheckpoint.id ? response.data : cp)));
      setShowEditModal(false);
      resetForm();
      toast.success('Ponto de verificação atualizado com sucesso!');
    } catch (err: any) {
      console.error('Error editing checkpoint:', err);
      toast.error(err.response?.data?.message || 'Erro ao atualizar ponto de verificação.');
    }
  };

  const handleDeleteCheckpoint = async () => {
    if (!currentCheckpoint) return;

    try {
      await api.delete(`/api/admin/checkpoints/${currentCheckpoint.id}`);
      setCheckpoints(checkpoints.filter(cp => cp.id !== currentCheckpoint.id));
      setShowDeleteModal(false);
      toast.success('Ponto de verificação removido com sucesso!');
    } catch (err: any) {
      console.error('Error deleting checkpoint:', err);
      toast.error(err.response?.data?.message || 'Erro ao remover ponto de verificação.');
    }
  };

  const downloadQRCode = () => {
    if (qrCodeUrl && currentCheckpoint) {
      const link = document.createElement('a');
      link.href = qrCodeUrl;
      link.download = `qrcode-${currentCheckpoint.name.replace(/\s+/g, '-').toLowerCase()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const printAllQRCodes = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Seu navegador bloqueou a janela de impressão. Por favor, permita popups para este site.');
      return;
    }
    
    // Prepare the HTML content for the print window
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>QR Codes - Todos os pontos de verificação</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
          }
          .qr-container {
            display: flex;
            flex-wrap: wrap;
            gap: 20px;
            justify-content: center;
          }
          .qr-card {
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 15px;
            width: 200px;
            text-align: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            page-break-inside: avoid;
          }
          .qr-card img {
            width: 180px;
            height: 180px;
            margin-bottom: 10px;
          }
          .qr-name {
            font-weight: bold;
            font-size: 16px;
            margin-bottom: 5px;
          }
          .qr-location {
            color: #666;
            font-size: 14px;
          }
          @media print {
            .no-print {
              display: none;
            }
            .page-break {
              page-break-after: always;
            }
          }
          .print-btn {
            background-color: #4f46e5;
            color: white;
            border: none;
            padding: 10px 15px;
            border-radius: 5px;
            cursor: pointer;
            margin-bottom: 20px;
            font-size: 16px;
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="text-align: center; margin-bottom: 20px;">
          <button class="print-btn" onclick="window.print()">Imprimir QR Codes</button>
        </div>
        <h1 style="text-align: center;">QR Codes - Pontos de Verificação</h1>
        <div class="qr-container">
          ${allQRCodes.map(item => `
            <div class="qr-card">
              <img src="${item.qrCodeUrl}" alt="QR Code ${item.name}">
              <div class="qr-name">${item.name}</div>
              <div class="qr-location">${item.location}</div>
            </div>
          `).join('')}
        </div>
      </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
  };

  const downloadAllQRCodes = async () => {
    try {
      const response = await api.get('/api/admin/checkpoints/qrcodes/pdf', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'qrcodes.pdf');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading QR codes:', error);
      toast.error('Erro ao baixar QR codes');
    }
  };

  const updateLatLngFromMap = (e: L.LeafletMouseEvent) => {
    const { lat, lng } = e.latlng;
    setFormData({
      ...formData,
      latitude: lat,
      longitude: lng,
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-4 sm:p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-medium text-gray-900 flex items-center">
            <MapPin className="mr-2 h-5 w-5 text-secondary-600" />
            Pontos de Verificação
          </h3>
          <div className="flex space-x-2">
            <button
              onClick={() => setViewMode(viewMode === 'list' ? 'map' : 'list')}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary-500"
            >
              {viewMode === 'list' ? 'Ver mapa' : 'Ver lista'}
            </button>
            <button
              onClick={openAllQRCodesModal}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary-500"
            >
              <QrCode className="mr-2 h-5 w-5" />
              Ver Todos QR Codes
            </button>
            <button
              onClick={downloadAllQRCodes}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary-500"
            >
              <Download className="mr-2 h-5 w-5" />
              Baixar PDF
            </button>
            <button
              onClick={openAddModal}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-secondary-600 hover:bg-secondary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary-500"
            >
              <Plus className="mr-2 h-5 w-5" />
              Novo Ponto
            </button>
          </div>
        </div>

       {/* Rest of the component remains the same */}
       {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-secondary-600"></div>
          </div>
        ) : error ? (
          <div className="bg-error-50 border border-error-200 text-error-700 px-4 py-3 rounded">
            {error}
          </div>
        ) : checkpoints.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Nenhum ponto de verificação encontrado. Adicione um novo ponto para começar.
          </div>
        ) : viewMode === 'list' ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nome
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Localização
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Coordenadas
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {checkpoints.map(checkpoint => (
                  <tr key={checkpoint.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{checkpoint.name}</div>
                      <div className="text-xs text-gray-500">{checkpoint.description}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {checkpoint.location}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {checkpoint.latitude.toFixed(6)}, {checkpoint.longitude.toFixed(6)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        checkpoint.active 
                          ? 'bg-success-100 text-success-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {checkpoint.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => openQRModal(checkpoint)}
                        className="text-primary-600 hover:text-primary-900 mr-3"
                      >
                        <QrCode className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => openEditModal(checkpoint)}
                        className="text-secondary-600 hover:text-secondary-900 mr-3"
                      >
                        <Pencil className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => openDeleteModal(checkpoint)}
                        className="text-error-600 hover:text-error-900"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="h-64 rounded-lg overflow-hidden border border-gray-200">
            <MapContainer 
              center={mapCenter} 
              zoom={13} 
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {checkpoints.map(checkpoint => (
                <Marker 
                  key={checkpoint.id} 
                  position={[checkpoint.latitude, checkpoint.longitude]}
                >
                  <Popup>
                    <div>
                      <h3 className="font-medium">{checkpoint.name}</h3>
                      <p className="text-sm text-gray-600">{checkpoint.location}</p>
                      <p className="text-xs text-gray-500 mt-1">{checkpoint.description}</p>
                      <div className="mt-2 flex space-x-2">
                        <button
                          onClick={() => openQRModal(checkpoint)}
                          className="text-xs text-primary-600 hover:text-primary-900"
                        >
                          QR Code
                        </button>
                        <button
                          onClick={() => openEditModal(checkpoint)}
                          className="text-xs text-secondary-600 hover:text-secondary-900"
                        >
                          Editar
                        </button>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        )}
      </div>
      {/* Add Checkpoint Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={handleAddCheckpoint}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="mb-4">
                    <h3 className="text-lg font-medium text-gray-900">Adicionar Novo Ponto</h3>
                  </div>
                  <div className="mb-4">
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                      Nome
                    </label>
                    <input
                      type="text"
                      name="name"
                      id="name"
                      required
                      value={formData.name}
                      onChange={handleInputChange}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-secondary-500 focus:border-secondary-500 sm:text-sm"
                    />
                  </div>
                  <div className="mb-4">
                    <label htmlFor="location" className="block text-sm font-medium text-gray-700">
                      Localização
                    </label>
                    <input
                      type="text"
                      name="location"
                      id="location"
                      required
                      value={formData.location}
                      onChange={handleInputChange}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-secondary-500 focus:border-secondary-500 sm:text-sm"
                      placeholder="Ex: Entrada Principal, Portão 2"
                    />
                  </div>
                  <div className="mb-4">
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                      Descrição
                    </label>
                    <textarea
                      name="description"
                      id="description"
                      rows={3}
                      value={formData.description}
                      onChange={handleInputChange}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-secondary-500 focus:border-secondary-500 sm:text-sm"
                      placeholder="Descrição ou instruções para este ponto"
                    ></textarea>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label htmlFor="latitude" className="block text-sm font-medium text-gray-700">
                        Latitude
                      </label>
                      <input
                        type="number"
                        step="any"
                        name="latitude"
                        id="latitude"
                        required
                        value={formData.latitude}
                        onChange={handleInputChange}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-secondary-500 focus:border-secondary-500 sm:text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="longitude" className="block text-sm font-medium text-gray-700">
                        Longitude
                      </label>
                      <input
                        type="number"
                        step="any"
                        name="longitude"
                        id="longitude"
                        required
                        value={formData.longitude}
                        onChange={handleInputChange}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-secondary-500 focus:border-secondary-500 sm:text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      name="active"
                      id="active"
                      checked={formData.active}
                      onChange={handleInputChange}
                      className="h-4 w-4 text-secondary-600 focus:ring-secondary-500 border-gray-300 rounded"
                    />
                    <label htmlFor="active" className="ml-2 block text-sm text-gray-900">
                      Ponto ativo
                    </label>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-secondary-600 text-base font-medium text-white hover:bg-secondary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary-500 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Adicionar
                  </button>
                  <button
                    type="button"
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                    onClick={() => setShowAddModal(false)}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Checkpoint Modal - Very similar to Add modal */}
      {showEditModal && currentCheckpoint && (
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={handleEditCheckpoint}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="mb-4">
                    <h3 className="text-lg font-medium text-gray-900">Editar Ponto</h3>
                  </div>
                  {/* Same form fields as Add modal */}
                  <div className="mb-4">
                    <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700">
                      Nome
                    </label>
                    <input
                      type="text"
                      name="name"
                      id="edit-name"
                      required
                      value={formData.name}
                      onChange={handleInputChange}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-secondary-500 focus:border-secondary-500 sm:text-sm"
                    />
                  </div>
                  <div className="mb-4">
                    <label htmlFor="edit-location" className="block text-sm font-medium text-gray-700">
                      Localização
                    </label>
                    <input
                      type="text"
                      name="location"
                      id="edit-location"
                      required
                      value={formData.location}
                      onChange={handleInputChange}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-secondary-500 focus:border-secondary-500 sm:text-sm"
                    />
                  </div>
                  <div className="mb-4">
                    <label htmlFor="edit-description" className="block text-sm font-medium text-gray-700">
                      Descrição
                    </label>
                    <textarea
                      name="description"
                      id="edit-description"
                      rows={3}
                      value={formData.description}
                      onChange={handleInputChange}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-secondary-500 focus:border-secondary-500 sm:text-sm"
                    ></textarea>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label htmlFor="edit-latitude" className="block text-sm font-medium text-gray-700">
                        Latitude
                      </label>
                      <input
                        type="number"
                        step="any"
                        name="latitude"
                        id="edit-latitude"
                        required
                        value={formData.latitude}
                        onChange={handleInputChange}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-secondary-500 focus:border-secondary-500 sm:text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="edit-longitude" className="block text-sm font-medium text-gray-700">
                        Longitude
                      </label>
                      <input
                        type="number"
                        step="any"
                        name="longitude"
                        id="edit-longitude"
                        required
                        value={formData.longitude}
                        onChange={handleInputChange}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-secondary-500 focus:border-secondary-500 sm:text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      name="active"
                      id="edit-active"
                      checked={formData.active}
                      onChange={handleInputChange}
                      className="h-4 w-4 text-secondary-600 focus:ring-secondary-500 border-gray-300 rounded"
                    />
                    <label htmlFor="edit-active" className="ml-2 block text-sm text-gray-900">
                      Ponto ativo
                    </label>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-secondary-600 text-base font-medium text-white hover:bg-secondary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary-500 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Salvar
                  </button>
                  <button
                    type="button"
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                    onClick={() => setShowEditModal(false)}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Checkpoint Modal */}
      {showDeleteModal && currentCheckpoint && (
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-error-100 sm:mx-0 sm:h-10 sm:w-10">
                    <Trash2 className="h-6 w-6 text-error-600" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">Remover Ponto</h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        Tem certeza que deseja remover o ponto <strong>{currentCheckpoint.name}</strong>? Esta ação não pode ser desfeita.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-error-600 text-base font-medium text-white hover:bg-error-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-error-500 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={handleDeleteCheckpoint}
                >
                  Remover
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => setShowDeleteModal(false)}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQRModal && currentCheckpoint && (
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="text-center">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">QR Code: {currentCheckpoint.name}</h3>
                  {qrCodeUrl ? (
                    <div className="flex flex-col items-center">
                      <img src={qrCodeUrl} alt={`QR Code para ${currentCheckpoint.name}`} className="w-64 h-64 border border-gray-200 rounded-lg" />
                      <p className="mt-2 text-sm text-gray-600">{currentCheckpoint.location}</p>
                    </div>
                  ) : (
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                    </div>
                  )}
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={downloadQRCode}
                  disabled={!qrCodeUrl}
                >
                  <Download className="mr-2 h-5 w-5" />
                  Baixar QR Code
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => setShowQRModal(false)}
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

            {/* All QR Codes Modal */}
            {showAllQRCodesModal && (
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Todos os QR Codes</h3>
                  <button
                    onClick={printAllQRCodes}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary-500"
                  >
                    <Printer className="mr-2 h-5 w-5" />
                    Imprimir Todos
                  </button>
                </div>
                
                {loadingAllQRCodes ? (
                  <div className="flex justify-center items-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-secondary-600"></div>
                  </div>
                ) : allQRCodes.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    Nenhum QR code disponível para pontos de verificação ativos.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-96 overflow-y-auto p-2">
                    {allQRCodes.map(item => (
                      <div key={item.id} className="border border-gray-200 rounded-lg p-4 flex flex-col items-center">
                        <img src={item.qrCodeUrl} alt={`QR Code ${item.name}`} className="w-40 h-40 mb-2" />
                        <div className="font-medium text-center">{item.name}</div>
                        <div className="text-sm text-gray-500 text-center">{item.location}</div>
                        <button
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = item.qrCodeUrl;
                            link.download = `qrcode-${item.name.replace(/\s+/g, '-').toLowerCase()}.png`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }}
                          className="mt-2 text-xs text-primary-600 hover:text-primary-900 flex items-center"
                        >
                          <Download className="mr-1 h-4 w-4" />
                          Baixar
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 flex justify-end">
                <button
                  type="button"
                  className="inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary-500 sm:w-auto sm:text-sm"
                  onClick={() => setShowAllQRCodesModal(false)}
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Checkpoints;