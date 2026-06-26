import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-2 pt-18 bg-background">
      <h1 className="text-2xl">404</h1>
      <p className="text-muted-foreground">Page not found.</p>
      <Link to="/projects" className="text-primary">
        Back to Projects
      </Link>
    </div>
  )
}
