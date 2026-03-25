import { Table as TableExtension } from '@tiptap/extension-table'
import { TableRow as TableRowExtension } from '@tiptap/extension-table-row'
import { TableCell as TableCellExtension } from '@tiptap/extension-table-cell'
import { TableHeader as TableHeaderExtension } from '@tiptap/extension-table-header'

// Export the main table extension with Notion-like configuration
export const NotionTable = TableExtension.configure({
  resizable: true,
  HTMLAttributes: {
    class: 'notion-table',
  },
})

export const NotionTableRow = TableRowExtension.configure({
  HTMLAttributes: {
    class: 'notion-table-row',
  },
})

export const NotionTableCell = TableCellExtension.configure({
  HTMLAttributes: {
    class: 'notion-table-cell',
  },
})

export const NotionTableHeader = TableHeaderExtension.configure({
  HTMLAttributes: {
    class: 'notion-table-header',
  },
})
