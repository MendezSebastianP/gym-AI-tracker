import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { ProtectedRoute } from './components/ProtectedRoute';
import Layout from './components/Layout';
import { AdminRoute } from './components/AdminRoute';
import AdminLayout from './components/AdminLayout';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { api } from './api/client';
import { db } from './db/schema';
import { useAuthStore } from './store/authStore';
import { startSyncService, stopSyncService, getPendingDeleteServerIds, processSyncQueue } from './db/sync';
import i18n from './i18n';
import OnboardingToast from './components/OnboardingToast';
import { MotionPreferenceSync, MotionProvider, PublicRouteFrame, StandaloneAppRouteFrame } from './motion/RouteTransition';
import { getRootShellKey } from './motion/routes';

const Landing = lazy(() => import('./pages/Landing'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Terms = lazy(() => import('./pages/Terms'));
const Routines = lazy(() => import('./pages/Routines'));
const CreateRoutine = lazy(() => import('./pages/CreateRoutine'));
const RoutineDetails = lazy(() => import('./pages/RoutineDetails'));
const ActiveSession = lazy(() => import('./pages/ActiveSession'));
const Stats = lazy(() => import('./pages/Stats'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Settings = lazy(() => import('./pages/Settings'));
const Sessions = lazy(() => import('./pages/Sessions'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const Shop = lazy(() => import('./pages/Shop'));
const Quests = lazy(() => import('./pages/Quests'));
const TrainingContext = lazy(() => import('./pages/TrainingContext'));
const ProgressionReport = lazy(() => import('./pages/ProgressionReport'));
const Playground = lazy(() => import('./pages/Playground'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
const AdminExercises = lazy(() => import('./pages/admin/AdminExercises'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'));

function RouteLoadingFallback() {
	return (
		<div
			style={{
				minHeight: '100vh',
				display: 'grid',
				placeItems: 'center',
				padding: '24px',
				background: 'var(--bg-primary)',
				color: 'var(--text-secondary)',
				fontSize: '14px',
				letterSpacing: '0.04em',
				textTransform: 'uppercase',
			}}
		>
			Loading...
		</div>
	);
}

function App() {
	const { isAuthenticated, isAdmin, user } = useAuthStore();
	const location = useLocation();

	const { needRefresh, updateServiceWorker } = useRegisterSW();

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
				// Push any pending local changes before pulling from server
				await processSyncQueue();

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

				// Skip sessions the user has deleted locally but server hasn't processed yet
				const pendingDeletes = await getPendingDeleteServerIds();

				// Merge / Upsert server sessions
				for (const s of serverSessions) {
					const { sets: serverSets, id: serverId, ...sessionData } = s;
					if (pendingDeletes.has(serverId)) continue; // Skip — pending deletion
					activeServerSessionIds.add(serverId);

					let localSessionId: number;
					if (serverIdToLocalSession.has(serverId)) {
						localSessionId = serverIdToLocalSession.get(serverId)!;
						const existing = existingSessions.find(x => x.id === localSessionId);
						if (existing?.syncStatus === 'updated') {
							// Local has unsent edits — preserve local values, just ensure server_id is set
							await db.sessions.update(localSessionId, { server_id: serverId });
						} else {
							await db.sessions.update(localSessionId, {
								...sessionData,
								server_id: serverId,
								syncStatus: 'synced'
							});
						}
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
								if (existing?.syncStatus === 'updated') {
									// Local has unsent edits — preserve local values, just link server_id
									// Do NOT change session_id: the local assignment is authoritative
									await db.sets.update(localSetId, { server_id: setServerId });
								} else {
									await db.sets.update(localSetId, {
										...setData,
										set_type: (setData as any).set_type || 'normal',
										to_failure: !!(setData as any).to_failure,
										server_id: setServerId,
										// Do NOT change session_id: local assignment is authoritative
										syncStatus: 'synced'
									});
								}
							} else {
								await db.sets.add({
									...setData,
									set_type: (setData as any).set_type || 'normal',
									to_failure: !!(setData as any).to_failure,
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
	const shellKey = getRootShellKey(location.pathname);

	return (
		<MotionProvider>
			<MotionPreferenceSync />
			<OnboardingToast />
			{needRefresh[0] && (
			<div style={{
				position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
				background: 'var(--bg-secondary)', borderBottom: '1px solid var(--overlay-medium)',
				padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '12px',
				fontSize: '13px', color: 'var(--text-primary)'
			}}>
				<span style={{ flex: 1 }}>New version available</span>
				<button
					onClick={() => updateServiceWorker(true)}
					style={{
						background: 'var(--accent)', color: '#000', border: 'none',
						borderRadius: '6px', padding: '5px 12px', fontSize: '12px',
						fontWeight: 600, cursor: 'pointer'
					}}
				>Update</button>
				<button
					onClick={() => needRefresh[1](false)}
					style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '4px' }}
				>✕</button>
			</div>
		)}
			<Suspense fallback={<RouteLoadingFallback />}>
				<AnimatePresence mode="wait" initial={false}>
					<Routes location={location} key={shellKey}>
						<Route
							path="/"
							element={isAuthenticated ? (isAdmin ? <Navigate to="/admin" replace /> : <Navigate to="/home" replace />) : <PublicRouteFrame><Landing /></PublicRouteFrame>}
						/>
						<Route path="/login" element={isAuthenticated ? <Navigate to="/home" replace /> : <PublicRouteFrame><Login /></PublicRouteFrame>} />
						<Route path="/register" element={isAuthenticated ? <Navigate to="/home" replace /> : <PublicRouteFrame><Register /></PublicRouteFrame>} />
						<Route path="/privacy" element={<PublicRouteFrame><Privacy /></PublicRouteFrame>} />
						<Route path="/terms" element={<PublicRouteFrame><Terms /></PublicRouteFrame>} />
						<Route element={<AdminRoute />}>
							<Route path="/playground" element={<Playground />} />
						</Route>

						<Route element={<ProtectedRoute />}>
							<Route path="/onboarding" element={<StandaloneAppRouteFrame><Onboarding /></StandaloneAppRouteFrame>} />
							<Route element={<Layout />}>
								<Route path="/dashboard" element={<Dashboard />} />
								<Route path="/sessions" element={<Sessions />} />
								<Route path="/sessions/:id" element={<ActiveSession />} />
								<Route path="/sessions/:routineName/:index" element={<ActiveSession />} />
								<Route path="/routines" element={<Routines />} />
								<Route path="/routines/new" element={<CreateRoutine />} />
								<Route path="/routines/:id" element={<RoutineDetails />} />
								<Route path="/routines/:id/report" element={<ProgressionReport />} />
								<Route path="/home" element={<Stats />} />
								<Route path="/quests" element={<Quests />} />

								<Route path="/settings" element={<Settings />} />
								<Route path="/settings/questionnaire" element={<TrainingContext />} />
								<Route path="/shop" element={<Shop />} />

							</Route>
						</Route>

						<Route element={<AdminRoute />}>
							<Route element={<AdminLayout />}>
								<Route path="/admin" element={<AdminDashboard />} />
								<Route path="/admin/users" element={<AdminUsers />} />
								<Route path="/admin/exercises" element={<AdminExercises />} />
								<Route path="/admin/settings" element={<AdminSettings />} />
							</Route>
						</Route>

						<Route path="*" element={<Navigate to="/" replace />} />
					</Routes>
				</AnimatePresence>
			</Suspense>
		</MotionProvider>
	);
}

export default App;
