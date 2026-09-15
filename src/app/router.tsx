import { Navigate, Route, Routes } from 'react-router-dom'
import CreateTabPage from '../pages/CreateTabPage'
import HomePage from '../pages/HomePage'
import OrganizerPage from '../pages/OrganizerPage'
import TabPage from '../pages/TabPage'
import PaymentResultPage from '../pages/PaymentResultPage'

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/create" element={<CreateTabPage />} />
      <Route path="/t/:slug" element={<TabPage />} />
      <Route path="/o/:slug" element={<OrganizerPage />} />
      <Route path="/payment-result/:slug/:slotId" element={<PaymentResultPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
