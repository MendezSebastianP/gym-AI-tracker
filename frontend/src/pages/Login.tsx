import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore, hardReset } from '../store/authStore';
import { api } from '../api/client';
import { useTranslation } from 'react-i18next';
import PublicAuthShell, { AuthField } from '../components/PublicAuthShell';

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
			title={t('Login')}
			subtitle={t('Sign in to continue logging sessions, charts, and rewards.')}
			altPrompt={
				<>
					{t("Don't have an account?")} <Link to="/register">{t('Register')}</Link>
				</>
			}
		>
			{error && <div className="auth-error">{error}</div>}

			<form onSubmit={handleSubmit}>
				<AuthField
					label={t('Email or Username')}
					value={email}
					onChange={setEmail}
					placeholder="you@email.com"
					autoComplete="username"
					required
					disabled={loading}
				/>
				<AuthField
					label={t('Password')}
					type="password"
					value={password}
					onChange={setPassword}
					placeholder={t('Your password')}
					autoComplete="current-password"
					required
					disabled={loading}
				/>

				<button
					type="submit"
					className="btn-primary auth-submit"
					disabled={loading}
					style={{ opacity: loading ? 0.7 : 1 }}
				>
					{successBridge ? t('Opening Home...') : loading ? t('Logging in...') : t('Login')}
				</button>
			</form>

			<button
				type="button"
				className="link-quiet"
				onClick={() => hardReset()}
				style={{ display: 'block', margin: '18px auto 0' }}
			>
				{t('App stuck or not loading? Reset local data')}
			</button>
		</PublicAuthShell>
	);
}
