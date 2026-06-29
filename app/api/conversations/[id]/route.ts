import type { NextRequest } from 'next/server'

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<'/api/conversations/[id]'>,
) {
  const { id } = await ctx.params
  return Response.json({ id })
}

export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext<'/api/conversations/[id]'>,
) {
  const { id } = await ctx.params
  return Response.json({ id, deleted: true })
}
