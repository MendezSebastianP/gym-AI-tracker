import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { useTranslation } from 'react-i18next';
import { X, Search, Filter, Dumbbell, Layers, Activity, Plus, Check, ChevronDown } from 'lucide-react';
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

	const activeFilterCount = Object.values(filters).filter(Boolean).length;

	if (isCreating) {
		return createPortal(
			<div className="flow sub">
				<div className="flow-hdr" style={{ alignItems: 'center' }}>
					<span className="flow-title sm">{t('Custom Exercise')}</span>
					<button className="flow-cancel" onClick={() => setIsCreating(false)}>{t('Cancel')}</button>
				</div>
				<div className="flow-scroll">
					<div className="field" style={{ marginTop: 6 }}>
						<label>{t('Name')} *</label>
						<input value={customName} onChange={e => setCustomName(e.target.value)} placeholder={t("e.g. My Special Curl")} autoFocus />
					</div>
					<div className="field">
						<label>{t('Target Zone')}</label>
						<select value={customGroup} onChange={e => setCustomGroup(e.target.value)}>
							<option value="">{t('Select Target Zone')}</option>
							{options.groups.map(g => <option key={g} value={g!}>{t(g!)}</option>)}
						</select>
					</div>
					<div className="field">
						<label>{t('Specific Muscle')}</label>
						<select value={customMuscle} onChange={e => setCustomMuscle(e.target.value)}>
							<option value="">{t('Select Muscle')}</option>
							{options.muscles.map(m => <option key={m} value={m as string}>{t(m as string)}</option>)}
						</select>
					</div>
					<div className="field">
						<label>{t('Equipment')}</label>
						<select value={customEquipment} onChange={e => setCustomEquipment(e.target.value)}>
							<option value="">{t('Select Equipment')}</option>
							{options.equipment.map(e => <option key={e} value={e as string}>{t(e as string)}</option>)}
						</select>
					</div>
					<button
						className="btn-primary"
						style={{ width: '100%', marginTop: 22 }}
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
		<div className="flow sub">
			<div className="pk-searchbar">
				<div className="pk-search">
					<span className="sic"><Search size={18} /></span>
					<input
						autoFocus
						placeholder={cardioMode ? t("Search cardio exercises...") : t("Search exercises...")}
						value={search}
						onChange={e => setSearch(e.target.value)}
					/>
				</div>
				{!cardioMode && (
					<button
						className={`pk-filter ${showFilters || activeFilterCount > 0 ? 'on' : ''}`}
						onClick={() => setShowFilters(!showFilters)}
						aria-label={t('Filters')}
					>
						<Filter size={18} />
						{!showFilters && activeFilterCount > 0 && <span className="pk-filter-count num">{activeFilterCount}</span>}
					</button>
				)}
				<button className="pk-close" onClick={onClose} aria-label={t('Close')}>
					<X size={20} />
				</button>
			</div>

			{!cardioMode && showFilters && (
				<div className="filters">
					<div className="filters-h" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
						<span>{t('Filters')}</span>
						{activeFilterCount > 0 && (
							<button onClick={clearFilters} style={{ fontFamily: 'var(--font-disp)', fontSize: 12, fontWeight: 600, color: 'var(--lime)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textTransform: 'none', letterSpacing: 0 }}>
								{t('Clear All')}
							</button>
						)}
					</div>

					{/* Target Zone (mutually exclusive with Specific Muscle) */}
					<div className="filt-sec" style={{ opacity: filters.muscle ? 0.45 : 1 }}>
						<div className="filt-row" onClick={() => toggleFilterSection('group')}>
							<span className="fr-ic"><Layers size={13} /></span>
							<span className="fr-name">{t('Target Zone')}</span>
							{filters.group && <span className="fr-count">{t(filters.group)}</span>}
							<span className={`fr-chev ${expandedFilter === 'group' ? 'open' : ''}`}><ChevronDown size={15} /></span>
						</div>
						{expandedFilter === 'group' && (
							<div className="chip-wrap">
								{options.groups.map(g => (
									<button key={g} className={`fchip ${filters.group === g ? 'on' : ''}`} onClick={() => { toggleFilter('group', g!); if (filters.group !== g) setExpandedFilter(null); }}>
										{t(g!)}
									</button>
								))}
							</div>
						)}
					</div>

					{!filters.group && !filters.muscle && <div className="filt-or">— {t('or')} —</div>}

					{/* Specific Muscle */}
					<div className="filt-sec" style={{ opacity: filters.group ? 0.45 : 1 }}>
						<div className="filt-row" onClick={() => toggleFilterSection('muscle')}>
							<span className="fr-ic"><Activity size={13} /></span>
							<span className="fr-name">{t('Specific Muscle')}</span>
							{filters.muscle && <span className="fr-count">{t(filters.muscle)}</span>}
							<span className={`fr-chev ${expandedFilter === 'muscle' ? 'open' : ''}`}><ChevronDown size={15} /></span>
						</div>
						{expandedFilter === 'muscle' && (
							<div className="chip-wrap">
								{options.muscles.map(m => (
									<button key={m} className={`fchip ${filters.muscle === m ? 'on' : ''}`} onClick={() => { toggleFilter('muscle', m!); if (filters.muscle !== m) setExpandedFilter(null); }}>
										{t(m!)}
									</button>
								))}
							</div>
						)}
					</div>

					{/* Equipment */}
					<div className="filt-sec">
						<div className="filt-row" onClick={() => toggleFilterSection('equipment')}>
							<span className="fr-ic"><Dumbbell size={13} /></span>
							<span className="fr-name">{t('Equipment')}</span>
							{filters.equipment && <span className="fr-count">{t(filters.equipment)}</span>}
							<span className={`fr-chev ${expandedFilter === 'equipment' ? 'open' : ''}`}><ChevronDown size={15} /></span>
						</div>
						{expandedFilter === 'equipment' && (
							<div className="chip-wrap">
								{options.equipment.map(e => (
									<button key={e} className={`fchip ${filters.equipment === e ? 'on' : ''}`} onClick={() => { toggleFilter('equipment', e!); if (filters.equipment !== e) setExpandedFilter(null); }}>
										{t(e!)}
									</button>
								))}
							</div>
						)}
					</div>
				</div>
			)}

			<div className="pk-list">
				{/* Create Custom option only in regular mode */}
				{!cardioMode && (
					<>
						<button
							className="custom-row"
							onClick={() => {
								setCustomName(search); // pre-fill with search term
								setIsCreating(true);
							}}
						>
							<span className="cr-ic"><Plus size={18} /></span>
							<span className="cr-txt">{t('Create Custom Exercise')}</span>
						</button>
						<div className="pk-div" />
					</>
				)}

				{filteredExercises?.map(ex => {
					const isSelected = multiSelect && selected.has(ex.id);
					return (
						<button
							key={ex.id}
							className={`exp-row ${isSelected ? 'sel' : ''}`}
							onClick={() => multiSelect ? toggleSelected(ex) : onSelect(ex)}
						>
							{multiSelect && (
								<span className="ex-cb">{isSelected && <Check size={15} strokeWidth={3} />}</span>
							)}
							<div className="er-main">
								<div className="er-name">{ex._displayName}</div>
								<div className="er-tags">
									{ex.muscle_group && <span className="er-tag"><Layers size={12} />{t(ex.muscle_group)}</span>}
									{ex.equipment && <span className="er-tag"><Dumbbell size={12} />{t(ex.equipment)}</span>}
									{ex.muscle && <span className="er-tag"><Activity size={12} />{t(ex.muscle)}</span>}
								</div>
							</div>
						</button>
					);
				})}

				{exercises === undefined && !loadingTimedOut && (
					<div className="topmark" style={{ padding: '40px 20px' }}>{t('Loading exercises...')}</div>
				)}
				{(loadingTimedOut || (exercises !== undefined && filteredExercises.length === 0)) && (
					<div className="b-empty" style={{ marginTop: 30 }}>
						<p>{cardioMode ? t('No cardio exercises found.') : t('No exercises found.')}</p>
						{!cardioMode && (!exercises || exercises.length === 0) && (
							<p style={{ fontSize: 12, marginTop: 8 }}>{t('Make sure your exercise library is synced.')}</p>
						)}
					</div>
				)}
			</div>

			{/* Multi-select bottom bar — flex sibling so it never overlaps the list */}
			{multiSelect && (
				<div className="pk-bar">
					<div className="pk-bar-inner">
						{showSelectedNames && selected.size > 0 && (
							<div className="sel-tray">
								{Array.from(selected.values()).map((ex: any) => (
									<span key={ex.id} className="sel-chip">
										{ex._displayName || ex.name}
										<span className="sc-x" onClick={(e) => { e.stopPropagation(); toggleSelected(ex); }}>
											<X size={13} />
										</span>
									</span>
								))}
							</div>
						)}
						<div className="pk-bar-foot">
							<div
								className={`pk-count ${selected.size === 0 ? 'zero' : ''}`}
								onClick={() => selected.size > 0 && setShowSelectedNames(p => !p)}
							>
								<span className="num">{selected.size}</span> {t('selected')}
								{selected.size > 0 && (
									<span className={`tray-tog ${showSelectedNames ? 'open' : ''}`}><ChevronDown size={15} /></span>
								)}
							</div>
							<button className="pk-add" disabled={selected.size === 0} onClick={handleAddAll}>
								{t('Add All')}{selected.size > 1 ? ` · ${selected.size}` : ''}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>,
		document.body
	);
}
