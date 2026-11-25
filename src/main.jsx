import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './sensory/motion/motion.css'
import App from './App.jsx'
import { I18nProvider } from './i18n'
import { startAppShell } from './install/runtime'
import { startErrorReporting } from './errors/report'
import InstallPrompt from './install/InstallPrompt'
import OfflineBanner from './install/OfflineBanner'
import PageLoading from './components/PageLoading'
import { rememberEntryExam } from './entryExam'
import { startGoogleAnalytics } from './googleAnalytics'

startErrorReporting()
startAppShell()
rememberEntryExam()
startGoogleAnalytics()

// Stand-alone pages that work without signing in; everything else is the app.
// They load on demand, so the app's first screen does not wait for them.
const PAGES = {
  '/engineering-diagnostic': lazy(() => import('./EngineeringDiagnostic.jsx')),
  '/daily': lazy(() => import('./daily/Daily.jsx')),
}
// /sample is the app itself: signed out, the landing page opens the sample
// round on screen 1 (Landing.jsx); signed in, it is just the app.
const ROUTES = { ...PAGES, '/sample': App }
const Page = ROUTES[window.location.pathname.replace(/\/+$/, '')] || App

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <I18nProvider>
      <OfflineBanner />
      <Suspense fallback={<PageLoading />}>
        <Page />
      </Suspense>
      <InstallPrompt />
    </I18nProvider>
  </StrictMode>,
)
