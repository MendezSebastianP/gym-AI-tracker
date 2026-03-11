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
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import Sessions from './pages/Sessions';
import Onboarding from './pages/Onboarding';
import Quests from './pages/Quests';
import RoutineQuestionnaire from './pages/RoutineQuestionnaire';

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
		// Restore theme from user settings
		if (user?.settings?.active_theme && user.settings.active_theme !== 'dark') {
			document.documentElement.setAttribute('data-theme', 'theme_' + user.settings.active_theme);
		} else {
			document.documentElement.removeAttribute('data-theme');
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

				// Sync Sessions & Sets without wiping local IDs to maintain stable URLs
				const resSessions = await api.get('/sessions?limit=100');
				// Sort chronological: oldest first so Dexie assigns ++id correctly
				const serverSessions: any[] = resSessions.data.sort((a: any, b: any) =>
					new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
				);

				const existingSessions = await db.sessions.toArray();
				const existingSets = await db.sets.toArray();

				const serverIdToLocalSession = new Map<number, number>();
				existingSessions.forEach(s => {
					if (s.server_id) serverIdToLocalSession.set(s.server_id, s.id!);
				});

				const serverIdToLocalSet = new Map<number, number>();
				existingSets.forEach(s => {
					if (s.server_id) serverIdToLocalSet.set(s.server_id, s.id!);
				});

				const activeServerSessionIds = new Set<number>();
				const activeServerSetIds = new Set<number>();

				// Merge / Upsert server sessions
				for (const s of serverSessions) {
					const { sets: serverSets, id: serverId, ...sessionData } = s;
					activeServerSessionIds.add(serverId);

					let localSessionId: number;
					if (serverIdToLocalSession.has(serverId)) {
						localSessionId = serverIdToLocalSession.get(serverId)!;
						const existing = existingSessions.find(x => x.id === localSessionId);
						await db.sessions.update(localSessionId, {
							...sessionData,
							server_id: serverId,
							syncStatus: existing?.syncStatus === 'updated' ? 'updated' : 'synced'
						});
					} else {
						localSessionId = await db.sessions.add({
							...sessionData,
							server_id: serverId,
							syncStatus: 'synced'
						} as any) as number;
						serverIdToLocalSession.set(serverId, localSessionId);
					}

					if (serverSets && serverSets.length > 0) {
						for (const serverSet of serverSets) {
							const { id: setServerId, ...setData } = serverSet;
							activeServerSetIds.add(setServerId);

							if (serverIdToLocalSet.has(setServerId)) {
								const localSetId = serverIdToLocalSet.get(setServerId)!;
								const existing = existingSets.find(x => x.id === localSetId);
								await db.sets.update(localSetId, {
									...setData,
									server_id: setServerId,
									session_id: localSessionId,
									syncStatus: existing?.syncStatus === 'updated' ? 'updated' : 'synced'
								});
							} else {
								await db.sets.add({
									...setData,
									server_id: setServerId,
									session_id: localSessionId,
									syncStatus: 'synced'
								} as any);
							}
						}
					}
				}

				// Purge synced sessions/sets that no longer exist on the server
				for (const existing of existingSessions) {
					if (existing.server_id && existing.syncStatus === 'synced' && !activeServerSessionIds.has(existing.server_id)) {
						await db.sessions.delete(existing.id!);
					}
				}
				for (const existing of existingSets) {
					if (existing.server_id && existing.syncStatus === 'synced' && !activeServerSetIds.has(existing.server_id)) {
						await db.sets.delete(existing.id!);
					}
				}

				console.log(`Synced ${serverSessions.length} sessions.`);

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
					<Route path="/dashboard" element={<Dashboard />} />
					<Route path="/sessions" element={<Sessions />} />
					<Route path="/sessions/:id" element={<ActiveSession />} />
					<Route path="/sessions/:routineName/:index" element={<ActiveSession />} />
					<Route path="/routines" element={<Routines />} />
					<Route path="/routines/new" element={<CreateRoutine />} />
					<Route path="/routines/:id" element={<RoutineDetails />} />
					<Route path="/stats" element={<Stats />} />
					<Route path="/quests" element={<Quests />} />

					<Route path="/settings" element={<Settings />} />
					<Route path="/settings/questionnaire" element={<RoutineQuestionnaire />} />
				</Route>
			</Route>

			<Route path="*" element={<Navigate to="/" replace />} />
		</Routes>
	);
}

export default App;
