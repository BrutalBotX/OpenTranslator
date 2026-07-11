import { create } from 'zustand'

export interface Character {
  id: string
  novelId: string
  name: string
  aliases: string[]
  gender: 'Male' | 'Female' | 'Non-binary' | 'Unknown'
  role: 'Protagonist' | 'Antagonist' | 'Supporting' | 'Minor'
  status: 'Alive' | 'Dead' | 'Missing' | 'Unknown'
  traits: Record<string, any>
  stateSummary: string
}

interface CharacterState {
  characters: Character[]
  setCharacters: (characters: Character[]) => void
  addCharacter: (character: Character) => void
  updateCharacter: (id: string, updates: Partial<Character>) => void
  removeCharacter: (id: string) => void
}

export const useCharacterStore = create<CharacterState>(set => ({
  characters: [],
  setCharacters: characters => set({ characters }),
  addCharacter: character =>
    set(state => ({ characters: [...state.characters, character] })),
  updateCharacter: (id, updates) =>
    set(state => ({
      characters: state.characters.map(c =>
        c.id === id ? { ...c, ...updates } : c
      )
    })),
  removeCharacter: id =>
    set(state => ({
      characters: state.characters.filter(c => c.id !== id)
    }))
}))
