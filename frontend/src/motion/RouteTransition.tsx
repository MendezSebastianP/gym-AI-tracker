import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef } from 'react';
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'framer-motion';
import { useLocation, useNavigationType, useOutlet } from 'react-router-dom';
import { classifyPathname, getRouteDirection, motionTokens } from './routes';

interface FrameChildrenProps {
	children: ReactNode;
}

interface VariantCustom {
	direction: -1 | 0 | 1;
	reducedMotion: boolean;
}

const publicVariants = {
	initial: ({ reducedMotion }: VariantCustom) => reducedMotion
		? { opacity: 0 }
		: { opacity: 0, y: motionTokens.distance.publicY, scale: 0.985, filter: `blur(${motionTokens.blur.public}px)` },
	animate: ({ reducedMotion }: VariantCustom) => reducedMotion
		? { opacity: 1, transition: { duration: motionTokens.duration.medium, ease: motionTokens.ease.out } }
		: {
			opacity: 1,
			y: 0,
			scale: 1,
			filter: 'blur(0px)',
			transition: { duration: motionTokens.duration.publicEnter, ease: motionTokens.ease.out },
		},
	exit: ({ reducedMotion }: VariantCustom) => reducedMotion
		? { opacity: 0, transition: { duration: motionTokens.duration.fast, ease: motionTokens.ease.in } }
		: {
			opacity: 0,
			y: -12,
			scale: 0.995,
			filter: `blur(${Math.max(4, motionTokens.blur.public - 4)}px)`,
			transition: { duration: motionTokens.duration.publicExit, ease: motionTokens.ease.in },
		},
};

const appVariants = {
	initial: ({ direction, reducedMotion }: VariantCustom & { kind: 'app-peer' | 'app-stack' | 'static' }) => {
		if (reducedMotion) return { opacity: 0 };
		if (direction === 0) return { opacity: 0, y: 8, filter: 'blur(4px)' };
		return {
			opacity: 0,
			x: (direction > 0 ? 1 : -1) * (motionTokens.distance.peerX + 2),
			scale: 0.995,
			filter: `blur(${motionTokens.blur.app}px)`,
		};
	},
	animate: ({ reducedMotion }: VariantCustom) => reducedMotion
		? { opacity: 1, transition: { duration: motionTokens.duration.fast, ease: motionTokens.ease.out } }
		: {
			opacity: 1,
			x: 0,
			y: 0,
			scale: 1,
			filter: 'blur(0px)',
			transition: { duration: motionTokens.duration.medium, ease: motionTokens.ease.out },
		},
	exit: ({ direction, reducedMotion }: VariantCustom & { kind: 'app-peer' | 'app-stack' | 'static' }) => {
		if (reducedMotion) {
			return { opacity: 0, transition: { duration: motionTokens.duration.fast, ease: motionTokens.ease.in } };
		}
		if (direction === 0) {
			return { opacity: 0, y: -6, filter: 'blur(4px)', transition: { duration: motionTokens.duration.fast, ease: motionTokens.ease.in } };
		}
		return {
			opacity: 0,
			x: (direction > 0 ? -1 : 1) * 16,
			scale: 0.996,
			filter: `blur(${Math.max(4, motionTokens.blur.app - 2)}px)`,
			transition: { duration: motionTokens.duration.fast, ease: motionTokens.ease.in },
		};
	},
};

const stackVariants = {
	initial: ({ direction, reducedMotion }: VariantCustom) => reducedMotion
		? { opacity: 0 }
		: {
			opacity: 0,
			x: direction >= 0 ? motionTokens.distance.stackX : -18,
			scale: 0.992,
			filter: `blur(${motionTokens.blur.app}px)`,
		},
	animate: ({ reducedMotion }: VariantCustom) => reducedMotion
		? { opacity: 1, transition: { duration: motionTokens.duration.fast, ease: motionTokens.ease.out } }
		: {
			opacity: 1,
			x: 0,
			scale: 1,
			filter: 'blur(0px)',
			transition: { duration: 0.24, ease: motionTokens.ease.out },
		},
	exit: ({ direction, reducedMotion }: VariantCustom) => reducedMotion
		? { opacity: 0, transition: { duration: motionTokens.duration.fast, ease: motionTokens.ease.in } }
		: {
			opacity: 0,
			x: direction >= 0 ? -14 : 24,
			scale: 0.996,
			filter: 'blur(6px)',
			transition: { duration: 0.2, ease: motionTokens.ease.in },
		},
};

export function MotionPreferenceSync() {
	const reducedMotion = useReducedMotion();

	useEffect(() => {
		document.documentElement.dataset.reducedMotion = reducedMotion ? 'true' : 'false';
	}, [reducedMotion]);

	return null;
}

export function MotionProvider({ children }: FrameChildrenProps) {
	return (
		<MotionConfig reducedMotion="user">
			{children}
		</MotionConfig>
	);
}

export function PublicRouteFrame({ children }: FrameChildrenProps) {
	const reducedMotion = useReducedMotion();
	const custom = useMemo<VariantCustom>(() => ({ direction: 1, reducedMotion }), [reducedMotion]);

	return (
		<motion.div
			className="route-scene route-scene--public"
			custom={custom}
			variants={publicVariants}
			initial="initial"
			animate="animate"
			exit="exit"
		>
			{children}
		</motion.div>
	);
}

export function StandaloneAppRouteFrame({ children }: FrameChildrenProps) {
	const reducedMotion = useReducedMotion();
	const custom = useMemo<VariantCustom>(() => ({ direction: 1, reducedMotion }), [reducedMotion]);

	return (
		<motion.div
			className="route-scene route-scene--standalone"
			custom={custom}
			variants={stackVariants}
			initial="initial"
			animate="animate"
			exit="exit"
		>
			{children}
		</motion.div>
	);
}

export function AnimatedAppOutlet() {
	const outlet = useOutlet();
	const location = useLocation();
	const navigationType = useNavigationType();
	const reducedMotion = useReducedMotion();
	const previousPathRef = useRef(location.pathname);
	const previousPath = previousPathRef.current;
	const kind = classifyPathname(location.pathname);
	const direction = getRouteDirection(previousPath, location.pathname, navigationType);

	useEffect(() => {
		previousPathRef.current = location.pathname;
	}, [location.pathname]);

	if (!outlet) {
		return null;
	}

	const custom = {
		direction,
		reducedMotion,
		kind: kind === 'app-stack' ? 'app-stack' : kind === 'app-peer' ? 'app-peer' : 'static',
	} as const;

	const variants = kind === 'app-stack' ? stackVariants : appVariants;

	return (
		<div className="app-route-shell">
			<AnimatePresence mode="wait" initial={false} custom={custom}>
				<motion.div
					key={location.pathname}
					className={`route-scene route-scene--app ${kind === 'app-stack' ? 'is-stack' : 'is-peer'}`}
					custom={custom}
					variants={variants}
					initial="initial"
					animate="animate"
					exit="exit"
				>
					{outlet}
				</motion.div>
			</AnimatePresence>
		</div>
	);
}
