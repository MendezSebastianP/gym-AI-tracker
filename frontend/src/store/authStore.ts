import { create } from 'zustand';
import { api } from '../api/client';
import { db } from '../db/schema';
import type { User } from '../db/schema';
import { syncAllDataBeforeLogout } from '../db/sync';

interface AuthState {
	user: User | null;
	token: string | null;
	isAuthenticated: boolean;
	isAdmin: boolean;
	isLoading: boolean;
	login: (token: string, refreshToken?: string) => Promise<void>;
	logout: () => void;
	checkAuth: () => Promise<void>;
	updateUser: (updates: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
	user: null,
	token: localStorage.getItem('token'),
	isAuthenticated: !!localStorage.getItem('token'),
	isAdmin: false,
	isLoading: true,

	login: async (token: string, refreshToken?: string) => {
		localStorage.setItem('token', token);
		if (refreshToken) {
			localStorage.setItem('refresh_token', refreshToken);
		}
		set({ token, isAuthenticated: true });

		try {
			// Fetch user profile
			const response = await api.get('/auth/me');
			const user = response.data;
			set({ user, isAdmin: user.is_admin || false });

			// Cache user to IndexedDB
			await db.users.put(user);
		} catch (error) {
			console.error("Failed to fetch user profile", error);
		}
	},

	logout: async () => {
		// Sync ALL pending sessions/sets to server before clearing local data
		try {
			await syncAllDataBeforeLogout();
		} catch (e) {
			console.error("Failed to sync before logout", e);
		}

		// Revoke refresh token on server
		try {
			await api.post('/auth/logout');
		} catch (e) {
			// Best-effort — don't block logout if server is unreachable
		}

		localStorage.removeItem('token');
		localStorage.removeItem('refresh_token');
		try {
			await db.delete();
			await db.open();
		} catch (e) {
			console.error("Failed to clear local DB on logout", e);
		}
		set({ user: null, token: null, isAuthenticated: false, isAdmin: false });
	},


	checkAuth: async () => {
		const token = localStorage.getItem('token');
		if (!token) {
			set({ isLoading: false, isAuthenticated: false });
			return;
		}

		try {
			const response = await api.get('/auth/me');
			set({ user: response.data, isAuthenticated: true, isAdmin: response.data.is_admin || false, isLoading: false });
		} catch (error) {
			// If offline, try to load from local DB
			if (!navigator.onLine) {
				const user = await db.users.toCollection().first();
				if (user) {
					set({ user, isAuthenticated: true, isAdmin: user.is_admin || false, isLoading: false });
					return;
				}
			}

			console.error("Auth check failed", error);
			localStorage.removeItem('token');
			set({ user: null, token: null, isAuthenticated: false, isAdmin: false, isLoading: false });
		}
	},

	// Update user object in store (for immediate local reflection of settings changes)
	updateUser: (updates: Partial<User>) => {
		set((state: AuthState) => ({
			user: state.user ? { ...state.user, ...updates } : null
		}));
	}
}));

// Listen for logout events from other tabs
if (typeof window !== 'undefined') {
	window.addEventListener('storage', (event) => {
		if ((event.key === 'token' || event.key === 'refresh_token') && !event.newValue) {
			console.log('Token removed in another tab. Logging out...');
			useAuthStore.getState().logout();
		}
	});
}
