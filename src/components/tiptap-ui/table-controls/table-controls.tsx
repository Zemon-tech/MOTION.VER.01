
import { Editor } from '@tiptap/react'
import {  
  Minus, 
  ArrowUp, 
  ArrowDown, 
  ArrowLeft, 
  ArrowRight,
  Trash2,
} from 'lucide-react'

interface TableControlsProps {
  editor: Editor | null
  isVisible: boolean
  position: { top: number; left: number }
}

export function TableControls({ editor, isVisible, position }: TableControlsProps) {
  if (!editor) return null

  const canAddRowBefore = editor.can().addRowBefore()
  const canAddRowAfter = editor.can().addRowAfter()
  const canAddColumnBefore = editor.can().addColumnBefore()
  const canAddColumnAfter = editor.can().addColumnAfter()
  const canDeleteRow = editor.can().deleteRow()
  const canDeleteColumn = editor.can().deleteColumn()
  const canDeleteTable = editor.can().deleteTable()

  const handleAddRowBefore = () => {
    if (canAddRowBefore) {
      editor.chain().focus().addRowBefore().run()
    }
  }

  const handleAddRowAfter = () => {
    if (canAddRowAfter) {
      editor.chain().focus().addRowAfter().run()
    }
  }

  const handleAddColumnBefore = () => {
    if (canAddColumnBefore) {
      editor.chain().focus().addColumnBefore().run()
    }
  }

  const handleAddColumnAfter = () => {
    if (canAddColumnAfter) {
      editor.chain().focus().addColumnAfter().run()
    }
  }

  const handleDeleteRow = () => {
    if (canDeleteRow) {
      editor.chain().focus().deleteRow().run()
    }
  }

  const handleDeleteColumn = () => {
    if (canDeleteColumn) {
      editor.chain().focus().deleteColumn().run()
    }
  }

  const handleDeleteTable = () => {
    if (canDeleteTable) {
      editor.chain().focus().deleteTable().run()
    }
  }

  return (
    <div 
      className={`table-controls ${isVisible ? 'visible' : ''}`}
      style={{
        top: position.top,
        left: position.left,
      }}
    >
      {/* Row controls */}
      <div className="table-control-group">
        <button
          className="table-control-button"
          onClick={handleAddRowBefore}
          disabled={!canAddRowBefore}
          title="Add row above"
        >
          <ArrowUp size={14} />
          <span>Row</span>
        </button>
        <button
          className="table-control-button"
          onClick={handleAddRowAfter}
          disabled={!canAddRowAfter}
          title="Add row below"
        >
          <ArrowDown size={14} />
          <span>Row</span>
        </button>
        <button
          className="table-control-button"
          onClick={handleDeleteRow}
          disabled={!canDeleteRow}
          title="Delete row"
        >
          <Minus size={14} />
          <span>Row</span>
        </button>
      </div>

      {/* Column controls */}
      <div className="table-control-group">
        <button
          className="table-control-button"
          onClick={handleAddColumnBefore}
          disabled={!canAddColumnBefore}
          title="Add column left"
        >
          <ArrowLeft size={14} />
          <span>Col</span>
        </button>
        <button
          className="table-control-button"
          onClick={handleAddColumnAfter}
          disabled={!canAddColumnAfter}
          title="Add column right"
        >
          <ArrowRight size={14} />
          <span>Col</span>
        </button>
        <button
          className="table-control-button"
          onClick={handleDeleteColumn}
          disabled={!canDeleteColumn}
          title="Delete column"
        >
          <Minus size={14} />
          <span>Col</span>
        </button>
      </div>

      {/* Table controls */}
      <div className="table-control-group">
        <button
          className="table-control-button"
          onClick={handleDeleteTable}
          disabled={!canDeleteTable}
          title="Delete table"
        >
          <Trash2 size={14} />
          <span>Table</span>
        </button>
      </div>
    </div>
  )
}
