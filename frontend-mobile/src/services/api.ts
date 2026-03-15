import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_URL = 'http://localhost:3001/api/v1';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const refreshToken = await SecureStore.getItemAsync('refreshToken');
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
          await SecureStore.setItemAsync('accessToken', data.accessToken);
          await SecureStore.setItemAsync('refreshToken', data.refreshToken);
          error.config.headers.Authorization = `Bearer ${data.accessToken}`;
          return api(error.config);
        } catch {
          await SecureStore.deleteItemAsync('accessToken');
          await SecureStore.deleteItemAsync('refreshToken');
        }
      }
    }
    return Promise.reject(error);
  },
);

export default api;
