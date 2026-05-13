import React from 'react';
import { reportError } from '../utils/reportError';

interface State {
	hasError: boolean;
	error?: Error;
}

interface Props {
	children: React.ReactNode;
}

export default class ErrorBoundary extends React.Component<Props, State> {
	state: State = { hasError: false };

	static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, info: React.ErrorInfo) {
		reportError(error, {
			context: { type: 'react.errorBoundary', componentStack: info.componentStack },
		});
	}

	handleReload = () => {
		this.setState({ hasError: false, error: undefined });
		window.location.reload();
	};

	render() {
		if (!this.state.hasError) return this.props.children;
		return (
			<div style={{
				padding: '24px',
				maxWidth: 520,
				margin: '40px auto',
				fontFamily: 'inherit',
				color: 'var(--text-primary)',
				background: 'var(--bg-secondary)',
				border: '1px solid var(--border)',
				borderRadius: 12,
				textAlign: 'center',
			}}>
				<h2 style={{ marginTop: 0 }}>Something went wrong</h2>
				<p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
					The error has been reported. You can try reloading the page.
				</p>
				{this.state.error?.message && (
					<pre style={{
						textAlign: 'left',
						background: 'var(--bg-tertiary)',
						padding: 12,
						borderRadius: 8,
						fontSize: 12,
						overflowX: 'auto',
						color: 'var(--text-tertiary)',
					}}>{this.state.error.message}</pre>
				)}
				<button
					onClick={this.handleReload}
					style={{
						marginTop: 12,
						padding: '8px 16px',
						background: 'var(--accent)',
						color: '#000',
						border: 'none',
						borderRadius: 8,
						cursor: 'pointer',
						fontWeight: 600,
					}}
				>Reload</button>
			</div>
		);
	}
}
