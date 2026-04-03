import { create } from 'zustand';
import { api } from '../api/client';
import { db } from '../db/schema';
import type { User } from '../db/schema';
import { syncAllDataBeforeLogout, stopSyncService } from '../db/sync';

/**
 * Bypass Dexie's closed-state entirely by deleting the DB with the native IndexedDB API.
 * Safe to call at any time — even when Dexie is in an unusable state.
 */
export const hardReset = async () => {
	localStorage.clear();
	// Close Dexie first so the deleteDatabase request isn't blocked by an open connection
	try { db.close(); } catch (_) { /* ignore */ }
	await new Promise<void>((resolve) => {
		const req = indexedDB.deleteDatabase('GymTrackerDB');
		req.onsuccess = () => resolve();
		req.onerror = () => resolve();
		req.onblocked = () => resolve(); // resolve anyway — navigate will close remaining connections
	});
	window.location.replace('/login');
};

interface AuthState {
	user: User | null;
	token: string | null;
	isAuthenticated: boolean;
	isAdmin: boolean;
	isLoading: boolean;
	login: (token: string, refreshToken?: string) => Promise<void>;
	logout: () => Promise<void>;
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
			set({ user, isAdmin: user.is_admin || false, isLoading: false });

			// Cache user to IndexedDB
			await db.users.put(user);
		} catch (error) {
			console.error("Failed to fetch user profile", error);
			set({ isLoading: false });
		}
	},

	logout: async () => {
		// Sync unsynced data before wiping — 1.5s cap keeps logout snappy
		// (normal case: everything already synced, resolves in <200ms)
		try {
			await Promise.race([
				syncAllDataBeforeLogout(),
				new Promise<void>(resolve => setTimeout(resolve, 1500)),
			]);
		} catch (_) { /* best-effort */ }

		// No server logout call — access token expires in 15min, refresh in 7d.
		// The server call required a valid access token which is often expired by
		// logout time, causing a visible 401 in the browser console.

		// Stop background sync before touching the DB
		stopSyncService();

		// Immediate local cleanup
		localStorage.removeItem('token');
		localStorage.removeItem('refresh_token');
		// Clear all tables instead of delete+reopen — keeps Dexie's observation
		// system intact so useLiveQuery hooks work after the next login
		try {
			await Promise.race([
				Promise.all([
					db.users.clear(),
					db.exercises.clear(),
					db.routines.clear(),
					db.sessions.clear(),
					db.sets.clear(),
					db.syncQueue.clear(),
				]),
				new Promise<void>(resolve => setTimeout(resolve, 1000)),
			]);
		} catch (_) { /* ignore */ }
		set({ user: null, token: null, isAuthenticated: false, isAdmin: false, isLoading: false });
	},


	checkAuth: async () => {
		try {
			const token = localStorage.getItem('token');
			if (!token) {
				set({ isLoading: false, isAuthenticated: false });
				return;
			}
			// If already authenticated with user data, skip redundant server call
			const state = useAuthStore.getState();
			if (state.isAuthenticated && state.user) {
				set({ isLoading: false });
				return;
			}

			try {
				const response = await api.get('/auth/me');
				set({ user: response.data, isAuthenticated: true, isAdmin: response.data.is_admin || false, isLoading: false });
			} catch (error) {
				// If offline, try to load from local DB
				if (!navigator.onLine) {
					try {
						const user = await db.users.toCollection().first();
						if (user) {
							set({ user, isAuthenticated: true, isAdmin: user.is_admin || false, isLoading: false });
							return;
						}
					} catch (dbErr) {
						// DB is in a broken/closed state — hard reset to unblock the user
						console.error("DB broken during offline auth check — hard resetting", dbErr);
						await hardReset();
						return;
					}
				}

				console.error("Auth check failed", error);
				localStorage.removeItem('token');
				set({ user: null, token: null, isAuthenticated: false, isAdmin: false, isLoading: false });
			}
		} catch (fatal) {
			// Catch-all: any unexpected error (e.g. DB closed, version mismatch)
			console.error("Fatal error in checkAuth — hard resetting", fatal);
			await hardReset();
		}
	},

	// Update user object in store (for immediate local reflection of settings changes)
	updateUser: (updates: Partial<User>) => {
		set((state: AuthState) => {
			if (!state.user) {
				return state;
			}
			const nextUser = { ...state.user, ...updates };
			db.users.put(nextUser).catch(() => {});
			return {
				user: nextUser,
				isAdmin: nextUser.is_admin || false,
			};
		});
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
