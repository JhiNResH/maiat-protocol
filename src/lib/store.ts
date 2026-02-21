import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface Project {
  id: string
  name: string
  category: string
  avgRating: number
  reviewCount: number
  image?: string
  description?: string
}

export interface Review {
  id: string
  projectId: string
  projectName: string
  reviewer: string
  content: string
  rating: number // 1-5
  upvotes: number
  downvotes: number
  createdAt: string
}

interface AppState {
  // Data
  projects: Project[]
  reviews: Review[]
  
  // User State
  userAddress: string | null
  scarabBalance: number

  // Actions
  setUserAddress: (address: string | null) => void
  setScarabBalance: (balance: number) => void
  addProject: (project: Project) => void
  addReview: (review: Review) => void
  updateReviewVotes: (reviewId: string, upvotes: number, downvotes: number) => void
  
  // Helpers
  getProject: (id: string) => Project | undefined
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      projects: [],
      reviews: [],
      userAddress: null,
      scarabBalance: 0,

      setUserAddress: (address) => set({ userAddress: address }),
      setScarabBalance: (balance) => set({ scarabBalance: balance }),

      addProject: (newProject) => set((state) => {
        // Prevent duplicates
        if (state.projects.find(p => p.id === newProject.id)) return state
        return {
          projects: [newProject, ...state.projects]
        }
      }),

      addReview: (newReview) => set((state) => ({
        reviews: [newReview, ...state.reviews],
        projects: state.projects.map(p => 
          p.id === newReview.projectId 
            ? { ...p, reviewCount: p.reviewCount + 1 } 
            : p
        )
      })),

      updateReviewVotes: (reviewId, upvotes, downvotes) => set((state) => ({
        reviews: state.reviews.map(r => 
          r.id === reviewId 
            ? { ...r, upvotes, downvotes } 
            : r
        )
      })),

      getProject: (id) => get().projects.find(p => p.id === id)
    }),
    {
      name: 'maat-storage',
      storage: createJSONStorage(() => 
        typeof window !== 'undefined' ? window.localStorage : ({} as any)
      ),
      skipHydration: typeof window === 'undefined',
    }
  )
)
