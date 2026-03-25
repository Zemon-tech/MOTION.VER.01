import * as React from "react"
import type { Editor } from "@tiptap/react"
import { SuggestionMenu } from "@/components/tiptap-ui/suggestion-menu"

export type SlashMenuProps = {
  editor: Editor | null
  onCreateSubpage?: (title: string) => Promise<{ id: string; slug: string; title: string; icon: string | null }>
}

export function SlashMenu({ editor, onCreateSubpage }: SlashMenuProps) {
  const items = React.useCallback(({ query }: { query: string }) => {
    const q = query.toLowerCase()
    const all = [
      {
        title: "Text",
        subtext: "Paragraph",
        onSelect: ({ editor }: { editor: Editor }) => editor.chain().focus().setParagraph().run(),
        aliases: ["p", "text"],
      },
      {
        title: "Heading 1",
        subtext: "Large section title",
        onSelect: ({ editor }: { editor: Editor }) => editor.chain().focus().setHeading({ level: 1 }).run(),
        aliases: ["h1", "heading1"],
      },
      {
        title: "Heading 2",
        onSelect: ({ editor }: { editor: Editor }) => editor.chain().focus().setHeading({ level: 2 }).run(),
        aliases: ["h2", "heading2"],
      },
      {
        title: "Heading 3",
        onSelect: ({ editor }: { editor: Editor }) => editor.chain().focus().setHeading({ level: 3 }).run(),
        aliases: ["h3", "heading3"],
      },
      {
        title: "Heading 4",
        onSelect: ({ editor }: { editor: Editor }) => editor.chain().focus().setHeading({ level: 4 }).run(),
        aliases: ["h4", "heading4"],
      },
      {
        title: "Toggle heading 1",
        subtext: "Collapsible H1 toggle",
        onSelect: ({ editor }: { editor: Editor }) => editor.chain().focus().setDetails().updateAttributes('details', { level: 1 }).run(),
        aliases: ["toggle h1", "toggle heading1", "th1"],
      },
      {
        title: "Toggle heading 2",
        subtext: "Collapsible H2 toggle",
        onSelect: ({ editor }: { editor: Editor }) => editor.chain().focus().setDetails().updateAttributes('details', { level: 2 }).run(),
        aliases: ["toggle h2", "toggle heading2", "th2"],
      },
      {
        title: "Toggle heading 3",
        subtext: "Collapsible H3 toggle",
        onSelect: ({ editor }: { editor: Editor }) => editor.chain().focus().setDetails().updateAttributes('details', { level: 3 }).run(),
        aliases: ["toggle h3", "toggle heading3", "th3"],
      },
      {
        title: "Toggle heading 4",
        subtext: "Collapsible H4 toggle",
        onSelect: ({ editor }: { editor: Editor }) => editor.chain().focus().setDetails().updateAttributes('details', { level: 4 }).run(),
        aliases: ["toggle h4", "toggle heading4", "th4"],
      },
      {
        title: "Bulleted list",
        onSelect: ({ editor }: { editor: Editor }) => editor.chain().focus().toggleBulletList().run(),
        aliases: ["ul", "bullet", "list"],
      },
      {
        title: "Numbered list",
        onSelect: ({ editor }: { editor: Editor }) => editor.chain().focus().toggleOrderedList().run(),
        aliases: ["ol", "ordered", "list"],
      },
      {
        title: "Quote",
        onSelect: ({ editor }: { editor: Editor }) => editor.chain().focus().toggleBlockquote().run(),
        aliases: ["blockquote", "quote"],
      },
      {
        title: "Mermaid",
        subtext: "Insert editable Mermaid diagram",
        onSelect: ({ editor }: { editor: Editor }) => editor.chain().focus().setMermaidNode({}).run(),
        aliases: ["diagram", "mermaid", "flowchart"],
      },
      {
        title: "Code block",
        onSelect: ({ editor }: { editor: Editor }) => editor.chain().focus().toggleCodeBlock().run(),
        aliases: ["code"],
      },
      {
        title: "Horizontal rule",
        onSelect: ({ editor }: { editor: Editor }) => editor.chain().focus().setHorizontalRule().run(),
        aliases: ["hr", "rule", "line", "separator"],
      },
      {
        title: "Image upload",
        subtext: "Insert and upload image",
        onSelect: ({ editor }: { editor: Editor }) => editor.chain().focus().setImageUploadNode().run(),
        aliases: ["img", "image", "photo", "upload"],
      },
      {
        title: "Task list",
        onSelect: ({ editor }: { editor: Editor }) => editor.chain().focus().toggleTaskList().run(),
        aliases: ["todo", "task"],
      },
      {
        title: "Toggle list",
        subtext: "Collapsible block",
        onSelect: ({ editor }: { editor: Editor }) => editor.chain().focus().setDetails().run(),
        aliases: ["toggle", "details", "collapse"],
      },
      {
        title: "Align left",
        onSelect: ({ editor }: { editor: Editor }) => editor.chain().focus().setTextAlign('left').run(),
        aliases: ["left", "align"],
      },
      {
        title: "Align center",
        onSelect: ({ editor }: { editor: Editor }) => editor.chain().focus().setTextAlign('center').run(),
        aliases: ["center", "align"],
      },
      {
        title: "Align right",
        onSelect: ({ editor }: { editor: Editor }) => editor.chain().focus().setTextAlign('right').run(),
        aliases: ["right", "align"],
      },
      {
        title: "Table",
        subtext: "Insert a table",
        onSelect: ({ editor }: { editor: Editor }) => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
        aliases: ["table", "grid"],
      },
      ...(onCreateSubpage ? [{
        title: "Subpage",
        subtext: "Create a page inside this page",
        onSelect: async ({ editor }: { editor: Editor }) => {
          const defaultTitle = "Untitled"
          try {
            const created = await onCreateSubpage(defaultTitle)
            editor.chain().focus().insertContent({
              type: 'subpage',
              attrs: { pageId: created.id, slug: created.slug }
            }).run()
          } catch {}
        },
        aliases: ["subpage", "page", "child", "block"],
      }] : []),
    ]
    return all.filter((i) => {
      if (!q) return true
      if (i.title.toLowerCase().includes(q)) return true
      if (i.subtext && i.subtext.toLowerCase().includes(q)) return true
      return (i.aliases || []).some(a => a.toLowerCase().includes(q))
    })
  }, [onCreateSubpage])

  if (!editor) return null

  return <SuggestionMenu char="/" items={({ query }) => items({ query })} editor={editor} />
}

