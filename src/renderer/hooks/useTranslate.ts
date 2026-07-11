import { useMutation } from '@tanstack/react-query'
import { useTranslationStore, Segment } from '../stores/translationStore'

interface TranslateParams {
  segmentId: string
  sourceText: string
  chapterId: string
  novelId: string
}

interface TranslateResult {
  translation: string
  warnings: string[]
}

async function callTranslate(params: TranslateParams): Promise<TranslateResult> {
  const response = await window.electronAPI.fetch('/api/translate', {
    method: 'POST',
    body: {
      source_text: params.sourceText,
      chapter_id: params.chapterId,
      novel_id: params.novelId
    }
  })
  return response
}

export function useTranslate() {
  const { updateTranslation, updateStatus } = useTranslationStore()

  return useMutation({
    mutationFn: callTranslate,
    onMutate: variables => {
      updateStatus(variables.segmentId, 'translating')
    },
    onSuccess: (data, variables) => {
      updateTranslation(variables.segmentId, data.translation)
      updateStatus(variables.segmentId, data.warnings.length > 0 ? 'needs_review' : 'translated')
    },
    onError: (_error, variables) => {
      updateStatus(variables.segmentId, 'needs_review')
    }
  })
}
