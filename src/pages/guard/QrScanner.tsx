import { useState, useEffect } from 'react';
import QrScanner from 'react-qr-scanner';
import { QrCode, Check, X, MapPin, Info, AlertCircle, RefreshCw } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

// Função para calcular a distância entre dois pontos usando a fórmula de Haversine
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Raio da Terra em km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c * 1000; // Distância em metros (corrigido: era * 300)
  return distance;
};

const QrScannerPage = () => {
  const [scanning, setScanning] = useState(true);
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [locationAccuracy, setLocationAccuracy] = useState(null);
  const [lastScanned, setLastScanned] = useState(null);
  const [distanceInfo, setDistanceInfo] = useState(null);
  const [permissionState, setPermissionState] = useState('unknown'); // 'granted', 'denied', 'prompt', 'unknown'

  // Raio permitido para bater o ponto (em metros)
  const ALLOWED_RADIUS = 10; // Ajuste conforme necessário
  const MAX_ACCURACY_OFFSET = 500; // Máximo offset por imprecisão GPS

  const requestLocationPermission = async () => {
    try {
      // Check if geolocation is supported
      if (!navigator.geolocation) {
        setLocationError('Geolocalização não é suportada neste dispositivo.');
        setPermissionState('denied');
        return;
      }

      // Try to get current position
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          setLocationAccuracy(position.coords.accuracy);
          setLocationError(null);
          setPermissionState('granted');
        },
        (error) => {
          console.error('Error getting location:', error);
          setPermissionState('denied');
          
          switch (error.code) {
            case error.PERMISSION_DENIED:
              setLocationError(
                'Acesso à localização foi negado. Para usar o scanner, você precisa permitir acesso à localização nas configurações do navegador.'
              );
              break;
            case error.POSITION_UNAVAILABLE:
              setLocationError('Informações de localização indisponíveis. Verifique sua conexão GPS.');
              break;
            case error.TIMEOUT:
              setLocationError('Tempo esgotado ao obter localização. Tente novamente.');
              break;
            default:
              setLocationError('Erro desconhecido ao obter localização.');
          }
        },
        { 
          enableHighAccuracy: true, 
          timeout: 15000, 
          maximumAge: 30000 
        }
      );
    } catch (error) {
      console.error('Error requesting location:', error);
      setLocationError('Erro ao solicitar permissão de localização.');
      setPermissionState('denied');
    }
  };

  useEffect(() => {
    requestLocationPermission();
  }, []);

  const checkLocationProximity = (checkpointLocation) => {
    if (!location || !checkpointLocation || !checkpointLocation.lat || !checkpointLocation.lng) {
      return {
        isNearby: false,
        distance: null,
        message: 'Não foi possível verificar a proximidade. Dados de localização insuficientes.'
      };
    }

    const distance = calculateDistance(
      location.lat, 
      location.lng, 
      checkpointLocation.lat, 
      checkpointLocation.lng
    );

    // Considerar a precisão do GPS para determinar se está perto o suficiente
    // Mas com limite máximo razoável
    const maxAccuracyOffset = MAX_ACCURACY_OFFSET;
    const accuracyOffset = locationAccuracy ? Math.min(locationAccuracy, maxAccuracyOffset) : 0;
    const effectiveRadius = ALLOWED_RADIUS + accuracyOffset;
    const isNearby = distance <= effectiveRadius;

    return {
      isNearby,
      distance,
      effectiveRadius,
      message: isNearby 
        ? `Você está a ${distance.toFixed(0)}m do ponto de controle (dentro do raio permitido de ${effectiveRadius.toFixed(0)}m).`
        : `Você está a ${distance.toFixed(0)}m do ponto de controle. É necessário estar a ${effectiveRadius.toFixed(0)}m ou menos.`
    };
  };

  const handleScan = async (data) => {
    if (data && scanning) {
      setScanning(false);
      setResult(data.text);
      setStatus('processing');
      setStatusMessage('Processando QR code...');
      
      try {
        // Primeiro, obtenha informações do checkpoint sem registrar o ponto
        const checkpointInfoResponse = await api.get(`/api/checkpoints/info?qrData=${encodeURIComponent(data.text)}`);
        
        if (!checkpointInfoResponse.data || !checkpointInfoResponse.data.checkpoint) {
          setStatus('error');
          setStatusMessage('QR code inválido ou não reconhecido.');
          return;
        }
        
        const checkpointInfo = checkpointInfoResponse.data.checkpoint;
        
        // Verificar se o checkpoint tem localização definida
        if (!checkpointInfo.location || !checkpointInfo.location.lat || !checkpointInfo.location.lng) {
          setStatus('error');
          setStatusMessage('Este ponto de controle não possui coordenadas geográficas definidas.');
          return;
        }
        
        // Se não tiver localização do usuário, permitir check-in mas com aviso
        if (!location) {
          setStatus('error');
          setStatusMessage('Não foi possível obter sua localização. Permita o acesso à localização para continuar.');
          return;
        }
        
        // Verificar proximidade
        const proximityCheck = checkLocationProximity(checkpointInfo.location);
        setDistanceInfo(proximityCheck);
        
        if (!proximityCheck.isNearby) {
          setStatus('error');
          setStatusMessage(`Você está muito distante do local. ${proximityCheck.message}`);
          return;
        }
        
        // Se estiver próximo, registrar o ponto
        const response = await api.post('/api/checkin', {
          qrData: data.text,
          location: location || undefined,
          locationAccuracy: locationAccuracy,
          distance: proximityCheck.distance,
        });
        
        if (response.data.success) {
          setStatus('success');
          setStatusMessage(response.data.message || 'Check-in realizado com sucesso!');
          setLastScanned(response.data.checkpoint);
          toast.success('Check-in registrado!');
        } else {
          setStatus('error');
          setStatusMessage(response.data.message || 'QR code inválido ou expirado.');
          toast.error(response.data.message || 'QR code inválido');
        }
      } catch (error) {
        console.error('Error processing QR code:', error);
        setStatus('error');
        setStatusMessage(error.response?.data?.message || 'Erro ao processar o QR code.');
        toast.error('Falha no processamento do QR code');
      }
    }
  };

  const handleError = (err) => {
    console.error('QR Scanner error:', err);
    toast.error('Erro na câmera. Verifique as permissões.');
  };

  const resetScanner = () => {
    setScanning(true);
    setResult(null);
    setStatus(null);
    setStatusMessage('');
    setDistanceInfo(null);
  };

  const handleRetryLocation = () => {
    setLocationError(null);
    setLocation(null);
    setPermissionState('unknown');
    requestLocationPermission();
  };

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-4 sm:p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
          <QrCode className="mr-2 h-5 w-5 text-primary-600" />
          Scanner de QR Code
        </h3>
        
        {/* Location status */}
        <div className={`mb-4 p-3 rounded-lg flex items-start justify-between ${
          locationError 
            ? 'bg-error-50 text-error-700 border border-error-200' 
            : location 
              ? 'bg-success-50 text-success-700 border border-success-200'
              : 'bg-warning-50 text-warning-700 border border-warning-200'
        }`}>
          <div className="flex items-start">
            <MapPin className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">
                {locationError 
                  ? 'Erro de localização' 
                  : location 
                    ? 'Localização obtida' 
                    : 'Obtendo localização...'}
              </p>
              <p className="text-xs mt-1">
                {locationError || (
                  location 
                    ? `Lat: ${location.lat.toFixed(6)}, Lng: ${location.lng.toFixed(6)}${
                        locationAccuracy ? ` (Precisão: ±${locationAccuracy.toFixed(0)}m)` : ''
                      }` 
                    : 'Aguarde enquanto obtemos sua localização atual...'
                )}
              </p>
            </div>
          </div>
          
          {locationError && (
            <button
              onClick={handleRetryLocation}
              className="ml-2 flex-shrink-0 p-1 rounded-md hover:bg-error-100 transition-colors"
              title="Tentar novamente"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}
        </div>
        
        {/* Permission instructions */}
        {permissionState === 'denied' && (
          <div className="mb-4 p-3 rounded-lg bg-info-50 text-info-700 border border-info-200">
            <h4 className="font-medium text-sm mb-2">Como permitir acesso à localização:</h4>
            <ol className="text-xs space-y-1 pl-4 list-decimal">
              <li>Clique no ícone de cadeado na barra de endereços</li>
              <li>Selecione "Permitir" para localização</li>
              <li>Recarregue a página ou clique em "Tentar novamente"</li>
            </ol>
          </div>
        )}
        
        {/* Accuracy warning if needed */}
        {location && locationAccuracy && locationAccuracy > 100 && (
          <div className="mb-4 p-3 rounded-lg bg-warning-50 text-warning-700 border border-warning-200 flex items-start">
            <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Precisão da localização reduzida</p>
              <p className="text-xs mt-1">
                A precisão atual do GPS é de ±{locationAccuracy.toFixed(0)}m, o que pode afetar a verificação de proximidade.
                {locationAccuracy > MAX_ACCURACY_OFFSET && (
                  <span className="font-medium"> A precisão será limitada a {MAX_ACCURACY_OFFSET}m para validação.</span>
                )}
                <br />Considere ir para uma área aberta ou aguardar melhor sinal GPS.
              </p>
            </div>
          </div>
        )}
        
        {/* Scanner or result */}
        <div className="overflow-hidden rounded-lg">
          {scanning && location ? (
            <div className="relative">
              <div className="aspect-square max-w-sm mx-auto overflow-hidden rounded-lg border-2 border-primary-300">
                <QrScanner
                  onScan={handleScan}
                  onError={handleError}
                  style={{ width: '100%' }}
                  constraints={{
                    video: { facingMode: 'environment' }
                  }}
                />
              </div>
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 border-2 border-primary-400 rounded-lg animate-pulse opacity-50"></div>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 border-primary-500 rounded-lg"></div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white p-2 text-center text-sm">
                Posicione o QR code no centro
              </div>
            </div>
          ) : scanning && !location ? (
            <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 text-center">
              <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">
                É necessário permitir acesso à localização para usar o scanner.
              </p>
              <button
                onClick={handleRetryLocation}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Tentar obter localização
              </button>
            </div>
          ) : (
            <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
              {status === 'processing' && (
                <div className="flex flex-col items-center justify-center py-6">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4"></div>
                  <p className="text-gray-700">{statusMessage}</p>
                </div>
              )}
              
              {status === 'success' && (
                <div className="flex flex-col items-center justify-center py-6">
                  <div className="rounded-full bg-success-100 p-3 mb-4">
                    <Check className="h-8 w-8 text-success-600" />
                  </div>
                  <p className="text-success-700 font-medium text-lg mb-2">{statusMessage}</p>
                  {distanceInfo && (
                    <div className="bg-success-50 p-3 rounded-lg border border-success-200 w-full max-w-sm mt-2 mb-4">
                      <p className="text-sm text-success-700">{distanceInfo.message}</p>
                    </div>
                  )}
                  {lastScanned && (
                    <div className="bg-white p-4 rounded-lg border border-gray-200 w-full max-w-sm mt-4">
                      <h4 className="font-medium text-gray-900">{lastScanned.name}</h4>
                      <p className="text-sm text-gray-500">{lastScanned.description || lastScanned.location}</p>
                      <p className="text-sm text-gray-500 mt-2">
                        {new Date().toLocaleTimeString()}
                      </p>
                    </div>
                  )}
                </div>
              )}
              
              {status === 'error' && (
                <div className="flex flex-col items-center justify-center py-6">
                  <div className="rounded-full bg-error-100 p-3 mb-4">
                    <X className="h-8 w-8 text-error-600" />
                  </div>
                  <p className="text-error-700 font-medium text-lg mb-2">{statusMessage}</p>
                  {distanceInfo && (
                    <div className="bg-error-50 p-3 rounded-lg border border-error-200 w-full max-w-sm mt-2">
                      <p className="text-sm text-error-700">{distanceInfo.message}</p>
                    </div>
                  )}
                </div>
              )}
              
              <div className="mt-6 flex justify-center">
                <button
                  onClick={resetScanner}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  Escanear novamente
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* Instructions */}
        {scanning && location && (
          <div className="mt-6 bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h4 className="font-medium text-gray-900 flex items-center">
              <Info className="h-4 w-4 mr-2 text-primary-600" />
              Como usar o scanner:
            </h4>
            <ol className="mt-2 text-sm text-gray-600 space-y-2 pl-6 list-decimal">
              <li>Certifique-se de estar próximo do local de registro (dentro de {ALLOWED_RADIUS}m)</li>
              <li>Aponte a câmera para o QR code do ponto de verificação</li>
              <li>Mantenha o QR code centralizado e aguarde o reconhecimento</li>
              <li>Aguarde a confirmação de check-in</li>
              <li>Se estiver em modo offline, o registro será sincronizado quando houver conexão</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
};

export default QrScannerPage;