/**
 * GenLoader — full-screen AI progress overlay (routine generation + reports).
 *
 * Progress eases fast→slow up to a 96% cap while `status === 'loading'`;
 * it only completes when the parent flips `status` to 'done' (the result
 * actually arrived), and parks at the cap with a retry block on 'error'.
 * The first half of every stage list is connection/API work so a late
 * stall never reads as "almost done, then the connection broke".
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { K } from './kit';

export type GenLoaderStatus = 'loading' | 'done' | 'error';

interface GenLoaderProps {
	variant: 'routine' | 'report';
	status: GenLoaderStatus;
	doneTitle?: string;
	doneSub?: string;
	errorTitle?: string;
	errorText?: string | null;
	onDone: () => void;
	onCancel: () => void;
	onRetry?: () => void;
}

const STAGES: Record<'routine' | 'report', { eyebrow: string; stages: string[] }> = {
	routine: {
		eyebrow: 'Generating your routine',
		stages: [
			'Connecting to the AI engine',
			'Securing your session',
			'Uploading your training history',
			'The AI is analysing your data',
			'Selecting your exercises',
			'Balancing muscle groups',
			'Sequencing your training days',
			'Finalising your routine',
		],
	},
	report: {
		eyebrow: 'Analysing your training',
		stages: [
			'Connecting to the AI engine',
			'Loading your session history',
			'Sending data for analysis',
			'The AI is reviewing each exercise',
			'Detecting plateaus & trends',
			'Scoring confidence',
			'Writing your recommendations',
			'Finalising your report',
		],
	},
};

/* Decorative skeleton content (blurred — placeholder, not the real result) */
const GL_DAYS = [
	{ name: 'Push', ex: ['Bench Press', 'Incline DB Press', 'Overhead Press', 'Lateral Raise', 'Cable Fly', 'Triceps Pushdown'] },
	{ name: 'Pull', ex: ['Deadlift', 'Pull Up', 'Barbell Row', 'Face Pull', 'Dumbbell Curl', 'Hammer Curl'] },
	{ name: 'Legs', ex: ['Back Squat', 'Romanian Deadlift', 'Leg Press', 'Walking Lunge', 'Leg Curl', 'Calf Raise'] },
];
const GL_SCAN = [
	'Bench Press', 'Squat', 'Dumbbell Curl', 'Lateral Raise', 'Pull Up', 'Overhead Tricep Ext.',
];

const FILL_MS = 11000; // time to ease up to the cap
const CAP = 96;        // never auto-passes this until the result truly lands
const SUCCESS_MS = 650; // cap → 100 ramp once the result arrives
const C = 364;          // progress ring circumference (r≈58)

