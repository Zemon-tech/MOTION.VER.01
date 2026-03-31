import React, { useState, useEffect } from 'react'
import { 
  format, addMonths, subMonths, startOfMonth, endOfMonth, 
  startOfWeek, endOfWeek, isSameMonth, isSameDay, 
  eachDayOfInterval 
} from 'date-fns'
import { ChevronLeft, ChevronRight, Plus, CheckCircle2, Circle, Trash2, Calendar as CalendarIcon, Loader2 } from 'lucide-react'
import { api } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export function TodoCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [todos, setTodos] = useState<any[]>([])
  const [googleEvents, setGoogleEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced'>('idle')
  const [addingTodo, setAddingTodo] = useState(false)
  const [newTodoTitle, setNewTodoTitle] = useState('')

  const fetchTodos = async () => {
    setLoading(true)
    setSyncStatus('syncing')
    try {
      const start = startOfMonth(currentMonth)
      const end = endOfMonth(currentMonth)
      
      const [todoData, calendarData] = await Promise.all([
        api(`/todos?start=${start.toISOString()}&end=${end.toISOString()}`),
        api('/google/calendar/events').catch(() => ({ events: [] }))
      ])
      
      setTodos(todoData.todos || [])
      setGoogleEvents(calendarData.events || [])
      setSyncStatus('synced')
      setTimeout(() => setSyncStatus('idle'), 3000)
    } catch (error) {
      console.error('Fetch data error:', error)
      setSyncStatus('idle')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTodos()
  }, [currentMonth])

  const onDateClick = (day: Date) => {
    setSelectedDate(day)
    setAddingTodo(true)
  }

  const addTodo = async () => {
    if (!newTodoTitle.trim()) return
    try {
      const data = await api('/todos', {
        method: 'POST',
        body: JSON.stringify({ title: newTodoTitle, date: selectedDate.toISOString() })
      })
      setTodos([...todos, data.todo])
      setNewTodoTitle('')
      setAddingTodo(false)
    } catch (error) {
      console.error('Add todo error:', error)
    }
  }

  const toggleTodo = async (id: string, completed: boolean) => {
    try {
      const data = await api(`/todos/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ completed: !completed })
      })
      setTodos(todos.map(t => t._id === id ? data.todo : t))
    } catch (error) {
      console.error('Toggle todo error:', error)
    }
  }

  const deleteTodo = async (id: string) => {
    try {
      await api(`/todos/${id}`, { method: 'DELETE' })
      setTodos(todos.filter(t => t._id !== id))
    } catch (error) {
      console.error('Delete todo error:', error)
    }
  }

  const renderHeader = () => {
    return (
      <div className="flex items-center justify-between mb-8 px-2">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-orange-100 text-orange-600 dark:bg-orange-950/30 dark:text-orange-400 shadow-sm border border-orange-200 dark:border-orange-800/50">
             <CalendarIcon className="size-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold tracking-tight">{format(currentMonth, 'MMMM yyyy')}</h2>
              {syncStatus === 'syncing' && <span className="flex items-center gap-1 text-[10px] bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded-full font-bold animate-pulse"><Loader2 className="size-2.5 animate-spin" /> Syncing...</span>}
              {syncStatus === 'synced' && <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full font-bold animate-in fade-in zoom-in duration-300">✓ Data Synced</span>}
            </div>
            <p className="text-sm text-muted-foreground font-medium">Your schedule & tasks</p>
          </div>
        </div>
        <div className="flex bg-muted/60 p-1.5 rounded-xl border border-border/50">
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="hover:bg-background h-8 w-8 rounded-lg shadow-sm">
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(new Date())} className="hover:bg-background text-xs font-semibold h-8 mx-1 px-3 rounded-lg shadow-sm">
            Today
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="hover:bg-background h-8 w-8 rounded-lg shadow-sm">
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    )
  }

  const renderDays = () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    return (
      <div className="grid grid-cols-7 mb-4">
        {days.map((day, i) => (
          <div key={i} className="text-center text-xs font-bold text-muted-foreground uppercase tracking-widest py-2">
            {day}
          </div>
        ))}
      </div>
    )
  }

  const renderCells = () => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(monthStart)
    const startDate = startOfWeek(monthStart)
    const endDate = endOfWeek(monthEnd)

    const calendarDays = eachDayOfInterval({
      start: startDate,
      end: endDate
    })

    const rows: React.ReactNode[] = []
    let days: React.ReactNode[] = []

    calendarDays.forEach((day: Date, i: number) => {
      const dayTodos = todos.filter(t => isSameDay(new Date(t.date), day))
      const dayGoogleEvents = googleEvents.filter(e => {
        const start = e.start ? new Date(e.start) : null
        return start && isSameDay(start, day)
      })
      const isSelected = isSameDay(day, selectedDate)
      const isMonth = isSameMonth(day, monthStart)
      const isToday = isSameDay(day, new Date())

      days.push(
        <div
          key={day.toString()}
          className={cn(
            "min-h-[140px] border border-border/30 p-2 transition-all relative group cursor-pointer",
            !isMonth ? "bg-muted/10 opacity-40" : "bg-card hover:bg-muted/20",
            isToday && "bg-orange-50/30 dark:bg-orange-950/20 border-orange-200/50 dark:border-orange-800/30",
            isSelected && "ring-2 ring-primary ring-inset z-10"
          )}
          onClick={() => onDateClick(day)}
        >
          <div className="flex justify-between items-start mb-1">
            <span className={cn(
              "text-sm font-semibold flex items-center justify-center w-7 h-7 rounded-lg transition-colors",
              isToday ? "bg-orange-500 text-white shadow-md shadow-orange-500/20" : "group-hover:text-primary",
              !isMonth && "text-muted-foreground/50"
            )}>
              {format(day, 'd')}
            </span>
            { (dayTodos.length > 0 || dayGoogleEvents.length > 0) && (
              <div className="flex gap-1">
                {dayTodos.length > 0 && (
                  <span className="text-[10px] bg-orange-500 text-white px-1.5 py-0.5 rounded-md font-bold shadow-sm shadow-orange-500/20">
                    {dayTodos.length}
                  </span>
                )}
                {dayGoogleEvents.length > 0 && (
                  <span className="text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded-md font-bold shadow-sm shadow-blue-500/20">
                    {dayGoogleEvents.length} G
                  </span>
                )}
              </div>
            )}
          </div>
          
          <div className="space-y-1.5 max-h-[90px] overflow-hidden group-hover:overflow-y-auto custom-scrollbar pr-0.5">
            {dayTodos.slice(0, 4).map((todo) => (
              <div 
                key={todo._id} 
                className={cn(
                  "text-[11px] p-1.5 rounded-lg border truncate flex items-center gap-1.5 transition-all shadow-sm",
                  todo.completed 
                    ? "bg-muted/30 text-muted-foreground line-through border-transparent" 
                    : "bg-white dark:bg-muted/40 border-border/50 group-hover:border-primary/20"
                )}
              >
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full shrink-0",
                  todo.completed ? "bg-muted-foreground/30" : "bg-orange-500 shadow-[0_0_4px_rgba(249,115,22,0.4)]"
                )} />
                <span className="truncate flex-1 font-medium">{todo.title}</span>
              </div>
            ))}
            {dayTodos.length > 4 && (
              <div className="text-[10px] text-muted-foreground pl-1 font-bold italic opacity-70">
                + {dayTodos.length - 4} more
              </div>
            )}
          </div>

          <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
             <div className="bg-primary text-primary-foreground p-1 rounded-md shadow-lg">
                <Plus size={14} />
             </div>
          </div>
        </div>
      )

      if ((i + 1) % 7 === 0) {
        rows.push(
          <div className="grid grid-cols-7" key={day.toString()}>
            {days}
          </div>
        )
        days = []
      }
    })

    return (
      <div className="rounded-2xl border border-border/60 overflow-hidden shadow-2xl shadow-primary/5 bg-background">
        {renderDays()}
        {rows}
      </div>
    )
  }

  const selectedDateTodos = todos.filter(t => isSameDay(new Date(t.date), selectedDate))

  return (
    <div className="w-full">
      {renderHeader()}
      {loading ? (
        <div className="flex items-center justify-center py-20 bg-muted/20 rounded-2xl border-2 border-dashed">
          <Loader2 className="size-8 animate-spin text-primary opacity-50" />
        </div>
      ) : (
        renderCells()
      )}

      <Dialog open={addingTodo} onOpenChange={setAddingTodo}>
        <DialogContent className="sm:max-w-md rounded-2xl border-none shadow-2xl overflow-hidden p-0">
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-6 text-white">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <CalendarIcon size={20} />
              {format(selectedDate, 'EEEE, MMMM d')}
            </h2>
            <p className="text-orange-100 text-sm mt-1 font-medium">Manage your tasks for this day</p>
          </div>
          
          <div className="p-6 space-y-6 bg-background">
            <div className="flex gap-2">
              <input
                className="flex h-11 w-full rounded-xl border border-border bg-muted/30 px-4 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all shadow-inner"
                placeholder="What needs to be done?"
                value={newTodoTitle}
                onChange={(e) => setNewTodoTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTodo()}
                autoFocus
              />
              <Button onClick={addTodo} className="rounded-xl px-5 h-11 bg-orange-500 hover:bg-orange-600 shadow-lg shadow-orange-500/20 transition-all font-bold">Add</Button>
            </div>

            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
              {selectedDateTodos.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground italic rounded-2xl border-2 border-dashed border-muted flex flex-col items-center gap-2">
                  <div className="p-3 rounded-full bg-muted/50 text-muted-foreground/50">
                     <Plus className="size-6 opacity-30" />
                  </div>
                  <p className="text-sm font-medium">No tasks for today. Click add to start!</p>
                </div>
              ) : (
                selectedDateTodos.map((todo) => (
                  <div key={todo._id} className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-muted/10 hover:bg-muted/20 transition-all group/todo shadow-sm animate-in fade-in slide-in-from-bottom-1 duration-200">
                    <div className="flex items-center gap-3 min-w-0">
                      <button 
                        onClick={() => toggleTodo(todo._id, todo.completed)}
                        className={cn(
                          "shrink-0 transition-transform active:scale-95",
                          todo.completed ? "text-primary" : "text-muted-foreground hover:text-primary"
                        )}
                      >
                        {todo.completed ? <CheckCircle2 size={22} className="fill-primary/10" /> : <Circle size={22} />}
                      </button>
                      <span className={cn(
                        "text-sm font-semibold truncate transition-all",
                        todo.completed ? "text-muted-foreground/60 line-through" : "text-foreground"
                      )}>
                        {todo.title}
                      </span>
                    </div>
                    <button 
                      onClick={() => deleteTodo(todo._id)} 
                      className="text-muted-foreground opacity-0 group-hover/todo:opacity-100 hover:text-red-500 transition-all p-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
          
          <div className="p-4 border-t bg-muted/30 flex justify-end">
             <Button variant="ghost" onClick={() => setAddingTodo(false)} className="rounded-xl font-bold h-10 px-6">Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
