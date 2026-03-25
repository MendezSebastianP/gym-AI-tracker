import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FlaskConical } from 'lucide-react';
import { useState } from 'react';
import DayTemplates from '../components/playground/DayTemplates';
import SmartAutoFill from '../components/playground/SmartAutoFill';
import CopyDay from '../components/playground/CopyDay';
import ImportFromSessions from '../components/playground/ImportFromSessions';
import MostUsed from '../components/playground/MostUsed';
import ByEquipment from '../components/playground/ByEquipment';

const TABS = [
	'Day Templates',
	'Smart Auto-Fill',
	'Copy Day',
	'Import Sessions',
	'Most Used',
	'By Equipment',
] as const;
type Tab = typeof TABS[number];

const TAB_META: Record<Tab, { title: string; description: string }> = {
	'Day Templates': {
		title: 'Day Templates',
		description: 'One-tap quick-fill — pick a template, get a full day of exercises from your library instantly.',
	},
	'Smart Auto-Fill': {
		title: 'Smart Auto-Fill',
		description: 'Type a day name — Push, Pull, Leg Day — and matching exercises appear automatically.',
	},
	'Copy Day': {
		title: 'Copy Day',
		description: 'Duplicate any day\'s exercise list. Useful for A/B alternating routines.',
	},
	'Import Sessions': {
		title: 'Import from Sessions',
		description: 'Pull exercises from a past workout, with sets/reps pre-filled from your actual performance.',
	},
	'Most Used': {
		title: 'Most Used',
		description: 'Your most-performed exercises across all sessions — one tap to add.',
	},
	'By Equipment': {
		title: 'By Equipment',
		description: 'Select the equipment you have available and get a balanced day using only those tools.',
	},
};

export default function Playground() {
	const navigate = useNavigate();
	const [activeTab, setActiveTab] = useState<Tab>('Day Templates');

	const meta = TAB_META[activeTab];

	return (
		<div className="container fade-in" style={{ paddingBottom: '96px' }}>
			{/* Header */}
			<div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
				<button onClick={() => navigate(-1)} style={{
					background: 'transparent', border: 'none', cursor: 'pointer',
					display: 'flex', alignItems: 'center', padding: '4px', color: 'var(--text-secondary)'
				}}>
					<ArrowLeft size={24} />
				</button>
				<FlaskConical size={24} color="var(--primary)" />
				<h1 style={{ fontSize: '20px', fontWeight: 'bold' }}>Playground</h1>
			</div>

			{/* Horizontally scrollable tab bar */}
			<div style={{
				display: 'flex', gap: '6px', marginBottom: '20px',
				overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none',
			}}>
				{TABS.map(tab => (
					<button
						key={tab}
						onClick={() => setActiveTab(tab)}
						style={{
							flexShrink: 0, padding: '7px 14px', borderRadius: '20px', border: 'none',
							fontSize: '12px', fontWeight: 600, cursor: 'pointer',
							background: activeTab === tab ? 'var(--primary)' : 'var(--bg-secondary)',
							color: activeTab === tab ? '#000' : 'var(--text-tertiary)',
							transition: 'all 0.15s',
						}}
					>
						{tab}
					</button>
				))}
			</div>

			{/* Tab header */}
			<div style={{ marginBottom: '16px' }}>
				<h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '4px' }}>{meta.title}</h2>
				<p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: 0, lineHeight: 1.5 }}>{meta.description}</p>
			</div>

			{/* Tab content */}
			{activeTab === 'Day Templates' && <DayTemplates />}
			{activeTab === 'Smart Auto-Fill' && <SmartAutoFill />}
			{activeTab === 'Copy Day' && <CopyDay />}
			{activeTab === 'Import Sessions' && <ImportFromSessions />}
			{activeTab === 'Most Used' && <MostUsed />}
			{activeTab === 'By Equipment' && <ByEquipment />}
		</div>
	);
}
