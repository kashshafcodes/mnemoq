import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import EngineeringDiagnostic from './EngineeringDiagnostic.jsx'
import { I18nProvider } from './i18n'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <I18nProvider>
      {window.location.pathname === '/engineering-diagnostic' ? <EngineeringDiagnostic /> : <App />}
    </I18nProvider>
  </StrictMode>,
)
