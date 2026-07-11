interface AmbiguityHighlighterProps {
  text: string
  issues: Array<{ start: number; end: number; type: string }>
  onIssueClick: (type: string) => void
}

export default function AmbiguityHighlighter({ text, issues, onIssueClick }: AmbiguityHighlighterProps) {
  if (issues.length === 0) {
    return <span>{text}</span>
  }

  const parts: Array<{ text: string; highlighted: boolean; type?: string }> = []
  let lastIndex = 0

  for (const issue of issues.sort((a, b) => a.start - b.start)) {
    if (issue.start > lastIndex) {
      parts.push({ text: text.slice(lastIndex, issue.start), highlighted: false })
    }
    parts.push({ text: text.slice(issue.start, issue.end), highlighted: true, type: issue.type })
    lastIndex = issue.end
  }

  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), highlighted: false })
  }

  return (
    <span>
      {parts.map((part, i) =>
        part.highlighted ? (
          <button
            key={i}
            onClick={() => onIssueClick(part.type!)}
            className="bg-yellow-900/40 text-yellow-300 border-b border-dashed border-yellow-500 hover:bg-yellow-900/60 cursor-help transition-colors"
            title={`Ambiguous: ${part.type}`}
          >
            {part.text}
          </button>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </span>
  )
}
