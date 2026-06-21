import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { FullScreenLoader } from '@/components/ui/Spinner'

// Páginas carregadas sob demanda (code-splitting) para um bundle inicial leve.
const Login = lazy(() => import('@/pages/Login').then((m) => ({ default: m.Login })))
const Dashboard = lazy(() => import('@/pages/Dashboard').then((m) => ({ default: m.Dashboard })))
const Produtos = lazy(() => import('@/pages/Produtos').then((m) => ({ default: m.Produtos })))
const NovaVenda = lazy(() => import('@/pages/NovaVenda').then((m) => ({ default: m.NovaVenda })))
const Movimentacoes = lazy(() =>
  import('@/pages/Movimentacoes').then((m) => ({ default: m.Movimentacoes })),
)
const Repasses = lazy(() => import('@/pages/Repasses').then((m) => ({ default: m.Repasses })))
const Relatorios = lazy(() => import('@/pages/Relatorios').then((m) => ({ default: m.Relatorios })))
const Configuracoes = lazy(() =>
  import('@/pages/Configuracoes').then((m) => ({ default: m.Configuracoes })),
)

function protect(node: React.ReactNode) {
  return <ProtectedRoute>{node}</ProtectedRoute>
}

export default function App() {
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={protect(<Dashboard />)} />
        <Route path="/produtos" element={protect(<Produtos />)} />
        <Route path="/vendas/nova" element={protect(<NovaVenda />)} />
        <Route path="/movimentacoes" element={protect(<Movimentacoes />)} />
        <Route path="/repasses" element={protect(<Repasses />)} />
        <Route path="/relatorios" element={protect(<Relatorios />)} />
        <Route path="/configuracoes" element={protect(<Configuracoes />)} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
