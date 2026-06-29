import { ProjectProvider } from '@/components/projects/project-provider'

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <ProjectProvider projectId={id}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {children}
      </div>
    </ProjectProvider>
  )
}
