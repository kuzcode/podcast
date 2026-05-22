import { create } from 'zustand'
import { createPodcastFromUrl } from '@/api/podcasts'

interface ImportState {
  active: boolean
  url: string | null
  start: (url: string, userId: string) => Promise<string>
  reset: () => void
}

export const useImportStore = create<ImportState>((set) => ({
  active: false,
  url: null,

  start: async (url, userId) => {
    set({ active: true, url })
    try {
      const podcast = await createPodcastFromUrl(url, userId)
      set({ active: false, url: null })
      return podcast.$id
    } catch (e) {
      set({ active: false, url: null })
      throw e
    }
  },

  reset: () => set({ active: false, url: null }),
}))
