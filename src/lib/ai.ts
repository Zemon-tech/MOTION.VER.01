import { apiBase } from './utils'

export type SuggestMode = 'brainstorm' | 'continue' | 'find_words' | 'clarify' | 'outline'
export type EditMode = 'rewrite' | 'expand' | 'shorten' | 'improve_style' | 'fix_grammar'

export async function aiSuggest(body: {
  mode: SuggestMode
  selectionMarkdown: string
  contextMarkdown?: string
  pageMeta?: { title?: string }
  constraints?: { tone?: string; length?: string; audience?: string }
}): Promise<{ suggestions: { markdown: string }[] }> {
  const res = await fetch(`${apiBase}/ai/suggest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('accessToken') || ''}` },
    body: JSON.stringify({ ...body, stream: false }),
    credentials: 'include',
  })
  if (!res.ok) throw new Error('suggest failed')
  return res.json()
}

export async function* aiSuggestStream(body: {
  mode: SuggestMode
  selectionMarkdown: string
  contextMarkdown?: string
  pageMeta?: { title?: string }
  constraints?: { tone?: string; length?: string; audience?: string }
}): AsyncGenerator<string> {
  const res = await fetch(`${apiBase}/ai/suggest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('accessToken') || ''}` },
    body: JSON.stringify({ ...body, stream: true }),
    credentials: 'include',
  })
  if (!res.ok || !res.body) throw new Error('suggest stream failed')
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let idx
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const raw = buffer.slice(0, idx)
      buffer = buffer.slice(idx + 2)
      if (raw.startsWith('data: ')) {
        const data = raw.slice(6)
        try {
          const j = JSON.parse(data)
          if (j?.markdown) yield j.markdown
        } catch {}
      }
    }
  }
}

export async function aiEdit(body: {
  mode: EditMode
  selectionMarkdown: string
  contextMarkdown?: string
  constraints?: { tone?: string; length?: string; audience?: string }
}): Promise<{ markdown: string }> {
  const res = await fetch(`${apiBase}/ai/edit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('accessToken') || ''}` },
    body: JSON.stringify({ ...body, stream: false }),
    credentials: 'include',
  })
  if (!res.ok) throw new Error('edit failed')
  return res.json()
}

export async function* aiEditStream(body: {
  mode: EditMode
  selectionMarkdown: string
  contextMarkdown?: string
  constraints?: { tone?: string; length?: string; audience?: string }
}): AsyncGenerator<string> {
  const res = await fetch(`${apiBase}/ai/edit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('accessToken') || ''}` },
    body: JSON.stringify({ ...body, stream: true }),
    credentials: 'include',
  })
  if (!res.ok || !res.body) throw new Error('edit stream failed')
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let idx
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const raw = buffer.slice(0, idx)
      buffer = buffer.slice(idx + 2)
      if (raw.startsWith('data: ')) {
        const data = raw.slice(6)
        try {
          const j = JSON.parse(data)
          if (j?.markdown) yield j.markdown
        } catch {}
      }
    }
  }
}
