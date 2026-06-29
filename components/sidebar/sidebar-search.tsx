"use client";

import { useState } from "react";
import { IconSearch } from "@tabler/icons-react";
import { SearchDialog } from "@/components/sidebar/search-dialog";

export function SidebarSearch() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="px-2">
        <button
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-foreground hover:bg-sidebar-accent/60 transition-colors"
        >
          <IconSearch className="size-4 shrink-0" />
          <span>Search chats</span>
        </button>
      </div>
      <SearchDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
