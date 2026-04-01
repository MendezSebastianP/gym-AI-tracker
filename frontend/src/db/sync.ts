import { db } from './schema';
import { api } from '../api/client';

let isSyncing = false;

export const processSyncQueue = async () => {
	if (!navigator.onLine || isSyncing || !db.isOpen()) return;
	isSyncing = true;

	try {
		const allEvents = await db.syncQueue.toArray();
		const events = allEvents.filter(e => e.processed === false);

		if (events.length > 0) {
			console.log(`Syncing ${events.length} queue events...`);

			for (const event of events) {
				try {
					if (event.event_type === 'create_routine') {
						await api.post('/routines', event.payload);
					} else if (event.event_type === 'delete_session') {
						await api.delete(`/sessions/${event.payload.server_id}`);
					}
					// Always delete to unblock queue
					if (event.id) await db.syncQueue.delete(event.id);
				} catch (err) {
					console.error("Queue item sync failed", err);
				}
			}
		}

		// Opportunistically upload any un-synced routines
		const unsyncedRoutines = await db.routines.filter((r: any) => r.syncStatus === 'created').toArray();
		for (const r of unsyncedRoutines) {
			try {
				const { id, syncStatus, ...data } = r as any;
				const res = await api.post('/routines', data);
				// Update with server ID (routines use server id as local id, so we need to replace)
				await db.routines.delete(id);
				await db.routines.put({ ...res.data, syncStatus: 'synced' });
			} catch (e) { /* intentionally swallow - offline, will retry */ }
		}

		// Opportunistically upload any un-synced sessions
		const unsyncedSessions = await db.sessions
			.filter((s: any) => s.syncStatus && s.syncStatus !== 'synced')
			.toArray();

		for (const session of unsyncedSessions) {
			await syncSessionToServer(session);
		}

		// Opportunistically upload any lingering un-synced sets for already-synced sessions
		const remainingUnsyncedSets = await db.sets
			.filter((s: any) => s.syncStatus && s.syncStatus !== 'synced')
			.toArray();

		for (const set of remainingUnsyncedSets) {
			try {
				const parentSession = await db.sessions.get(set.session_id);
				if (!parentSession?.server_id) continue;

				const serverSessionId = parentSession.server_id;

				if (!set.server_id) {
					const setRes = await api.post('/sets', {
						session_id: serverSessionId,
						exercise_id: set.exercise_id,
						set_number: set.set_number,
						weight_kg: set.weight_kg,
						reps: set.reps,
						duration_sec: set.duration_sec,
						rpe: set.rpe,
						distance_km: set.distance_km,
						avg_pace: set.avg_pace,
						incline: set.incline,
						set_type: set.set_type || 'normal',
						to_failure: !!set.to_failure,
						completed_at: set.completed_at,
					});
					await db.sets.update(set.id!, {
						syncStatus: 'synced',
						server_id: setRes.data.id,
					});
				} else if (set.syncStatus === 'updated' && set.server_id) {
					await api.put(`/sets/${set.server_id}`, {
						weight_kg: set.weight_kg,
						reps: set.reps,
						duration_sec: set.duration_sec,
						set_number: set.set_number,
						distance_km: set.distance_km,
						avg_pace: set.avg_pace,
						incline: set.incline,
						set_type: set.set_type || 'normal',
						to_failure: !!set.to_failure,
					});
					await db.sets.update(set.id!, { syncStatus: 'synced' });
				}
			} catch (setErr) {
				console.error(`Failed to sync set ${set.id}`, setErr);
			}
		}

	} catch (e) {
		console.error("Sync failed", e);
	} finally {
		isSyncing = false;
	}
};

/**
 * Sync a single session (and its sets) to the server.
 * Returns the server_id on success, null on failure.
 */
