import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { api } from '../api/client';
import { useTranslation } from 'react-i18next';
import PublicAuthShell from '../components/PublicAuthShell';

export default function Login() {
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);
	const [successBridge, setSuccessBridge] = useState(false);
	const { login } = useAuthStore();
	const navigate = useNavigate();
	const { t } = useTranslation();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setError('');

		try {
			const response = await api.post('/auth/login', { email, password });
			await login(response.data.access_token, response.data.refresh_token);
			setSuccessBridge(true);
			await new Promise((resolve) => window.setTimeout(resolve, 420));
			navigate('/');
		} catch (err: any) {
			console.error('Login error:', err);
			setSuccessBridge(false);

			// Better error messages
			if (err.response) {
				const detail = err.response.data?.detail;
				if (typeof detail === 'string') {
					setError(detail);
				} else if (err.response.status === 401) {
					setError('Incorrect email or password');
				} else if (err.response.status === 422) {
					setError('Invalid email format');
				} else {
					setError(`Server error (${err.response.status}). Please try again later.`);
				}
			} else if (err.request) {
				setError('Cannot connect to server. Check your internet connection.');
			} else {
				setError('Login failed. Please try again.');
			}
		} finally {
			setLoading(false);
		}
	};

	return (
		<PublicAuthShell
			eyebrow={t('Welcome back')}
			title={t('Pick up where you left off.')}
			subtitle={t('Open your routines, log the next session, and keep the same training flow you started on the homepage.')}
			cardClassName={successBridge ? 'is-success-bridge' : ''}
			altPrompt={
				<>
					{t("Don't have an account?")} <Link to="/register">{t("Register")}</Link>
				</>
			}
		>
			<div className="public-auth-form-header">
				<h2>{t('Login')}</h2>
				<p>{t('Sign in to continue logging sessions, charts, and rewards.')}</p>
			</div>

			{error && <div className="public-auth-error">{error}</div>}

			<form onSubmit={handleSubmit} className="public-auth-form">
				<div className="input-group">
					<label className="label">{t("Email or Username")}</label>
					<input
						type="text"
						className="input"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						required
						autoComplete="username"
						disabled={loading}
					/>
				</div>

				<div className="input-group">
					<label className="label">{t("Password")}</label>
					<input
						type="password"
						className="input"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						required
						autoComplete="current-password"
						disabled={loading}
					/>
				</div>

				<button
					type="submit"
					className={`btn public-auth-submit motion-btn motion-btn--cta motion-btn--public ${loading ? 'is-loading' : ''} ${successBridge ? 'is-success-locked' : ''}`.trim()}
					disabled={loading}
				>
					{successBridge ? t('Opening Home...') : loading ? t('Logging in...') : t("Login")}
				</button>
			</form>
		</PublicAuthShell>
	);
}
