import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import EngineeringDiagnostic from './EngineeringDiagnostic.jsx'
import Daily from './daily/Daily.jsx'
import { I18nProvider } from './i18n'

// Stand-alone pages that work without signing in; everything else is the app.
const PAGES = {
  '/engineering-diagnostic': EngineeringDiagnostic,
  '/daily': Daily,
}
const Page = PAGES[window.location.pathname.replace(/\/+$/, '')] || App

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <I18nProvider>
      <Page />
    </I18nProvider>
  </StrictMode>,
)
