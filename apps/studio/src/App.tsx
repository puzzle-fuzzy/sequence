import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './pages/Layout.tsx'
import { AuthGate } from '@/components/AuthGate'

const Playground = lazy(() => import('./pages/Playground.tsx'))
const Projects = lazy(() => import('./pages/Projects.tsx'))
const Canvas = lazy(() => import('./pages/Canvas.tsx'))
const NotFound = lazy(() => import('./pages/NotFound.tsx'))

function Loading() {
  return <div className="flex items-center justify-center min-h-screen text-muted-foreground">Loading...</div>
}

export default function App() {
  return (
    <AuthGate>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/projects" replace />} />
            <Route path="playground" element={<Playground />} />
            <Route path="projects" element={<Projects />} />
            <Route path="projects/:id" element={<Canvas />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </AuthGate>
  )
}
