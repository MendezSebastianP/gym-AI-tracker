import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { api } from '../api/client';
import { useTranslation } from 'react-i18next';
import PublicAuthShell, { AuthField } from '../components/PublicAuthShell';

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
			title={t('Create account')}
			subtitle={t('Start logging in under a minute. No card, no spam — your data stays in your own training journal.')}
			altPrompt={
				<>
					{t('Already have an account?')} <Link to="/login">{t('Login')}</Link>
				</>
			}
		>
			{error && <div className="auth-error">{error}</div>}

			<form onSubmit={handleSubmit}>
				<AuthField
					label={t('Email')}
					type="email"
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
					placeholder={t('At least 6 characters')}
					autoComplete="new-password"
					required
					minLength={6}
					disabled={loading}
					hint={<span><b className="num">{password.length}/6</b> {t('minimum characters')}</span>}
				/>

				<button
					type="submit"
					className="btn-primary auth-submit"
					disabled={loading}
					style={{ opacity: loading ? 0.7 : 1 }}
				>
					{successBridge ? t('Opening Home...') : loading ? t('Creating account...') : t('Create account')}
				</button>
			</form>
		</PublicAuthShell>
	);
}
