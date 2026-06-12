import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './LanguageSwitcher';
import PublicLegalLinks from './PublicLegalLinks';
import KairosLogo from './KairosLogo';
import './PublicAuthShell.css';

interface PublicAuthShellProps {
	eyebrow: string;
	title: string;
	subtitle: string;
	altPrompt: ReactNode;
	children: ReactNode;
	cardClassName?: string;
}

/** Labelled auth input with optional show/hide-password toggle. */
export function AuthField({
	label,
	type = 'text',
	value,
	onChange,
	placeholder,
	autoComplete,
	hint,
	required,
	disabled,
	minLength,
}: {
	label: string;
	type?: string;
	value: string;
	onChange: (v: string) => void;
	placeholder?: string;
	autoComplete?: string;
	hint?: ReactNode;
	required?: boolean;
	disabled?: boolean;
	minLength?: number;
}) {
	const [show, setShow] = useState(false);
	const isPw = type === 'password';
	return (
		<div className="afield">
			<label>{label}</label>
			<div className={`afield-box ${isPw ? 'has-toggle' : ''}`}>
				<input
					type={isPw && show ? 'text' : type}
					value={value}
					onChange={(e) => onChange(e.target.value)}
					placeholder={placeholder}
					autoComplete={autoComplete}
					spellCheck="false"
					required={required}
					disabled={disabled}
					minLength={minLength}
				/>
				{isPw && (
					<button
						className="pw-toggle"
						type="button"
						onClick={() => setShow((s) => !s)}
						aria-label={show ? 'Hide password' : 'Show password'}
					>
						{show ? <EyeOff size={19} /> : <Eye size={19} />}
					</button>
				)}
			</div>
			{hint && <div className="afield-hint">{hint}</div>}
		</div>
	);
}

export default function PublicAuthShell({
	eyebrow,
	title,
	subtitle,
	altPrompt,
	children,
	cardClassName = '',
}: PublicAuthShellProps) {
	const { t } = useTranslation();

	return (
		<div className="public-auth-page">
			<div className={`auth-col ${cardClassName}`.trim()}>
				<div className="topbar">
					<Link to="/" aria-label="Kairos lift home">
						<KairosLogo size="sm" />
					</Link>
					<span className="spacer" />
					<LanguageSwitcher />
				</div>

				<Link to="/" className="backchip" style={{ alignSelf: 'flex-start' }}>
					<ArrowLeft size={16} />
					{t('Home')}
				</Link>

				<div className="auth-head" style={{ marginTop: 18 }}>
					<span className="welcome">{eyebrow}</span>
					<div className="auth-title">{title}</div>
					<p className="auth-sub">{subtitle}</p>
				</div>

				{children}

				<div className="auth-alt">{altPrompt}</div>

				<div className="legalfoot">
					<span className="lf-brand mono">Kairos lift · {t('Offline-first training log')}</span>
					<div className="lf-links">
						<PublicLegalLinks centered compact />
					</div>
				</div>
			</div>
		</div>
	);
}
