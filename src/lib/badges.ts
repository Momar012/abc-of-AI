import { Badge } from '@/types/badges'

export const BADGES: Badge[] = [
  {
    id: 'dataset-builder',
    name: 'Dataset Builder',
    description: 'Placed your first block on the canvas',
    icon: '🏗️',
    color: '#7C3AED',
  },
  {
    id: 'label-master',
    name: 'Label Master',
    description: 'Created 3 or more labels in one block',
    icon: '🏷️',
    color: '#2DD4BF',
  },
  {
    id: 'balanced-dataset',
    name: 'Balanced Dataset',
    description: 'Passed the balance validation check',
    icon: '⚖️',
    color: '#10B981',
  },
  {
    id: 'data-scientist',
    name: 'Data Scientist',
    description: 'Completed the full flow: upload → label → validate → split',
    icon: '🔬',
    color: '#F59E0B',
  },
]
