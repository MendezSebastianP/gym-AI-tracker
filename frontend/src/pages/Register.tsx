import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { api } from '../api/client';
import { useTranslation } from 'react-i18next';
import PublicAuthShell from '../components/PublicAuthShell';

export default function Register() {
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
			const response = await api.post('/auth/register', { email, password });
			await login(response.data.access_token, response.data.refresh_token);
			setSuccessBridge(true);
			await new Promise((resolve) => window.setTimeout(resolve, 420));
			navigate('/home');
		} catch (err: any) {
			console.error('Registration error:', err);
			setSuccessBridge(false);

			// Better error messages
			if (err.response) {
				// Server responded with error
				const detail = err.response.data?.detail;
				if (typeof detail === 'string') {
					setError(detail);
				} else if (err.response.status === 400) {
					setError('Email already registered or invalid data');
				} else if (err.response.status === 422) {
					setError('Invalid email or password format');
				} else {
					setError(`Server error (${err.response.status}). Please try again later.`);
				}
			} else if (err.request) {
				// Request made but no response
				setError('Cannot connect to server. Check your internet connection.');
			} else {
				// Something else happened
				setError('Registration failed. Please try again.');
			}
		} finally {
			setLoading(false);
		}
	};

	return (
		<PublicAuthShell
			eyebrow={t('Start here')}
			title={t('Create the account. Start the log.')}
			subtitle={t('Get the same homepage experience, then move straight into routines, sessions, and progress tracking.')}
			cardClassName={successBridge ? 'is-success-bridge' : ''}
			altPrompt={
				<>
					{t("Already have an account?")} <Link to="/login">{t("Login")}</Link>
				</>
			}
		>
			<div className="public-auth-form-header">
				<h2>{t('Register')}</h2>
				<p>{t('Create your account and we will take you straight into Home.')}</p>
			</div>

			{error && <div className="public-auth-error">{error}</div>}

			<form onSubmit={handleSubmit} className="public-auth-form">
				<div className="input-group">
					<label className="label">{t("Email")}</label>
					<input
						type="email"
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
						autoComplete="new-password"
						minLength={6}
						disabled={loading}
					/>
					<small style={{ color: 'var(--text-tertiary)', marginTop: '6px', display: 'block' }}>
						{t('Minimum 6 characters')}
					</small>
				</div>

				<button
					type="submit"
					className={`btn public-auth-submit motion-btn motion-btn--cta motion-btn--public ${loading ? 'is-loading' : ''} ${successBridge ? 'is-success-locked' : ''}`.trim()}
					disabled={loading}
				>
					{successBridge ? t('Opening Home...') : loading ? t('Creating account...') : t("Register")}
				</button>
			</form>
		</PublicAuthShell>
	);
}
