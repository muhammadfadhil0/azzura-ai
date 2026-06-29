import { ProjectHomeView } from '@/components/projects/project-home-view'

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <ProjectHomeView projectId={id} />
}
