import axios from 'axios';

// Get API URL from env or default to current origin/api for production proxy
const API_URL = '/api';

export const api = axios.create({
	baseURL: API_URL,
	headers: {
		'Content-Type': 'application/json',
	},
});

// Request interceptor to add auth token
api.interceptors.request.use(
	(config) => {
		const token = localStorage.getItem('token');
		if (token) {
			config.headers.Authorization = `Bearer ${token}`;
		}
		return config;
	},
	(error) => Promise.reject(error)
);

// Track whether a refresh is already in-flight to avoid parallel refreshes
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function onTokenRefreshed(token: string) {
	refreshSubscribers.forEach((cb) => cb(token));
	refreshSubscribers = [];
}

function subscribeToRefresh(cb: (token: string) => void) {
	refreshSubscribers.push(cb);
}

// Response interceptor — on 401, try to refresh the access token
api.interceptors.response.use(
	(response) => response,
	async (error) => {
		const originalRequest = error.config;

		// Don't retry refresh or login/register endpoints
		if (
			error.response?.status !== 401 ||
			originalRequest._retry ||
			originalRequest.url?.includes('/auth/refresh') ||
			originalRequest.url?.includes('/auth/login') ||
			originalRequest.url?.includes('/auth/register')
		) {
			// If it's a non-retryable 401, clear tokens
			if (error.response?.status === 401 && !originalRequest.url?.includes('/auth/')) {
				localStorage.removeItem('token');
			}
			return Promise.reject(error);
		}

		const refreshToken = localStorage.getItem('refresh_token');
		if (!refreshToken) {
			localStorage.removeItem('token');
			return Promise.reject(error);
		}

		if (isRefreshing) {
			// Another request is already refreshing — wait for it
			return new Promise((resolve) => {
				subscribeToRefresh((newToken: string) => {
					originalRequest.headers.Authorization = `Bearer ${newToken}`;
					originalRequest._retry = true;
					resolve(api(originalRequest));
				});
			});
		}

		isRefreshing = true;
		originalRequest._retry = true;

		try {
			const res = await axios.post(`${API_URL}/auth/refresh`, {
				refresh_token: refreshToken,
			});
			const newAccessToken = res.data.access_token;
			localStorage.setItem('token', newAccessToken);

			// If the server rotated the refresh token, store the new one
			if (res.data.refresh_token) {
				localStorage.setItem('refresh_token', res.data.refresh_token);
			}

			isRefreshing = false;
			onTokenRefreshed(newAccessToken);

			originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
			return api(originalRequest);
		} catch (refreshError) {
			isRefreshing = false;
			refreshSubscribers = [];
			// Refresh failed — force logout
			localStorage.removeItem('token');
			localStorage.removeItem('refresh_token');
			return Promise.reject(refreshError);
		}
	}
);
