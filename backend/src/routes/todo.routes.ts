import { Router, Request, Response } from 'express'
import { auth } from '../middleware/auth'
import { Todo } from '../db/models/Todo'

const router = Router()

// Get all todos for a specific date or date range
router.get('/', auth, async (req: any, res) => {
  const { start, end } = req.query
  try {
    const filter: any = { userId: req.user.userId }
    if (start && end) {
      filter.date = { $gte: new Date(start as string), $lte: new Date(end as string) }
    } else if (start) {
      filter.date = new Date(start as string)
    }
    const todos = await Todo.find(filter).sort({ createdAt: -1 })
    res.json({ todos })
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching todos' })
  }
})

// Create a new todo
router.post('/', auth, async (req: any, res) => {
  const { title, date } = req.body
  if (!title || !date) return res.status(400).json({ error: 'Missing title or date' })
  try {
    const todo = await Todo.create({ 
      userId: req.user.userId, 
      title, 
      date: new Date(date) 
    })
    res.json({ todo })
  } catch (err) {
    res.status(500).json({ error: 'Server error creating todo' })
  }
})

// Update todo status or title
router.patch('/:id', auth, async (req: any, res) => {
  const { completed, title } = req.body
  try {
    const update: any = {}
    if (completed !== undefined) update.completed = completed
    if (title !== undefined) update.title = title
    const todo = await Todo.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.userId },
      { $set: update },
      { new: true }
    )
    if (!todo) return res.status(404).json({ error: 'Todo not found' })
    res.json({ todo })
  } catch (err) {
    res.status(500).json({ error: 'Server error updating todo' })
  }
})

// Delete a todo
router.delete('/:id', auth, async (req: any, res) => {
  try {
    const result = await Todo.deleteOne({ _id: req.params.id, userId: req.user.userId })
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Todo not found' })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Server error deleting todo' })
  }
})

export default router
