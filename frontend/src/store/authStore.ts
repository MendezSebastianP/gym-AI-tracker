import { create } from 'zustand';
import { api } from '../api/client';
import { db, User } from '../db/schema';
import { syncAllDataBeforeLogout } from '../db/sync';

interface AuthState {
	user: User | null;
	token: string | null;
	isAuthenticated: boolean;
	isLoading: boolean;
	login: (token: string) => Promise<void>;
	logout: () => void;
	checkAuth: () => Promise<void>;
	updateUser: (updates: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
	user: null,
	token: localStorage.getItem('token'),
	isAuthenticated: !!localStorage.getItem('token'),
	isLoading: true,

	login: async (token: string) => {
		localStorage.setItem('token', token);
		set({ token, isAuthenticated: true });

		try {
			// Fetch user profile
			const response = await api.get('/auth/me');
			const user = response.data;
			set({ user });

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

		localStorage.removeItem('token');
		try {
			await db.delete();
			await db.open();
		} catch (e) {
			console.error("Failed to clear local DB on logout", e);
		}
		set({ user: null, token: null, isAuthenticated: false });
	},

	checkAuth: async () => {
		const token = localStorage.getItem('token');
		if (!token) {
			set({ isLoading: false, isAuthenticated: false });
			return;
		}

		try {
			const response = await api.get('/auth/me');
			set({ user: response.data, isAuthenticated: true, isLoading: false });
		} catch (error) {
			// If offline, try to load from local DB
			if (!navigator.onLine) {
				const user = await db.users.toCollection().first();
				if (user) {
					set({ user, isAuthenticated: true, isLoading: false });
					return;
				}
			}

			console.error("Auth check failed", error);
			localStorage.removeItem('token');
			set({ user: null, token: null, isAuthenticated: false, isLoading: false });
		}
	},

	// Update user object in store (for immediate local reflection of settings changes)
	updateUser: (updates: Partial<User>) => {
		set((state) => ({
			user: state.user ? { ...state.user, ...updates } : null
		}));
	}
}));