export default function GenLoader({
	variant,
	status,
	doneTitle,
	doneSub,
	errorTitle,
	errorText,
	onDone,
	onCancel,
	onRetry,
}: GenLoaderProps) {
	const { t } = useTranslation();
	const v = STAGES[variant];
	const [disp, setDisp] = useState(0);
	const startRef = useRef(Date.now());
	const successStartRef = useRef<number | null>(null);
	const doneFiredRef = useRef(false);
	const statusRef = useRef<GenLoaderStatus>(status);
	statusRef.current = status;
	const onDoneRef = useRef(onDone);
	onDoneRef.current = onDone;

	// Restart the fill when a retry begins
	useEffect(() => {
		if (status === 'loading') {
			startRef.current = Date.now();
			successStartRef.current = null;
			doneFiredRef.current = false;
			setDisp(0);
		}
	}, [status]);

	useEffect(() => {
		const id = setInterval(() => {
			const st = statusRef.current;
			if (st === 'error') {
				setDisp(CAP);
				return;
			}
			const el = Date.now() - startRef.current;
			const tt = Math.min(1, el / FILL_MS);
			const eased = 1 - Math.pow(1 - tt, 3.5); // quick off the line, long crawl to the cap
			let p = CAP * eased;

			if (st === 'done') {
				if (successStartRef.current == null) successStartRef.current = Date.now();
				const s = Math.min(1, (Date.now() - successStartRef.current) / SUCCESS_MS);
				p = Math.max(p, CAP) + (100 - CAP) * s - (Math.max(p, CAP) - CAP);
				p = CAP + (100 - CAP) * s;
				if (s >= 1 && !doneFiredRef.current) {
					doneFiredRef.current = true;
					setDisp(100);
					setTimeout(() => onDoneRef.current(), 1100);
					return;
				}
			}
			setDisp(p);
		}, 33);
		return () => clearInterval(id);
	}, []);

	const pct = Math.round(disp);
	const done = status === 'done' && pct >= 100;
	const error = status === 'error';
	const stageIdx = Math.min(v.stages.length - 1, Math.floor((Math.min(disp, CAP) / CAP) * v.stages.length));
	// reveal the decorative build across the second half of the fill
	const rp = done ? 1 : Math.max(0, Math.min(1, (Math.min(disp, CAP) - 48) / (CAP - 48)));

	// Portaled: ancestor route transitions apply transform/filter which would
	// re-anchor this fixed overlay to the page instead of the viewport.
	return createPortal(
		<div className="gen">
			<div className="grain" />
			<button className="gen-cancel" onClick={onCancel}>{error ? t('Close') : t('Cancel')}</button>

			<div className="gen-hero">
				<div className="gen-ring">
					<svg className={`spin ${error ? 'paused' : ''}`} viewBox="0 0 150 150" width="150" height="150">
						<circle cx="75" cy="75" r="70" fill="none" stroke="var(--line)" strokeWidth="1" strokeDasharray="2 7" />
					</svg>
					<svg className={`gen-arc ${error ? 'err' : ''}`} viewBox="0 0 150 150" width="150" height="150">
						<circle cx="75" cy="75" r="58" fill="none" stroke="var(--raised-2)" strokeWidth="6" />
						<circle
							cx="75" cy="75" r="58" fill="none"
							stroke={error ? 'var(--danger)' : 'url(#glim)'}
							strokeWidth="6" strokeLinecap="round"
							strokeDasharray={C} strokeDashoffset={C * (1 - disp / 100)}
							transform="rotate(-90 75 75)"
						/>
						<defs>
							<linearGradient id="glim" x1="0" y1="0" x2="1" y2="1">
								<stop offset="0" stopColor="var(--green-mid)" />
								<stop offset="1" stopColor="var(--lime)" />
							</linearGradient>
						</defs>
					</svg>
					<div className="gen-core">
						{done ? (
							<span className="gen-doneic">
								<svg width="34" height="34" viewBox="0 0 24 24" fill="none">
									<path d="M5 12.5l4.5 4.5L19 6.5" stroke="var(--lime)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
								</svg>
							</span>
						) : error ? (
							<span className="gen-erric">!</span>
						) : (
							<>
								<span className="gen-pct num">{pct}</span>
								<span className="gen-pctmark">%</span>
							</>
						)}
					</div>
				</div>

				{error ? (
					<div className="gen-errblock">
						<div className="gen-stage" style={{ marginTop: 18 }}>{errorTitle || t("Couldn't reach the AI")}</div>
						<div className="gen-eyebrow">{errorText || t('The connection dropped. Your coins were not charged.')}</div>
						<div className="gen-err-actions">
							{onRetry && (
								<button className="btn-primary" style={{ height: 48, padding: '0 22px' }} onClick={onRetry}>
									<K.spark />{t('Try again')}
								</button>
							)}
							<button className="gen-err-cancel" onClick={onCancel}>{t('Cancel')}</button>
						</div>
					</div>
				) : (
					<>
						<div className="gen-stage" key={done ? 'done' : stageIdx}>
							<span className="gen-spark"><K.spark width={18} height={18} /></span>
							{done ? (doneTitle || t('Ready')) : t(v.stages[stageIdx])}
						</div>
						<div className="gen-eyebrow mono">{done ? (doneSub || '') : t(v.eyebrow)}</div>
					</>
				)}
			</div>

			{variant === 'routine' ? (
				<div className={`gen-build ${error ? 'dim' : ''}`}>
					{GL_DAYS.map((d, di) => {
						const total = GL_DAYS.length * 6;
						const revealed = Math.round(rp * total);
						return (
							<div className="gen-col" key={di}>
								<div className="gen-col-head">
									<span className="gen-col-no num">{di + 1}</span>
									<span className={`gen-col-name ${revealed > di ? 'on' : ''}`}>{revealed > di ? d.name : '···'}</span>
								</div>
								<div className="gen-slots">
									{d.ex.map((n, ei) => (
										<div className={`gen-slot ${(ei * GL_DAYS.length + di) < revealed ? 'on' : ''}`} key={ei}>
											<span className="gen-slot-dot" />
											<span className="gen-slot-name">{n}</span>
										</div>
									))}
								</div>
							</div>
						);
					})}
				</div>
			) : (
				<div className={`gen-scan ${error ? 'dim' : ''}`}>
					<div className="gen-scan-label mono">{t('Reviewing exercises')}</div>
					{GL_SCAN.map((name, i) => {
						const revealed = Math.round(rp * GL_SCAN.length);
						const on = i < revealed;
						return (
							<div className={`scan-row ${on ? 'on' : ''}`} key={i}>
								<span className="scan-dot" />
								<span className="scan-name">{name}</span>
								<span className="scan-verdict">{on ? '· · ·' : ''}</span>
							</div>
						);
					})}
				</div>
			)}

			<div className="gen-foot">
				<div className={`gen-bar ${error ? 'err' : ''}`}><span style={{ width: `${pct}%` }} /></div>
				<div className="gen-foot-row">
					<span className="mono">
						{error ? t('Connection failed') : done ? t('Done') : `${t('Step')} ${stageIdx + 1} / ${v.stages.length}`}
					</span>
					<span className="mono">{error ? t('Retry available') : '~15s'}</span>
				</div>
			</div>
		</div>,
		document.body
	);
}
