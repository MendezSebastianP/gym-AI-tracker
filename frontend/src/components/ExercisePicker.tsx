import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { useTranslation } from 'react-i18next';
import { X, Search, Filter, Dumbbell, Layers, Activity } from 'lucide-react';

interface ExercisePickerProps {
	onSelect: (exercise: any) => void;
	onClose: () => void;
}

export default function ExercisePicker({ onSelect, onClose }: ExercisePickerProps) {
	const [search, setSearch] = useState('');
	const { t, i18n } = useTranslation();
	const [filters, setFilters] = useState({
		muscle: '',
		group: '',
		equipment: ''
	});
	const [showFilters, setShowFilters] = useState(false);

	const exercises = useLiveQuery(async () => {
		const all = await db.exercises.toArray();
		const currentLang = i18n.language.split('-')[0];

		return all
			.map(ex => {
				const translatedName = (ex as any).name_translations?.[currentLang] || ex.name;
				return { ...ex, _displayName: translatedName };
			})
			.sort((a, b) => a._displayName.localeCompare(b._displayName));
	}, [i18n.language]);

	// Extract unique filter options
	const options = useMemo(() => {
		if (!exercises) return { muscles: [], groups: [], equipment: [] };
		const muscles = Array.from(new Set(exercises.map(e => e.muscle).filter(Boolean))).sort();
		const groups = Array.from(new Set(exercises.map(e => e.muscle_group).filter(Boolean))).sort();
		const equipment = Array.from(new Set(exercises.map(e => e.equipment).filter(Boolean))).sort();
		return { muscles, groups, equipment };
	}, [exercises]);

	const filteredExercises = useMemo(() => {
		if (!exercises) return [];
		return exercises.filter(ex => {
			if (search && !ex._displayName.toLowerCase().includes(search.toLowerCase())) return false;
			if (filters.muscle && ex.muscle !== filters.muscle) return false;
			if (filters.group && ex.muscle_group !== filters.group) return false;
			if (filters.equipment && ex.equipment !== filters.equipment) return false;
			return true;
		}).slice(0, 100); // Limit rendered items for performance
	}, [exercises, search, filters]);

	const toggleFilter = (type: 'muscle' | 'group' | 'equipment', value: string) => {
		setFilters(prev => ({
			...prev,
			[type]: prev[type] === value ? '' : value
		}));
	};

	const clearFilters = () => {
		setFilters({ muscle: '', group: '', equipment: '' });
		setSearch('');
	};

	return (
		<div style={{
			position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
			backgroundColor: 'var(--bg-primary)', zIndex: 200, padding: '16px',
			display: 'flex', flexDirection: 'column'
		}}>
			<div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
				<div style={{ position: 'relative', flex: 1 }}>
					<Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
					<input
						autoFocus
						className="input"
						placeholder={t("Search exercises...")}
						value={search}
						onChange={e => setSearch(e.target.value)}
						style={{ width: '100%', paddingLeft: '36px' }}
					/>
				</div>
				<button
					className={`btn ${showFilters || Object.values(filters).some(Boolean) ? 'btn-primary' : 'btn-secondary'}`}
					onClick={() => setShowFilters(!showFilters)}
					style={{ padding: '10px' }}
				>
					<Filter size={20} />
				</button>
				<button className="btn btn-ghost" onClick={onClose} style={{ padding: '8px' }}>
					<X size={24} />
				</button>
			</div>

			{/* Filter Section */}
			{/* Filter Section */}
			{showFilters && (
				<div className="mb-4 p-3 bg-secondary rounded-lg fade-in">
					<div className="flex justify-between items-center mb-2">
						<h3 className="text-xs font-bold text-secondary">{t('Filters')}</h3>
						{(Object.values(filters).some(Boolean) || search) && (
							<button onClick={clearFilters} className="text-xs text-primary">
								{t('Clear All')}
							</button>
						)}
					</div>

					<div className="flex flex-col gap-md">
						{/* Muscle Group */}
						<div>
							<div className="flex items-center gap-2 mb-2">
								<Layers size={12} className="text-tertiary" />
								<span className="text-xs text-secondary">{t('Target Zone')}</span>
							</div>
							<div className="flex" style={{ flexWrap: 'wrap', gap: '8px' }}>
								{options.groups.map(g => (
									<button
										key={g}
										onClick={() => toggleFilter('group', g!)}
										className={`chip ${filters.group === g ? 'active' : 'inactive'}`}
									>
										{g}
									</button>
								))}
							</div>
						</div>

						{/* Equipment */}
						<div>
							<div className="flex items-center gap-2 mb-2">
								<Dumbbell size={12} className="text-tertiary" />
								<span className="text-xs text-secondary">{t('Equipment')}</span>
							</div>
							<div className="flex" style={{ flexWrap: 'wrap', gap: '8px' }}>
								{options.equipment.map(e => (
									<button
										key={e}
										onClick={() => toggleFilter('equipment', e!)}
										className={`chip ${filters.equipment === e ? 'active' : 'inactive'}`}
									>
										{e}
									</button>
								))}
							</div>
						</div>
					</div>
				</div>
			)}

			<div style={{ flex: 1, overflowY: 'auto' }}>
				{filteredExercises?.map(ex => (
					<div
						key={ex.id}
						onClick={() => onSelect(ex)}
						style={{
							padding: '12px',
							borderBottom: '1px solid var(--border)',
							cursor: 'pointer',
							background: 'transparent',
							transition: 'background 0.2s'
						}}
						className="hover:bg-white/5"
					>
						<div style={{ fontWeight: 'bold', fontSize: '15px' }}>{ex._displayName}</div>
						<div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px', display: 'flex', gap: '8px', alignItems: 'center' }}>
							{ex.muscle_group && (
								<span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
									<Layers size={10} /> {ex.muscle_group}
								</span>
							)}
							{ex.equipment && (
								<span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
									<Dumbbell size={10} /> {ex.equipment}
								</span>
							)}
							{ex.muscle && (
								<span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
									<Activity size={10} /> {ex.muscle}
								</span>
							)}
						</div>
					</div>
				))}

				{filteredExercises?.length === 0 && (
					<div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-tertiary)' }}>
						<p>{t('No exercises found.')}</p>
						<button
							onClick={clearFilters}
							className="mt-2 text-primary text-sm hover:underline"
						>
							{t('Clear filters')}
						</button>
					</div>
				)}
			</div>
		</div>
	);
}
