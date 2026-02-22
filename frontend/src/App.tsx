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

	useEffect(() => {
		// Initial sync of exercises on app load if authenticated
		const syncUserData = async () => {
			if (!isAuthenticated) return;
			if (!navigator.onLine) return;

			try {
				// Sync Exercises
				const resEx = await api.get('/exercises');
				await db.exercises.bulkPut(resEx.data);
				console.log(`Synced ${resEx.data.length} exercises`);

				// Sync Routines
				const resRoutines = await api.get('/routines');
				await db.routines.clear();
				await db.routines.bulkPut(resRoutines.data.map((r: any) => ({ ...r, syncStatus: 'synced' })));
				console.log(`Synced ${resRoutines.data.length} routines`);

				// Sync Sessions & Sets
				const resSessions = await api.get('/sessions?limit=100');
				const sessions = resSessions.data;
				const allSets: any[] = [];

				const sessionsToStore = sessions.map((s: any) => {
					if (s.sets) {
						s.sets.forEach((set: any) => {
							allSets.push({ ...set, session_id: s.id, syncStatus: 'synced', server_id: set.id });
						});
					}
					const { sets, ...sessionData } = s;
					return { ...sessionData, syncStatus: 'synced', server_id: s.id };
				});

				await db.sessions.clear();
				await db.sets.clear();
				if (sessionsToStore.length > 0) {
					await db.sessions.bulkPut(sessionsToStore);
				}
				if (allSets.length > 0) {
					await db.sets.bulkPut(allSets);
				}
				console.log(`Synced ${sessions.length} sessions and ${allSets.length} sets`);

			} catch (e) {
				console.error("Failed to sync user data", e);
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
