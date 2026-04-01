import { useEffect, useRef, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore, hardReset } from '../store/authStore';

export const ProtectedRoute = () => {
	const { isAuthenticated, isLoading, checkAuth } = useAuthStore();
	const [showRecovery, setShowRecovery] = useState(false);
	const stuckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		checkAuth();
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		if (!isLoading) {
			if (stuckTimer.current) clearTimeout(stuckTimer.current);
			setShowRecovery(false);
			return;
		}
		// If still loading after 10s, show a recovery UI
		stuckTimer.current = setTimeout(() => setShowRecovery(true), 10000);
		return () => {
			if (stuckTimer.current) clearTimeout(stuckTimer.current);
		};
	}, [isLoading]);

	if (isLoading) {
		if (showRecovery) {
			return (
				<div style={{
					minHeight: '100vh', display: 'flex', flexDirection: 'column',
					alignItems: 'center', justifyContent: 'center', gap: '16px',
					padding: '24px', background: 'var(--bg-primary)', color: 'var(--text-secondary)',
					textAlign: 'center',
				}}>
					<p style={{ margin: 0, fontSize: '15px', color: 'var(--text-primary)' }}>Something is taking longer than expected.</p>
					<p style={{ margin: 0, fontSize: '13px' }}>This can happen when local app data gets out of sync.</p>
					<button
						onClick={() => hardReset()}
						style={{
							marginTop: '8px', padding: '10px 20px', borderRadius: '10px',
							background: 'var(--error, #f44)', color: '#fff', border: 'none',
							fontWeight: 700, fontSize: '14px', cursor: 'pointer',
						}}
					>
						Reset app data &amp; reload
					</button>
					<p style={{ margin: 0, fontSize: '11px', color: 'var(--text-tertiary)' }}>
						This clears local storage only. Your workout history is safe on the server.
					</p>
				</div>
			);
		}
		return <div style={{ display: 'flex', justifyContent: 'center', marginTop: '50px' }}>Loading...</div>;
	}

	return isAuthenticated ? <Outlet /> : <Navigate to="/" replace />;
};
