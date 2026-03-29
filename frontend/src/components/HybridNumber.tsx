import { useState, useRef, useCallback, useEffect } from 'react';

/* ── Hybrid Input: tap=drum, hold+drag=swipe, double-tap=keyboard ── */

export interface HybridNumProps {
	value: number;
	onChange: (v: number) => void;
	min?: number;
	max?: number;
	step?: number;
	sensitivity?: number;
	label?: string;
	showHint?: boolean;
	showDelta?: boolean;
}

export function HybridNumber({ value, onChange, min = 0, max = 9999, step = 0.5, sensitivity = 14, label, showHint = false, showDelta = true }: HybridNumProps) {
	const [mode, setMode] = useState<'idle' | 'drum' | 'swipe' | 'edit'>('idle');
	const [scrollOffset, setScrollOffset] = useState(0);
	const [swipeDelta, setSwipeDelta] = useState(0);
	const [editText, setEditText] = useState('');
	const inputRef = useRef<HTMLInputElement>(null);

	// Items for drum
	const itemsRef = useRef<number[]>([]);
	if (itemsRef.current.length === 0 || itemsRef.current[0] !== min || (itemsRef.current.length > 1 && itemsRef.current[1] !== +(min + step).toFixed(2))) {
		const arr: number[] = [];
		for (let i = min; i <= max; i = +(i + step).toFixed(2)) arr.push(i);
		itemsRef.current = arr;
	}
	const items = itemsRef.current;

	const ITEM_H = 48;
	const VISIBLE = 7;
	const CENTER = Math.floor(VISIBLE * 2 / 5); // 2/5 position from top (row index 2)
	const PX_PER_STEP = sensitivity;
	const HOLD_THRESHOLD = 200; // ms to distinguish tap from hold
	const MOVE_THRESHOLD = 5; // px to start swipe

	// Refs for gesture detection
	const touchStartTime = useRef(0);
	const touchStartY = useRef(0);
	const hasMoved = useRef(false);
	const gestureDecided = useRef(false);
	const mouseActive = useRef(false);

	// Swipe refs
	const startVal = useRef(0);
	const swipeCurrentVal = useRef(0);
	const swipeAccumPx = useRef(0);
	const swipeSteps = useRef(0);
	const lastY = useRef(0);
	const lastTime = useRef(0);
	const velocity = useRef(0);
	const momentumRef = useRef<number | null>(null);

	// Drum refs
	const drumStartIdx = useRef(0);
	const drumAccumDy = useRef(0);
	const drumVelocity = useRef(0);
	const drumLastY = useRef(0);
	const drumLastTime = useRef(0);
	const drumAnimFrame = useRef<number | null>(null);

	// Tap detection — lastTapTime tracks globally so backdrop taps count toward double-tap
	const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const lastTapTime = useRef(0);
	const DOUBLE_TAP_MS = 350;

	const currentIdx = items.indexOf(value);

	// ── Gesture start (touch or mouse down) ──────────────────────
	const onGestureStart = useCallback((clientY: number) => {
		if (momentumRef.current) { cancelAnimationFrame(momentumRef.current); momentumRef.current = null; }
		if (drumAnimFrame.current) { cancelAnimationFrame(drumAnimFrame.current); drumAnimFrame.current = null; }

		touchStartTime.current = Date.now();
		touchStartY.current = clientY;
		lastY.current = clientY;
		lastTime.current = Date.now();
		hasMoved.current = false;
		gestureDecided.current = false;
		startVal.current = value;
		swipeCurrentVal.current = value;
		swipeAccumPx.current = 0;
		swipeSteps.current = 0;
		velocity.current = 0;
		setSwipeDelta(0);
	}, [value]);

	// ── Gesture move ─────────────────────────────────────────────
	const onGestureMove = useCallback((clientY: number) => {
		const dy = Math.abs(touchStartY.current - clientY);

		if (!gestureDecided.current && dy > MOVE_THRESHOLD) {
			hasMoved.current = true;
			gestureDecided.current = true;

			const elapsed = Date.now() - touchStartTime.current;
			if (elapsed < HOLD_THRESHOLD) {
				// Quick move = swipe mode
				setMode('swipe');
			} else {
				// Held then moved = also swipe (more natural)
				setMode('swipe');
			}
		}

		if (!gestureDecided.current) return;

		// ── Swipe logic ──────────────────────────────────────────
		// Incremental accumulation keeps direction stable and avoids jitter near step boundaries.
		const rawDy = lastY.current - clientY;
		const now = Date.now();
		const dt = now - lastTime.current;
		if (dt > 0) {
			const instantVel = rawDy / dt;
			velocity.current = velocity.current * 0.72 + instantVel * 0.28;
		}
		lastY.current = clientY;
		lastTime.current = now;

		const speed = Math.abs(velocity.current);
		const gain = Math.min(2.3, 1.08 + speed * 1.8); // Faster swipe = covers more ground
		const pxPerStep = Math.max(6, PX_PER_STEP * 0.9);
		swipeAccumPx.current += rawDy * gain;

		const stepDelta = swipeAccumPx.current > 0
			? Math.floor(swipeAccumPx.current / pxPerStep)
			: Math.ceil(swipeAccumPx.current / pxPerStep);

		if (stepDelta !== 0) {
			swipeAccumPx.current -= stepDelta * pxPerStep;
			swipeSteps.current += stepDelta;
		}

		const rawTarget = startVal.current + swipeSteps.current * step;
		const clamped = Math.max(min, Math.min(max, +rawTarget.toFixed(2)));

		// If clamped at boundaries, re-sync accumulator to prevent bounce/jitter.
		const clampedSteps = Math.round((clamped - startVal.current) / step);
		if (clampedSteps !== swipeSteps.current) {
			swipeSteps.current = clampedSteps;
			swipeAccumPx.current = 0;
		}

		if (clamped !== swipeCurrentVal.current) {
			swipeCurrentVal.current = clamped;
			onChange(clamped);
		}
		setSwipeDelta(+(clamped - startVal.current).toFixed(2));
	}, [onChange, min, max, step, PX_PER_STEP]);

	// Flag to select all text after React renders the new editText value
	const shouldSelectAll = useRef(false);

	// ── Enter edit mode helper (needs to run synchronously in user gesture) ──
	const enterEditMode = useCallback(() => {
		if (tapTimer.current) { clearTimeout(tapTimer.current); tapTimer.current = null; }
		setEditText(step < 1 ? value.toFixed(1) : String(value));
		setMode('edit');
		shouldSelectAll.current = true;
		// Focus synchronously within user gesture for mobile keyboard
		inputRef.current?.focus();
	}, [step, value]);

	// Select all text after React has rendered the new editText
	useEffect(() => {
		if (mode === 'edit' && shouldSelectAll.current) {
			shouldSelectAll.current = false;
			const inp = inputRef.current;
			if (inp) inp.setSelectionRange(0, inp.value.length);
		}
	}, [mode, editText]);

	// ── Gesture end ──────────────────────────────────────────────
	const onGestureEnd = useCallback(() => {
		if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }

		if (!hasMoved.current) {
			// No movement = tap. Check if double-tap (within DOUBLE_TAP_MS of last tap).
			const now = Date.now();
			const elapsed = now - lastTapTime.current;
			lastTapTime.current = now;

			if (elapsed < DOUBLE_TAP_MS) {
				// Double tap → edit mode
				enterEditMode();
			} else {
				// Single tap → open drum immediately (so second tap can arrive within threshold)
				setMode('drum');
				setScrollOffset(0);
				drumAccumDy.current = 0;
			}
			return;
		}

		// End of swipe — apply momentum
		if (mode === 'swipe') {
			const vel = velocity.current;
			if (Math.abs(vel) > 0.3) {
				const cappedVel = Math.sign(vel) * Math.min(Math.abs(vel), 3);
				let momentumVel = cappedVel * 4;
				let currentVal = swipeCurrentVal.current;

				const tick = () => {
					momentumVel *= 0.88;
					if (Math.abs(momentumVel) < 0.2) {
						setSwipeDelta(0);
						setMode('idle');
						momentumRef.current = null;
						return;
					}
					const stepDelta = Math.round(momentumVel) * step;
					currentVal = Math.max(min, Math.min(max, +(currentVal + stepDelta).toFixed(2)));
					swipeCurrentVal.current = currentVal;
					onChange(currentVal);
					momentumRef.current = requestAnimationFrame(tick);
				};
				momentumRef.current = requestAnimationFrame(tick);
			} else {
				setSwipeDelta(0);
				setMode('idle');
			}
		}
	}, [mode, onChange, min, max, step]);

	// ── Drum drag handlers (when drum is open) ───────────────────
	const onDrumDragStart = useCallback((clientY: number) => {
		if (drumAnimFrame.current) cancelAnimationFrame(drumAnimFrame.current);
		drumStartIdx.current = currentIdx >= 0 ? currentIdx : 0;
		drumAccumDy.current = 0;
		drumVelocity.current = 0;
		drumLastY.current = clientY;
		drumLastTime.current = Date.now();
		setScrollOffset(0);
	}, [currentIdx]);

	const onDrumDragMove = useCallback((clientY: number) => {
		const rawDy = drumLastY.current - clientY;
		drumLastY.current = clientY;

		const now = Date.now();
		const dt = now - drumLastTime.current;
		if (dt > 0) {
			drumVelocity.current = drumVelocity.current * 0.6 + (rawDy / dt) * 0.4;
		}
		drumLastTime.current = now;

		// Adaptive: slow stays as-is, fast gets amplified
		const absDy = Math.abs(rawDy);
		let scale: number;
		if (absDy <= 5) scale = 1;
		else if (absDy <= 12) scale = 1 + (absDy - 5) * 0.15;
		else scale = 2 + (absDy - 12) * 0.2;

		// Dampen for reps (higher sensitivity = slower drum)
		const drumDampen = 14 / PX_PER_STEP; // 1.0 for weight (14), 0.5 for reps (28)
		drumAccumDy.current += rawDy * scale * drumDampen;
		const idxOffset = Math.round(drumAccumDy.current / ITEM_H);
		const newIdx = Math.max(0, Math.min(drumStartIdx.current + idxOffset, items.length - 1));
		if (items[newIdx] !== undefined) onChange(items[newIdx]);

		const snappedDy = idxOffset * ITEM_H;
		setScrollOffset(-(drumAccumDy.current - snappedDy));
	}, [items, onChange]);

	const runDrumMomentum = useCallback(() => {
		const vel = drumVelocity.current;
		if (Math.abs(vel) < 0.3) {
			drumVelocity.current = 0;
			setScrollOffset(0);
			drumAccumDy.current = Math.round(drumAccumDy.current / ITEM_H) * ITEM_H;
			const finalIdx = Math.max(0, Math.min(drumStartIdx.current + Math.round(drumAccumDy.current / ITEM_H), items.length - 1));
			if (items[finalIdx] !== undefined) onChange(items[finalIdx]);
			return;
		}
		drumVelocity.current *= 0.93;
		drumAccumDy.current += vel * 15;

		const idxOffset = Math.round(drumAccumDy.current / ITEM_H);
		const clampedIdx = Math.max(0, Math.min(drumStartIdx.current + idxOffset, items.length - 1));
		if (items[clampedIdx] !== undefined) onChange(items[clampedIdx]);

		const snappedDy = idxOffset * ITEM_H;
		setScrollOffset(-(drumAccumDy.current - snappedDy));

		if (clampedIdx <= 0 && vel < 0) drumVelocity.current = 0;
		if (clampedIdx >= items.length - 1 && vel > 0) drumVelocity.current = 0;

		drumAnimFrame.current = requestAnimationFrame(runDrumMomentum);
	}, [items, onChange]);

	const onDrumDragEnd = useCallback(() => {
		if (Math.abs(drumVelocity.current) > 0.3) {
			drumAnimFrame.current = requestAnimationFrame(runDrumMomentum);
		} else {
			setScrollOffset(0);
		}
	}, [runDrumMomentum]);

	// ── Touch handlers ───────────────────────────────────────────
	const hybridRef = useRef<HTMLDivElement>(null);
	const drumRef = useRef<HTMLDivElement>(null);

	// preventDefault on touchstart suppresses synthetic mouse events on mobile
	const handleTouchStart = useCallback((e: React.TouchEvent) => {
		e.preventDefault();
		onGestureStart(e.touches[0].clientY);
	}, [onGestureStart]);

	const handleTouchEnd = useCallback((e: React.TouchEvent) => {
		e.preventDefault();
		onGestureEnd();
	}, [onGestureEnd]);

	// Non-passive touchmove listeners to block pull-to-refresh on mobile Chrome
	useEffect(() => {
		const el = hybridRef.current;
		if (!el) return;
		const onMove = (e: TouchEvent) => { e.preventDefault(); onGestureMove(e.touches[0].clientY); };
		el.addEventListener('touchmove', onMove, { passive: false });
		return () => el.removeEventListener('touchmove', onMove);
	}, [onGestureMove]);

	useEffect(() => {
		const el = drumRef.current;
		if (!el) return;
		const onMove = (e: TouchEvent) => { e.preventDefault(); onDrumDragMove(e.touches[0].clientY); };
		el.addEventListener('touchmove', onMove, { passive: false });
		return () => el.removeEventListener('touchmove', onMove);
	}, [mode, onDrumDragMove]); // re-attach when mode changes (drum appears/disappears)

	// Drum touch
	const handleDrumTouchStart = useCallback((e: React.TouchEvent) => {
		onDrumDragStart(e.touches[0].clientY);
	}, [onDrumDragStart]);
	const handleDrumTouchEnd = useCallback(() => onDrumDragEnd(), [onDrumDragEnd]);

	// ── Mouse handlers ───────────────────────────────────────────
	const handleMouseDown = useCallback((e: React.MouseEvent) => {
		mouseActive.current = true;
		onGestureStart(e.clientY);
		e.preventDefault();
	}, [onGestureStart]);

	const drumMouseActive = useRef(false);
	const handleDrumMouseDown = useCallback((e: React.MouseEvent) => {
		drumMouseActive.current = true;
		onDrumDragStart(e.clientY);
		e.preventDefault();
	}, [onDrumDragStart]);

	useEffect(() => {
		const move = (e: MouseEvent) => {
			if (mouseActive.current) onGestureMove(e.clientY);
			if (drumMouseActive.current) onDrumDragMove(e.clientY);
		};
		const up = () => {
			if (mouseActive.current) { mouseActive.current = false; onGestureEnd(); }
			if (drumMouseActive.current) { drumMouseActive.current = false; onDrumDragEnd(); }
		};
		window.addEventListener('mousemove', move);
		window.addEventListener('mouseup', up);
		return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
	}, [onGestureMove, onGestureEnd, onDrumDragMove, onDrumDragEnd]);

	// Cleanup
	useEffect(() => () => {
		if (momentumRef.current) cancelAnimationFrame(momentumRef.current);
		if (drumAnimFrame.current) cancelAnimationFrame(drumAnimFrame.current);
		if (tapTimer.current) clearTimeout(tapTimer.current);
		if (holdTimer.current) clearTimeout(holdTimer.current);
	}, []);

	const commitEdit = () => {
		const parsed = parseFloat(editText);
		if (!isNaN(parsed)) {
			// Accept any value the user typed (don't snap to step)
			const clamped = Math.max(min, Math.min(max, +parsed.toFixed(2)));
			onChange(clamped);
		}
		setMode('idle');
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
		if (e.key === 'Escape') setMode('idle');
	};

	// ── Render drum items ────────────────────────────────────────
	const renderDrumItems = () => {
		const range = CENTER + 2;
		const result = [];
		for (let offset = -range; offset <= range; offset++) {
			const idx = currentIdx + offset;
			if (idx < 0 || idx >= items.length) {
				result.push(<div key={`empty-${offset}`} style={{ height: ITEM_H }} />);
				continue;
			}
			const v = items[idx];
			const dist = Math.abs(offset);
			result.push(
				<div key={v} style={{
					height: ITEM_H,
					display: 'flex', alignItems: 'center', justifyContent: 'center',
					fontSize: dist === 0 ? '22px' : dist === 1 ? '17px' : '14px',
					fontWeight: dist === 0 ? 800 : dist <= 1 ? 600 : 400,
					color: dist === 0 ? 'var(--text-primary)' : dist === 1 ? 'var(--text-secondary)' : 'var(--text-tertiary)',
					opacity: dist === 0 ? 1 : dist === 1 ? 0.8 : dist === 2 ? 0.5 : 0.25,
					pointerEvents: 'none',
				}}>
					{step < 1 ? v.toFixed(1) : v}
				</div>
			);
		}
		return result;
	};

	const isSwipe = mode === 'swipe';
	const isEdit = mode === 'edit';

	return (
		<div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 2, position: 'relative' }}>
			{label && <span className="exp-set-field-label">{label}</span>}

			{/* Always-present input — positioned off-screen when not editing so focus() works synchronously on mobile */}
			<input
				ref={inputRef}
				type="text"
				inputMode="decimal"
				value={editText}
				onChange={e => setEditText(e.target.value)}
				onBlur={commitEdit}
				onKeyDown={handleKeyDown}
				style={isEdit ? {
					width: 80, height: 44, textAlign: 'center',
					fontSize: '18px', fontWeight: 700,
					background: 'var(--bg-primary)',
					border: '2px solid var(--primary)',
					borderRadius: 'var(--radius-sm)',
					color: 'var(--text-primary)',
					outline: 'none', caretColor: 'var(--primary)',
				} : {
					position: 'absolute', left: -9999, top: 0,
					width: 1, height: 1, opacity: 0,
				}}
			/>

			{/* Main value display — hidden during edit */}
			<div
				ref={hybridRef}
				onTouchStart={handleTouchStart}
				onTouchEnd={handleTouchEnd}
				onMouseDown={handleMouseDown}
				style={{
					position: 'relative',
					display: isEdit ? 'none' : 'block',
					background: isSwipe ? 'var(--primary-glow)' : 'var(--bg-tertiary)',
					border: isSwipe ? '1px solid var(--primary-border)' : mode === 'drum' ? '1px solid var(--primary-border)' : '1px solid var(--border)',
					borderRadius: 'var(--radius-sm)',
					padding: '8px 14px',
					fontSize: '16px', fontWeight: 700,
					color: isSwipe ? 'var(--primary)' : 'var(--text-primary)',
					minWidth: '80px', textAlign: 'center',
					cursor: 'ns-resize',
					userSelect: 'none', WebkitUserSelect: 'none',
					touchAction: 'none',
					transition: isSwipe ? 'none' : 'all 0.2s',
				}}
			>
				{step < 1 ? value.toFixed(1) : value}

				{/* Swipe delta indicator — right side */}
				{showDelta && isSwipe && swipeDelta !== 0 && (
					<div style={{
						position: 'absolute', right: -38, top: '50%',
						transform: 'translateY(-50%)',
						fontSize: '12px', fontWeight: 700,
						color: swipeDelta > 0 ? 'var(--success)' : 'var(--error)',
						whiteSpace: 'nowrap', pointerEvents: 'none',
					}}>
						{swipeDelta > 0 ? '+' : ''}{step < 1 ? swipeDelta.toFixed(1) : swipeDelta}
					</div>
				)}

				{/* Arrows hint */}
				{mode === 'idle' && (
					<div style={{
						position: 'absolute', right: 4, top: '50%',
						transform: 'translateY(-50%)',
						display: 'flex', flexDirection: 'column', gap: 1,
						opacity: 0.3, fontSize: 8, lineHeight: 1,
						color: 'var(--text-tertiary)',
					}}>
						<span>&#9650;</span>
						<span>&#9660;</span>
					</div>
				)}
			</div>

			{!isEdit && showHint && (
				<span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
					drag &bull; tap=drum &bull; double-tap=type
				</span>
			)}

			{/* Drum overlay */}
			{mode === 'drum' && (
				<>
					<div
						onTouchEnd={(e) => {
							e.preventDefault(); // suppress delayed click
							const now = Date.now();
							const elapsed = now - lastTapTime.current;
							lastTapTime.current = now;
							if (elapsed < DOUBLE_TAP_MS) {
								enterEditMode();
							} else {
								setMode('idle');
							}
						}}
						onClick={() => {
							// Desktop fallback (touch devices use onTouchEnd above)
							const now = Date.now();
							const elapsed = now - lastTapTime.current;
							lastTapTime.current = now;
							if (elapsed < DOUBLE_TAP_MS) {
								enterEditMode();
							} else {
								setMode('idle');
							}
						}}
						style={{ position: 'fixed', inset: 0, zIndex: 40 }}
					/>
					<div
						ref={drumRef}
						onTouchStart={handleDrumTouchStart}
						onTouchEnd={handleDrumTouchEnd}
						onMouseDown={handleDrumMouseDown}
						style={{
							position: 'absolute', top: '100%', left: '50%',
							transform: 'translateX(-50%)', zIndex: 50, marginTop: 6,
							background: 'var(--bg-secondary)',
							border: '1px solid var(--border)',
							borderRadius: 'var(--radius-md)',
							boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
							overflow: 'hidden', width: '120px',
							height: ITEM_H * VISIBLE,
							userSelect: 'none', WebkitUserSelect: 'none',
							touchAction: 'none', cursor: 'ns-resize',
						}}
					>
						<div style={{
							position: 'absolute', top: ITEM_H * CENTER,
							left: 4, right: 4, height: ITEM_H,
							background: 'var(--primary-glow)',
							border: '1.5px solid var(--primary)',
							borderRadius: 'var(--radius-sm)',
							pointerEvents: 'none', zIndex: 1,
						}} />
						<div style={{
							position: 'absolute', left: 0, right: 0, top: 0,
							transform: `translateY(${(CENTER - (CENTER + 2)) * ITEM_H + scrollOffset}px)`,
							pointerEvents: 'none',
						}}>
							{renderDrumItems()}
						</div>
						<div style={{
							position: 'absolute', top: 0, left: 0, right: 0, height: ITEM_H * 2,
							background: 'linear-gradient(to bottom, var(--bg-secondary) 20%, transparent)',
							pointerEvents: 'none', zIndex: 2,
						}} />
						<div style={{
							position: 'absolute', bottom: 0, left: 0, right: 0, height: ITEM_H * 2,
							background: 'linear-gradient(to top, var(--bg-secondary) 20%, transparent)',
							pointerEvents: 'none', zIndex: 2,
						}} />
					</div>
				</>
			)}
		</div>
	);
}

export default HybridNumber;
