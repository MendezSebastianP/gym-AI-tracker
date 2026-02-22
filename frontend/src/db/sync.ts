import { db } from './schema';
import { api } from '../api/client';

export const processSyncQueue = async () => {
	if (!navigator.onLine) return;

	// Use filter in memory to avoid key errors if index is missing or type mismatch
	const allEvents = await db.syncQueue.toArray();
	const events = allEvents.filter(e => e.processed === false);

	if (events.length === 0) return;

	console.log(`Syncing ${events.length} events...`);

	try {
		await api.post('/sync', events);

		const ids = events.map(e => e.id!).filter(id => id !== undefined);
		await db.syncQueue.bulkDelete(ids);
		console.log("Sync complete");
	} catch (e) {
		console.error("Sync failed", e);
	}
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

	try {
		// 1. Process any pending sync queue events first
		await processSyncQueue();

		// 2. Sync any sessions that haven't been synced yet (syncStatus !== 'synced')
		const unsyncedSessions = await db.sessions
			.filter((s: any) => s.syncStatus && s.syncStatus !== 'synced')
			.toArray();

		for (const session of unsyncedSessions) {
			try {
				if (!session.server_id) {
					// No server ID means it was never created on the server, even if local status is 'updated'
					const res = await api.post('/sessions', {
						routine_id: session.routine_id,
						day_index: session.day_index,
						started_at: session.started_at,
						completed_at: session.completed_at,
						notes: session.notes,
					});

					const serverId = res.data.id;

					const sessionSets = await db.sets
						.where('session_id')
						.equals(session.id!)
						.toArray();

					for (const set of sessionSets) {
						try {
							await api.post('/sets', {
								session_id: serverId,
								exercise_id: set.exercise_id,
								set_number: set.set_number,
								weight_kg: set.weight_kg,
								reps: set.reps,
								duration_sec: set.duration_sec,
								rpe: set.rpe,
								completed_at: set.completed_at,
							});
						} catch (setErr) {
							console.error(`Failed to sync set ${set.id}`, setErr);
						}
					}

					await db.sessions.update(session.id!, { syncStatus: 'synced', server_id: serverId });
				} else if (session.syncStatus === 'updated' && session.server_id) {
					await api.put(`/sessions/${session.server_id}`, {
						completed_at: session.completed_at,
						notes: session.notes,
					});
					await db.sessions.update(session.id!, { syncStatus: 'synced' });
				}
			} catch (sessionErr) {
				console.error(`Failed to sync session ${session.id}`, sessionErr);
			}
		}

		// 3. Sync any unsynced sets that belong to already-synced sessions
		const unsyncedSets = await db.sets
			.filter((s: any) => s.syncStatus && s.syncStatus !== 'synced')
			.toArray();

		for (const set of unsyncedSets) {
			try {
				const parentSession = await db.sessions.get(set.session_id);
				const serverSessionId = parentSession?.server_id || set.session_id;

				if (!set.server_id) {
					await api.post('/sets', {
						session_id: serverSessionId,
						exercise_id: set.exercise_id,
						set_number: set.set_number,
						weight_kg: set.weight_kg,
						reps: set.reps,
						completed_at: set.completed_at,
					});
				} else if (set.syncStatus === 'updated' && set.server_id) {
					await api.put(`/sets/${set.server_id}`, {
						weight_kg: set.weight_kg,
						reps: set.reps,
					});
				}
				await db.sets.update(set.id!, { syncStatus: 'synced' });
			} catch (setErr) {
				console.error(`Failed to sync set ${set.id}`, setErr);
			}
		}

		console.log("All data synced before logout");
	} catch (e) {
		console.error("Failed to sync all data before logout", e);
	}
};

// Setup interval
let syncInterval: any;

export const startSyncService = () => {
	if (syncInterval) clearInterval(syncInterval);
	syncInterval = setInterval(processSyncQueue, 30000); // Sync every 30s

	// Also sync on online event
	window.addEventListener('online', processSyncQueue);
};

export const stopSyncService = () => {
	if (syncInterval) clearInterval(syncInterval);
	window.removeEventListener('online', processSyncQueue);
};