const syncSessionToServer = async (session: any): Promise<number | null> => {
	try {
		const sessionSets = await db.sets.where('session_id').equals(session.id!).toArray();

		if (!session.server_id) {
			// Never created on server — create it now
			const res = await api.post('/sessions', {
				routine_id: session.routine_id,
				day_index: session.day_index,
				started_at: session.started_at,
				completed_at: null, // Send as null initially
				notes: session.notes,
				locked_exercises: session.locked_exercises || [],
			});

			const serverId: number = res.data.id;
			session.server_id = serverId;
			await db.sessions.update(session.id!, { server_id: serverId });
		}

		const serverId = session.server_id;

		if (session.completed_at && session.syncStatus === 'updated') {
			// Already-completed session was edited (e.g. date change) — just PUT the metadata
			await api.put(`/sessions/${serverId}`, {
				started_at: session.started_at,
				completed_at: session.completed_at,
				notes: session.notes,
				duration_seconds: session.duration_seconds || null,
				locked_exercises: session.locked_exercises || [],
				bodyweight_kg: session.bodyweight_kg || null,
				self_rated_effort: session.self_rated_effort ?? null,
			});
			await db.sessions.update(session.id!, { syncStatus: 'synced' });
			return serverId;
		} else if (session.completed_at) {
			// Bulk sync and complete
			const bulkPayload = {
				completed_at: session.completed_at,
				notes: session.notes,
				duration_seconds: session.duration_seconds || null,
				bodyweight_kg: session.bodyweight_kg || null,
				self_rated_effort: session.self_rated_effort ?? null,
				sets: sessionSets.map((s: any) => ({
					exercise_id: s.exercise_id,
					set_number: s.set_number,
					weight_kg: s.weight_kg,
					reps: s.reps,
					duration_sec: s.duration_sec,
					rpe: s.rpe,
					distance_km: s.distance_km,
					avg_pace: s.avg_pace,
					incline: s.incline,
					set_type: s.set_type || 'normal',
					to_failure: !!s.to_failure,
					completed_at: s.completed_at || session.completed_at
				}))
			};

			const finalRes = await api.post(`/sessions/${serverId}/complete_bulk`, bulkPayload);

			// Dispatch gamification if it was just completed
			if (finalRes.data?.gamification) {
				window.dispatchEvent(new CustomEvent('gamification-reward', {
					detail: finalRes.data.gamification
				}));
			}

			// Mark everything synced locally
			await db.sessions.update(session.id!, {
				syncStatus: 'synced',
				effort_score: finalRes.data?.effort_score ?? session.effort_score ?? null,
			});

			for (const s of sessionSets) {
				if (finalRes.data?.sets) {
					const serverSets = finalRes.data.sets;
					const matchingServerSet = serverSets.find((srv: any) =>
						srv.exercise_id === s.exercise_id &&
						srv.set_number === s.set_number &&
						(srv.set_type || 'normal') === (s.set_type || 'normal')
					);
					if (matchingServerSet) {
						await db.sets.update(s.id!, { syncStatus: 'synced', server_id: matchingServerSet.id });
					} else {
						await db.sets.update(s.id!, { syncStatus: 'synced' });
					}
				} else {
					await db.sets.update(s.id!, { syncStatus: 'synced' });
				}
			}
			return serverId;

		} else {
			// Routine sync loop for IN-PROGRESS session
			if (session.syncStatus === 'updated') {
				const updateRes = await api.put(`/sessions/${serverId}`, {
					started_at: session.started_at,
					completed_at: session.completed_at,
					notes: session.notes,
					locked_exercises: session.locked_exercises || [],
					duration_seconds: session.duration_seconds || null,
					bodyweight_kg: session.bodyweight_kg || null,
					self_rated_effort: session.self_rated_effort ?? null,
				});
				await db.sessions.update(session.id!, { syncStatus: 'synced' });

				if (updateRes.data?.gamification) {
					window.dispatchEvent(new CustomEvent('gamification-reward', {
						detail: updateRes.data.gamification
					}));
				}
			}

			// Also sync any unsynced sets belonging to this session
			for (const set of sessionSets) {
				if (set.syncStatus && set.syncStatus !== 'synced') {
					try {
						if (!set.server_id) {
							const setRes = await api.post('/sets', {
								session_id: serverId,
								exercise_id: set.exercise_id,
								set_number: set.set_number,
								weight_kg: set.weight_kg,
								reps: set.reps,
								duration_sec: set.duration_sec,
								rpe: set.rpe,
								distance_km: set.distance_km,
								avg_pace: set.avg_pace,
								incline: set.incline,
								set_type: set.set_type || 'normal',
								to_failure: !!set.to_failure,
								completed_at: set.completed_at,
							});
							await db.sets.update(set.id!, {
								syncStatus: 'synced',
								server_id: setRes.data.id,
							});
						} else if (set.syncStatus === 'updated') {
							await api.put(`/sets/${set.server_id}`, {
								weight_kg: set.weight_kg,
								reps: set.reps,
								set_number: set.set_number,
								distance_km: set.distance_km,
								avg_pace: set.avg_pace,
								incline: set.incline,
								set_type: set.set_type || 'normal',
								to_failure: !!set.to_failure,
							});
							await db.sets.update(set.id!, { syncStatus: 'synced' });
						}
					} catch (setErr) {
						console.error(`Failed to sync set ${set.id}`, setErr);
					}
				}
			}

			return serverId;
		}
	} catch (sessionErr) {
		console.error(`Failed to sync session ${session.id}`, sessionErr);
	}
	return null;
};

