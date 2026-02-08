# Transcripts Folder

Drop your meeting transcript files here (JSON format) and they will be automatically processed.

## Expected JSON Format

```json
{
  "meeting_title": "Sprint Planning Meeting",
  "date": "2026-02-08",
  "participants": ["Alice Johnson", "Bob Smith", "Sarah Chen"],
  "transcript": [
    {
      "speaker": "Sarah Chen",
      "text": "Alice, I need you to work on the dashboard frontend this sprint.",
      "timestamp": "00:01:30"
    }
  ],
  "action_items": [
    {
      "assignee": "Alice Johnson",
      "task": "Build dashboard frontend with React",
      "priority": "high",
      "deadline": "2026-02-15"
    }
  ]
}
```

## Processing

When a new `.json` file is added to this folder:
1. The system parses the transcript
2. Extracts action items and task assignments
3. Matches assignees to users in the database
4. Creates/updates Jira issues for each assigned task
5. Moves processed files to the `processed/` subfolder
