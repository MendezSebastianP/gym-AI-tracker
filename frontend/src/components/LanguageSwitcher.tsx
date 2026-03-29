import { useTranslation } from 'react-i18next';

export default function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
	const { i18n } = useTranslation();

	const changeLanguage = (lng: string) => {
		i18n.changeLanguage(lng);
		localStorage.setItem('i18nextLng', lng);
	};

	const currentLanguage = i18n.language.split('-')[0];

	return (
		<div
			style={{
				display: 'inline-flex',
				gap: compact ? '4px' : '8px',
				padding: compact ? '4px' : '0',
				borderRadius: '999px',
				background: compact ? 'color-mix(in srgb, var(--bg-secondary) 92%, transparent)' : 'transparent',
				border: compact ? '1px solid var(--border)' : 'none',
				zIndex: 100,
			}}
		>
			{['en', 'es', 'fr'].map(lng => (
				<button
					key={lng}
					onClick={() => changeLanguage(lng)}
					style={{
						background: currentLanguage === lng
							? 'color-mix(in srgb, var(--primary-glow) 82%, transparent)'
							: 'transparent',
						border: currentLanguage === lng
							? '1px solid var(--primary-border)'
							: '1px solid transparent',
						color: currentLanguage === lng ? 'var(--primary)' : 'var(--text-secondary)',
						fontWeight: currentLanguage === lng ? 700 : 600,
						cursor: 'pointer',
						fontSize: compact ? '12px' : '14px',
						padding: compact ? '6px 9px' : '4px',
						borderRadius: compact ? '999px' : '6px',
						display: 'flex',
						alignItems: 'center',
						gap: '4px',
						transition: 'background 0.2s ease, color 0.2s ease, border-color 0.2s ease',
					}}
					aria-label={`Switch language to ${lng.toUpperCase()}`}
				>
					{lng.toUpperCase()}
				</button>
			))}
		</div>
	);
}
