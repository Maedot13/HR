import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:3001/api/v1",
  headers: { "Content-Type": "application/json" },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Global response error interceptor
// Rule 5: log errors to console only in development; never in production.
// Rule 6: never expose raw error objects to production browser logs.
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalConfig = err.config;
    const status: number | undefined = err.response?.status;

    // Redirect to login on 401 if refresh attempt fails, or no refresh token exists
    if (status === 401 && !originalConfig._retry) {
      originalConfig._retry = true;
      const refreshToken = localStorage.getItem("refreshToken");

      if (refreshToken) {
        try {
          // Attempt refresh
          const { data } = await axios.post(`${api.defaults.baseURL}/auth/refresh`, { refreshToken });
          const newAccessToken = data.data.accessToken;
          const newRefreshToken = data.data.refreshToken;
          localStorage.setItem("accessToken", newAccessToken);
          localStorage.setItem("refreshToken", newRefreshToken);

          // Update header and retry
          if (originalConfig.headers) {
            originalConfig.headers.Authorization = `Bearer ${newAccessToken}`;
          }
          return api(originalConfig);
        } catch (refreshErr) {
          // Refresh failed, log out
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
          window.location.href = "/login";
          return Promise.reject(refreshErr);
        }
      } else {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        window.location.href = "/login";
        return Promise.reject(err);
      }
    }

    if (status === 401) {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      window.location.href = "/login";
      return Promise.reject(err);
    }

    // Dev-only structured logging — never runs in production builds
    if (import.meta.env.DEV) {
      const apiMessage: string =
        err.response?.data?.error?.message ?? "Unknown API error";
      console.error(
        `[API Error] ${err.config?.method?.toUpperCase() ?? "?"} ${
          err.config?.url ?? "?"
        } → ${status ?? "network error"}: ${apiMessage}`
      );
    }

    return Promise.reject(err);
  }
);

export default api;
