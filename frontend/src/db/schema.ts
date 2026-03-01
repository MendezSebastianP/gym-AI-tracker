import Dexie, { Table } from 'dexie';

export interface User {
	id: number;
	email: string;
	is_active: boolean;
	settings: {
		timer_mode?: 'stopwatch' | 'timer';
		[key: string]: any;
	};
	weight?: number;
	height?: number;
	age?: number;
	priorities?: any;
}

export interface Exercise {
	id: number;
	name: string;
	description?: string;
	muscle?: string;
	secondary_muscle?: string;
	muscle_group?: string;
	equipment?: string;
	type?: string;
	is_bodyweight?: boolean;
	default_weight_kg?: number;
	source: string;
	user_id?: number;
	name_translations?: Record<string, string>;
}

export interface RoutineExercise {
	exercise_id: number;
	name?: string;
	sets: number;
	reps: string;
	rest?: number;
	weight_kg?: number;
	locked?: boolean;
	notes?: string;
}

export interface RoutineDay {
	day_name: string;
	exercises: RoutineExercise[];
}

export interface Routine {
	id: number;
	user_id: number;
	name: string;
	description?: string;
	days: RoutineDay[];
	syncStatus?: 'synced' | 'created' | 'updated' | 'deleted';
	is_favorite?: boolean;
	archived_at?: string;
}

export interface Session {
	id?: number; // local auto-increment
	server_id?: number;
	user_id: number;
	routine_id?: number;
	day_index?: number;
	started_at: string; // ISO string
	completed_at?: string;
	notes?: string;
	locked_exercises?: number[]; // IDs of exercises that are locked/collapsed
	syncStatus?: 'synced' | 'created' | 'updated' | 'deleted';
}

export interface Set {
	id?: number;
	server_id?: number;
	session_id: number; // reference to local session ID
	exercise_id: number;
	set_number: number;
	weight_kg?: number;
	reps?: number;
	duration_sec?: number;
	rpe?: number;
	completed_at: string;
	syncStatus?: 'synced' | 'created' | 'updated' | 'deleted';
}

export interface SyncEvent {
	id?: number;
	event_type: string;
	payload: any;
	client_timestamp: string;
	processed: boolean;
}

class GymDatabase extends Dexie {
	users!: Table<User>;
	exercises!: Table<Exercise>;
	routines!: Table<Routine>;
	sessions!: Table<Session>;
	sets!: Table<Set>;
	syncQueue!: Table<SyncEvent>;

	constructor() {
		super('GymTrackerDB');
		this.version(1).stores({
			users: 'id, email',
			exercises: 'id, name, muscle, muscle_group',
			routines: 'id, user_id, syncStatus',
			sessions: '++id, server_id, user_id, routine_id, started_at, syncStatus',
			sets: '++id, server_id, session_id, exercise_id, syncStatus',
			syncQueue: '++id, processed'
		});
	}
}

export const db = new GymDatabase();
