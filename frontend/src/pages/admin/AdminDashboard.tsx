import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { Activity, DollarSign, Database, Users, TrendingUp, RefreshCw } from 'lucide-react';

interface AIReportData {
	financials: {
		total_cost_usd: number;
		total_tokens: number;
	};
	conversion: {
		total_generations: number;
		total_saved: number;
		conversion_rate_percentage: number;
		average_retention_percentage: number;
	};
	top_users: Array<{
		email: string;
		generations: number;
		total_cost: number;
	}>;
}

export default function AdminDashboard() {
	const [reportData, setReportData] = useState<AIReportData | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');

	const fetchReport = async () => {
		setLoading(true);
		setError('');
		try {
			const res = await api.get('/admin/ai/report');
			setReportData(res.data);
		} catch (err: any) {
			console.error('Failed to fetch AI report:', err);
			setError('Could not load AI analytics. Ensure you have admin privileges.');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchReport();
	}, []);

	if (loading) {
		return <div className="loading-spinner" style={{ margin: '40px auto' }}></div>;
	}

	if (error) {
		return <div style={{ color: 'var(--error)' }}>{error}</div>;
	}

	if (!reportData) return null;

	const { financials, conversion, top_users } = reportData;

	return (
		<div>
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
				<h1 style={{ color: 'var(--primary)', margin: 0 }}>AI Tracking & Analytics</h1>
				<button onClick={fetchReport} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
					<RefreshCw size={16} /> Refresh Data
				</button>
			</div>

			<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '32px' }}>
				{/* Financials */}
				<div className="admin-card" style={{ marginBottom: 0 }}>
					<div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', color: 'var(--text-secondary)' }}>
						<DollarSign size={20} />
						<h3 style={{ margin: 0, fontWeight: 500 }}>Total AI Cost</h3>
					</div>
					<div style={{ fontSize: '36px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
						${financials.total_cost_usd.toFixed(2)}
					</div>
					<div style={{ fontSize: '14px', color: 'var(--text-tertiary)', marginTop: '8px' }}>
						USD Billed by OpenAI
					</div>
				</div>

				<div className="admin-card" style={{ marginBottom: 0 }}>
					<div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', color: 'var(--text-secondary)' }}>
						<Database size={20} />
						<h3 style={{ margin: 0, fontWeight: 500 }}>Total Tokens Input</h3>
					</div>
					<div style={{ fontSize: '36px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
						{financials.total_tokens.toLocaleString()}
					</div>
					<div style={{ fontSize: '14px', color: 'var(--text-tertiary)', marginTop: '8px' }}>
						Prompt + Completion Tokens
					</div>
				</div>

				{/* Conversion */}
				<div className="admin-card" style={{ marginBottom: 0 }}>
					<div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', color: 'var(--text-secondary)' }}>
						<TrendingUp size={20} />
						<h3 style={{ margin: 0, fontWeight: 500 }}>Conversion Rate</h3>
					</div>
					<div style={{ fontSize: '36px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
						{conversion.conversion_rate_percentage.toFixed(1)}%
					</div>
					<div style={{ fontSize: '14px', color: 'var(--text-tertiary)', marginTop: '8px' }}>
						{conversion.total_saved} saved out of {conversion.total_generations} generated
					</div>
				</div>

				<div className="admin-card" style={{ marginBottom: 0 }}>
					<div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', color: 'var(--text-secondary)' }}>
						<Activity size={20} />
						<h3 style={{ margin: 0, fontWeight: 500 }}>AI Retention Value</h3>
					</div>
					<div style={{ fontSize: '36px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
						{conversion.average_retention_percentage.toFixed(1)}%
					</div>
					<div style={{ fontSize: '14px', color: 'var(--text-tertiary)', marginTop: '8px' }}>
						Average exercise retention from AI drafts
					</div>
				</div>
			</div>

			<div className="admin-card">
				<div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
					<Users size={20} color="var(--primary)" />
					<h3 style={{ margin: 0 }}>Top AI Users</h3>
				</div>

				{top_users.length === 0 ? (
					<p style={{ color: 'var(--text-tertiary)' }}>No AI usage recorded yet.</p>
				) : (
					<div style={{ overflowX: 'auto' }}>
						<table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
							<thead>
								<tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
									<th style={{ padding: '12px 0', fontWeight: 500 }}>User Email</th>
									<th style={{ padding: '12px 0', fontWeight: 500 }}>Total Generations</th>
									<th style={{ padding: '12px 0', fontWeight: 500 }}>Total Cost (USD)</th>
								</tr>
							</thead>
							<tbody>
								{top_users.map((user, idx) => (
									<tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
										<td style={{ padding: '16px 0', color: 'var(--text-primary)' }}>{user.email}</td>
										<td style={{ padding: '16px 0', color: 'var(--text-primary)' }}>{user.generations}</td>
										<td style={{ padding: '16px 0', color: 'var(--error)', fontWeight: 500 }}>${user.total_cost.toFixed(4)}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</div>
	);
}
