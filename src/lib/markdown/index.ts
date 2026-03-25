export type TipTapJSON = any

// Minimal serializer for selection/context: headings, lists, paragraphs, code, blockquote
export function toMarkdown(json: TipTapJSON): string {
  try {
    if (!json || !Array.isArray(json?.content)) return ''
    const lines: string[] = []
    for (const node of json.content) {
      switch (node?.type) {
        case 'heading': {
          const level = Math.min(6, Math.max(1, node.attrs?.level || 1))
          const text = extractText(node)
          lines.push(`${'#'.repeat(level)} ${text}`)
          break
        }
        case 'bulletList': {
          for (const li of node.content || []) {
            const text = extractText(li)
            lines.push(`- ${text}`)
          }
          lines.push('')
          break
        }
        case 'orderedList': {
          let i = 1
          for (const li of node.content || []) {
            const text = extractText(li)
            lines.push(`${i++}. ${text}`)
          }
          lines.push('')
          break
        }
        case 'codeBlock': {
          const lang = node.attrs?.language || ''
          const text = extractText(node)
          lines.push('```' + lang)
          lines.push(text)
          lines.push('```')
          break
        }
        case 'blockquote': {
          const text = extractText(node)
          for (const l of text.split('\n')) lines.push(`> ${l}`)
          break
        }
        case 'paragraph':
        default: {
          const text = extractText(node)
          lines.push(text)
          break
        }
      }
      lines.push('')
    }
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  } catch {
    return ''
  }
}

// Lightweight Markdown parser to TipTap JSON supporting common blocks
export function fromMarkdown(md: string): TipTapJSON {
  const safe = String(md || '').replace(/\r\n/g, '\n')
  const content: any[] = []
  const lines = safe.split('\n')
  let i = 0

  const pushParagraph = (text: string) => {
    const t = text.trim()
    if (!t) return
    content.push({ type: 'paragraph', content: parseInline(t) })
  }

  while (i < lines.length) {
    const line = lines[i]

    // Fence code block
    const fence = line.match(/^```(.*)$/)
    if (fence) {
      const lang = fence[1]?.trim() || ''
      i++
      const codeLines: string[] = []
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      // skip closing fence
      if (i < lines.length && lines[i].startsWith('```')) i++
      content.push({ type: 'codeBlock', attrs: lang ? { language: lang } : undefined, content: [{ type: 'text', text: codeLines.join('\n') }] })
      continue
    }

    // Heading
    const h = line.match(/^(#{1,6})\s+(.*)$/)
    if (h) {
      const level = Math.min(6, h[1].length)
      content.push({ type: 'heading', attrs: { level }, content: parseInline(h[2]) })
      i++
      continue
    }

    // Blockquote (single paragraph)
    if (/^>\s?/.test(line)) {
      const quoteLines: string[] = []
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''))
        i++
      }
      content.push({ type: 'blockquote', content: [{ type: 'paragraph', content: parseInline(quoteLines.join('\n')) }] })
      continue
    }

    // Lists
    if (/^\s*[-*]\s+/.test(line)) {
      const items: any[] = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        const txt = lines[i].replace(/^\s*[-*]\s+/, '')
        items.push({ type: 'listItem', content: [{ type: 'paragraph', content: parseInline(txt) }] })
        i++
      }
      content.push({ type: 'bulletList', content: items })
      continue
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: any[] = []
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        const txt = lines[i].replace(/^\s*\d+\.\s+/, '')
        items.push({ type: 'listItem', content: [{ type: 'paragraph', content: parseInline(txt) }] })
        i++
      }
      content.push({ type: 'orderedList', content: items })
      continue
    }

    // Blank line -> skip
    if (!line.trim()) { i++; continue }

    // Paragraph: accumulate until blank or different block
    const para: string[] = [line]
    i++
    while (i < lines.length && lines[i].trim() && !/^(#{1,6})\s+/.test(lines[i]) && !/^```/.test(lines[i]) && !/^>\s?/.test(lines[i]) && !/^\s*[-*]\s+/.test(lines[i]) && !/^\s*\d+\.\s+/.test(lines[i])) {
      para.push(lines[i])
      i++
    }
    pushParagraph(para.join(' '))
  }

  return { type: 'doc', content }
}

function extractText(node: any): string {
  if (!node) return ''
  if (node.type === 'text') return node.text || ''
  if (Array.isArray(node.content)) return node.content.map(extractText).join('')
  return ''
}

// Very small inline parser: **bold**, *italic*, `code`, [text](url)
function parseInline(text: string): any[] {
  const nodes: any[] = []
  if (!text) return nodes
  const pattern = /(\*\*[^*]+\*\*)|(\*[^*]+\*)|(`[^`]+`)|(\[[^\]]+\]\([^\)]+\))/g
  let idx = 0
  let m: RegExpExecArray | null
  const pushText = (t: string) => { if (t) nodes.push({ type: 'text', text: t }) }
  while ((m = pattern.exec(text)) !== null) {
    const start = m.index
    if (start > idx) pushText(text.slice(idx, start))
    const token = m[0]
    if (token.startsWith('**')) {
      const inner = token.slice(2, -2)
      nodes.push({ type: 'text', text: inner, marks: [{ type: 'bold' }] })
    } else if (token.startsWith('*')) {
      const inner = token.slice(1, -1)
      nodes.push({ type: 'text', text: inner, marks: [{ type: 'italic' }] })
    } else if (token.startsWith('`')) {
      const inner = token.slice(1, -1)
      nodes.push({ type: 'text', text: inner, marks: [{ type: 'code' }] })
    } else if (token.startsWith('[')) {
      const mm = token.match(/^\[([^\]]+)\]\(([^\)]+)\)$/)
      if (mm) {
        nodes.push({ type: 'text', text: mm[1], marks: [{ type: 'link', attrs: { href: mm[2] } }] })
      } else {
        pushText(token)
      }
    }
    idx = start + token.length
  }
  if (idx < text.length) pushText(text.slice(idx))
  return nodes
}
