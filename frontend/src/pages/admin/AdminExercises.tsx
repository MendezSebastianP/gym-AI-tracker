import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { Edit2, Trash2, Plus, Search } from 'lucide-react';
import type { Exercise } from '../../db/schema';

export default function AdminExercises() {
	const [exercises, setExercises] = useState<Exercise[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [searchQuery, setSearchQuery] = useState('');

	const [isModalOpen, setIsModalOpen] = useState(false);
	const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);

	// Form State
	const [formData, setFormData] = useState<Partial<Exercise>>({
		name: '', muscle: '', secondary_muscle: '', muscle_group: '', equipment: '', type: '', is_bodyweight: false
	});

	const fetchExercises = async () => {
		setLoading(true);
		try {
			// We can use the public global endpoint to fetch them all
			const res = await api.get('/exercises');
			// Filter to show only global exercises to the admin
			const globalEx = res.data.filter((e: any) => e.source === 'global');
			setExercises(globalEx);
		} catch (err) {
			console.error('Failed to fetch exercises:', err);
			setError('Could not load exercise catalog.');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchExercises();
	}, []);

	const filteredExercises = exercises.filter(e =>
		e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
		e.muscle_group?.toLowerCase().includes(searchQuery.toLowerCase())
	);

	const openModal = (exercise?: Exercise) => {
		if (exercise) {
			setEditingExercise(exercise);
			setFormData(exercise);
		} else {
			setEditingExercise(null);
			setFormData({ name: '', muscle: '', secondary_muscle: '', muscle_group: '', equipment: '', type: '', is_bodyweight: false });
		}
		setIsModalOpen(true);
	};

	const closeModal = () => {
		setIsModalOpen(false);
		setEditingExercise(null);
	};

	const handleSave = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			if (editingExercise) {
				await api.put(`/admin/exercises/${editingExercise.id}`, formData);
			} else {
				await api.post('/admin/exercises', formData);
			}
			closeModal();
			fetchExercises();
		} catch (err: any) {
			console.error("Save failed", err);
			alert(`Failed to save: ${err.response?.data?.detail || err.message}`);
		}
	};

	const handleDelete = async (id: number) => {
		if (window.confirm("Are you sure you want to permanently delete this global exercise? This will affect all users.")) {
			try {
				await api.delete(`/admin/exercises/${id}`);
				fetchExercises();
			} catch (err: any) {
				alert(`Delete failed: ${err.response?.data?.detail || err.message}`);
			}
		}
	};

	if (loading && exercises.length === 0) {
		return <div className="loading-spinner" style={{ margin: '40px auto' }}></div>;
	}

	return (
		<div>
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
				<h1 style={{ color: 'var(--primary)', margin: 0 }}>Exercise Catalog</h1>
				<button onClick={() => openModal()} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
					<Plus size={18} /> Add Exercise
				</button>
			</div>

			<p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
				Manage the global database of exercises available to all users. Changes here are live immediately.
			</p>

			<div style={{ position: 'relative', marginBottom: '24px' }}>
				<Search size={20} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
				<input
					className="input"
					type="text"
					placeholder="Search exercises by name or muscle group..."
					value={searchQuery}
					onChange={e => setSearchQuery(e.target.value)}
					style={{ paddingLeft: '48px', width: '100%', maxWidth: '600px' }}
				/>
			</div>

			{error && <div style={{ color: 'var(--error)', marginBottom: '16px' }}>{error}</div>}

			<div className="admin-card">
				<div style={{ overflowX: 'auto' }}>
					<table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
						<thead>
							<tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
								<th style={{ padding: '12px 16px', fontWeight: 500 }}>ID</th>
								<th style={{ padding: '12px 16px', fontWeight: 500 }}>Name</th>
								<th style={{ padding: '12px 16px', fontWeight: 500 }}>Target / Secondary</th>
								<th style={{ padding: '12px 16px', fontWeight: 500 }}>Group</th>
								<th style={{ padding: '12px 16px', fontWeight: 500 }}>Equipment</th>
								<th style={{ padding: '12px 16px', fontWeight: 500, textAlign: 'right' }}>Actions</th>
							</tr>
						</thead>
						<tbody>
							{filteredExercises.map((ex) => (
								<tr key={ex.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
									<td style={{ padding: '16px', color: 'var(--text-tertiary)' }}>#{ex.id}</td>
									<td style={{ padding: '16px', color: 'var(--text-primary)', fontWeight: 500 }}>
										{ex.name}
										{ex.is_bodyweight && <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--primary)', backgroundColor: 'var(--bg-primary)', padding: '2px 6px', borderRadius: '4px' }}>BW</span>}
									</td>
									<td style={{ padding: '16px', color: 'var(--text-secondary)' }}>
										{ex.muscle || '-'} {ex.secondary_muscle ? ` / ${ex.secondary_muscle}` : ''}
									</td>
									<td style={{ padding: '16px', color: 'var(--text-secondary)' }}>
										{ex.muscle_group || '-'}
									</td>
									<td style={{ padding: '16px', color: 'var(--text-secondary)' }}>
										{ex.equipment || '-'}
									</td>
									<td style={{ padding: '16px', textAlign: 'right' }}>
										<div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
											<button onClick={() => openModal(ex)} className="action-btn" style={{ padding: '6px', background: 'none', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
												<Edit2 size={16} />
											</button>
											<button onClick={() => ex.id && handleDelete(ex.id)} className="action-btn" style={{ padding: '6px', background: 'none', border: '1px solid var(--error)', borderRadius: '4px', color: 'var(--error)', cursor: 'pointer' }}>
												<Trash2 size={16} />
											</button>
										</div>
									</td>
								</tr>
							))}
							{filteredExercises.length === 0 && (
								<tr>
									<td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
										No exercises found matching "{searchQuery}".
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
			</div>

			{/* Modal */}
			{isModalOpen && (
				<div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
					<div className="admin-card" style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
						<h2 style={{ marginTop: 0, marginBottom: '24px', color: 'var(--primary)' }}>
							{editingExercise ? 'Edit Global Exercise' : 'Create Global Exercise'}
						</h2>

						<form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
							<div>
								<label className="label">Exercise Name</label>
								<input className="input" required value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} />
							</div>

							<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
								<div>
									<label className="label">Target Muscle</label>
									<input className="input" placeholder="e.g. chest" value={formData.muscle || ''} onChange={e => setFormData({ ...formData, muscle: e.target.value })} />
								</div>
								<div>
									<label className="label">Secondary Muscle</label>
									<input className="input" placeholder="e.g. triceps" value={formData.secondary_muscle || ''} onChange={e => setFormData({ ...formData, secondary_muscle: e.target.value })} />
								</div>
							</div>

							<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
								<div>
									<label className="label">Muscle Group (UI Category)</label>
									<input className="input" placeholder="e.g. chest" value={formData.muscle_group || ''} onChange={e => setFormData({ ...formData, muscle_group: e.target.value })} />
								</div>
								<div>
									<label className="label">Equipment</label>
									<input className="input" placeholder="e.g. barbell" value={formData.equipment || ''} onChange={e => setFormData({ ...formData, equipment: e.target.value })} />
								</div>
							</div>

							<div>
								<label className="label">Mechanic Type</label>
								<input className="input" placeholder="e.g. compound or isolation" value={formData.type || ''} onChange={e => setFormData({ ...formData, type: e.target.value })} />
							</div>

							<div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
								<input
									type="checkbox"
									id="is_bodyweight"
									checked={formData.is_bodyweight || false}
									onChange={e => setFormData({ ...formData, is_bodyweight: e.target.checked })}
									style={{ width: '20px', height: '20px', accentColor: 'var(--primary)' }}
								/>
								<label htmlFor="is_bodyweight" style={{ color: 'var(--text-primary)', cursor: 'pointer' }}>Is this a bodyweight exercise?</label>
							</div>

							<div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
								<button type="button" onClick={closeModal} className="btn btn-secondary">Cancel</button>
								<button type="submit" className="btn btn-primary">Save Exercise</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}
