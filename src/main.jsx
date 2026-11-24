import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { I18nProvider } from './i18n'
import { startAppShell } from './install/runtime'
import { startErrorReporting } from './errors/report'
import InstallPrompt from './install/InstallPrompt'
import OfflineBanner from './install/OfflineBanner'
import PageLoading from './components/PageLoading'

startErrorReporting()
startAppShell()

// Stand-alone pages that work without signing in; everything else is the app.
// They load on demand, so the app's first screen does not wait for them.
const PAGES = {
  '/engineering-diagnostic': lazy(() => import('./EngineeringDiagnostic.jsx')),
  '/daily': lazy(() => import('./daily/Daily.jsx')),
}
const Page = PAGES[window.location.pathname.replace(/\/+$/, '')] || App

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
