import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import { RefreshCw, Trash2 } from 'lucide-react';

interface ErrorRow {
	id: number;
	created_at: string;
	user_id: number | null;
	source: string;
	level: string;
	message: string;
	stack: string | null;
	url: string | null;
	user_agent: string | null;
	context: Record<string, any> | null;
}

export default function AdminErrors() {
	const [rows, setRows] = useState<ErrorRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [sourceFilter, setSourceFilter] = useState<string>('');
	const [levelFilter, setLevelFilter] = useState<string>('');
	const [expandedId, setExpandedId] = useState<number | null>(null);

	const fetchRows = useCallback(async () => {
		setLoading(true);
		setError('');
		try {
			const params = new URLSearchParams();
			params.set('limit', '200');
			if (sourceFilter) params.set('source', sourceFilter);
			if (levelFilter) params.set('level', levelFilter);
			const res = await api.get(`/_errors?${params.toString()}`);
			setRows(res.data);
		} catch (err: any) {
			setError('Failed to load error log. Admin access required.');
		} finally {
			setLoading(false);
		}
	}, [sourceFilter, levelFilter]);

	useEffect(() => { fetchRows(); }, [fetchRows]);

	const purgeOld = async () => {
		if (!confirm('Delete all errors older than 30 days?')) return;
		try {
			await api.delete('/_errors?older_than_days=30');
			fetchRows();
		} catch {
			alert('Failed to purge — admin only?');
		}
	};

	return (
		<div>
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
				<h2 style={{ margin: 0 }}>Error Log</h2>
				<div style={{ display: 'flex', gap: 8 }}>
					<button className="btn btn-ghost" onClick={fetchRows}><RefreshCw size={14} /> Refresh</button>
					<button className="btn btn-ghost" onClick={purgeOld}><Trash2 size={14} /> Purge &gt;30d</button>
				</div>
			</div>

			<div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
				<select className="input" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} style={{ width: 'auto' }}>
					<option value="">All sources</option>
					<option value="frontend">frontend</option>
					<option value="backend">backend</option>
				</select>
				<select className="input" value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)} style={{ width: 'auto' }}>
					<option value="">All levels</option>
					<option value="error">error</option>
					<option value="warn">warn</option>
					<option value="info">info</option>
				</select>
			</div>

			{loading && <div className="loading-spinner" style={{ margin: '20px auto' }}></div>}
			{error && <div style={{ color: 'var(--error)' }}>{error}</div>}

			{!loading && !error && (
				<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
					{rows.length === 0 && <div style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: 24 }}>No errors recorded.</div>}
					{rows.map(row => (
						<div
							key={row.id}
							className="card"
							style={{ padding: 12, cursor: 'pointer' }}
							onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
						>
							<div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
								<div style={{ flex: 1, minWidth: 0 }}>
									<div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
										<span style={{
											fontSize: 11, padding: '2px 6px', borderRadius: 4,
											background: row.source === 'frontend' ? 'rgba(99,102,241,0.15)' : 'rgba(245,158,11,0.15)',
											color: row.source === 'frontend' ? 'var(--accent)' : '#f59e0b',
										}}>{row.source}</span>
										<span style={{
											fontSize: 11, padding: '2px 6px', borderRadius: 4,
											background: row.level === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(156,163,175,0.15)',
											color: row.level === 'error' ? '#ef4444' : 'var(--text-secondary)',
										}}>{row.level}</span>
										<span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{new Date(row.created_at).toLocaleString()}</span>
										{row.user_id != null && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>user #{row.user_id}</span>}
									</div>
									<div style={{ fontSize: 13, color: 'var(--text-primary)', wordBreak: 'break-word' }}>{row.message}</div>
									{row.url && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2, wordBreak: 'break-all' }}>{row.url}</div>}
								</div>
							</div>
							{expandedId === row.id && (
								<div style={{ marginTop: 10, fontSize: 11, fontFamily: 'monospace' }}>
									{row.stack && (
										<>
											<div style={{ color: 'var(--text-tertiary)', marginTop: 6, marginBottom: 4 }}>STACK</div>
											<pre style={{
												background: 'var(--bg-tertiary)', padding: 8, borderRadius: 6,
												overflowX: 'auto', whiteSpace: 'pre-wrap', margin: 0,
												color: 'var(--text-secondary)', maxHeight: 240,
											}}>{row.stack}</pre>
										</>
									)}
									{row.context && (
										<>
											<div style={{ color: 'var(--text-tertiary)', marginTop: 8, marginBottom: 4 }}>CONTEXT</div>
											<pre style={{
												background: 'var(--bg-tertiary)', padding: 8, borderRadius: 6,
												overflowX: 'auto', whiteSpace: 'pre-wrap', margin: 0,
												color: 'var(--text-secondary)',
											}}>{JSON.stringify(row.context, null, 2)}</pre>
										</>
									)}
									{row.user_agent && (
										<div style={{ color: 'var(--text-tertiary)', marginTop: 8, wordBreak: 'break-all' }}>
											UA: <span style={{ color: 'var(--text-secondary)' }}>{row.user_agent}</span>
										</div>
									)}
								</div>
							)}
						</div>
					))}
				</div>
			)}
		</div>
	);
}
