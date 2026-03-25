import { Editor } from '@tiptap/react'
import { Table } from 'lucide-react'

interface TableButtonProps {
  editor: Editor | null
  isActive: boolean
  onClick: () => void
}

export function TableButton({ editor, isActive, onClick }: TableButtonProps) {
  if (!editor) return null

  return (
    <button
      type="button"
      onClick={onClick}
      className={`toolbar-button ${isActive ? 'active' : ''}`}
      title="Insert table"
      disabled={!editor.isEditable}
    >
      <Table size={16} />
    </button>
  )
}
