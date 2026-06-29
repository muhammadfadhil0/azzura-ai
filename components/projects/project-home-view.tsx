"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  IconMessageCircle,
  IconBook,
  IconDots,
  IconPencil,
  IconTrash,
  IconDotsVertical,
  IconChevronDown,
  IconCheck,
  IconLayoutSidebarLeftExpand,
  IconMenu2,
  IconSettings,
} from "@tabler/icons-react";
import { ProjectIcon, PROJECT_ICONS, DEFAULT_PROJECT_ICON, type ProjectIconName } from "@/components/projects/project-icon";
import { KnowledgeBase } from "@/components/projects/knowledge-base";
import { ModelLogo } from "@/components/chat/model-logo";
import { DEFAULT_MODEL_ID, findModel, MODEL_GROUPS } from "@/lib/ai/models";
import { useSidebar } from "@/hooks/use-sidebar";
import { cn } from "@/lib/utils";
import { Loader } from "@/components/ui/loader";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useProject } from "@/components/projects/project-provider";
import { useChat } from "@/components/chat/chat-provider";
import {
  Composer,
  type ComposerHandle,
  type ComposerPayload,
} from "@/components/chat/composer";
import type { Message } from "@/types/chat";

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto)
    return crypto.randomUUID();
  return Math.random().toString(36).slice(2);
}

type Tab = "percakapan" | "knowledge";

function ConversationListItem({
  projectId,
  conversation,
}: {
  projectId: string;
  conversation: {
    id: string;
    title: string;
    updatedAt: string;
    isGeneratingTitle?: boolean;
  };
}) {
  const { renameConversation, deleteConversation } = useChat();
  const router = useRouter();
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(conversation.title);

  const handleRename = async () => {
    if (!draft.trim() || draft === conversation.title) {
      setRenaming(false);
      return;
    }
    try {
      await renameConversation(conversation.id, draft.trim());
    } catch {
    } finally {
      setRenaming(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteConversation(conversation.id);
    } catch {}
  };

  return (
    <li className="group rounded-lg hover:bg-sidebar-accent/50 transition-colors">
      <div className="flex items-start justify-between gap-2 px-3 py-2">
        <Link
          href={`/projects/${projectId}/c/${conversation.id}`}
          className="flex-1 min-w-0 py-0.5"
        >
          {renaming ? (
            <input
              className="w-full rounded border border-border bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-primary"
              value={draft}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename();
                if (e.key === "Escape") setRenaming(false);
              }}
              onBlur={handleRename}
            />
          ) : (
            <>
              <p className="truncate text-sm font-medium">
                {conversation.isGeneratingTitle ? (
                  <span className="block h-3 w-40 animate-pulse rounded bg-muted" />
                ) : (
                  conversation.title
                )}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(conversation.updatedAt).toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "short",
                })}
              </p>
            </>
          )}
        </Link>
        <div className="relative z-10 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-6 opacity-0 group-hover:opacity-100 transition-opacity flex"
                  aria-label="Conversation actions"
                  onClick={(e) => e.preventDefault()}
                >
                  <IconDotsVertical className="size-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end" side="bottom">
              <DropdownMenuItem
                className="gap-2"
                onClick={(e) => {
                  e.preventDefault();
                  setRenaming(true);
                }}
              >
                <IconPencil className="size-4" /> Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                className="gap-2 text-destructive focus:text-destructive"
                onClick={(e) => {
                  e.preventDefault();
                  handleDelete();
                }}
              >
                <IconTrash className="size-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </li>
  );
}

function ConversationList({ projectId }: { projectId: string }) {
  const { conversations, isLoadingConversations } = useChat();
  const projectConvs = conversations.filter((c) => c.projectId === projectId);

  if (isLoadingConversations) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (projectConvs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
        <IconMessageCircle className="size-8" />
        <p className="text-sm">Belum ada percakapan.</p>
        <p className="text-xs">
          Mulai chat di atas untuk membuat percakapan pertama.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-1">
      {projectConvs.map((c) => (
        <ConversationListItem
          key={c.id}
          projectId={projectId}
          conversation={c}
        />
      ))}
    </ul>
  );
}

