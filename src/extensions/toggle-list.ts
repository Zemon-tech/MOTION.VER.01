/**
 * Toggle List Extension for Tiptap v3
 *
 * Uses the official @tiptap/extension-details package (v3),
 * which bundles Details, DetailsSummary, and DetailsContent
 * in a single package. The standalone v2 packages
 * (@tiptap/extension-details-summary, @tiptap/extension-details-content)
 * were merged into this package in v3.
 *
 * Usage:
 * - Import and add to editor extensions
 * - Use editor.commands.setDetails() to create a toggle
 * - Click the summary to expand/collapse content
 */

import { Details, DetailsSummary, DetailsContent } from '@tiptap/extension-details'

/**
 * Configure the Details extension with sensible defaults.
 * Uses this.parent?.() in addAttributes to preserve the 'open'
 * attribute that persist: true depends on.
 */
export const ToggleList = Details.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
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
