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
					onClick={() => changeLanguage(lng)}
					style={{
						background: 'none',
						border: 'none',
						color: i18n.language === lng ? 'var(--primary)' : 'var(--text-secondary)',
						fontWeight: i18n.language === lng ? 'bold' : 'normal',
						cursor: 'pointer',
						fontSize: '14px',
						padding: '4px'
					}}
				>
					{lng.toUpperCase()}
				</button>
			))}
		</div>
	);
}
