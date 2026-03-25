import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { useTranslation } from 'react-i18next';
import { X, Search, Filter, Dumbbell, Layers, Activity, Plus, Check } from 'lucide-react';
import { api } from '../api/client';

interface ExercisePickerProps {
	onSelect: (exercise: any) => void;
	onClose: () => void;
	cardioMode?: boolean;
	multiSelect?: boolean;
	onSelectMultiple?: (exercises: any[]) => void;
}

export default function ExercisePicker({ onSelect, onClose, cardioMode = false, multiSelect = false, onSelectMultiple }: ExercisePickerProps) {
	const [search, setSearch] = useState('');
	const { t, i18n } = useTranslation();
	const [filters, setFilters] = useState({
		muscle: '',
		group: '',
		equipment: ''
	});
	const [showFilters, setShowFilters] = useState(false);
	const [expandedFilter, setExpandedFilter] = useState<'group' | 'muscle' | 'equipment' | null>(null);

	const toggleFilterSection = (section: 'group' | 'muscle' | 'equipment') => {
		setExpandedFilter(prev => prev === section ? null : section);
	};

	// Custom Exercise Form State
	const [isCreating, setIsCreating] = useState(false);
	const [customName, setCustomName] = useState('');
	const [customMuscle, setCustomMuscle] = useState('');
	const [customGroup, setCustomGroup] = useState('');
	const [customEquipment, setCustomEquipment] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);

	// Multi-select state
	const [selected, setSelected] = useState<Map<number, any>>(new Map());
	const [showSelectedNames, setShowSelectedNames] = useState(false);

	const [loadingTimedOut, setLoadingTimedOut] = useState(false);

	const toggleSelected = (ex: any) => {
		setSelected(prev => {
			const next = new Map(prev);
			if (next.has(ex.id)) {
				next.delete(ex.id);
			} else {
				next.set(ex.id, ex);
			}
			return next;
		});
	};

	const handleAddAll = () => {
		if (onSelectMultiple) {
			onSelectMultiple(Array.from(selected.values()));
		}
		onClose();
	};

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

	useEffect(() => {
		if (exercises !== undefined) { setLoadingTimedOut(false); return; }
		const timer = setTimeout(() => setLoadingTimedOut(true), 3000);
		return () => clearTimeout(timer);
	}, [exercises]);

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
		const defaultEquipmentLower = new Set(defaultEquipment.map(e => e.toLowerCase()));
		// Map known DB aliases to canonical display names
		const aliasMap: Record<string, string> = {
			'bodyweight': 'None (Bodyweight)',
			'body weight': 'None (Bodyweight)',
			'none': 'None (Bodyweight)',
			'none (bodyweight)': 'None (Bodyweight)',
			'smith machine': 'Smith Machine',
		};
		const dbEquipment = exercises
			.map(e => {
				if (!e.equipment) return null;
				const lower = e.equipment.toLowerCase();
				// If it maps to a default via alias, skip (already in defaults)
				if (aliasMap[lower]) return null;
				// If it matches a default exactly (case-insensitive), skip
				if (defaultEquipmentLower.has(lower)) return null;
				return capitalize(e.equipment);
			})
			.filter(Boolean);
		const equipment = Array.from(new Set([...defaultEquipment, ...dbEquipment])).sort();

		return { muscles, groups, equipment };
	}, [exercises]);

	const filteredExercises = useMemo(() => {
		if (!exercises) return [];
		return exercises.filter(ex => {
			// cardioMode: only show Cardio exercises; regular mode: exclude Cardio
			if (cardioMode) {
				if (ex.type !== 'Cardio') return false;
			} else {
				if (ex.type === 'Cardio') return false;
			}

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
			if (filters.equipment) {
				const filterEq = filters.equipment.toLowerCase();
				const exEq = (ex.equipment || '').toLowerCase();
				// Alias matching for equipment filter
				const bodyweightAliases = ['none (bodyweight)', 'bodyweight', 'body weight', 'none'];
				const smithAliases = ['smith machine', 'smith'];
				const isMatch =
					filterEq === exEq ||
					(bodyweightAliases.includes(filterEq) && bodyweightAliases.includes(exEq)) ||
					(smithAliases.includes(filterEq) && smithAliases.includes(exEq));
				if (!isMatch) return false;
			}
			return true;
		}).sort((a, b) => {
			if (!search) return 0;
			const s = search.toLowerCase();
			const aName = a._displayName.toLowerCase();
			const bName = b._displayName.toLowerCase();

			if (aName === s && bName !== s) return -1;
			if (bName === s && aName !== s) return 1;

			const aStarts = aName.startsWith(s);
			const bStarts = bName.startsWith(s);
			if (aStarts && !bStarts) return -1;
			if (bStarts && !aStarts) return 1;

			return 0;
		}).slice(0, 100);
	}, [exercises, search, filters, t, cardioMode]);

	const toggleFilter = (type: 'muscle' | 'group' | 'equipment', value: string) => {
		setFilters(prev => {
			const isDeselect = prev[type] === value;
			return {
				...prev,
				[type]: isDeselect ? '' : value,
				// Target Zone and Specific Muscle are mutually exclusive
				...(type === 'group' && !isDeselect ? { muscle: '' } : {}),
				...(type === 'muscle' && !isDeselect ? { group: '' } : {}),
			};
		});
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
			if (multiSelect) {
				toggleSelected(newEx);
			} else {
				onSelect(newEx);
			}
		} catch (e) {
			console.error("Failed to create custom exercise", e);
			alert(t("Failed to create custom exercise. Are you offline?"));
		} finally {
			setIsSubmitting(false);
		}
	};

	if (isCreating) {
		return createPortal(
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
			</div>,
			document.body
		);
	}

	return createPortal(
		<div style={{
			position: 'fixed', top: 0, left: 0, right: 0, bottom: '65px',
			backgroundColor: 'var(--bg-primary)', zIndex: 200,
			padding: '16px 16px 0',
			display: 'flex', flexDirection: 'column'
		}}>
			<div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
				<div style={{ position: 'relative', flex: 1 }}>
					<Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
					<input
						autoFocus
						className="input"
						placeholder={cardioMode ? t("Search cardio exercises...") : t("Search exercises...")}
						value={search}
						onChange={e => setSearch(e.target.value)}
						style={{ width: '100%', paddingLeft: '36px' }}
					/>
				</div>
				{!cardioMode && (
					<button
						className={`btn ${showFilters || Object.values(filters).some(Boolean) ? 'btn-primary' : 'btn-secondary'}`}
						onClick={() => setShowFilters(!showFilters)}
						style={{ padding: '10px' }}
					>
						<Filter size={20} />
					</button>
				)}
				<button className="btn btn-ghost" onClick={onClose} style={{ padding: '8px' }}>
					<X size={24} />
				</button>
			</div>

			{!cardioMode && showFilters && (
				<div style={{ marginBottom: '8px', borderRadius: '10px', border: '1px solid var(--border)', overflow: 'hidden' }}>
					{/* Header row */}
					<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: expandedFilter ? '1px solid var(--border)' : 'none', background: 'var(--bg-secondary)' }}>
						<span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('Filters')}</span>
						{Object.values(filters).some(Boolean) && (
							<button onClick={clearFilters} style={{ fontSize: '11px', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
								{t('Clear All')}
							</button>
						)}
					</div>

					{/* Accordion: Target Zone (mutually exclusive with Specific Muscle) */}
					<div style={{ borderBottom: '1px solid var(--border)' }}>
						<button
							onClick={() => toggleFilterSection('group')}
							style={{
								width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
								padding: '10px 12px', background: 'var(--bg-secondary)', border: 'none', cursor: 'pointer',
								opacity: filters.muscle ? 0.45 : 1,
							}}
						>
							<Layers size={13} color={filters.group ? 'var(--primary)' : 'var(--text-tertiary)'} />
							<span style={{ flex: 1, textAlign: 'left', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>{t('Target Zone')}</span>
							{filters.group && (
								<span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '8px', background: 'rgba(204, 255, 0, 0.15)', color: 'var(--primary)', fontWeight: 600 }}>
									{t(filters.group)}
								</span>
							)}
							<span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>{expandedFilter === 'group' ? '▲' : '▼'}</span>
						</button>
						{expandedFilter === 'group' && (
							<div style={{ padding: '8px 12px 10px', display: 'flex', flexWrap: 'wrap', gap: '6px', background: 'var(--bg-primary)' }}>
								{options.groups.map(g => (
									<button key={g} onClick={() => { toggleFilter('group', g!); if (filters.group !== g) setExpandedFilter(null); }} className={`chip ${filters.group === g ? 'active' : 'inactive'}`}>
										{t(g!)}
									</button>
								))}
							</div>
						)}
					</div>

					{/* "or" divider — only shown when neither is selected */}
					{!filters.group && !filters.muscle && (
						<div style={{ textAlign: 'center', fontSize: '10px', color: 'var(--text-tertiary)', padding: '3px 0', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', letterSpacing: '0.5px' }}>
							— or —
						</div>
					)}

					{/* Accordion: Specific Muscle (mutually exclusive with Target Zone) */}
					<div style={{ borderBottom: '1px solid var(--border)' }}>
						<button
							onClick={() => toggleFilterSection('muscle')}
							style={{
								width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
								padding: '10px 12px', background: 'var(--bg-secondary)', border: 'none', cursor: 'pointer',
								opacity: filters.group ? 0.45 : 1,
							}}
						>
							<Activity size={13} color={filters.muscle ? 'var(--primary)' : 'var(--text-tertiary)'} />
							<span style={{ flex: 1, textAlign: 'left', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>{t('Specific Muscle')}</span>
							{filters.muscle && (
								<span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '8px', background: 'rgba(204, 255, 0, 0.15)', color: 'var(--primary)', fontWeight: 600 }}>
									{t(filters.muscle)}
								</span>
							)}
							<span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>{expandedFilter === 'muscle' ? '▲' : '▼'}</span>
						</button>
						{expandedFilter === 'muscle' && (
							<div style={{ padding: '8px 12px 10px', display: 'flex', flexWrap: 'wrap', gap: '6px', background: 'var(--bg-primary)' }}>
								{options.muscles.map(m => (
									<button key={m} onClick={() => { toggleFilter('muscle', m!); if (filters.muscle !== m) setExpandedFilter(null); }} className={`chip ${filters.muscle === m ? 'active' : 'inactive'}`}>
										{t(m!)}
									</button>
								))}
							</div>
						)}
					</div>

								{/* Accordion: Equipment */}
					<div>
						<button
							onClick={() => toggleFilterSection('equipment')}
							style={{
								width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
								padding: '10px 12px', background: 'var(--bg-secondary)', border: 'none', cursor: 'pointer',
							}}
						>
							<Dumbbell size={13} color={filters.equipment ? 'var(--primary)' : 'var(--text-tertiary)'} />
							<span style={{ flex: 1, textAlign: 'left', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>{t('Equipment')}</span>
							{filters.equipment && (
								<span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '8px', background: 'rgba(204, 255, 0, 0.15)', color: 'var(--primary)', fontWeight: 600 }}>
									{t(filters.equipment)}
								</span>
							)}
							<span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>{expandedFilter === 'equipment' ? '▲' : '▼'}</span>
						</button>
						{expandedFilter === 'equipment' && (
							<div style={{ padding: '8px 12px 10px', display: 'flex', flexWrap: 'wrap', gap: '6px', background: 'var(--bg-primary)' }}>
								{options.equipment.map(e => (
									<button key={e} onClick={() => { toggleFilter('equipment', e!); if (filters.equipment !== e) setExpandedFilter(null); }} className={`chip ${filters.equipment === e ? 'active' : 'inactive'}`}>
										{t(e!)}
									</button>
								))}
							</div>
						)}
					</div>
				</div>
			)}

			<div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingBottom: '8px' }}>
				{/* Create Custom option only in regular mode */}
				{!cardioMode && (
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
				)}

				{filteredExercises?.map(ex => {
					const isSelected = multiSelect && selected.has(ex.id);
					return (
						<div
							key={ex.id}
							onClick={() => multiSelect ? toggleSelected(ex) : onSelect(ex)}
							style={{
								padding: '12px', borderBottom: '1px solid var(--border)',
								cursor: 'pointer', transition: 'background 0.2s',
								display: 'flex', alignItems: 'center', gap: '10px',
								background: isSelected ? 'rgba(204, 255, 0, 0.06)' : 'transparent',
							}}
							className="hover:bg-white/5"
						>
							{multiSelect && (
								<div style={{
									width: '22px', height: '22px', borderRadius: '6px', flexShrink: 0,
									border: isSelected ? '2px solid var(--primary)' : '2px solid var(--border)',
									background: isSelected ? 'var(--primary)' : 'transparent',
									display: 'flex', alignItems: 'center', justifyContent: 'center',
									transition: 'all 0.15s',
								}}>
									{isSelected && <Check size={14} color="#000" strokeWidth={3} />}
								</div>
							)}
							<div style={{ flex: 1, minWidth: 0 }}>
								<div style={{ fontWeight: 'bold', fontSize: '15px' }}>{ex._displayName}</div>
								<div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px', display: 'flex', gap: '8px', alignItems: 'center' }}>
									{ex.muscle_group && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Layers size={10} /> {t(ex.muscle_group)}</span>}
									{ex.equipment && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Dumbbell size={10} /> {t(ex.equipment)}</span>}
									{ex.muscle && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Activity size={10} /> {t(ex.muscle)}</span>}
								</div>
							</div>
						</div>
					);
				})}

				{exercises === undefined && !loadingTimedOut && (
					<div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-tertiary)' }}>
						<p>{t('Loading exercises...')}</p>
					</div>
				)}
				{(loadingTimedOut || (exercises !== undefined && filteredExercises.length === 0)) && (
					<div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-tertiary)' }}>
						<p>{cardioMode ? t('No cardio exercises found.') : t('No exercises found.')}</p>
						{!cardioMode && (!exercises || exercises.length === 0) && (
							<p style={{ fontSize: '12px', marginTop: '8px' }}>{t('Make sure your exercise library is synced.')}</p>
						)}
					</div>
				)}
			</div>

		{/* Multi-select bottom bar — flex sibling so it never overlaps the list */}
		{multiSelect && (
			<div style={{ flexShrink: 0, background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)' }}>
				{/* Expandable selected names */}
				{showSelectedNames && selected.size > 0 && (
					<div style={{
						padding: '8px 16px 6px',
						borderBottom: '1px solid var(--border)',
						display: 'flex', flexWrap: 'wrap', gap: '6px',
						maxHeight: '100px', overflowY: 'auto',
					}}>
						{Array.from(selected.values()).map((ex: any) => (
							<span key={ex.id} style={{
								fontSize: '12px', fontWeight: 600,
								padding: '3px 10px', borderRadius: '20px',
								background: 'rgba(204,255,0,0.12)', color: 'var(--primary)',
								border: '1px solid rgba(204,255,0,0.25)',
							}}>
								{ex._displayName || ex.name}
							</span>
						))}
					</div>
				)}
				{/* Action row */}
				<div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
					<button
						onClick={() => selected.size > 0 && setShowSelectedNames(p => !p)}
						style={{
							fontSize: '14px', fontWeight: 600, padding: 0,
							color: selected.size > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)',
							background: 'none', border: 'none',
							cursor: selected.size > 0 ? 'pointer' : 'default',
							display: 'flex', alignItems: 'center', gap: '5px',
						}}
					>
						{selected.size} {t('selected')}
						{selected.size > 0 && (
							<span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
								{showSelectedNames ? '▲' : '▼'}
							</span>
						)}
					</button>
					<button
						onClick={handleAddAll}
						disabled={selected.size === 0}
						style={{
							padding: '10px 24px', borderRadius: '10px', border: 'none',
							background: selected.size > 0 ? 'var(--primary)' : 'var(--bg-tertiary)',
							color: selected.size > 0 ? '#000' : 'var(--text-tertiary)',
							fontSize: '14px', fontWeight: 700,
							cursor: selected.size > 0 ? 'pointer' : 'not-allowed',
							transition: 'all 0.15s',
						}}
					>
						{t('Add All')}
					</button>
				</div>
			</div>
		)}
		</div>,
		document.body
	);
}