export function ProjectHomeView({ projectId }: { projectId: string }) {
  const { project, updateProject } = useProject();
  const { createConversation, streamAssistantReply, webSearchEnabled, selectedModelId, setSelectedModelId } =
    useChat();
  const { toggleCollapsed, setMobileOpen } = useSidebar();
  const router = useRouter();
  const composerRef = useRef<ComposerHandle>(null);
  const [activeTab, setActiveTab] = useState<Tab>("percakapan");
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editIcon, setEditIcon] = useState<ProjectIconName>(DEFAULT_PROJECT_ICON);
  const [saving, setSaving] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  const openEditModal = () => {
    setEditName(project?.name ?? "");
    setEditDescription(project?.description ?? "");
    setEditIcon((project?.icon as ProjectIconName) ?? DEFAULT_PROJECT_ICON);
    setEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim() || saving) return;
    setSaving(true);
    try {
      await updateProject({
        name: editName.trim(),
        description: editDescription.trim(),
        icon: editIcon,
      });
      setEditModalOpen(false);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (editModalOpen) {
      editInputRef.current?.focus();
    }
  }, [editModalOpen]);

  const currentModel = findModel(selectedModelId) ?? findModel(DEFAULT_MODEL_ID);
  const currentLabel = currentModel?.label ?? selectedModelId;

  const handleSend = async ({
    text,
    attachments,
    webSearch,
  }: ComposerPayload) => {
    const userMessage: Message = {
      id: makeId(),
      role: "user",
      content: text,
      parentId: null,
      attachments: attachments.length > 0 ? attachments : undefined,
      createdAt: new Date().toISOString(),
    };
    try {
      const convId = await createConversation(userMessage, { projectId });
      streamAssistantReply(convId, [userMessage], { webSearch, projectId });
      router.push(`/projects/${projectId}/c/${convId}`);
    } catch {
      // ignore
    }
  };

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    {
      key: "percakapan",
      label: "Percakapan",
      icon: <IconMessageCircle className="size-4" />,
    },
    {
      key: "knowledge",
      label: "Knowledge",
      icon: <IconBook className="size-4" />,
    },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Header — model selector */}
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-2 border-b border-border/40 bg-background/80 px-3 backdrop-blur">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Open sidebar"
            onClick={() => setMobileOpen(true)}
          >
            <IconMenu2 className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hidden md:inline-flex"
            aria-label="Toggle sidebar"
            onClick={toggleCollapsed}
          >
            <IconLayoutSidebarLeftExpand className="size-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" className="gap-1.5 px-2 font-semibold">
                  {currentLabel}
                  <IconChevronDown className="size-3.5 text-muted-foreground" />
                </Button>
              }
            />
            <DropdownMenuContent align="start" className="max-h-[70vh] w-64 overflow-y-auto">
              {MODEL_GROUPS.map((group, idx) => (
                <Fragment key={group.tier}>
                  {idx > 0 ? <DropdownMenuSeparator /> : null}
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="flex items-center gap-1.5 py-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                      {group.label}
                    </DropdownMenuLabel>
                    {group.models.map((m) => (
                      <DropdownMenuItem
                        key={m.id}
                        onClick={() => setSelectedModelId(m.id)}
                        className={cn(
                          'flex items-center gap-2 py-1.5',
                          selectedModelId === m.id && 'bg-accent text-accent-foreground',
                        )}
                      >
                        <ModelLogo provider={m.provider} />
                        <span className="flex-1 text-sm">{m.label}</span>
                        {selectedModelId === m.id ? <IconCheck className="size-3.5 shrink-0" /> : null}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                </Fragment>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Composer + project info */}
      <div className="border-b border-border">
        <div className="mx-auto w-full max-w-3xl px-4">
          <div className="flex items-center gap-3 pt-5 pb-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ProjectIcon name={project?.icon} className="size-5" />
            </div>
            <div>
              <h1 className="text-base font-semibold leading-tight">
                {project?.name ?? "…"}
              </h1>
              {project?.description && (
                <p className="text-xs text-muted-foreground">{project.description}</p>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="ml-auto size-9 rounded-xl text-muted-foreground hover:text-foreground"
              aria-label="Project settings"
              onClick={openEditModal}
              disabled={!project}
            >
              <IconSettings className="size-5" />
            </Button>
          </div>
        </div>
        <div className="pb-4">
          <Composer
            ref={composerRef}
            onSend={handleSend}
            placeholder="Tanya sesuatu tentang project ini…"
            documentUploadDisabled
            autoFocus
          />
        </div>
      </div>

      {/* Tabs — mobile/tablet only */}
      <div className="flex gap-1 border-b border-border px-6 pt-2 lg:hidden">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content — mobile/tablet only */}
      <div className="flex-1 overflow-y-auto px-6 py-4 lg:hidden">
        {activeTab === "percakapan" && (
          <ConversationList projectId={projectId} />
        )}
        {activeTab === "knowledge" && <KnowledgeBase />}
      </div>

      {/* Split view — desktop only */}
      <div className="hidden flex-1 min-h-0 lg:flex">
        <section className="flex flex-col flex-1 min-w-0 border-r border-border">
          <div className="flex items-center gap-1.5 border-b border-border px-6 py-3 text-sm font-medium text-foreground">
            <IconMessageCircle className="size-4" />
            Percakapan
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <ConversationList projectId={projectId} />
          </div>
        </section>
        <section className="flex flex-col w-[40%] min-w-0">
          <div className="flex items-center gap-1.5 border-b border-border px-6 py-3 text-sm font-medium text-foreground">
            <IconBook className="size-4" />
            Knowledge
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <KnowledgeBase />
          </div>
        </section>
      </div>

      {/* Edit Project Modal */}
      {editModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setEditModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-5 text-base font-semibold">Edit Project</h2>
            <form onSubmit={handleSaveEdit} className="flex flex-col gap-4">
              {/* Icon preview */}
              <div className="flex flex-col items-center gap-3">
                <div className="flex size-16 items-center justify-center rounded-2xl border border-border bg-primary/10 text-primary">
                  <ProjectIcon name={editIcon} className="size-8" />
                </div>

                {/* Icon grid */}
                <div className="grid w-full grid-cols-6 gap-1 rounded-xl border border-border bg-muted/40 p-1.5">
                  {Object.entries(PROJECT_ICONS).map(([name, Icon]) => {
                    const iconName = name as ProjectIconName;
                    return (
                      <button
                        key={iconName}
                        type="button"
                        title={iconName.replace('Icon', '')}
                        onClick={() => setEditIcon(iconName)}
                        className={`flex aspect-square w-full items-center justify-center rounded-lg transition-colors hover:bg-sidebar-accent ${editIcon === iconName ? 'bg-primary/15 text-primary ring-1 ring-primary/40' : 'text-muted-foreground'}`}
                      >
                        <Icon className="size-5" />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Nama</label>
                <input
                  ref={editInputRef}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Nama project…"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Deskripsi <span className="text-muted-foreground/60">(opsional)</span>
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Jelaskan tujuan project ini…"
                  rows={3}
                  className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent/60 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!editName.trim() || saving}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {saving ? 'Menyimpan…' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