/**
 * Force-sync all local sessions and sets to the server before logout.
 * This ensures no data is lost when the local DB is cleared.
 */
export const syncAllDataBeforeLogout = async () => {
	if (!navigator.onLine) {
		console.warn("Cannot sync before logout: offline");
		return;
	}
	if (!db.isOpen()) return;

	try {
		// 1. Process any pending sync queue events first
		await processSyncQueue();

		// 2. Sync any sessions that haven't been synced yet (syncStatus !== 'synced')
		const unsyncedSessions = await db.sessions
			.filter((s: any) => s.syncStatus && s.syncStatus !== 'synced')
			.toArray();

		for (const session of unsyncedSessions) {
			await syncSessionToServer(session);
		}

		// 3. Sync any lingering unsynced sets whose session IS already on the server
		//    (edge case: set was created/updated after session was synced)
		const remainingUnsyncedSets = await db.sets
			.filter((s: any) => s.syncStatus && s.syncStatus !== 'synced')
			.toArray();

		for (const set of remainingUnsyncedSets) {
			try {
				const parentSession = await db.sessions.get(set.session_id);
				if (!parentSession?.server_id) continue; // parent not synced yet, skip

				const serverSessionId = parentSession.server_id;

				if (!set.server_id) {
					const setRes = await api.post('/sets', {
						session_id: serverSessionId,
						exercise_id: set.exercise_id,
						set_number: set.set_number,
						weight_kg: set.weight_kg,
						reps: set.reps,
						duration_sec: set.duration_sec,
						rpe: set.rpe,
						distance_km: set.distance_km,
						avg_pace: set.avg_pace,
						incline: set.incline,
						set_type: set.set_type || 'normal',
						to_failure: !!set.to_failure,
						completed_at: set.completed_at,
					});
					await db.sets.update(set.id!, {
						syncStatus: 'synced',
						server_id: setRes.data.id,
					});
				} else if (set.syncStatus === 'updated' && set.server_id) {
					await api.put(`/sets/${set.server_id}`, {
						weight_kg: set.weight_kg,
						reps: set.reps,
						duration_sec: set.duration_sec,
						set_number: set.set_number,
						distance_km: set.distance_km,
						avg_pace: set.avg_pace,
						incline: set.incline,
						set_type: set.set_type || 'normal',
						to_failure: !!set.to_failure,
					});
					await db.sets.update(set.id!, { syncStatus: 'synced' });
				}
			} catch (setErr) {
				console.error(`Failed to sync set ${set.id}`, setErr);
			}
		}

		console.log("All data synced before logout");
	} catch (e) {
		console.error("Failed to sync all data before logout", e);
	}
};

/**
 * Returns server IDs of sessions that are pending deletion in the sync queue.
 * Used by syncUserData to avoid re-creating sessions the user already deleted.
 */
export const getPendingDeleteServerIds = async (): Promise<Set<number>> => {
	const allEvents = await db.syncQueue.toArray();
	const ids = new Set<number>();
	for (const e of allEvents) {
		if (e.event_type === 'delete_session' && e.payload?.server_id) {
			ids.add(e.payload.server_id);
		}
	}
	return ids;
};

// Setup interval
let syncInterval: any;

export const startSyncService = () => {
	if (syncInterval) clearInterval(syncInterval);
	syncInterval = setInterval(processSyncQueue, 30000); // Sync every 30s

	// Also sync on online event and when app is backgrounded/closed
	window.addEventListener('online', processSyncQueue);
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'hidden') {
			processSyncQueue();
		}
	});
};

export const stopSyncService = () => {
	if (syncInterval) clearInterval(syncInterval);
	window.removeEventListener('online', processSyncQueue);
	document.removeEventListener('visibilitychange', processSyncQueue);
};
