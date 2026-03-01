import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { useTranslation } from 'react-i18next';
import { X, Search, Filter, Dumbbell, Layers, Activity, Plus } from 'lucide-react';
import { api } from '../api/client';

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

	// Custom Exercise Form State
	const [isCreating, setIsCreating] = useState(false);
	const [customName, setCustomName] = useState('');
	const [customMuscle, setCustomMuscle] = useState('');
	const [customGroup, setCustomGroup] = useState('');
	const [customEquipment, setCustomEquipment] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);

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

		const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();

		const defaultMuscles = ["Abdominals", "Biceps", "Calves", "Chest", "Forearms", "Glutes", "Hamstrings", "Lats", "Lower Back", "Neck", "Quadriceps", "Shoulders", "Traps", "Triceps"];
		const dbMuscles = exercises.map(e => e.muscle ? capitalize(e.muscle) : null).filter(Boolean);
		const muscles = Array.from(new Set([...defaultMuscles, ...dbMuscles])).sort();

		const defaultGroups = ["Core", "Arms", "Legs", "Chest", "Back", "Shoulders", "Full Body", "Cardio"];
		const dbGroups = exercises.map(e => e.muscle_group ? capitalize(e.muscle_group) : null).filter(Boolean);
		const groups = Array.from(new Set([...defaultGroups, ...dbGroups])).sort();

		const defaultEquipment = ["None (Bodyweight)", "Barbell", "Dumbbell", "Kettlebell", "Machine", "Cable", "Bands", "Smith Machine", "Other"];
		const dbEquipment = exercises.map(e => e.equipment ? capitalize(e.equipment) : null).filter(Boolean);
		const equipment = Array.from(new Set([...defaultEquipment, ...dbEquipment])).sort();

		return { muscles, groups, equipment };
	}, [exercises]);

	const filteredExercises = useMemo(() => {
		if (!exercises) return [];
		return exercises.filter(ex => {
			if (search) {
				const s = search.toLowerCase();
				const matchName = ex._displayName.toLowerCase().includes(s);
				const matchMuscle = t(ex.muscle || '').toLowerCase().includes(s);
				const matchSecondary = t(ex.secondary_muscle || '').toLowerCase().includes(s);
				const matchGroup = t(ex.muscle_group || '').toLowerCase().includes(s);
				const matchEq = t(ex.equipment || '').toLowerCase().includes(s);
				if (!matchName && !matchMuscle && !matchSecondary && !matchGroup && !matchEq) return false;
			}
			if (filters.muscle) {
				const fMuscle = filters.muscle.toLowerCase();
				const pMuscle = ex.muscle?.toLowerCase();
				const sMuscle = ex.secondary_muscle?.toLowerCase();
				if (pMuscle !== fMuscle && sMuscle !== fMuscle) return false;
			}
			if (filters.group && ex.muscle_group?.toLowerCase() !== filters.group.toLowerCase()) return false;
			if (filters.equipment && ex.equipment?.toLowerCase() !== filters.equipment.toLowerCase()) return false;
			return true;
		}).slice(0, 100);
	}, [exercises, search, filters, t]);

	const toggleFilter = (type: 'muscle' | 'group' | 'equipment', value: string) => {
		setFilters(prev => ({ ...prev, [type]: prev[type] === value ? '' : value }));
	};

	const clearFilters = () => {
		setFilters({ muscle: '', group: '', equipment: '' });
		setSearch('');
	};

	const handleCreateCustom = async () => {
		if (!customName.trim()) return;
		setIsSubmitting(true);
		try {
			// Save to backend
			const res = await api.post('/exercises', {
				name: customName,
				muscle: customMuscle || null,
				muscle_group: customGroup || null,
				equipment: customEquipment || null,
				type: "Strength",
				is_bodyweight: customEquipment?.toLowerCase().includes("bodyweight") || false,
				default_weight_kg: 0
			});

			// Save to local IndexedDB
			const newEx = res.data;
			await db.exercises.put(newEx);

			// Complete and select
			setIsCreating(false);
			onSelect(newEx);
		} catch (e) {
			console.error("Failed to create custom exercise", e);
			alert(t("Failed to create custom exercise. Are you offline?"));
		} finally {
			setIsSubmitting(false);
		}
	};

	if (isCreating) {
		return (
			<div style={{
				position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
				backgroundColor: 'var(--bg-primary)', zIndex: 200, padding: '16px',
				display: 'flex', flexDirection: 'column'
			}}>
				<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
					<h2 className="text-xl font-bold">{t('Custom Exercise')}</h2>
					<button className="btn btn-ghost" onClick={() => setIsCreating(false)} style={{ padding: '8px' }}>
						<X size={24} />
					</button>
				</div>
				<div className="flex flex-col gap-4">
					<div>
						<label className="text-sm text-secondary mb-1 block">{t('Name')} *</label>
						<input className="input w-full" value={customName} onChange={e => setCustomName(e.target.value)} placeholder={t("e.g. My Special Curl")} autoFocus />
					</div>
					<div>
						<label className="text-sm text-secondary mb-1 block">{t('Target Zone')}</label>
						<select className="input w-full" value={customGroup} onChange={e => setCustomGroup(e.target.value)}>
							<option value="">{t('Select Target Zone')}</option>
							{options.groups.map(g => <option key={g} value={g}>{t(g!)}</option>)}
						</select>
					</div>
					<div>
						<label className="text-sm text-secondary mb-1 block">{t('Specific Muscle')}</label>
						<select className="input w-full" value={customMuscle} onChange={e => setCustomMuscle(e.target.value)}>
							<option value="">{t('Select Muscle')}</option>
							{options.muscles.map(m => <option key={m} value={m as string}>{t(m as string)}</option>)}
						</select>
					</div>
					<div>
						<label className="text-sm text-secondary mb-1 block">{t('Equipment')}</label>
						<select className="input w-full" value={customEquipment} onChange={e => setCustomEquipment(e.target.value)}>
							<option value="">{t('Select Equipment')}</option>
							{options.equipment.map(e => <option key={e} value={e as string}>{t(e as string)}</option>)}
						</select>
					</div>
					<button
						className="btn btn-primary mt-4 py-3"
						onClick={handleCreateCustom}
						disabled={!customName.trim() || isSubmitting}
					>
						{isSubmitting ? t('Saving...') : t('Create & Select')}
					</button>
				</div>
			</div>
		);
	}

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
						<div>
							<div className="flex items-center gap-2 mb-2">
								<Layers size={12} className="text-tertiary" />
								<span className="text-xs text-secondary">{t('Target Zone')}</span>
							</div>
							<div className="flex" style={{ flexWrap: 'wrap', gap: '8px' }}>
								{options.groups.map(g => (
									<button key={g} onClick={() => toggleFilter('group', g!)} className={`chip ${filters.group === g ? 'active' : 'inactive'}`}>
										{t(g!)}
									</button>
								))}
							</div>
						</div>

						{/* Individual Muscle Filter */}
						<div>
							<div className="flex items-center gap-2 mb-2">
								<Activity size={12} className="text-tertiary" />
								<span className="text-xs text-secondary">{t('Specific Muscle')}</span>
							</div>
							<div className="flex" style={{ flexWrap: 'wrap', gap: '8px' }}>
								{options.muscles.map(m => (
									<button key={m} onClick={() => toggleFilter('muscle', m!)} className={`chip ${filters.muscle === m ? 'active' : 'inactive'}`}>
										{t(m!)}
									</button>
								))}
							</div>
						</div>

						<div>
							<div className="flex items-center gap-2 mb-2">
								<Dumbbell size={12} className="text-tertiary" />
								<span className="text-xs text-secondary">{t('Equipment')}</span>
							</div>
							<div className="flex" style={{ flexWrap: 'wrap', gap: '8px' }}>
								{options.equipment.map(e => (
									<button key={e} onClick={() => toggleFilter('equipment', e!)} className={`chip ${filters.equipment === e ? 'active' : 'inactive'}`}>
										{t(e!)}
									</button>
								))}
							</div>
						</div>
					</div>
				</div>
			)}

			<div style={{ flex: 1, overflowY: 'auto' }}>
				{/* Always show Create Custom as first option */}
				<div
					onClick={() => {
						setCustomName(search); // pre-fill with search term
						setIsCreating(true);
					}}
					style={{ padding: '12px', borderBottom: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--accent)' }}
					className="hover:bg-white/5"
				>
					<div style={{ background: 'rgba(99, 102, 241, 0.15)', padding: '8px', borderRadius: '8px' }}>
						<Plus size={16} />
					</div>
					<div style={{ fontWeight: 'bold', fontSize: '15px' }}>{t('Create Custom Exercise')}</div>
				</div>

				{filteredExercises?.map(ex => (
					<div
						key={ex.id}
						onClick={() => onSelect(ex)}
						style={{ padding: '12px', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.2s' }}
						className="hover:bg-white/5"
					>
						<div style={{ fontWeight: 'bold', fontSize: '15px' }}>{ex._displayName}</div>
						<div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px', display: 'flex', gap: '8px', alignItems: 'center' }}>
							{ex.muscle_group && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Layers size={10} /> {t(ex.muscle_group)}</span>}
							{ex.equipment && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Dumbbell size={10} /> {t(ex.equipment)}</span>}
							{ex.muscle && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Activity size={10} /> {t(ex.muscle)}</span>}
						</div>
					</div>
				))}

				{filteredExercises?.length === 0 && (
					<div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-tertiary)' }}>
						<p>{t('No exercises found.')}</p>
					</div>
				)}
			</div>
		</div>
	);
}
