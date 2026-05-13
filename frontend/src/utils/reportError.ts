/**
 * Fire-and-forget error reporter. Uses the native fetch API (not axios) so
 * we still capture errors even when the axios interceptor stack itself is
 * the source of the problem.
 */
type ReportLevel = 'error' | 'warn' | 'info';

interface ReportOptions {
	level?: ReportLevel;
	context?: Record<string, any>;
}

function _serializeError(err: unknown): { message: string; stack?: string } {
	if (err instanceof Error) {
		return { message: err.message || String(err), stack: err.stack };
	}
	if (typeof err === 'string') {
		return { message: err };
	}
	try {
		return { message: JSON.stringify(err) };
	} catch {
		return { message: String(err) };
	}
}

export function reportError(err: unknown, options: ReportOptions = {}): void {
	const { message, stack } = _serializeError(err);
	const token = (() => {
		try { return localStorage.getItem('token') || null; } catch { return null; }
	})();
	const headers: Record<string, string> = { 'Content-Type': 'application/json' };
	if (token) headers['Authorization'] = `Bearer ${token}`;

	const body = {
		source: 'frontend',
		level: options.level || 'error',
		message: message.slice(0, 4000),
		stack: stack ? stack.slice(0, 20000) : undefined,
		url: typeof window !== 'undefined' ? window.location.href : undefined,
		user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
		context: options.context,
	};

	try {
		fetch('/api/_errors', {
			method: 'POST',
			headers,
			body: JSON.stringify(body),
			// keepalive lets the request survive a page unload (works for
			// unhandledrejection during navigation)
			keepalive: true,
		}).catch(() => { /* swallow — best effort */ });
	} catch {
		/* swallow — best effort */
	}
}

let installed = false;
export function installGlobalErrorHandlers() {
	if (installed || typeof window === 'undefined') return;
	installed = true;

	window.addEventListener('error', (event) => {
		reportError(event.error || event.message, { context: { type: 'window.error' } });
	});

	window.addEventListener('unhandledrejection', (event) => {
		reportError(event.reason, { context: { type: 'unhandledrejection' } });
	});
}
