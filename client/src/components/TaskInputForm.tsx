import { useState } from "react"
import { Button } from "@/components/ui/button"

interface TaskInputFormProps {
  onSubmit: (description: string, taskType?: string) => void
  isLoading: boolean
}

export default function TaskInputForm({ onSubmit, isLoading }: TaskInputFormProps) {
  const [description, setDescription] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (description.trim()) {
      onSubmit(description)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
      <div className="space-y-2">
        <label htmlFor="task-description" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          Task Description
        </label>
        <textarea
          id="task-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the task to be allocated..."
          className="flex min-h-30 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isLoading}
        />
      </div>
      <Button type="submit" disabled={isLoading || !description.trim()}>
        {isLoading ? "Allocating..." : "Allocate Task"}
      </Button>
    </form>
  )
}
