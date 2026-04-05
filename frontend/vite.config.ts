import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
	build: {
		rollupOptions: {
			output: {
				manualChunks: {
					react: ['react', 'react-dom', 'react-router-dom'],
					data: ['axios', 'dexie', 'dexie-react-hooks', 'zustand'],
					i18n: ['i18next', 'react-i18next'],
					charts: ['recharts', 'date-fns'],
					dnd: ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
					icons: ['lucide-react'],
				},
			},
		},
	},
	plugins: [
		react(),
		VitePWA({
			registerType: 'prompt',
			includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
			manifest: {
				name: 'Kairos lift',
				short_name: 'Kairos',
				description: 'Offline-first training journal. Seize the moment.',
				theme_color: '#ffffff',
				background_color: '#ffffff',
				display: 'standalone',
				scope: '/',
				start_url: '/',
				orientation: 'portrait',
				icons: [
					{
						src: 'pwa-192x192.png',
						sizes: '192x192',
						type: 'image/png'
					},
					{
						src: 'pwa-512x512.png',
						sizes: '512x512',
						type: 'image/png'
					},
					{
						src: 'pwa-512x512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'any maskable'
					}
				]
			}
		})
	],
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src'),
		},
	},
	server: {
		host: '0.0.0.0',
		port: 5173,
		watch: {
			usePolling: true
		},
		hmr: {
			overlay: false
		},
		allowedHosts: [
			'gym-ai-tracker.duckdns.org',
			'.duckdns.org', // allow all duckdns subdomains
			'kairos.sebmendez.dev',
			'localhost',
			'192.168.1.45',
		],
		proxy: {
			'/api': {
				target: 'http://api:8000',
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/api/, '/api')
			}
		}
	}
})
