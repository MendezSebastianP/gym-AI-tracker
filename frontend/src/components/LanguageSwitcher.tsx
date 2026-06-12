import { useTranslation } from 'react-i18next';

export default function LanguageSwitcher({ compact: _compact = false }: { compact?: boolean }) {
	const { i18n } = useTranslation();

	const changeLanguage = (lng: string) => {
		i18n.changeLanguage(lng);
		localStorage.setItem('i18nextLng', lng);
	};

	const currentLanguage = i18n.language.split('-')[0];

	return (
		<div className="lang">
			{['en', 'es', 'fr'].map(lng => (
				<button
					key={lng}
					className={currentLanguage === lng ? 'on' : ''}
					onClick={() => changeLanguage(lng)}
					aria-label={`Switch language to ${lng.toUpperCase()}`}
				>
					{lng.toUpperCase()}
				</button>
			))}
		</div>
	);
}
