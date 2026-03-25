import { Editor } from '@tiptap/react'
import { useCallback, useEffect, useState } from 'react'

export function useTable(editor: Editor | null) {
  const [isTableActive, setIsTableActive] = useState(false)
  const [tablePosition, setTablePosition] = useState<{ top: number; left: number } | null>(null)
  const [showTableControls, setShowTableControls] = useState(false)

  // Check if table is active
  const checkTableActive = useCallback(() => {
    if (!editor) return false
    return editor.isActive('table')
  }, [editor])

  // Insert table
  const insertTable = useCallback(() => {
    if (!editor) return false
    
    // Insert a 3x3 table by default (like Notion)
    return editor
      .chain()
      .focus()
      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
      .run()
  }, [editor])

  // Delete table
  const deleteTable = useCallback(() => {
    if (!editor) return false
    return editor.chain().focus().deleteTable().run()
  }, [editor])

  // Add row
  const addRowBefore = useCallback(() => {
    if (!editor) return false
    return editor.chain().focus().addRowBefore().run()
  }, [editor])

  const addRowAfter = useCallback(() => {
    if (!editor) return false
    return editor.chain().focus().addRowAfter().run()
  }, [editor])

  // Add column
  const addColumnBefore = useCallback(() => {
    if (!editor) return false
    return editor.chain().focus().addColumnBefore().run()
  }, [editor])

  const addColumnAfter = useCallback(() => {
    if (!editor) return false
    return editor.chain().focus().addColumnAfter().run()
  }, [editor])

  // Delete row/column
  const deleteRow = useCallback(() => {
    if (!editor) return false
    return editor.chain().focus().deleteRow().run()
  }, [editor])

  const deleteColumn = useCallback(() => {
    if (!editor) return false
    return editor.chain().focus().deleteColumn().run()
  }, [editor])

  // Merge/split cells
  const mergeCells = useCallback(() => {
    if (!editor) return false
    return editor.chain().focus().mergeCells().run()
  }, [editor])

  const splitCell = useCallback(() => {
    if (!editor) return false
    return editor.chain().focus().splitCell().run()
  }, [editor])

  // Toggle header row/column
  const toggleHeaderRow = useCallback(() => {
    if (!editor) return false
    return editor.chain().focus().toggleHeaderRow().run()
  }, [editor])

  const toggleHeaderColumn = useCallback(() => {
    if (!editor) return false
    return false // Not available in basic TipTap table extension
  }, [editor])

  // Update table active state
  useEffect(() => {
    if (!editor) return

    const updateTableState = () => {
      const isActive = checkTableActive()
      setIsTableActive(isActive)
      
      if (isActive) {
        // Calculate table position for controls
        const { from } = editor.state.selection
        const coords = editor.view.coordsAtPos(from)
        setTablePosition({
          top: coords.top - 50,
          left: coords.left
        })
      } else {
        setTablePosition(null)
      }
    }

    // Initial check
    updateTableState()

    // Listen for selection changes
    editor.on('selectionUpdate', updateTableState)
    editor.on('transaction', updateTableState)

    return () => {
      editor.off('selectionUpdate', updateTableState)
      editor.off('transaction', updateTableState)
    }
  }, [editor, checkTableActive])

  // Show/hide table controls
  useEffect(() => {
    if (isTableActive && tablePosition) {
      setShowTableControls(true)
    } else {
      setShowTableControls(false)
    }
  }, [isTableActive, tablePosition])

  return {
    isTableActive,
    showTableControls,
    tablePosition,
    insertTable,
    deleteTable,
    addRowBefore,
    addRowAfter,
    addColumnBefore,
    addColumnAfter,
    deleteRow,
    deleteColumn,
    mergeCells,
    splitCell,
    toggleHeaderRow,
    toggleHeaderColumn,
    canInsertTable: editor?.can().insertTable() ?? false,
    canDeleteTable: editor?.can().deleteTable() ?? false,
    canAddRowBefore: editor?.can().addRowBefore() ?? false,
    canAddRowAfter: editor?.can().addRowAfter() ?? false,
    canAddColumnBefore: editor?.can().addColumnBefore() ?? false,
    canAddColumnAfter: editor?.can().addColumnAfter() ?? false,
    canDeleteRow: editor?.can().deleteRow() ?? false,
    canDeleteColumn: editor?.can().deleteColumn() ?? false,
    canMergeCells: editor?.can().mergeCells() ?? false,
    canSplitCell: editor?.can().splitCell() ?? false,
    canToggleHeaderRow: editor?.can().toggleHeaderRow() ?? false,
  }
}
