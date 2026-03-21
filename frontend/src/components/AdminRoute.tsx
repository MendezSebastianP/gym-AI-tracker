import { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export const AdminRoute = () => {
	const { isAuthenticated, isAdmin, isLoading, checkAuth } = useAuthStore();

	useEffect(() => {
		checkAuth();
	}, [checkAuth]);

	if (isLoading) {
		return <div className="loading-spinner" style={{ margin: '40px auto' }}></div>;
	}

	if (!isAuthenticated) {
		return <Navigate to="/login" replace />;
	}

	if (!isAdmin) {
		return <Navigate to="/" replace />;
	}

	return <Outlet />;
};
