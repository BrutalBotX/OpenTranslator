import { useQuery } from '@tanstack/react-query'

interface ContextData {
  characters: Array<{
    name: string
    gender: string
    role: string
    stateSummary: string
  }>
  plotSummary: string
  glossaryTerms: Array<{
    sourceTerm: string
    targetTerm: string
    category: string
  }>
}

async function fetchContext(chapterId: string, novelId: string): Promise<ContextData> {
  return window.electronAPI.fetch(`/api/context/${chapterId}?novel_id=${novelId}`)
}

export function useContextGather(chapterId: string | undefined, novelId: string | undefined) {
  return useQuery({
    queryKey: ['context', chapterId, novelId],
    queryFn: () => fetchContext(chapterId!, novelId!),
    enabled: !!chapterId && !!novelId
  })
}
