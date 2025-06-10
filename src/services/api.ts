import axios from 'axios';

const api = axios.create({
  baseURL: (() => {
    const { hostname } = window.location;
    return `https://${hostname}`;
  })(),
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});
 
api.interceptors.request.use(
  async (config) => {
    // Check if we're online
    if (!navigator.onLine) {
      const offlineEndpoints = ['/api/checkin'];
      
      // For specific endpoints, store the request in IndexedDB for later sync
      if (offlineEndpoints.some(endpoint => config.url?.includes(endpoint))) {
        // Store in IndexedDB using the storeOfflineRequest helper
        await storeOfflineRequest(config);
        
        // Return a mock successful response
        const mockResponse = { 
          status: 200, 
          data: { 
            success: true, 
            offlineStored: true,
            message: 'Registro armazenado para sincronização' 
          } 
        };
        
        return Promise.resolve(mockResponse);
      }
      
      // For other endpoints, reject with a custom offline error
      return Promise.reject({
        response: {
          status: 0,
          data: { message: 'Você está offline. Verifique sua conexão.' }
        }
      });
    }
    
    // Add auth token if available
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle connection errors more gracefully
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle network errors more gracefully
    if (!error.response) {
      // Network error (server unreachable)
      console.error('API Server unreachable:', error.message);
      
      return Promise.reject({
        response: {
          status: 0,
          data: { 
            message: 'Não foi possível conectar ao servidor. Verifique sua conexão ou tente novamente mais tarde.' 
          }
        }
      });
    }
    
    return Promise.reject(error);
  }
);

// Helper function to store offline requests
async function storeOfflineRequest(config: any) {
  // Create or open the IndexedDB database
  const dbPromise = window.indexedDB.open('offlineRequests', 1);
  
  dbPromise.onupgradeneeded = function(event) {
    const db = (event.target as IDBOpenDBRequest).result;
    if (!db.objectStoreNames.contains('requests')) {
      db.createObjectStore('requests', { keyPath: 'id', autoIncrement: true });
    }
  };
  
  return new Promise((resolve, reject) => {
    dbPromise.onsuccess = function(event) {
      const db = (event.target as IDBOpenDBRequest).result;
      const transaction = db.transaction(['requests'], 'readwrite');
      const store = transaction.objectStore('requests');
      
      const requestData = {
        url: config.url,
        method: config.method,
        data: config.data,
        timestamp: new Date().getTime(),
      };
      
      const request = store.add(requestData);
      
      request.onsuccess = function() {
        console.log('Request stored for offline sync');
        resolve(true);
      };
      
      request.onerror = function(event) {
        console.error('Error storing offline request', event);
        reject(event);
      };
    };
    
    dbPromise.onerror = function(event) {
      console.error('IndexedDB error', event);
      reject(event);
    };
  });
}

// Function to process offline requests when back online
export function syncOfflineRequests() {
  if (!navigator.onLine) return;
  
  const dbPromise = window.indexedDB.open('offlineRequests', 1);
  
  dbPromise.onsuccess = function(event) {
    const db = (event.target as IDBOpenDBRequest).result;
    const transaction = db.transaction(['requests'], 'readwrite');
    const store = transaction.objectStore('requests');
    
    const request = store.getAll();
    
    request.onsuccess = function() {
      const requests = request.result;
      
      requests.forEach(async (offlineRequest) => {
        try {
          // Send the request
          await axios({
            url: offlineRequest.url,
            method: offlineRequest.method,
            data: offlineRequest.data,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          });
          
          // Remove the request from the store
          store.delete(offlineRequest.id);
        } catch (error) {
          console.error('Error syncing offline request', error);
        }
      });
    };
  };
}

// Listen for online event to trigger sync
window.addEventListener('online', syncOfflineRequests);

export default api;