import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuid } from 'uuid'

export interface Toast {
  id: string
  message: string
  type: 'info' | 'success' | 'warn'
}

interface UIState {
  toasts: Toast[]
  earnedBadges: string[]
  firstVisit: boolean
  showEducationalOverlay: boolean
  selectedBlockId: string | null
  selectedBlockType: 'labelled' | 'unlabelled' | 'model' | 'rl-gridworld' | 'sensor' | 'condition' | 'switch' | 'logic' | 'fan' | 'alarm' | 'ac' | 'timer' | 'door' | 'bulb' | null
  testResultsModalBlockId: string | null
  clusterResultsModalBlockId: string | null
  labellingModalBlockId: string | null
  selectedBankItemIds: string[]
  leftPanelCollapsed: boolean
  rightPanelCollapsed: boolean
  curriculumCollapsed: boolean
  canvasTool: 'select' | 'pan' | 'text'
  canvasInteractive: boolean

  addToast: (message: string, type?: Toast['type']) => void
  removeToast: (id: string) => void
  earnBadge: (badgeId: string) => void
  setFirstVisitSeen: () => void
  setShowEducationalOverlay: (show: boolean) => void
  setSelectedBlock: (id: string, type: 'labelled' | 'unlabelled' | 'model' | 'rl-gridworld' | 'sensor' | 'condition' | 'switch' | 'logic' | 'fan' | 'alarm' | 'ac' | 'timer' | 'door' | 'bulb') => void
  clearSelectedBlock: () => void
  openTestResultsModal: (blockId: string) => void
  closeTestResultsModal: () => void
  openClusterResultsModal: (blockId: string) => void
  closeClusterResultsModal: () => void
  openLabellingModal: (blockId: string) => void
  closeLabellingModal: () => void
  toggleBankItemSelection: (id: string) => void
  clearBankSelection: () => void
  toggleLeftPanel: () => void
  toggleRightPanel: () => void
  toggleCurriculumPanel: () => void
  setCanvasTool: (tool: 'select' | 'pan' | 'text') => void
  setCanvasInteractive: (v: boolean) => void
}

export const useUIStore = create<UIState>()(persist((set) => ({
  toasts: [],
  earnedBadges: [],
  firstVisit: true,
  showEducationalOverlay: false,
  selectedBlockId: null,
  selectedBlockType: null,
  testResultsModalBlockId: null,
  clusterResultsModalBlockId: null,
  labellingModalBlockId: null,
  selectedBankItemIds: [],
  leftPanelCollapsed: true,
  rightPanelCollapsed: true,
  curriculumCollapsed: false,
  canvasTool: 'select',
  canvasInteractive: true,

  addToast: (message, type = 'info') =>
    set((s) => ({
      toasts: [...s.toasts, { id: uuid(), message, type }],
    })),

  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  earnBadge: (badgeId) =>
    set((s) => {
      if (s.earnedBadges.includes(badgeId)) return s
      return { earnedBadges: [...s.earnedBadges, badgeId] }
    }),

  setFirstVisitSeen: () => set({ firstVisit: false }),

  setShowEducationalOverlay: (show) => set({ showEducationalOverlay: show }),

  setSelectedBlock: (id, type) => set({ selectedBlockId: id, selectedBlockType: type, rightPanelCollapsed: false }),

  clearSelectedBlock: () => set({ selectedBlockId: null, selectedBlockType: null }),

  openTestResultsModal: (blockId) => set({ testResultsModalBlockId: blockId }),
  closeTestResultsModal: () => set({ testResultsModalBlockId: null }),

  openClusterResultsModal: (blockId) => set({ clusterResultsModalBlockId: blockId }),
  closeClusterResultsModal: () => set({ clusterResultsModalBlockId: null }),

  openLabellingModal: (blockId) => set({ labellingModalBlockId: blockId }),
  closeLabellingModal: () => set({ labellingModalBlockId: null }),

  toggleBankItemSelection: (id) =>
    set((s) => ({
      selectedBankItemIds: s.selectedBankItemIds.includes(id)
        ? s.selectedBankItemIds.filter((i) => i !== id)
        : [...s.selectedBankItemIds, id],
    })),

  clearBankSelection: () => set({ selectedBankItemIds: [] }),

  toggleLeftPanel: () => set((s) => ({ leftPanelCollapsed: !s.leftPanelCollapsed })),
  toggleRightPanel: () => set((s) => ({ rightPanelCollapsed: !s.rightPanelCollapsed })),
  toggleCurriculumPanel: () => set((s) => ({ curriculumCollapsed: !s.curriculumCollapsed })),

  setCanvasTool: (tool) => set({ canvasTool: tool }),
  setCanvasInteractive: (v) => set({ canvasInteractive: v }),
}), {
  name: 'abcai_ui_panels_v2',
  partialize: (s) => ({ leftPanelCollapsed: s.leftPanelCollapsed, rightPanelCollapsed: s.rightPanelCollapsed, curriculumCollapsed: s.curriculumCollapsed }),
}))
