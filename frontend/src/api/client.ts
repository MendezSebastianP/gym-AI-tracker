import axios from 'axios';

// Get API URL from env or default to current origin/api for production proxy
const API_URL = '/api';

export const api = axios.create({
	baseURL: API_URL,
	// 25s — mobile networks (esp. iPhone Edge) routinely take 10–20s when
	// resuming from background. A short timeout that fires here used to
	// clear the user's tokens and force a re-login mid-session.
	timeout: 25000,
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
type RefreshCb = (token: string | null, error?: unknown) => void;
let refreshSubscribers: RefreshCb[] = [];

function onTokenRefreshed(token: string) {
	refreshSubscribers.forEach((cb) => cb(token));
	refreshSubscribers = [];
}

function onRefreshFailed(error: unknown) {
	refreshSubscribers.forEach((cb) => cb(null, error));
	refreshSubscribers = [];
}

function subscribeToRefresh(cb: RefreshCb) {
	refreshSubscribers.push(cb);
}

async function doRefresh(refreshToken: string) {
	// Network errors get one retry after 1s backoff — mobile flakiness only
	try {
		return await axios.post(`${API_URL}/auth/refresh`, { refresh_token: refreshToken }, { timeout: 25000 });
	} catch (err: any) {
		if (err?.response) throw err; // HTTP error (401, 5xx) — don't retry, surface immediately
		await new Promise((r) => setTimeout(r, 1000));
		return await axios.post(`${API_URL}/auth/refresh`, { refresh_token: refreshToken }, { timeout: 25000 });
	}
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
			return Promise.reject(error);
		}

		const refreshToken = localStorage.getItem('refresh_token');
		if (!refreshToken) {
			localStorage.removeItem('token');
			return Promise.reject(error);
		}

		if (isRefreshing) {
			// Another request is already refreshing — wait for it
			return new Promise((resolve, reject) => {
				subscribeToRefresh((newToken, error) => {
					if (error || !newToken) { reject(error); return; }
					originalRequest.headers.Authorization = `Bearer ${newToken}`;
					originalRequest._retry = true;
					resolve(api(originalRequest));
				});
			});
		}

		isRefreshing = true;
		originalRequest._retry = true;

		try {
			const res = await doRefresh(refreshToken);
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
		} catch (refreshError: any) {
			isRefreshing = false;
			// Only nuke tokens when the refresh token is actually rejected.
			// Network/timeout/5xx failures leave the tokens alone so the user
			// stays logged in across mobile network blips.
			const isAuthFailure = refreshError?.response?.status === 401;
			onRefreshFailed(refreshError);
			if (isAuthFailure) {
				localStorage.removeItem('token');
				localStorage.removeItem('refresh_token');
			}
			return Promise.reject(refreshError);
		}
	}
);
