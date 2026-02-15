import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { api } from '../api/client';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../components/LanguageSwitcher';

export default function Register() {
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);
	const { login } = useAuthStore();
	const navigate = useNavigate();
	const { t } = useTranslation();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setError('');

		try {
			const response = await api.post('/auth/register', { email, password });
			await login(response.data.access_token);
			navigate('/onboarding');
		} catch (err: any) {
			console.error('Registration error:', err);

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
		<div className="container" style={{ justifyContent: 'center', position: 'relative' }}>
			<div style={{ position: 'absolute', top: '16px', right: '16px' }}>
				<LanguageSwitcher />
			</div>
			<div style={{ marginTop: '40px' }}></div>
			<h1 className="fade-in" style={{ fontSize: '32px', marginBottom: '8px', color: 'var(--primary)' }}>Join Gym AI</h1>
			<p className="fade-in" style={{ marginBottom: '32px', color: 'var(--text-secondary)' }}>Start your journey today.</p>

			{error && (
				<div style={{
					color: 'var(--error)',
					marginBottom: '16px',
					padding: '12px',
					backgroundColor: 'rgba(255, 68, 68, 0.1)',
					borderRadius: '8px',
					border: '1px solid var(--error)'
				}}>
					{error}
				</div>
			)}

			<form onSubmit={handleSubmit} className="fade-in">
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
					<small style={{ color: 'var(--text-tertiary)', marginTop: '4px', display: 'block' }}>
						Minimum 6 characters
					</small>
				</div>

				<button
					type="submit"
					className="btn btn-primary"
					style={{ width: '100%', marginTop: '16px' }}
					disabled={loading}
				>
					{loading ? 'Creating account...' : t("Register")}
				</button>
			</form>

			<p style={{ marginTop: '24px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
				Already have an account? <Link to="/login" style={{ color: 'var(--primary)' }}>{t("Login")}</Link>
			</p>
		</div>
	);
}
