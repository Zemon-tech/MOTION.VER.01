import { mergeAttributes, Node } from "@tiptap/core"
import { ReactNodeViewRenderer } from "@tiptap/react"
import type { NodeType } from "@tiptap/pm/model"
import { MermaidNode as MermaidNodeComponent } from "./mermaid-node"

export interface MermaidNodeOptions {
  type?: string | NodeType | undefined
  HTMLAttributes: Record<string, any>
}

declare module "@tiptap/react" {
  interface Commands<ReturnType> {
    mermaidNode: {
      setMermaidNode: (attrs?: Partial<{ code: string; mode: "code" | "preview" | "split" }>) => ReturnType
      updateMermaidCode: (code: string) => ReturnType
      toggleMermaidMode: (mode: "code" | "preview" | "split") => ReturnType
    }
  }
}

export const MermaidNode = Node.create<MermaidNodeOptions>({
  name: "mermaidNode",

  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addOptions() {
    return {
      type: "div",
      HTMLAttributes: {},
    }
  },

  addAttributes() {
    return {
      code: {
        default: "graph TD\n  A[Mermaid] --> B[Diagram]",
      },
      mode: {
        default: "split",
        parseHTML: (el) => (el.getAttribute("data-mode") as any) || "split",
        renderHTML: (attrs) => ({ "data-mode": attrs.mode }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="mermaid-node"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      this.options.type as string,
      mergeAttributes({ "data-type": "mermaid-node" }, HTMLAttributes),
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(MermaidNodeComponent)
  },

  addCommands() {
    return {
      setMermaidNode:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),

      updateMermaidCode:
        (code: string) =>
        ({ commands }) => {
          return commands.updateAttributes(this.name, { code })
        },

      toggleMermaidMode:
        (mode: "code" | "preview" | "split") =>
        ({ commands }) => commands.updateAttributes(this.name, { mode }),
    }
  },
})

export default MermaidNode
