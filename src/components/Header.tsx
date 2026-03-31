import { useEffect, useState } from "react";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { Lock, Star, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/utils";
import { ShareDialog } from "@/components/ShareDialog";

type HeaderProps = {
  title: string;
  savingState?: "idle" | "saving" | "saved";
  pageId?: string | null;
  slug?: string | null;
  isPublic?: boolean;
  onPrivacyChanged?: (isPublic: boolean) => void;
  ancestors?: Array<{
    _id: string;
    title: string;
    slug: string;
    icon?: string | null;
  }>;
  locked?: boolean;
  onLockChanged?: (locked: boolean) => void;
  isStarred?: boolean;
  onStarChanged?: (starred: boolean) => void;
};

export function Header({
  title,
  savingState = "idle",
  pageId,
  slug,
  isPublic = false,
  onPrivacyChanged,
  ancestors = [],
  locked = false,
  onLockChanged,
  isStarred = false,
  onStarChanged,
}: HeaderProps) {
  const { state } = useSidebar();
  const [starred, setStarred] = useState<boolean>(!!isStarred);
  const [starBusy, setStarBusy] = useState(false);

  useEffect(() => {
    setStarred(!!isStarred);
  }, [isStarred, pageId]);

  async function toggleStar() {
    if (!pageId || starBusy) return;
    const next = !starred;
    setStarred(next);
    setStarBusy(true);
    try {
      await api(`/pages/${pageId}/star`, { method: next ? "POST" : "DELETE" });
      onStarChanged?.(next);
      try {
        window.dispatchEvent(
          new CustomEvent("page-star-toggled", {
            detail: { pageId, starred: next },
          }),
        );
      } catch {}
      try {
        window.dispatchEvent(new Event("pages-updated"));
      } catch {}
    } catch (err: unknown) {
      setStarred(!next);
      const message =
        err instanceof Error ? err.message : "Could not update star.";
      window.alert(message);
    } finally {
      setStarBusy(false);
    }
  }

  async function lockPage() {
    if (!pageId) return;
    const pwd = window.prompt("Set a password to lock this page:");
    if (!pwd) return;
    try {
      await api(`/pages/${pageId}/lock`, {
        method: "PATCH",
        body: JSON.stringify({ locked: true, password: pwd }),
      });
      onLockChanged?.(true);
      try {
        window.dispatchEvent(new Event("pages-updated"));
      } catch {}
    } catch {}
  }
  async function unlockPage() {
    if (!pageId) return;
    try {
      await api(`/pages/${pageId}/lock`, {
        method: "PATCH",
        body: JSON.stringify({ locked: false }),
      });
      onLockChanged?.(false);
      try {
        window.dispatchEvent(new Event("pages-updated"));
      } catch {}
    } catch {}
  }
  return (
    <div className="w-full flex items-center justify-between gap-2">
      <div
        className={`flex items-center gap-2 ${state !== "collapsed" ? "pl-3 sm:pl-4" : ""}`}
      >
        {state === "collapsed" ? <SidebarTrigger /> : null}
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          {Array.isArray(ancestors) && ancestors.length > 0 ? (
            <nav className="flex items-center gap-1">
              {ancestors.map((a) => (
                <span key={a._id} className="inline-flex items-center gap-1">
                  <a href={`/${a.slug}`} className="hover:underline">
                    {a.title || "Untitled"}
                  </a>
                  <span className="mx-1">/</span>
                </span>
              ))}
              <span>{title || "Untitled"}</span>
            </nav>
          ) : (
            <span>{title || "Untitled"}</span>
          )}
        </div>
        <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
          <Lock className="size-3" /> {isPublic ? "Public" : "Private"}
        </span>
        {savingState !== "idle" ? (
          <span className="text-xs text-muted-foreground ml-2">
            {savingState === "saving" ? "Saving…" : "Saved"}
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-1">
        {pageId ? (
          <button
            type="button"
            aria-pressed={starred}
            onClick={toggleStar}
            disabled={starBusy}
            className={`inline-flex items-center gap-2 px-2 py-1 text-sm transition-colors disabled:opacity-50 ${
              starred
                ? "text-amber-500 hover:text-amber-600"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Star className={`size-4 ${starred ? "fill-current" : ""}`} />
            <span className="hidden sm:inline">Star</span>
          </button>
        ) : null}
        {pageId && slug ? (
          <ShareDialog
            pageId={pageId}
            slug={slug}
            isPublic={isPublic}
            onPrivacyChanged={onPrivacyChanged}
            trigger={
              <button className="inline-flex items-center gap-2 px-2 py-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <span>Share</span>
              </button>
            }
          />
        ) : (
          <button className="inline-flex items-center gap-2 px-2 py-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <span>Share</span>
          </button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="inline-flex items-center gap-2 px-2 py-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <MoreHorizontal className="size-4" />
              <span className="hidden sm:inline">More</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {locked ? (
              <DropdownMenuItem onClick={unlockPage}>
                Unlock page
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={lockPage}>Lock page…</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
