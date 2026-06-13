import { ModelType } from '@/types/model'

export const MODEL_CATALOG = [
  {
    type: 'image-supervised' as ModelType,
    name: 'Image Supervised',
    icon: '🖼️',
    description: 'Teach the AI using your labelled photos. Uses MobileNet + KNN.',
    available: true,
  },
  {
    type: 'image-classifier' as ModelType,
    name: 'Image Classifier',
    icon: '🔍',
    description: 'Train a custom image classification neural network.',
    available: false,
  },
  {
    type: 'image-unsupervised' as ModelType,
    name: 'Image Unsupervised',
    icon: '🧩',
    description: 'Group similar images automatically. No labels needed. Uses K-means + MobileNet.',
    available: true,
  },
  {
    type: 'text-corpus' as ModelType,
    name: 'Text Brain',
    icon: '🧠',
    description: 'Feed it text and it learns the facts. Teach it wrong things and watch it get confused!',
    available: true,
  },
]
