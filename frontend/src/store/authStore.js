import { create } from 'zustand';
import api from '../services/api.js';
import { connectSocket, disconnectSocket } from '../services/socket.js';

export const useAuthStore = create((set, get) => ({
  user: null,
  token: localStorage.getItem('grouproute_token') || null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  // Initialize session
  initAuth: async () => {
    const token = localStorage.getItem('grouproute_token');
    if (!token) {
      set({ user: null, isAuthenticated: false, isLoading: false });
      return;
    }
    try {
      const data = await api.getMe();
      set({ user: data.user, isAuthenticated: true, isLoading: false });
      connectSocket();
    } catch (err) {
      console.warn('[AuthStore] Session restoration failed:', err.message);
      localStorage.removeItem('grouproute_token');
      set({ user: null, token: null, isAuthenticated: false, isLoading: false });
    }
  },

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const data = await api.login({ email, password });
      localStorage.setItem('grouproute_token', data.token);
      set({ user: data.user, token: data.token, isAuthenticated: true, isLoading: false });
      connectSocket();
      return data;
    } catch (err) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },

  register: async (name, email, password, profile_image) => {
    set({ isLoading: true, error: null });
    try {
      const data = await api.register({ name, email, password, profile_image });
      localStorage.setItem('grouproute_token', data.token);
      set({ user: data.user, token: data.token, isAuthenticated: true, isLoading: false });
      connectSocket();
      return data;
    } catch (err) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },

  logout: () => {
    localStorage.removeItem('grouproute_token');
    disconnectSocket();
    set({ user: null, token: null, isAuthenticated: false, error: null });
  },

  updateProfile: async (updates) => {
    const data = await api.updateProfile(updates);
    set({ user: data.user });
  }
}));

export default useAuthStore;
