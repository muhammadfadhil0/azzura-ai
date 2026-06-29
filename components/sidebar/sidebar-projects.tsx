"use client";

import Link from "next/link";
import { IconFolder } from "@tabler/icons-react";

export function SidebarProjects() {
  return (
    <div className="px-2 pb-2">
      <Link
        href="/projects"
        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-foreground hover:bg-sidebar-accent/60 transition-colors"
      >
        <IconFolder className="size-4 shrink-0" />
        <span>Projects</span>
      </Link>
    </div>
  );
}
