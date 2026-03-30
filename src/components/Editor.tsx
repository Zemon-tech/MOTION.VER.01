import { useEffect, useMemo, useRef } from "react";
import { Image as ImageIcon, Smile } from "lucide-react";
import { Extension } from "@tiptap/core";
import { useEditor, EditorContent } from "@tiptap/react";
import HardBreak from "@tiptap/extension-hard-break";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import { TaskList, TaskItem } from "@tiptap/extension-list";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import Typography from "@tiptap/extension-typography";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
// removed invalid Selection extension import
import {
  DndContext,
  closestCenter,
  useDraggable,
  useDroppable,
  MouseSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import * as React from "react";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  ToggleList,
  ToggleSummary,
  ToggleContent,
} from "@/extensions/toggle-list";

// Simple template nodes and styles for proper rendering
import { HorizontalRule } from "@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node-extension";
import { MermaidNode } from "@/components/tiptap-node/mermaid-node/mermaid-node-extension";
import { ImageUploadNode } from "@/components/tiptap-node/image-upload-node/image-upload-node-extension";
import {
  NotionTable,
  NotionTableRow,
  NotionTableCell,
  NotionTableHeader,
} from "@/components/tiptap-node/table-node/table-node-extension";
import "@/components/tiptap-node/blockquote-node/blockquote-node.scss";
import "@/components/tiptap-node/code-block-node/code-block-node.scss";
import "@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node.scss";
import "@/components/tiptap-node/list-node/list-node.scss";
import "@/components/tiptap-node/image-node/image-node.scss";
import "@/components/tiptap-node/heading-node/heading-node.scss";
import "@/components/tiptap-node/paragraph-node/paragraph-node.scss";
import "@/components/tiptap-node/table-node/table-node.scss";
import "@/components/tiptap-node/toggle-list-node/toggle-list.scss";
import "@/components/tiptap-node/subpage-node/subpage-node.scss";
import { LinkMentionNode } from "@/components/tiptap-node/link-mention-node/link-mention-node-extension";
import "@/components/tiptap-node/link-mention-node/link-mention-node.scss";
import { BookmarkNode } from "@/components/tiptap-node/bookmark-node/bookmark-node-extension";
import "@/components/tiptap-node/bookmark-node/bookmark-node.scss";
import { UrlPasteInterceptor } from "@/components/tiptap-extensions/url-paste-interceptor";
import { handleImageUpload, MAX_FILE_SIZE } from "@/lib/tiptap-utils";
import { SlashMenu } from "@/components/tiptap-ui/slash-menu";
import { PasteUrlMenu } from "@/components/tiptap-ui/paste-url-menu";
import { CoverImage, CoverPickerDialog } from "@/components/CoverImage";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SubpageNode } from "@/components/tiptap-node/subpage-node/subpage-node-extension";
import { api } from "@/lib/utils";

type EditorProps = {
  title: string;
  onTitleChange: (title: string) => void;
  initialContentJSON?: any;
  onContentChange?: (json: any) => void;
  readOnly?: boolean;
  coverImageUrl?: string | null;
  coverPosition?: number;
  onCoverImageUrlChange?: (url: string | null) => void;
  onCoverPositionChange?: (pos: number) => void;
  icon?: string | null;
  onIconChange?: (icon: string | null) => void;
  persistKey?: string;
  onCreateSubpage?: (
    title: string,
  ) => Promise<{
    id: string;
    slug: string;
    title: string;
    icon: string | null;
  }>;
};

function IconDisplay({ icon, hasCover }: { icon: string; hasCover: boolean }) {
  return (
    <div className="w-full px-4">
      <div className="mx-auto w-full max-w-3xl">
        <div
          className="flex justify-start"
          style={{ marginTop: hasCover ? -28 : 72 }}
        >
          <div className="relative group/icon">
            {/^https?:\/\//i.test(icon) ? (
              <img
                src={icon}
                alt="icon"
                className="w-20 h-20 rounded opacity-100"
              />
            ) : (
              <span className="text-8xl leading-none opacity-100">{icon}</span>
            )}
            {/* Inline change icon control under the icon is removed to avoid overlap with title */}
          </div>
        </div>
      </div>
    </div>
  );
}

