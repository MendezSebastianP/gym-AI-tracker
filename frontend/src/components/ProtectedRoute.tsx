import { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export const ProtectedRoute = () => {
	const { isAuthenticated, isLoading, checkAuth } = useAuthStore();

	useEffect(() => {
		checkAuth();
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	if (isLoading) {
		return <div style={{ display: 'flex', justifyContent: 'center', marginTop: '50px' }}>Loading...</div>;
	}

	return isAuthenticated ? <Outlet /> : <Navigate to="/" replace />;
};
