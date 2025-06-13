import axios, { AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';

// Types for offline requests
interface OfflineRequest {
  id?: number;
  url: string;
  method: string;
  data: any;
  headers: any;
  timestamp: number;
}

interface MockResponse {
  status: number;
  data: {
    success: boolean;
    offlineStored: boolean;
    message: string;
  };
}

const api = axios.create({
  baseURL: (() => {
    const { hostname } = window.location;

    return `https://10.0.11.150:3003`;
  })(),
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Request interceptor
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> => {
    // Check if we're online
    if (!navigator.onLine) {
      const offlineEndpoints = ['/api/checkin'];
      
      // For specific endpoints, store the request in IndexedDB for later sync
      if (offlineEndpoints.some(endpoint => config.url?.includes(endpoint))) {
        // Store in IndexedDB using the storeOfflineRequest helper
        await storeOfflineRequest(config);
        
        // Throw a custom error that will be caught by the response interceptor
        throw {
          isOfflineStored: true,
          response: {
            status: 200,
            data: {
              success: true,
              offlineStored: true,
              message: 'Registro armazenado para sincronização'
            }
          }
        };
      }
      
      // For other endpoints, throw with a custom offline error
      throw {
        response: {
          status: 0,
          data: { message: 'Você está offline. Verifique sua conexão.' }
        }
      };
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

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle custom offline stored responses
    if (error.isOfflineStored) {
      return Promise.resolve(error);
    }
    
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
    
    // Handle authentication errors
    if (error.response.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/';
      return Promise.reject(error);
    }
    
    return Promise.reject(error);
  }
);

// Helper function to store offline requests
async function storeOfflineRequest(config: InternalAxiosRequestConfig): Promise<boolean> {
  try {
    // Create or open the IndexedDB database
    const dbPromise = window.indexedDB.open('offlineRequests', 1);
    
    dbPromise.onupgradeneeded = function(event: IDBVersionChangeEvent) {
      const target = event.target as IDBOpenDBRequest;
      if (!target) return;
      
      const db = target.result;
      if (!db.objectStoreNames.contains('requests')) {
        db.createObjectStore('requests', { keyPath: 'id', autoIncrement: true });
      }
    };
    
    return new Promise((resolve, reject) => {
      dbPromise.onsuccess = function(event: Event) {
        const target = event.target as IDBOpenDBRequest;
        if (!target) {
          reject(new Error('Target is null'));
          return;
        }
        
        const db = target.result;
        const transaction = db.transaction(['requests'], 'readwrite');
        const store = transaction.objectStore('requests');
        
        const requestData: OfflineRequest = {
          url: config.url || '',
          method: config.method || 'GET',
          data: config.data,
          headers: config.headers,
          timestamp: new Date().getTime(),
        };
        
        const request = store.add(requestData);
        
        request.onsuccess = function() {
          console.log('Request stored for offline sync');
          resolve(true);
        };
        
        request.onerror = function(event: Event) {
          console.error('Error storing offline request', event);
          reject(event);
        };
      };
      
      dbPromise.onerror = function(event: Event) {
        console.error('IndexedDB error', event);
        reject(event);
      };
    });
  } catch (error) {
    console.error('Error in storeOfflineRequest:', error);
    return Promise.resolve(false);
  }
}

// Function to process offline requests when back online
export function syncOfflineRequests(): void {
  if (!navigator.onLine) return;
  
  const dbPromise = window.indexedDB.open('offlineRequests', 1);
  
  dbPromise.onsuccess = function(event: Event) {
    const target = event.target as IDBOpenDBRequest;
    if (!target) return;
    
    const db = target.result;
    
    // Check if the object store exists
    if (!db.objectStoreNames.contains('requests')) {
      console.log('No offline requests to sync');
      return;
    }
    
    const transaction = db.transaction(['requests'], 'readwrite');
    const store = transaction.objectStore('requests');
    
    const request = store.getAll();
    
    request.onsuccess = function() {
      const requests: OfflineRequest[] = request.result;
      
      if (requests.length === 0) {
        console.log('No offline requests to sync');
        return;
      }
      
      console.log(`Syncing ${requests.length} offline requests`);
      
      requests.forEach(async (offlineRequest: OfflineRequest) => {
        try {
          // Reconstruct the full URL
          const fullUrl = api.defaults.baseURL + offlineRequest.url;
          
          // Send the request
          await axios({
            url: fullUrl,
            method: offlineRequest.method,
            data: offlineRequest.data,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          });
          
          console.log('Offline request synced successfully:', offlineRequest.url);
          
          // Remove the request from the store after successful sync
          const deleteTransaction = db.transaction(['requests'], 'readwrite');
          const deleteStore = deleteTransaction.objectStore('requests');
          if (offlineRequest.id) {
            deleteStore.delete(offlineRequest.id);
          }
          
        } catch (error) {
          console.error('Error syncing offline request:', error);
          
          // Optionally, you could implement retry logic here
          // or remove old requests after a certain time
          const now = new Date().getTime();
          const requestAge = now - offlineRequest.timestamp;
          const maxAge = 24 * 60 * 60 * 1000; // 24 hours
          
          if (requestAge > maxAge) {
            console.log('Removing old offline request:', offlineRequest.url);
            const deleteTransaction = db.transaction(['requests'], 'readwrite');
            const deleteStore = deleteTransaction.objectStore('requests');
            if (offlineRequest.id) {
              deleteStore.delete(offlineRequest.id);
            }
          }
        }
      });
    };
    
    request.onerror = function(event: Event) {
      console.error('Error retrieving offline requests:', event);
    };
  };
  
  dbPromise.onerror = function(event: Event) {
    console.error('IndexedDB error during sync:', event);
  };
}

// Function to clear all offline requests (useful for debugging)
export function clearOfflineRequests(): void {
  const dbPromise = window.indexedDB.open('offlineRequests', 1);
  
  dbPromise.onsuccess = function(event: Event) {
    const target = event.target as IDBOpenDBRequest;
    if (!target) return;
    
    const db = target.result;
    
    if (!db.objectStoreNames.contains('requests')) {
      return;
    }
    
    const transaction = db.transaction(['requests'], 'readwrite');
    const store = transaction.objectStore('requests');
    
    store.clear();
    console.log('All offline requests cleared');
  };
}

// Listen for online event to trigger sync
window.addEventListener('online', () => {
  console.log('Back online - syncing offline requests');
  syncOfflineRequests();
});

// Optional: Sync on page load if online
document.addEventListener('DOMContentLoaded', () => {
  if (navigator.onLine) {
    setTimeout(syncOfflineRequests, 1000); // Wait 1 second before syncing
  }
});

export default api;