function IconTrigger({
  onSave,
  onRemove,
  current,
  className,
}: {
  onSave: (icon: string | null) => void;
  onRemove?: () => void;
  current?: string | null;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [val, setVal] = React.useState(current || "");
  const [tab, setTab] = React.useState<"emoji" | "link">("emoji");
  const [query, setQuery] = React.useState("");
  const openDialog = () => {
    setVal(current || "");
    setOpen(true);
  };
  const save = () => {
    onSave(val.trim() || null);
    setOpen(false);
  };

  const emojiList = React.useMemo(
    () => [
      "😀",
      "😁",
      "😂",
      "🤣",
      "😃",
      "😄",
      "😅",
      "😉",
      "😊",
      "🙂",
      "🙃",
      "😋",
      "😎",
      "😍",
      "😘",
      "😇",
      "🥳",
      "🤩",
      "🤔",
      "🤖",
      "🧠",
      "📚",
      "💡",
      "✅",
      "⭐️",
      "🔥",
      "⚙️",
      "📄",
      "🧱",
      "📝",
      "📌",
      "📎",
      "📦",
      "🧭",
      "🧩",
      "🛠️",
    ],
    [],
  );
  const filteredEmoji = emojiList.filter((e) => e.includes(query));
  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="w-[90vw] sm:max-w-lg"
          aria-describedby={undefined}
          showCloseButton={false}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Set page icon</span>
              {onRemove ? (
                <button
                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-red-500 hover:text-red-600 hover:bg-red-500/10"
                  onClick={() => {
                    onRemove();
                    setOpen(false);
                  }}
                >
                  Remove
                </button>
              ) : null}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[70vh] overflow-auto pr-1">
            <div className="flex border-b">
              <button
                className={`px-3 py-2 text-sm ${tab === "emoji" ? "border-b-2 border-foreground" : "text-muted-foreground"}`}
                onClick={() => setTab("emoji")}
              >
                Emoji
              </button>
              <button
                className={`px-3 py-2 text-sm ${tab === "link" ? "border-b-2 border-foreground" : "text-muted-foreground"}`}
                onClick={() => setTab("link")}
              >
                Link
              </button>
            </div>
            {tab === "emoji" ? (
              <div className="space-y-2">
                <input
                  className="w-full border rounded px-2 py-1 text-sm bg-background"
                  placeholder="Filter…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <div className="grid grid-cols-8 gap-2 max-h-[50vh] overflow-auto">
                  {filteredEmoji.map((e, i) => (
                    <button
                      key={i}
                      className="h-9 border rounded hover:bg-muted text-xl"
                      onClick={() => {
                        onSave(e);
                        setOpen(false);
                      }}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  className="w-full border rounded px-2 py-1 text-sm bg-background"
                  placeholder="https://example.com/icon.png or emoji"
                  value={val}
                  onChange={(e) => setVal(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                  <button
                    className="px-3 py-1 text-sm border rounded"
                    onClick={() => setOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="px-3 py-1 text-sm border rounded bg-foreground text-background"
                    onClick={save}
                  >
                    Save
                  </button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <button
        className={`inline-flex items-center gap-2 px-2 py-1 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors ${className || ""}`}
        onClick={openDialog}
        type="button"
      >
        <Smile className="size-4" />
        <span>{current ? "Change icon" : "Add icon"}</span>
      </button>
    </>
  );
}
function AddCoverTrigger({
  onSave,
  className,
  buttonLabel = "Add cover",
  predefinedUrls,
  currentUrl,
}: {
  onSave: (url: string | null) => void;
  className?: string;
  buttonLabel?: string;
  predefinedUrls?: string[];
  currentUrl?: string | null;
}) {
  const [open, setOpen] = React.useState(false);
  const openDialog = () => {
    setOpen(true);
  };
  return (
    <>
      <CoverPickerDialog
        open={open}
        onOpenChange={setOpen}
        currentUrl={currentUrl || null}
        predefinedUrls={predefinedUrls}
        onSelect={(u) => {
          onSave(u);
          setOpen(false);
        }}
      />
      <button
        className={`inline-flex items-center gap-2 px-2 py-1 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors ${className || ""}`}
        onClick={openDialog}
        type="button"
      >
        <ImageIcon className="size-4" />
        <span>{buttonLabel}</span>
      </button>
    </>
  );
}

export function Editor({
  title,
  onTitleChange,
  initialContentJSON,
  onContentChange,
  readOnly = false,
  coverImageUrl,
  coverPosition = 50,
  onCoverImageUrlChange,
  onCoverPositionChange,
  icon,
  onIconChange,
  persistKey,
  onCreateSubpage,
}: EditorProps) {
  const titleInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        hardBreak: false,
        horizontalRule: false,
      }),
      Link.configure({
        openOnClick: false,
        protocols: ["http", "https", "mailto", "tel"],
        autolink: true,
        linkOnPaste: true,
      }),
      ToggleSummary,
      ToggleContent,
      ToggleList,
      HorizontalRule,
      Highlight.configure({ multicolor: true }),
      Image,
      Typography,
      Superscript,
      Subscript,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      // Selection extension removed
      MermaidNode,
      NotionTable,
      NotionTableRow,
      NotionTableCell,
      NotionTableHeader,
      SubpageNode,
      LinkMentionNode,
      BookmarkNode,
      UrlPasteInterceptor,
      ImageUploadNode.configure({
        type: "image",
        accept: "image/*",
        maxSize: MAX_FILE_SIZE,
        limit: 3,
        upload: handleImageUpload,
        onError: (error) => console.error("Upload failed:", error),
        onSuccess: (url) => console.log("Uploaded:", url),
      }),
      Placeholder.configure({ placeholder: 'Type "/" for commands…' }),
      HardBreak.configure({ keepMarks: true }),
      // Notion-like Enter behavior: when at the end of a block-level node
      // (e.g., heading, blockquote), create a new paragraph below instead of
      // continuing the same node.
      Extension.create({
        name: "notionEnterBehavior",
        priority: 1000,
        addKeyboardShortcuts() {
          return {
            Enter: ({ editor }) => {
              const { state } = editor;
              const { selection } = state;
              const $head = selection.$head;
              const parent = $head.parent;
              const isAtEndOfNode = $head.parentOffset === parent.content.size;

              // Let lists, tasks, and code blocks keep their native behavior
              if (
                editor.isActive("bulletList") ||
                editor.isActive("orderedList") ||
                editor.isActive("taskList") ||
                editor.isActive("codeBlock")
              ) {
                return false;
              }

              // If current block is empty, just ensure it's a paragraph (normalizes headings/quotes)
              if (parent.isTextblock && parent.content.size === 0) {
                return editor.chain().focus().setParagraph().run();
              }

              if (isAtEndOfNode) {
                // Insert a paragraph after the current block and move cursor safely
                const posAfter = $head.after($head.depth);
                const maxPos = state.doc.content.size;
                const safePos = Math.max(0, Math.min(posAfter, maxPos));
                return editor
                  .chain()
                  .focus()
                  .insertContentAt(
                    safePos,
                    { type: "paragraph" },
                    { updateSelection: true },
                  )
                  .run();
              }

              return false;
            },
            "Shift-Enter": ({ editor }) => {
              // Ensure Shift+Enter is a soft line break
              return editor.chain().focus().setHardBreak().run();
            },
            Backspace: ({ editor }) => {
              const { state } = editor;
              const { selection } = state;
              const $head = selection.$head;
              const parent = $head.parent;
              const isAtStartOfNode = $head.parentOffset === 0;

              // Keep native behavior for lists/code
              if (
                editor.isActive("bulletList") ||
                editor.isActive("orderedList") ||
                editor.isActive("taskList") ||
                editor.isActive("codeBlock")
              ) {
                return false;
              }

              // If at start of a non-paragraph textblock (e.g., heading/blockquote), turn into paragraph
              if (
                isAtStartOfNode &&
                parent.isTextblock &&
                parent.type.name !== "paragraph"
              ) {
                return editor.chain().focus().setParagraph().run();
              }

              return false;
            },
          };
        },
      }),
    ],
    content: initialContentJSON || "<p></p>",
    autofocus: false,
    editable: !readOnly,
    editorProps: {
      attributes: {
        class: "tiptap prose max-w-none focus:outline-none",
      },
    },
  });
  useEffect(() => {
    if (!readOnly) {
      titleInputRef.current?.focus();
    }
  }, []);

  // Reset editor content when initialContentJSON changes (page navigation)
  useEffect(() => {
    if (editor && initialContentJSON) {
      editor.commands.setContent(initialContentJSON);
    }
  }, [editor, initialContentJSON]);

  // Re-render on every transaction so overlays update for new/removed blocks
  const [docVersion, setDocVersion] = React.useState(0);
  const contentSyncTimerRef = React.useRef<number | null>(null);
  // Selection toolbar positioning
  const [selPos, setSelPos] = React.useState<{
    x: number;
    yTop: number;
    yBottom: number;
    visible: boolean;
  } | null>(null);

  useEffect(() => {
    if (!editor) return;
    const onTxn = ({ transaction }: { transaction: any }) => {
      setDocVersion((v) => v + 1);
      if (!transaction?.docChanged) return;
      if (!readOnly && onContentChange) {
        if (contentSyncTimerRef.current)
          window.clearTimeout(contentSyncTimerRef.current);
        contentSyncTimerRef.current = window.setTimeout(() => {
          onContentChange(editor.getJSON());
        }, 90);
      }
    };
    const updateSelectionToolbar = () => {
      if (!editor || readOnly) {
        setSelPos(null);
        return;
      }
      const state = editor.state;
      const sel: any = state.selection;
      if (!sel || sel.empty) {
        setSelPos(null);
        return;
      }
      const from = sel.from;
      const to = sel.to;
      const start = editor.view.coordsAtPos(from);
      const end = editor.view.coordsAtPos(to);
      const midX = (start.left + end.right) / 2;
      const top = Math.min(start.top, end.top);
      const bottom = Math.max(start.bottom ?? start.top, end.bottom ?? end.top);
      // Ensure toggles stay open while editing inside them, but avoid redundant transactions
      try {
        const selEmpty = (editor.state.selection as any)?.empty === true;
        if (selEmpty && editor.isActive("details")) {
          const attrs = editor.getAttributes("details") as any;
          if (!attrs || attrs.open !== true) {
            editor.chain().updateAttributes("details", { open: true }).run();
          }
        }
      } catch {}
      const wrapper = document.getElementById("tiptap-editor-wrapper");
      const wrect = wrapper?.getBoundingClientRect();
      if (!wrect) {
        setSelPos(null);
        return;
      }
      const x = midX - wrect.left;
      const yTop = top - wrect.top;
      const yBottom = bottom - wrect.top;
      setSelPos({ x, yTop, yBottom, visible: true });
    };
    const onBlur = () => setSelPos(null);
    const onFocus = () => updateSelectionToolbar();
    editor.on("selectionUpdate", updateSelectionToolbar);
    editor.on("transaction", updateSelectionToolbar);
    editor.on("blur", onBlur);
    editor.on("focus", onFocus);
    editor.on("transaction", onTxn);
    return () => {
      if (contentSyncTimerRef.current)
        window.clearTimeout(contentSyncTimerRef.current);
      editor.off("selectionUpdate", updateSelectionToolbar);
      editor.off("transaction", updateSelectionToolbar);
      editor.off("blur", onBlur);
      editor.off("focus", onFocus);
      editor.off("transaction", onTxn);
    };
  }, [editor, readOnly, onContentChange]);

  // Debounced batch-fetch of subpage meta by IDs and dispatch window events for node views
  useEffect(() => {
    if (!editor) return;
    let t: number | null = null;
    const fetchMeta = async () => {
      try {
        const ids = new Set<string>();
        const slugs = new Map<string, string | undefined>();
        const { doc } = editor.state;
        doc.descendants((node) => {
          if (node.type.name === "subpage" && node.attrs?.pageId) {
            const pid = String(node.attrs.pageId);
            ids.add(pid);
            if (node.attrs.slug) slugs.set(pid, String(node.attrs.slug));
          }
        });
        if (!ids.size) return;
        const qs = Array.from(ids).join(",");
        const res = await api<{
          pages: Array<{
            _id: string;
            title: string;
            slug: string;
            icon: string | null;
          }>;
        }>(`/pages/meta?ids=${qs}`);
        const pages = Array.isArray(res.pages) ? res.pages : [];
        for (const p of pages) {
          try {
            // Prefer server slug, but keep any existing slug if server empty
            const slug = p.slug || slugs.get(p._id);
            window.dispatchEvent(
              new CustomEvent("subpage-meta", {
                detail: { pageId: p._id, title: p.title, icon: p.icon, slug },
              }),
            );
          } catch {}
        }
      } catch {}
    };
    const schedule = () => {
      if (t) window.clearTimeout(t);
      t = window.setTimeout(fetchMeta, 250);
    };
    // Initial and on every transaction
    schedule();
    const onTxn = () => schedule();
    editor.on("transaction", onTxn);
    return () => {
      if (t) window.clearTimeout(t);
      editor.off("transaction", onTxn);
    };
  }, [editor]);

  // Listen for subpage deletion and remove matching subpage nodes
  useEffect(() => {
    if (!editor) return;
    const handler = (ev: Event) => {
      const ce = ev as CustomEvent<{ pageId: string }>;
      const { pageId } = ce.detail || ({} as any);
      if (!pageId) return;
      editor
        .chain()
        .focus()
        .command(({ tr, state }) => {
          const { doc } = state;
          // Collect positions first to avoid shifting during iteration
          const positions: number[] = [];
          doc.descendants((node, pos) => {
            if (node.type.name === "subpage" && node.attrs.pageId === pageId) {
              positions.push(pos);
            }
          });
          // Delete from end to preserve positions
          positions.sort((a, b) => b - a);
          for (const pos of positions) {
            const node = tr.doc.nodeAt(pos);
            if (node) tr.delete(pos, pos + node.nodeSize);
          }
          return true;
        })
        .run();
    };
    window.addEventListener("subpage-deleted" as any, handler as any);
    return () =>
      window.removeEventListener("subpage-deleted" as any, handler as any);
  }, [editor]);

  // compute list of top-level block ids for dnd (simple approach: index-based)
  const blockIds = useMemo(() => {
    if (!editor) return [] as string[];
    const count = editor.state.doc.childCount;
    return Array.from({ length: count }, (_, idx) => `block-${idx}`);
  }, [editor, docVersion]);

  function handleDragStart(event: any) {
    // Optional: Add any drag start logic here
    console.log("Drag started:", event.active.id);
  }

  function handleDragOver() {
    // Optional: Add any drag over logic here for better visual feedback
  }

  function handleDragEnd(event: any) {
    if (!editor) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const from = Number(String(active.id).replace("block-", ""));
    const to = Number(String(over.id).replace("block-", ""));
    if (Number.isNaN(from) || Number.isNaN(to)) return;

    const { state } = editor;
    const { doc } = state;

    // Validate indices
    if (from < 0 || from >= doc.childCount || to < 0 || to >= doc.childCount)
      return;

    // If moving to the same position, do nothing
    if (from === to) return;

    // Get the JSON content and reorder it properly
    const json = editor.getJSON();
    const content = Array.isArray(json.content) ? [...json.content] : [];

    if (from < 0 || from >= content.length || to < 0 || to >= content.length)
      return;

    // Remove the block from its current position
    const [movedBlock] = content.splice(from, 1);

    // Insert it at the new position
    content.splice(to, 0, movedBlock);

    // Update the editor with the reordered content
    editor.commands.setContent({ type: "doc", content });

    // Focus the moved block at its document position
    const nextState = editor.state;
    const nextDoc = nextState.doc;
    let posStart = 0;
    for (let i = 0; i < Math.max(0, Math.min(to, nextDoc.childCount)); i++) {
      posStart += nextDoc.child(i).nodeSize;
    }
    // place cursor just inside the node
    const targetPos = Math.min(
      nextDoc.content.size - 1,
      Math.max(1, posStart + 1),
    );
    editor.commands.setTextSelection(targetPos);
  }

  // Configure DnD sensors so drag starts only after small movement
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  useEffect(() => {
    const key = persistKey ? `editor-scroll:${persistKey}` : null;
    const sc = scrollRef.current;
    if (!sc) return;
    const restore = async () => {
      if (!key) return;
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return;
        const { y } = JSON.parse(raw || "{}") || {};
        if (typeof y === "number")
          sc.scrollTo({ top: y, behavior: "instant" as ScrollBehavior });
      } catch {}
    };
    const onFonts = (document as any).fonts?.ready;
    if (onFonts && typeof onFonts.then === "function") {
      onFonts.then(() => restore()).catch(() => restore());
    } else {
      restore();
    }
    let t: number | null = null;
    const onScroll = () => {
      if (!key) return;
      if (t) window.clearTimeout(t);
      t = window.setTimeout(() => {
        try {
          localStorage.setItem(key, JSON.stringify({ y: sc.scrollTop }));
        } catch {}
      }, 150);
    };
    sc.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      sc.removeEventListener("scroll", onScroll);
      if (t) window.clearTimeout(t);
    };
  }, [persistKey, readOnly, initialContentJSON]);

  function insertParagraphAfterTopLevel(index: number) {
    if (!editor) return;
    const { state } = editor;
    if (index < 0 || index >= state.doc.childCount) return;
    // Compute position immediately AFTER the node at index and insert paragraph
    let posAfter = 0;
    for (let i = 0; i <= index; i++) {
      posAfter += state.doc.child(i).nodeSize;
    }
    const maxPos = state.doc.content.size;
    const safePos = Math.max(0, Math.min(posAfter, maxPos));
    editor
      .chain()
      .focus()
      .insertContentAt(
        safePos,
        { type: "paragraph" },
        { updateSelection: true },
      )
      .run();
  }

  function deleteTopLevelBlock(index: number) {
    if (!editor) return;
    const { state } = editor;
    const { doc } = state;
    if (index < 0 || index >= doc.childCount) return;
    let posStart = 0;
    for (let i = 0; i < index; i++) {
      posStart += doc.child(i).nodeSize;
    }
    const node = doc.child(index);
    const posEnd = posStart + node.nodeSize;
    editor.chain().focus().deleteRange({ from: posStart, to: posEnd }).run();
  }

  function TopLevelOverlay(props: { index: number }) {
    const { index } = props;
    const id = `block-${index}`;
    const [top, setTop] = React.useState(0);
    const [height, setHeight] = React.useState(0);
    const [hovered, setHovered] = React.useState(false);
    const [isDragging, setIsDragging] = React.useState(false);
    const [menuOpen, setMenuOpen] = React.useState(false);
    const menuRef = React.useRef<HTMLDivElement | null>(null);
    const hoverTimeoutRef = React.useRef<number | null>(null);

    const beginHover = () => {
      if (hoverTimeoutRef.current) {
        window.clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
      }
      setHovered(true);
    };

    const endHoverSoon = () => {
      if (hoverTimeoutRef.current) {
        window.clearTimeout(hoverTimeoutRef.current);
      }
      hoverTimeoutRef.current = window.setTimeout(() => {
        setHovered(false);
        hoverTimeoutRef.current = null;
      }, 200);
    };

    const { setNodeRef, isOver } = useDroppable({
      id,
      data: { index },
    });
    const {
      attributes,
      listeners,
      setNodeRef: setDragRef,
      isDragging: isDraggingThis,
    } = useDraggable({
      id,
      data: { index },
    });

    // Update dragging state
    React.useEffect(() => {
      setIsDragging(isDraggingThis);
    }, [isDraggingThis]);

    // Close menu if dragging starts
    React.useEffect(() => {
      if (menuOpen && isDraggingThis) setMenuOpen(false);
    }, [menuOpen, isDraggingThis]);

    // Close menu on outside click
    React.useEffect(() => {
      if (!menuOpen) return;
      const onDocDown = (e: MouseEvent) => {
        if (!menuRef.current) return;
        if (!menuRef.current.contains(e.target as Node)) {
          setMenuOpen(false);
        }
      };
      document.addEventListener("mousedown", onDocDown, true);
      return () => document.removeEventListener("mousedown", onDocDown, true);
    }, [menuOpen]);

    React.useEffect(() => {
      if (!editor) return;
      const measure = () => {
        const wrapper = document.getElementById("tiptap-editor-wrapper");
        const wrapperRect = wrapper?.getBoundingClientRect();
        const contentEl = editor.view.dom as HTMLElement;
        const childEl = contentEl?.children?.[index] as HTMLElement | undefined;
        const rect = childEl?.getBoundingClientRect();
        if (rect && wrapperRect) {
          setTop(rect.top - wrapperRect.top);
          setHeight(rect.height);
        }
      };
      measure();
      const onTxn = () => measure();
      editor.on("transaction", onTxn);
      const onScroll = () => measure();
      window.addEventListener("scroll", onScroll, true);
      window.addEventListener("resize", onScroll);
      return () => {
        editor.off("transaction", onTxn);
        window.removeEventListener("scroll", onScroll, true);
        window.removeEventListener("resize", onScroll);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editor, index]);

    return (
      <>
        <div
          ref={setNodeRef}
          className={`absolute left-0 right-0 transition-all duration-200 ${
            isOver ? "bg-blue-50 border-l-2 border-blue-400" : ""
          } ${isDraggingThis ? "opacity-50" : ""}`}
          style={{ top, height, pointerEvents: "none" }}
        />
        {/* Hover hit area in the left gutter to reveal controls */}
        <div
          className="absolute"
          style={{ top, height, left: -96, width: 120, cursor: "default" }}
          onMouseEnter={beginHover}
          onMouseLeave={endHoverSoon}
        />
        <div
          ref={setDragRef}
          className={`absolute inline-flex items-center gap-2 z-10 transition-all duration-200 ${
            hovered || isDragging ? "opacity-100" : "opacity-0"
          }`}
          style={{
            top,
            left: -64,
            pointerEvents: hovered || isDragging ? "auto" : "none",
          }}
          onMouseEnter={beginHover}
          onMouseLeave={endHoverSoon}
        >
          <div className="relative">
            <button
              type="button"
              className="rounded px-1.5 py-1 hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
              title="Add block below"
              onClick={() => insertParagraphAfterTopLevel(index)}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="currentColor"
              >
                <path
                  d="M6 1v10M1 6h10"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              className={`rounded px-1.5 py-1 hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors ${
                isDraggingThis ? "cursor-grabbing" : "cursor-grab"
              }`}
              title="Drag to move / menu"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((v) => !v);
              }}
              {...listeners}
              {...attributes}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="currentColor"
              >
                <circle cx="3" cy="3" r="1" fill="currentColor" />
                <circle cx="9" cy="3" r="1" fill="currentColor" />
                <circle cx="3" cy="6" r="1" fill="currentColor" />
                <circle cx="9" cy="6" r="1" fill="currentColor" />
                <circle cx="3" cy="9" r="1" fill="currentColor" />
                <circle cx="9" cy="9" r="1" fill="currentColor" />
              </svg>
            </button>
            {menuOpen && (
              <div
                className="absolute left-0 mt-1 min-w-[140px] rounded-md border bg-white text-gray-800 text-sm shadow-md z-20 dark:bg-neutral-900 dark:text-neutral-100 dark:border-neutral-700"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className="block w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-neutral-800"
                  onClick={() => {
                    deleteTopLevelBlock(index);
                    setMenuOpen(false);
                  }}
                >
                  Delete block
                </button>
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  function BlockControlsOverlay() {
    if (!editor) return null;
    const count = editor.state.doc.childCount;
    return (
      <>
        {Array.from({ length: count }, (_, i) => (
          <TopLevelOverlay key={`overlay-${i}`} index={i} />
        ))}
      </>
    );
  }

  function TableOverlay() {
    if (!editor) return null;
    const [visible, setVisible] = React.useState(false);
    const [rect, setRect] = React.useState<{
      top: number;
      left: number;
      width: number;
      height: number;
    } | null>(null);

    React.useEffect(() => {
      if (!editor) return;
      const wrapper = document.getElementById("tiptap-editor-wrapper");
      const updateFromSelection = () => {
        const view = editor.view;
        const sel = view.state.selection;
        // find closest table element from selection
        let el: HTMLElement | null = null;
        if (view.dom instanceof HTMLElement) {
          const anchor = view.domAtPos(sel.from).node as Node;
          const fromEl = (
            anchor instanceof HTMLElement
              ? anchor
              : (anchor as any)?.parentElement
          ) as HTMLElement | null;
          el = fromEl?.closest?.("table") || null;
        }
        if (el && wrapper) {
          const wrect = wrapper.getBoundingClientRect();
          const trect = el.getBoundingClientRect();
          setRect({
            top: trect.top - wrect.top,
            left: trect.left - wrect.left,
            width: trect.width,
            height: trect.height,
          });
          setVisible(true);
        } else {
          setVisible(false);
          setRect(null);
        }
      };
      updateFromSelection();
      const onTxn = () => updateFromSelection();
      const onScroll = () => updateFromSelection();
      editor.on("selectionUpdate", onTxn);
      editor.on("transaction", onTxn);
      window.addEventListener("scroll", onScroll, true);
      window.addEventListener("resize", onScroll);
      return () => {
        editor.off("selectionUpdate", onTxn);
        editor.off("transaction", onTxn);
        window.removeEventListener("scroll", onScroll, true);
        window.removeEventListener("resize", onScroll);
      };
    }, [editor]);

    if (!visible || !rect) return null;

    const addRow = () => editor.chain().focus().addRowAfter().run();
    const addCol = () => editor.chain().focus().addColumnAfter().run();
    const delRow = () => editor.chain().focus().deleteRow().run();
    const delCol = () => editor.chain().focus().deleteColumn().run();
    const runQuick =
      (fn: () => void) => (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.stopPropagation();
        fn();
      };

    // Row resize via dragging bottom bar
    const startRowResize = (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      const view = editor.view;
      const sel = view.state.selection;
      const anchorNode = view.domAtPos(sel.from).node as Node;
      const rowEl = (anchorNode as HTMLElement)?.closest?.(
        "tr",
      ) as HTMLTableRowElement | null;
      if (!rowEl) return;
      const startY = e.clientY;
      const startHeight = rowEl.getBoundingClientRect().height;
      const onMove = (ev: MouseEvent) => {
        const delta = ev.clientY - startY;
        const newH = Math.max(20, Math.round(startHeight + delta));
        rowEl.style.height = newH + "px";
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    };

    return (
      <>
        {/* Bottom full-width add row bar */}
        <div
          className="absolute z-20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
          style={{
            top: rect.top + rect.height - 1,
            left: rect.left,
            width: rect.width,
            height: 28,
          }}
        >
          <div
            className="pointer-events-auto flex items-center gap-2"
            onMouseDown={startRowResize}
            title="Drag to resize row height"
          >
            <button
              type="button"
              onMouseDown={runQuick(addRow)}
              className="rounded-md bg-background/70 border border-border/60 text-foreground/80 hover:bg-background/90 px-3 h-7 text-sm shadow-sm"
            >
              + Add row
            </button>
            <button
              type="button"
              onMouseDown={runQuick(delRow)}
              className="rounded-md bg-background/50 border border-border/50 text-foreground/70 hover:bg-background/80 px-2 h-7 text-sm"
              title="Delete current row"
            >
              –
            </button>
          </div>
        </div>
        {/* Right full-height add column bar */}
        <div
          className="absolute z-20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
          style={{
            top: rect.top,
            left: rect.left + rect.width - 1,
            width: 28,
            height: rect.height,
          }}
        >
          <div className="pointer-events-auto flex flex-col items-center gap-2">
            <button
              type="button"
              onMouseDown={runQuick(addCol)}
              className="rounded-md bg-background/70 border border-border/60 text-foreground/80 hover:bg-background/90 w-7 h-7 text-sm shadow-sm"
              title="Add column"
            >
              +
            </button>
            <button
              type="button"
              onMouseDown={runQuick(delCol)}
              className="rounded-md bg-background/50 border border-border/50 text-foreground/70 hover:bg-background/80 w-7 h-7 text-sm"
              title="Delete current column"
            >
              –
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="h-full">
      <div className="h-full px-0 py-0">
        <div className="h-full overflow-auto p-0" ref={scrollRef}>
          {coverImageUrl ? (
            <CoverImage
              url={coverImageUrl || undefined}
              position={coverPosition}
              readOnly={readOnly}
              onUrlChange={onCoverImageUrlChange}
              onPositionChange={onCoverPositionChange}
              height={250}
            />
          ) : null}
          {/* Centered page icon, consistent across views */}
          {icon ? <IconDisplay icon={icon} hasCover={!!coverImageUrl} /> : null}
          <div
            className={`px-4 ${coverImageUrl ? "pt-4" : icon ? "pt-3" : "pt-24"}`}
          >
            <div className="mx-auto w-full max-w-3xl">
              <div className="mb-6 relative group">
                {!readOnly ? (
                  <div
                    className={`flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity z-10 ${coverImageUrl || icon ? "mt-2" : ""}`}
                  >
                    <IconTrigger
                      onSave={(v) => onIconChange?.(v)}
                      onRemove={icon ? () => onIconChange?.(null) : undefined}
                      current={icon || ""}
                      className="text-xs text-muted-foreground hover:underline"
                    />
                    <AddCoverTrigger
                      onSave={(u) => onCoverImageUrlChange?.(u)}
                      className="text-xs text-muted-foreground hover:underline"
                      buttonLabel={coverImageUrl ? "Change cover" : "Add cover"}
                      currentUrl={coverImageUrl || null}
                    />
                  </div>
                ) : null}
                {readOnly ? (
                  <h1 className="w-full bg-transparent text-5xl font-semibold break-words">
                    {title && title.trim().length > 0 ? (
                      title
                    ) : (
                      <span className="text-muted-foreground/60 italic select-none">
                        New page
                      </span>
                    )}
                  </h1>
                ) : (
                  <input
                    className="w-full bg-transparent text-5xl font-extrabold focus:outline-none placeholder:text-muted-foreground/70"
                    placeholder="New page"
                    value={title}
                    onChange={(e) => onTitleChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (editor) {
                          const { state } = editor;
                          const hasAnyBlock = state.doc.childCount > 0;
                          if (!hasAnyBlock) {
                            editor.commands.setContent({
                              type: "doc",
                              content: [{ type: "paragraph" }],
                            });
                          } else {
                            const lastIndex = state.doc.childCount - 1;
                            const lastNode = state.doc.child(lastIndex);
                            if (
                              !lastNode ||
                              lastNode.type.name !== "paragraph"
                            ) {
                              editor
                                .chain()
                                .focus("end")
                                .insertContent({ type: "paragraph" })
                                .run();
                            }
                          }
                          editor.commands.focus("end");
                        }
                      } else if (e.key === "Enter" && e.shiftKey) {
                        e.preventDefault();
                        editor?.chain().focus("end").setHardBreak().run();
                      }
                    }}
                    ref={titleInputRef}
                    aria-label="Page title"
                  />
                )}
              </div>
            </div>
          </div>
          <div className="px-4 pb-8">
            <div className="mx-auto w-full max-w-3xl">
              {editor ? (
                readOnly ? (
                  <div className="relative" id="tiptap-editor-wrapper">
                    <EditorContent editor={editor} />
                  </div>
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={blockIds}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="relative" id="tiptap-editor-wrapper">
                        <EditorContent editor={editor} />
                        <PasteUrlMenu editor={editor} />
                        {editor && !readOnly && selPos?.visible ? (
                          <div
                            className="absolute z-20"
                            style={{
                              left: Math.max(8, selPos.x),
                              top:
                                selPos.yTop > 56 ? selPos.yTop : selPos.yBottom,
                              transform:
                                selPos.yTop > 56
                                  ? "translate(-50%, calc(-100% - 8px))"
                                  : "translate(-50%, 8px)",
                            }}
                          >
                            <div className="flex items-center gap-1 rounded-md border bg-background p-1 shadow-sm">
                              <button
                                className={`px-2 py-1 text-sm rounded ${editor.isActive("bold") ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"}`}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() =>
                                  editor.chain().focus().toggleBold().run()
                                }
                                disabled={
                                  !editor
                                    .can()
                                    .chain()
                                    .focus()
                                    .toggleBold()
                                    .run()
                                }
                              >
                                B
                              </button>
                              <button
                                className={`px-2 py-1 text-sm rounded ${editor.isActive("italic") ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"}`}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() =>
                                  editor.chain().focus().toggleItalic().run()
                                }
                                disabled={
                                  !editor
                                    .can()
                                    .chain()
                                    .focus()
                                    .toggleItalic()
                                    .run()
                                }
                              >
                                I
                              </button>
                              <button
                                className={`px-2 py-1 text-sm rounded ${editor.isActive("strike") ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"}`}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() =>
                                  editor.chain().focus().toggleStrike().run()
                                }
                                disabled={
                                  !editor
                                    .can()
                                    .chain()
                                    .focus()
                                    .toggleStrike()
                                    .run()
                                }
                              >
                                S
                              </button>
                              <button
                                className={`px-2 py-1 text-sm rounded ${editor.isActive("code") ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"}`}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() =>
                                  editor.chain().focus().toggleCode().run()
                                }
                                disabled={
                                  !editor
                                    .can()
                                    .chain()
                                    .focus()
                                    .toggleCode()
                                    .run()
                                }
                              >
                                {"</>"}
                              </button>
                              <button
                                className={`px-2 py-1 text-sm rounded ${editor.isActive("highlight") ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"}`}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() =>
                                  editor.chain().focus().toggleHighlight().run()
                                }
                                disabled={
                                  !editor
                                    .can()
                                    .chain()
                                    .focus()
                                    .toggleHighlight()
                                    .run()
                                }
                              >
                                H
                              </button>
                            </div>
                          </div>
                        ) : null}
                        <SlashMenu
                          editor={editor}
                          onCreateSubpage={onCreateSubpage}
                        />
                        <BlockControlsOverlay />
                        <TableOverlay />
                      </div>
                    </SortableContext>
                  </DndContext>
                )
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
