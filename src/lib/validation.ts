import { DataItem, LabelledDatasetBlock, ValidationCheck, ValidationResult } from '@/types/dataset'
import { MIN_ITEMS_PER_LABEL } from './constants'

export function validateDataset(
  labelledBlocks: LabelledDatasetBlock[],
  bankItems: DataItem[]
): ValidationResult {
  const checks: ValidationCheck[] = []
  let earnedBadges: string[] = []

  const allLabels = labelledBlocks.flatMap((b) => b.labels)
  const totalLabels = allLabels.length
  const totalItems = allLabels.reduce((acc, l) => acc + l.itemIds.length, 0)

  // Check 1: At least 2 labels
  if (totalLabels < 2) {
    checks.push({
      id: 'min-labels',
      label: 'Need more labels',
      status: 'warn',
      message: `You have ${totalLabels} label${totalLabels === 1 ? '' : 's'}. Add at least 2 labels so the AI can tell things apart.`,
      educationalNote: 'Imagine trying to sort your clothes with just one pile — you need at least two categories to see the difference!',
    })
  } else {
    checks.push({
      id: 'min-labels',
      label: 'Labels look good',
      status: 'pass',
      message: `Great! You have ${totalLabels} labels.`,
      educationalNote: 'Having multiple labels lets the AI learn to recognize different categories. Well done!',
    })
  }

  // Check 2: Minimum items per label
  const underfilledLabels = allLabels.filter((l) => l.itemIds.length < MIN_ITEMS_PER_LABEL)
  if (underfilledLabels.length > 0) {
    checks.push({
      id: 'min-items',
      label: 'Some labels need more data',
      status: 'warn',
      message: `${underfilledLabels.length} label${underfilledLabels.length > 1 ? 's have' : ' has'} fewer than ${MIN_ITEMS_PER_LABEL} items: ${underfilledLabels.map((l) => `"${l.name}"`).join(', ')}.`,
      educationalNote: 'Imagine teaching a friend the difference between cats and dogs — they need to see lots of examples of each!',
    })
  } else if (totalLabels >= 2) {
    checks.push({
      id: 'min-items',
      label: 'Each label has enough data',
      status: 'pass',
      message: `Every label has at least ${MIN_ITEMS_PER_LABEL} items.`,
      educationalNote: 'More examples = smarter AI. Keep it up!',
    })
  }

  // Check 3: Label imbalance (> 3×)
  if (allLabels.length >= 2) {
    const counts = allLabels.map((l) => l.itemIds.length)
    const maxCount = Math.max(...counts)
    const minCount = Math.min(...counts)
    if (minCount > 0 && maxCount / minCount > 3) {
      checks.push({
        id: 'balance',
        label: 'Dataset is imbalanced',
        status: 'warn',
        message: `Your largest label has ${maxCount} items but your smallest has ${minCount}. That's more than 3× different!`,
        educationalNote: 'If you show the AI 100 pictures of cats but only 10 dogs, it will be much better at recognizing cats. Try to keep your labels roughly equal!',
      })
    } else if (minCount > 0) {
      checks.push({
        id: 'balance',
        label: 'Dataset is balanced',
        status: 'pass',
        message: 'Your labels have a similar number of items. Perfect!',
        educationalNote: 'A balanced dataset helps the AI learn equally well for all categories.',
      })
      earnedBadges.push('balanced-dataset')
    }
  }

  // Check 4: Same item in multiple labels
  const allItemIds = allLabels.flatMap((l) => l.itemIds)
  const duplicates = allItemIds.filter((id, i) => allItemIds.indexOf(id) !== i)
  if (duplicates.length > 0) {
    checks.push({
      id: 'duplicates',
      label: 'Some items are in multiple labels',
      status: 'warn',
      message: `${new Set(duplicates).size} item${duplicates.length > 1 ? 's are' : ' is'} assigned to more than one label. Each item should belong to exactly one label.`,
      educationalNote: "If you told a friend a photo was both a cat AND a dog, they'd be confused! Each example should belong to exactly one category.",
    })
  } else if (totalItems > 0) {
    checks.push({
      id: 'duplicates',
      label: 'No duplicate assignments',
      status: 'pass',
      message: 'Every item belongs to exactly one label.',
      educationalNote: 'Clean data means cleaner learning for the AI!',
    })
  }

  // Check 5: Total size tip
  if (totalItems < 10 && totalItems > 0) {
    checks.push({
      id: 'size',
      label: 'Dataset is quite small',
      status: 'tip',
      message: `You have ${totalItems} labeled items. Real AI datasets often have thousands!`,
      educationalNote: 'The more examples you give the AI, the smarter it gets. Try adding more items to your Data Bank!',
    })
  } else if (totalItems >= 10) {
    checks.push({
      id: 'size',
      label: 'Good dataset size',
      status: 'pass',
      message: `You have ${totalItems} labeled items. Nice work!`,
      educationalNote: 'Growing your dataset is one of the best ways to improve AI accuracy.',
    })
  }

  const warnings = checks.filter((c) => c.status === 'warn').length
  const passed = warnings === 0 && totalLabels >= 2

  return { passed, checks, earnedBadges }
}
