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

// Response interceptor to handle auth errors
api.interceptors.response.use(
	(response) => response,
	(error) => {
		if (error.response?.status === 401) {
			// Clear token and redirect to login if needed
			// but avoid loop if already on login
			localStorage.removeItem('token');
			// window.location.href = '/login'; // Let the router handle this via protective wrapper
		}
		return Promise.reject(error);
	}
);
