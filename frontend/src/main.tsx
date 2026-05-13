import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary';
import { installGlobalErrorHandlers } from './lib/reportError';
import './index.css';
import './motion/motion.css';
import './i18n';

console.log("App Version: v2 (Relative API Path)");

installGlobalErrorHandlers();

ReactDOM.createRoot(document.getElementById('root')!).render(
	<React.StrictMode>
		<ErrorBoundary>
			<BrowserRouter>
				<App />
			</BrowserRouter>
		</ErrorBoundary>
	</React.StrictMode>,
)
