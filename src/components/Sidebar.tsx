import {
  Calendar,
  Home,
  Inbox,
  Search,
  Settings,
  User2,
  MoreHorizontal,
  SquarePen,
  FileText,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { Lock } from "lucide-react";
import {
  Sidebar as ShadSidebar,
  SidebarContent,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/utils";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { SidebarFooter } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SettingsDialog } from "@/components/SettingsDialog";
import { Skeleton } from "@/components/ui/skeleton";

const items = [
  { title: "Home", icon: Home },
  { title: "Inbox", icon: Inbox },
  { title: "Calendar", icon: Calendar },
  { title: "Search", icon: Search },
  { title: "Settings", icon: Settings },
];

type PageItem = {
  _id: string;
  title: string;
  slug: string;
  icon?: string | null;
  parentId?: string | null;
  locked?: boolean;
  favorite?: boolean;
};
type PageNode = PageItem & { children: PageNode[] };

function buildTree(items: PageItem[]): PageNode[] {
  const map = new Map<string, PageNode>();
  const roots: PageNode[] = [];
  for (const p of items) map.set(p._id, { ...p, children: [] });
  for (const p of items) {
    const node = map.get(p._id)!;
    if (p.parentId && map.has(p.parentId))
      map.get(p.parentId)!.children.push(node);
    else roots.push(node);
  }
  const sortNodes = (arr: PageNode[]) => {
    arr.sort((a, b) => a.title.localeCompare(b.title));
    arr.forEach((n) => sortNodes(n.children));
  };
  sortNodes(roots);
  return roots;
}

function TreeRow({
  node,
  depth,
  expanded,
  setExpanded,
  onDelete,
}: {
  node: PageNode;
  depth: number;
  expanded: Record<string, boolean>;
  setExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onDelete: (id: string) => void;
}) {
  const hasChildren = node.children && node.children.length > 0;
  const isOpen = !!expanded[node._id];
  return (
    <>
      <SidebarMenuItem className="group/row flex items-center">
        <div className="relative flex items-center w-full px-1 rounded-md hover:bg-accent/60">
          <div className="mr-2 w-4 shrink-0 flex items-center justify-center">
            {node.icon ? (
              <span className="inline-flex items-center justify-center h-4 text-base leading-none group-hover/row:hidden">
                {node.icon}
              </span>
            ) : (
              <FileText className="group-hover/row:hidden" />
            )}
            <button
              type="button"
              aria-label={isOpen ? "Collapse" : "Expand"}
              className="hidden group-hover/row:inline-flex p-0.5 rounded hover:bg-muted"
              onClick={() =>
                setExpanded((prev) => ({
                  ...prev,
                  [node._id]: !prev[node._id],
                }))
              }
            >
              {isOpen ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
            </button>
          </div>

          <SidebarMenuButton asChild>
            <Link
              to={`/${node.slug}`}
              className="flex-1 inline-flex items-center min-w-0"
            >
              <span className="truncate">{node.title}</span>
            </Link>
          </SidebarMenuButton>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="ml-auto mr-1 p-1 rounded hover:bg-muted opacity-0 group-hover/row:opacity-100 transition-opacity"
                aria-label="Page options"
              >
                <MoreHorizontal className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onDelete(node._id)}>
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </SidebarMenuItem>
      {isOpen ? (
        hasChildren ? (
          <div className="ml-5">
            {node.children.map((child: PageNode) => (
              <TreeRow
                key={child._id}
                node={child}
                depth={depth + 1}
                expanded={expanded}
                setExpanded={setExpanded}
                onDelete={onDelete}
              />
            ))}
          </div>
        ) : (
          <div className="ml-5 pl-2 py-1 text-xs text-muted-foreground">
            No pages inside
          </div>
        )
      ) : null}
    </>
  );
}
type SharedLinkItem = {
  pageId: string;
  slug: string;
  token?: string | null;
  title: string;
  addedAt: string;
  ownerId?: string;
  ownerName?: string;
  icon?: string | null;
};
type OwnerSharedItem = {
  _id: string;
  title: string;
  slug: string;
  updatedAt?: string;
};

type PageStarToggleDetail = {
  pageId?: string;
  starred?: boolean;
};

function getFavoriteOverrides(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem("sidebar.favoriteOverrides");
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function setFavoriteOverrides(overrides: Record<string, boolean>) {
  try {
    localStorage.setItem(
      "sidebar.favoriteOverrides",
      JSON.stringify(overrides),
    );
  } catch {}
}

function resolveUserId(user: any): string {
  if (!user || typeof user !== "object") return "";
  if (user._id) return String(user._id);
  if (user.id) return String(user.id);
  return "";
}

export function AppSidebar() {
  const { state } = useSidebar();
  const getSectionOpen = (key: string, fallback: boolean) => {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return fallback;
      return raw === "1";
    } catch {
      return fallback;
    }
  };
  const [pages, setPages] = useState<PageItem[]>([]);
  const [loadingPages, setLoadingPages] = useState<boolean>(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [shared, setShared] = useState<SharedLinkItem[]>([]);
  const [sharedByMe, setSharedByMe] = useState<OwnerSharedItem[]>([]);
  const [recentsOpen, setRecentsOpen] = useState<boolean>(() =>
    getSectionOpen("sidebar.recentsOpen", false),
  );
  const [favoritesOpen, setFavoritesOpen] = useState<boolean>(() =>
    getSectionOpen("sidebar.favoritesOpen", true),
  );
  const [agentsOpen, setAgentsOpen] = useState<boolean>(() =>
    getSectionOpen("sidebar.agentsOpen", true),
  );
  const [sharedOpen, setSharedOpen] = useState<boolean>(() =>
    getSectionOpen("sidebar.sharedOpen", true),
  );
  const [privateOpen, setPrivateOpen] = useState<boolean>(() =>
    getSectionOpen("sidebar.privateOpen", true),
  );
  const [recentVersion, setRecentVersion] = useState<number>(0);
  const [username, setUsername] = useState<string>("");
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [hideLocked, setHideLocked] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem("hideLocked");
      // Default to hiding locked pages when not previously set
      return v == null ? true : v === "1";
    } catch {
      return true;
    }
  });
  const navigate = useNavigate();
  const location = useLocation();

  const recentPages = (() => {
    // Recompute when recentVisited changes (via recentVersion updates).
    if (recentVersion < -1) return [];
    const bySlug = new Map<string, PageItem>();
    for (const p of pages) {
      // Private pages stay in the Private section.
      if (!p.locked) bySlug.set(p.slug, p);
    }

    try {
      const raw = localStorage.getItem("recentVisited");
      const list: Array<{ slug: string; ts: number }> = raw
        ? JSON.parse(raw)
        : [];
      const orderedUniqueSlugs: string[] = [];
      for (const item of list) {
        if (!item?.slug) continue;
        if (!orderedUniqueSlugs.includes(item.slug))
          orderedUniqueSlugs.push(item.slug);
      }
      return orderedUniqueSlugs
        .map((slug) => bySlug.get(slug))
        .filter((p): p is PageItem => !!p);
    } catch {
      return [];
    }
  })();

  function markRecentSlug(slug: string) {
    try {
      const raw = localStorage.getItem("recentVisited");
      const list: Array<{ slug: string; ts: number }> = raw
        ? JSON.parse(raw)
        : [];
      const now = Date.now();
      const next = [
        { slug, ts: now },
        ...list.filter((e) => e && e.slug !== slug),
      ].slice(0, 30);
      localStorage.setItem("recentVisited", JSON.stringify(next));
      try {
        window.dispatchEvent(new Event("recent-updated"));
      } catch {}
    } catch {}
  }

  async function refreshPages() {
    try {
      setLoadingPages(true);
      console.log("Refreshing pages...");
      const token = localStorage.getItem("accessToken");
      console.log("Token present:", !!token);

      const data = await api("/pages");
      console.log("Pages data:", data);
      const resolvedUserId =
        currentUserId ||
        (() => {
          try {
            const raw = localStorage.getItem("user");
            if (!raw) return "";
            const parsed = JSON.parse(raw);
            return resolveUserId(parsed);
          } catch {
            return "";
          }
        })();
      const favoriteOverrides = getFavoriteOverrides();
      // Expect backend to include parentId for hierarchy
      setPages(
        (data.pages || []).map((p: any) => ({
          _id: String(p._id),
          title: p.title,
          slug: p.slug,
          icon: p.icon || null,
          parentId: p.parentId || null,
          locked: !!p.locked,
          favorite:
            favoriteOverrides[String(p._id)] ??
            (resolvedUserId
              ? Array.isArray(p.favoritedBy) &&
                p.favoritedBy.some((id: any) => String(id) === resolvedUserId)
              : false),
        })),
      );
      console.log("Pages set:", data.pages?.length || 0);
    } catch (error) {
      console.error("Error fetching pages:", error);
    }
    setLoadingPages(false);
  }

  async function refreshShared() {
    try {
      const data = await api("/pages/shared");
      const arr: SharedLinkItem[] = Array.isArray((data as any).shared)
        ? (data as any).shared
        : [];
      // sort by addedAt desc
      arr.sort(
        (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime(),
      );
      setShared(arr);
    } catch (error) {
      // ignore
    }
  }

  async function refreshSharedByMe() {
    try {
      const data = await api("/pages/shared-by-me");
      const arr: OwnerSharedItem[] = Array.isArray((data as any).pages)
        ? (data as any).pages
        : [];
      setSharedByMe(arr);
    } catch {}
  }

  async function refreshUser() {
    try {
      // Try localStorage first for instant display
      const cachedUser = localStorage.getItem("user");
      if (cachedUser && cachedUser !== "undefined" && cachedUser !== "null") {
        try {
          const user = JSON.parse(cachedUser);
          setUsername(user?.name || user?.email || "User");
          setCurrentUserId(resolveUserId(user));
        } catch (e) {
          console.error("Error parsing cached user in sidebar:", e);
          // Clear invalid data
          localStorage.removeItem("user");
        }
      }

      // Then fetch fresh data from API
      const data = await api("/users/me");
      const user = data.user;
      setUsername(user?.name || user?.email || "User");
      setCurrentUserId(resolveUserId(user));
      // Update localStorage with fresh data
      localStorage.setItem("user", JSON.stringify(user));
    } catch (error) {
      console.error("Error fetching user:", error);
    }
  }

  useEffect(() => {
    refreshShared();
    refreshSharedByMe();
    refreshUser().finally(() => {
      refreshPages();
    });
    const onShared = () => {
      Promise.all([refreshShared(), refreshSharedByMe()]).catch(() => {});
    };
    window.addEventListener("shared-links-updated", onShared);
    const onPagesUpdated = () => {
      refreshPages();
    };
    const onPageStarToggled = (evt: Event) => {
      const detail = (evt as CustomEvent<PageStarToggleDetail>).detail;
      const pageId = detail?.pageId;
      const starred = !!detail?.starred;
      if (!pageId) return;

      const overrides = getFavoriteOverrides();
      overrides[String(pageId)] = starred;
      setFavoriteOverrides(overrides);

      // Optimistic local update so Favorites moves immediately.
      setPages((prev) =>
        prev.map((p) =>
          String(p._id) === String(pageId) ? { ...p, favorite: starred } : p,
        ),
      );

      // Then sync with server state.
      refreshPages();
    };
    const onRecentUpdated = () => {
      setRecentVersion((v) => v + 1);
    };
    window.addEventListener("pages-updated", onPagesUpdated);
    window.addEventListener("page-star-toggled", onPageStarToggled);
    window.addEventListener("recent-updated", onRecentUpdated);
    return () => {
      window.removeEventListener("shared-links-updated", onShared);
      window.removeEventListener("pages-updated", onPagesUpdated);
      window.removeEventListener("page-star-toggled", onPageStarToggled);
      window.removeEventListener("recent-updated", onRecentUpdated);
    };
  }, []);

  useEffect(() => {
    // Keep sidebar sections in sync after page navigation (star/lock state, recents visibility).
    refreshPages();
  }, [location.pathname]);

  useEffect(() => {
    try {
      localStorage.setItem("sidebar.recentsOpen", recentsOpen ? "1" : "0");
      localStorage.setItem("sidebar.favoritesOpen", favoritesOpen ? "1" : "0");
      localStorage.setItem("sidebar.agentsOpen", agentsOpen ? "1" : "0");
      localStorage.setItem("sidebar.sharedOpen", sharedOpen ? "1" : "0");
      localStorage.setItem("sidebar.privateOpen", privateOpen ? "1" : "0");
    } catch {}
  }, [recentsOpen, favoritesOpen, agentsOpen, sharedOpen, privateOpen]);

  async function createPage() {
    try {
      console.log("Creating new page from sidebar...");
      const token = localStorage.getItem("accessToken");
      console.log("Token present for create:", !!token);

      const data = await api("/pages", {
        method: "POST",
        body: JSON.stringify({ title: "New Page" }),
      });

      console.log("New page created:", data);
      await refreshPages();
      if (data.slug) {
        markRecentSlug(data.slug);
        console.log("Navigating to new page:", data.slug);
        navigate(`/${data.slug}`);
      }
    } catch (error) {
      console.error("Error creating page:", error);
    }
  }

  async function deletePage(pageId: string) {
    try {
      await api(`/pages/${pageId}`, {
        method: "DELETE",
      });
      await refreshPages();
      // Decide where to go next without triggering app-wide redirects
      try {
        const data = await api("/pages");
        const remaining = Array.isArray((data as any).pages)
          ? (data as any).pages
          : [];
        if (remaining.length > 0) {
          const next = remaining[0];
          const slug =
            next.slug ||
            `${next.title?.toLowerCase?.().replace(/\s+/g, "-")}-${next._id}`;
          localStorage.setItem(
            "lastPage",
            JSON.stringify({
              id: next._id,
              title: next.title,
              slug,
              updatedAt: next.updatedAt,
            }),
          );
          navigate(`/${slug}`);
        } else {
          localStorage.removeItem("lastPage");
          navigate("/home");
        }
      } catch {
        navigate("/home");
      }
    } catch (error) {
      console.error("Error deleting page:", error);
    }
  }

  async function logout() {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {}
    localStorage.removeItem("accessToken");
    localStorage.removeItem("user");
    localStorage.removeItem("lastPage");
    window.dispatchEvent(new Event("auth-updated"));
    navigate("/");
  }
  return (
    <ShadSidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center justify-between px-2 group/header">
          <span className="text-sm font-medium">Motion</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              title={hideLocked ? "Show locked pages" : "Hide locked pages"}
              onClick={() => {
                const next = !hideLocked;
                setHideLocked(next);
                try {
                  localStorage.setItem("hideLocked", next ? "1" : "0");
                  window.dispatchEvent(new Event("hideLocked-changed"));
                } catch {}
              }}
              className={`h-6 w-6 inline-flex items-center justify-center rounded border text-xs transition-opacity ${hideLocked ? "bg-foreground text-background" : "bg-background"} opacity-0 group-hover/header:opacity-100`}
            >
              <Lock className="size-3" />
            </button>
            <Button
              variant="outline"
              size="icon"
              className="h-6 w-6"
              onClick={createPage}
              title="Create page"
            >
              <SquarePen className="size-3" />
            </Button>
            {state === "expanded" ? <SidebarTrigger /> : null}
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  {item.title === "Settings" ? (
                    <SettingsDialog
                      trigger={
                        <SidebarMenuButton asChild>
                          <button type="button">
                            <Settings />
                            <span>Settings</span>
                          </button>
                        </SidebarMenuButton>
                      }
                    />
                  ) : item.title === "Home" ? (
                    <SidebarMenuButton asChild>
                      <Link to="/home">
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  ) : (
                    <SidebarMenuButton asChild>
                      <button type="button">
                        <item.icon />
                        <span>{item.title}</span>
                      </button>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <Separator className="my-2" />
        <SidebarGroup>
          <SidebarGroupContent>
            <div className="px-1 pb-2">
              <div className="flex items-center w-full px-2 py-1 rounded-md bg-muted/60 text-sm">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                  onClick={() => setRecentsOpen((v) => !v)}
                  aria-label={
                    recentsOpen ? "Collapse recents" : "Expand recents"
                  }
                >
                  <span>Recents</span>
                  {recentsOpen ? (
                    <ChevronDown className="size-4" />
                  ) : (
                    <ChevronRight className="size-4" />
                  )}
                </button>
                <button
                  type="button"
                  className="ml-auto p-1 rounded hover:bg-muted"
                  aria-label="Recents options"
                >
                  <MoreHorizontal className="size-4" />
                </button>
              </div>
            </div>

            <SidebarMenu>
              {recentsOpen
                ? buildTree(recentPages).map((node: PageNode) => (
                    <TreeRow
                      key={`recent:${node._id}`}
                      node={node}
                      depth={0}
                      expanded={expanded}
                      setExpanded={setExpanded}
                      onDelete={deletePage}
                    />
                  ))
                : null}

              <SidebarMenuItem>
                <div className="flex items-center w-full px-2 py-1 rounded-md text-sm hover:bg-muted/60">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                    onClick={() => setFavoritesOpen((v) => !v)}
                    aria-label={
                      favoritesOpen ? "Collapse favorites" : "Expand favorites"
                    }
                  >
                    <span>Favorites</span>
                    {favoritesOpen ? (
                      <ChevronDown className="size-4" />
                    ) : (
                      <ChevronRight className="size-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    className="ml-auto p-1 rounded hover:bg-muted"
                    aria-label="Favorites options"
                  >
                    <MoreHorizontal className="size-4" />
                  </button>
                </div>
              </SidebarMenuItem>
              {favoritesOpen ? (
                loadingPages ? (
                  <SidebarMenuItem>
                    <div className="flex items-center w-full gap-2 px-3 py-1">
                      <Skeleton className="h-4 w-4" />
                      <Skeleton className="h-4 flex-1" />
                    </div>
                  </SidebarMenuItem>
                ) : (
                  buildTree(pages.filter((p) => !!p.favorite)).map(
                    (node: PageNode) => (
                      <TreeRow
                        key={`fav:${node._id}`}
                        node={node}
                        depth={0}
                        expanded={expanded}
                        setExpanded={setExpanded}
                        onDelete={deletePage}
                      />
                    ),
                  )
                )
              ) : null}

              <SidebarMenuItem>
                <div className="flex items-center w-full px-2 py-1 rounded-md text-sm hover:bg-muted/60">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                    onClick={() => setAgentsOpen((v) => !v)}
                    aria-label={
                      agentsOpen ? "Collapse agents" : "Expand agents"
                    }
                  >
                    <span>Agents</span>
                    <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] uppercase tracking-wide">
                      Beta
                    </span>
                    {agentsOpen ? (
                      <ChevronDown className="size-4" />
                    ) : (
                      <ChevronRight className="size-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    className="ml-auto p-1 rounded hover:bg-muted"
                    aria-label="Agents options"
                  >
                    <MoreHorizontal className="size-4" />
                  </button>
                </div>
              </SidebarMenuItem>
              {agentsOpen ? (
                <SidebarMenuItem>
                  <div className="px-3 py-1 text-xs text-muted-foreground">
                    No agents yet
                  </div>
                </SidebarMenuItem>
              ) : null}

              <SidebarMenuItem>
                <div className="flex items-center w-full px-2 py-1 rounded-md text-sm hover:bg-muted/60">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                    onClick={() => setSharedOpen((v) => !v)}
                    aria-label={
                      sharedOpen ? "Collapse shared" : "Expand shared"
                    }
                  >
                    <span>Shared</span>
                    {sharedOpen ? (
                      <ChevronDown className="size-4" />
                    ) : (
                      <ChevronRight className="size-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    className="ml-auto p-1 rounded hover:bg-muted"
                    aria-label="Shared options"
                  >
                    <MoreHorizontal className="size-4" />
                  </button>
                </div>
              </SidebarMenuItem>
              {sharedOpen ? (
                <>
                  {sharedByMe.map((p) => (
                    <SidebarMenuItem
                      key={`me:${p._id}`}
                      className="group flex items-center"
                    >
                      <SidebarMenuButton asChild>
                        <Link to={`/${p.slug}`} className="flex-1">
                          <FileText />
                          <span>{p.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                  {shared.map((s) => (
                    <SidebarMenuItem
                      key={`${s.pageId}:${s.token || "shared"}`}
                      className="group flex items-center"
                    >
                      <SidebarMenuButton asChild>
                        <Link
                          to={`/${s.slug}${s.token ? `?t=${encodeURIComponent(s.token)}` : ""}`}
                          className="flex-1"
                        >
                          {s.icon ? (
                            <span className="inline-flex items-center justify-center w-4 h-4 text-base leading-none">
                              {s.icon}
                            </span>
                          ) : (
                            <FileText />
                          )}
                          <span>{s.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </>
              ) : null}

              <SidebarMenuItem>
                <div className="flex items-center w-full px-2 py-1 rounded-md text-sm hover:bg-muted/60">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                    onClick={() => setPrivateOpen((v) => !v)}
                    aria-label={
                      privateOpen ? "Collapse private" : "Expand private"
                    }
                  >
                    <span>Private</span>
                    {privateOpen ? (
                      <ChevronDown className="size-4" />
                    ) : (
                      <ChevronRight className="size-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    className="ml-auto p-1 rounded hover:bg-muted"
                    aria-label="Private options"
                  >
                    <MoreHorizontal className="size-4" />
                  </button>
                </div>
              </SidebarMenuItem>
              {privateOpen
                ? buildTree(pages.filter((p) => !!p.locked)).map(
                    (node: PageNode) => (
                      <TreeRow
                        key={`private:${node._id}`}
                        node={node}
                        depth={0}
                        expanded={expanded}
                        setExpanded={setExpanded}
                        onDelete={deletePage}
                      />
                    ),
                  )
                : null}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <button type="button">
                <User2 />
                <span>{username || "User"}</span>
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <button onClick={logout}>
                <span>Logout</span>
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </ShadSidebar>
  );
}
