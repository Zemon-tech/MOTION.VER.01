/**
 * Toggle List Extension for Tiptap
 * 
 * A clean implementation using Tiptap's official Details extension.
 * This creates Notion-style collapsible sections using native HTML <details> elements.
 * 
 * Usage:
 * - Import and add to editor extensions
 * - Use editor.commands.setDetails() to create a toggle
 * - Click the summary to expand/collapse content
 */

import Details from '@tiptap/extension-details'
import DetailsSummary from '@tiptap/extension-details-summary'
import DetailsContent from '@tiptap/extension-details-content'

/**
 * Configure the Details extension with sensible defaults
 */
export const ToggleList = Details.extend({
  addAttributes() {
    return {
      level: {
        default: 0,
        renderHTML: (attrs: any) => ({ 'data-level': attrs.level }),
      },
    }
  },
}).configure({
  persist: true, // Save open/closed state in the document
  openClassName: 'is-open', // CSS class when expanded
  HTMLAttributes: {
    class: 'toggle-list',
  },
})

/**
 * Configure DetailsSummary (the clickable header)
 */
export const ToggleSummary = DetailsSummary.configure({
  HTMLAttributes: {
    class: 'toggle-summary',
  },
})

/**
 * Configure DetailsContent (the collapsible content area)
 */
export const ToggleContent = DetailsContent.configure({
  HTMLAttributes: {
    class: 'toggle-content',
  },
})
