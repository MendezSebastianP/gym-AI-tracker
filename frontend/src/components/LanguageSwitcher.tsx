import { useTranslation } from 'react-i18next';

export default function LanguageSwitcher() {
	const { i18n } = useTranslation();

	const changeLanguage = (lng: string) => {
		i18n.changeLanguage(lng);
		localStorage.setItem('i18nextLng', lng);
	};

	return (
		<div style={{ display: 'flex', gap: '8px', zIndex: 100 }}>
			{['en', 'es', 'fr'].map(lng => (
				<button
					key={lng}
					onClick={() => {
						if (lng === 'en') changeLanguage(lng);
					}}
					disabled={lng !== 'en'}
					style={{
						background: 'none',
						border: 'none',
						color: i18n.language === lng ? 'var(--primary)' : 'var(--text-secondary)',
						fontWeight: i18n.language === lng ? 'bold' : 'normal',
						cursor: lng === 'en' ? 'pointer' : 'not-allowed',
						fontSize: '14px',
						padding: '4px',
						opacity: lng === 'en' ? 1 : 0.5,
						display: 'flex',
						alignItems: 'center',
						gap: '4px'
					}}
					title={lng !== 'en' ? 'Coming soon' : undefined}
				>
					{lng.toUpperCase()}
					{lng !== 'en' && <span style={{ fontSize: '10px', opacity: 0.7 }}>(Soon)</span>}
				</button>
			))}
		</div>
	);
}
