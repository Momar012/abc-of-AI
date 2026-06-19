import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { CURRICULUM, CurriculumModule } from '@/data/curriculum'

interface CurriculumContentState {
  modules: CurriculumModule[]
  setModules: (modules: CurriculumModule[]) => void
  resetToDefaults: () => void
}

export const useCurriculumContentStore = create<CurriculumContentState>()(
  persist(
    (set) => ({
      modules: JSON.parse(JSON.stringify(CURRICULUM)),
      setModules: (modules) => set({ modules }),
      resetToDefaults: () => set({ modules: JSON.parse(JSON.stringify(CURRICULUM)) }),
    }),
    {
      name: 'abcai_curriculum_content_v1',
      partialize: (s) => ({ modules: s.modules }),
    }
  )
)
