import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Routines from './pages/Routines';
import CreateRoutine from './pages/CreateRoutine';
import RoutineDetails from './pages/RoutineDetails';
import ActiveSession from './pages/ActiveSession';
import Stats from './pages/Stats';
import Settings from './pages/Settings';
import Sessions from './pages/Sessions';
import Onboarding from './pages/Onboarding';
import { useEffect } from 'react';
import { api } from './api/client';
import { db } from './db/schema';
import { useAuthStore } from './store/authStore';
import { startSyncService, stopSyncService } from './db/sync';
import i18n from './i18n';

function App() {
	const { isAuthenticated, user } = useAuthStore();

	useEffect(() => {
		if (isAuthenticated) {
			startSyncService();
		}
		return () => stopSyncService();
	}, [isAuthenticated]);

	// Restore language from user settings on login
	useEffect(() => {
		if (user?.settings?.language) {
			const savedLang = user.settings.language;
			if (savedLang && i18n.language !== savedLang) {
				i18n.changeLanguage(savedLang);
				localStorage.setItem('i18nextLng', savedLang);
			}
		}
	}, [user]);

	let isSyncingUserData = false;

	useEffect(() => {
		// Initial sync of exercises on app load if authenticated
		const syncUserData = async () => {
			if (!isAuthenticated || !navigator.onLine) return;
			if (isSyncingUserData) return;

			isSyncingUserData = true;
			try {
				// Sync Exercises
				const resEx = await api.get('/exercises');
				await db.exercises.bulkPut(resEx.data);
				console.log(`Synced ${resEx.data.length} exercises`);

				// Sync Routines (server IDs are used directly as local IDs for routines)
				const resRoutines = await api.get('/routines');
				await db.routines.clear();
				await db.routines.bulkPut(resRoutines.data.map((r: any) => ({ ...r, syncStatus: 'synced' })));
				console.log(`Synced ${resRoutines.data.length} routines`);

				// Sync Sessions & Sets
				// IMPORTANT: Sessions use ++id (auto-increment local id) in Dexie.
				// The server id must be stored as server_id only — never as the local id.
				const resSessions = await api.get('/sessions?limit=100');
				const serverSessions: any[] = resSessions.data;

				// Save any unsynced local sessions BEFORE clearing (they have no server_id)
				const unsyncedSessions = await db.sessions.filter((s: any) => s.syncStatus === 'created' || s.syncStatus === 'updated').toArray();
				const unsyncedSets = await db.sets.filter((s: any) => s.syncStatus === 'created' || s.syncStatus === 'updated').toArray();

				await db.sessions.clear();
				await db.sets.clear();

				// Insert server sessions one-by-one so Dexie assigns local IDs,
				// and track the server_id -> local_id map to assign correct session_id on sets
				const localIdByServerId = new Map<number, number>();
				for (const s of serverSessions) {
					const { sets: serverSets, id: serverId, ...sessionData } = s;
					const localId = await db.sessions.add({
						...sessionData,
						server_id: serverId,
						syncStatus: 'synced'
					} as any);
					localIdByServerId.set(serverId, localId as number);

					// Insert this session's sets, using the new local session id
					if (serverSets && serverSets.length > 0) {
						for (const set of serverSets) {
							const { id: setServerId, ...setData } = set;
							await db.sets.add({
								...setData,
								session_id: localId as number,
								server_id: setServerId,
								syncStatus: 'synced'
							} as any);
						}
					}
				}

				// Re-add unsynced local sessions/sets (remap local session ids since DB was cleared)
				for (const s of unsyncedSessions) {
					const oldLocalId = s.id;
					const { id, ...sessionData } = s;

					let newLocalId: number;

					// If this session was already synced to the server once (it has a server_id)
					// and we fetched it from the server just now, overwrite the clean server row
					// with our dirty local updates, so we don't duplicate it.
					if (sessionData.server_id && localIdByServerId.has(sessionData.server_id)) {
						newLocalId = localIdByServerId.get(sessionData.server_id)!;
						await db.sessions.update(newLocalId, {
							...sessionData,
							syncStatus: s.syncStatus
						});
					} else {
						newLocalId = await db.sessions.add(sessionData as any) as number;
					}

					// Re-add sets belonging to this session with updated session_id
					for (const set of unsyncedSets) {
						if (set.session_id === oldLocalId) {
							const { id: setId, ...setData } = set;

							if (set.server_id) {
								// Find the locally generated ID for this server set
								const existingSet = await db.sets.where('server_id').equals(set.server_id).first();
								if (existingSet && existingSet.id) {
									await db.sets.update(existingSet.id, {
										...setData,
										session_id: newLocalId,
										syncStatus: set.syncStatus
									});
									continue;
								}
							}

							await db.sets.add({ ...setData, session_id: newLocalId } as any);
						}
					}
				}

				console.log(`Synced ${serverSessions.length} sessions. Retained ${unsyncedSessions.length} unsynced sessions.`);

			} catch (e) {
				console.error("Failed to sync user data", e);
			} finally {
				isSyncingUserData = false;
			}
		};

		syncUserData();
	}, [isAuthenticated]);

	return (
		<Routes>
			<Route path="/login" element={<Login />} />
			<Route path="/register" element={<Register />} />

			<Route element={<ProtectedRoute />}>
				<Route path="/onboarding" element={<Onboarding />} />
				<Route element={<Layout />}>
					<Route path="/" element={<Stats />} />
					<Route path="/sessions" element={<Sessions />} />
					<Route path="/sessions/:id" element={<ActiveSession />} />
					<Route path="/routines" element={<Routines />} />
					<Route path="/routines/new" element={<CreateRoutine />} />
					<Route path="/routines/:id" element={<RoutineDetails />} />
					<Route path="/stats" element={<Stats />} />
					<Route path="/settings" element={<Settings />} />
				</Route>
			</Route>

			<Route path="*" element={<Navigate to="/" replace />} />
		</Routes>
	);
}

export default App;
