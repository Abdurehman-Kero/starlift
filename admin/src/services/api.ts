import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('np_accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('np_refreshToken');
      if (refreshToken) {
        try {
          const res = await axios.post('/api/auth/refresh', { refreshToken });
          if (res.data.success && res.data.data.accessToken) {
            localStorage.setItem('np_accessToken', res.data.data.accessToken);
            if (res.data.data.refreshToken) {
              localStorage.setItem('np_refreshToken', res.data.data.refreshToken);
            }
            originalRequest.headers.Authorization = `Bearer ${res.data.data.accessToken}`;
            return api(originalRequest);
          }
        } catch {
          localStorage.removeItem('np_accessToken');
          localStorage.removeItem('np_refreshToken');
          window.location.href = '/login';
        }
      } else {
        localStorage.removeItem('np_accessToken');
        localStorage.removeItem('np_refreshToken');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth
export const authApi = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  refresh: (refreshToken: string) => api.post('/auth/refresh', { refreshToken }),
  me: () => api.get('/auth/me'),
};

// Stats
export const statsApi = {
  overview: () => api.get('/stats/overview'),
  daily: (days?: number) => api.get('/stats/daily', { params: { days } }),
};

// Participants
export const participantsApi = {
  list: (params?: { search?: string; page?: number; limit?: number; sortBy?: string; sortOrder?: string }) =>
    api.get('/participants', { params }),
  get: (id: number) => api.get(`/participants/${id}`),
  verifySubmission: (id: number, status: string) => api.patch(`/participants/${id}/verify-submission`, { status }),
};

// Referrals
export const referralsApi = {
  list: (params?: { page?: number; limit?: number; referrerId?: number; status?: string }) =>
    api.get('/referrals', { params }),
  updateStatus: (id: number, status: string) => api.patch(`/referrals/${id}/status`, { status }),
};

// Leaderboard
export const leaderboardApi = {
  get: () => api.get('/leaderboard'),
  updateReactions: (participantId: number, reactionCount: number) =>
    api.patch(`/leaderboard/${participantId}/reactions`, { reactionCount }),
};

// System Status
export const systemApi = {
  status: () => api.get('/system/status'),
};

// Settings
export const settingsApi = {
  get: () => api.get('/settings'),
  update: (key: string, value: string) => api.put(`/settings/${key}`, { value }),
  syncBotProfile: () => api.post('/settings/sync-bot-profile'),
};

// Activity
export const activityApi = {
  list: (params?: { page?: number; limit?: number }) => api.get('/activity', { params }),
};

export default api;

