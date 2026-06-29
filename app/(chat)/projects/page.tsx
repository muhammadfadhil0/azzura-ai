import { createClient } from '@/lib/supabase/server'
import { ProjectGrid } from '@/components/projects/project-grid'
import type { Project } from '@/types/project'

export default async function ProjectsPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('projects')
    .select('id, name, description, created_at, updated_at')
    .order('updated_at', { ascending: false })

  const projects: Project[] = (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  }))

  return <ProjectGrid initialProjects={projects} />
}
