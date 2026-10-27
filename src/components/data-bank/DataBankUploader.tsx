'use client'

import { useCallback, useState } from 'react'
import { motion } from 'framer-motion'
import { useDatasetStore } from '@/store/useDatasetStore'
import { useUIStore } from '@/store/useUIStore'
import { MAX_BANK_ITEMS } from '@/lib/constants'
import { downscaleImage, BANK_IMAGE_MAX_DIM } from '@/lib/downscaleImage'

export default function DataBankUploader() {
  const addBankItem = useDatasetStore((s) => s.addBankItem)
  const bankItems = useDatasetStore((s) => s.bankItems)
  const addToast = useUIStore((s) => s.addToast)
  const [isDragOver, setIsDragOver] = useState(false)

  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files)
      let added = 0

      for (const file of fileArray) {
        if (bankItems.length + added >= MAX_BANK_ITEMS) {
          addToast(`Max ${MAX_BANK_ITEMS} items allowed`, 'warn')
          break
        }

        if (file.type.startsWith('image/')) {
          // Shrink before storing: a full-size phone photo alone can fill the
          // ~5 MB the browser allows for saving. Decoding here also catches files
          // the browser reports as images by extension but can't actually read —
          // a HEIC photo renamed .jpg (common straight off an iPhone) or a
          // corrupted file — at upload time instead of later during training.
          let shrunk
          try {
            shrunk = await downscaleImage(file, BANK_IMAGE_MAX_DIM)
          } catch {
            addToast(`⚠ "${file.name}" isn't a format this browser can use — try converting it to JPG or PNG first.`, 'warn')
            continue
          }
          const thumbnailUrl = URL.createObjectURL(shrunk.blob)
          addBankItem({ type: 'image', name: file.name, content: shrunk.dataUrl, thumbnailUrl })
          added++
        } else if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
          const text = await file.text()
          addBankItem({ type: 'text', name: file.name, content: text })
          added++
        } else {
          addToast(`Skipped "${file.name}" (only images and .txt files are supported)`, 'warn')
        }
      }

      if (added > 0) {
        addToast(`Added ${added} item${added > 1 ? 's' : ''} to your Data Bank! 🎉`, 'success')
      }
    },
    [addBankItem, addToast, bankItems.length]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      processFiles(e.dataTransfer.files)
    },
    [processFiles]
  )

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(e.target.files)
    e.target.value = ''
  }

  return (
    <motion.label
      htmlFor="bank-upload"
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      animate={{
        borderColor: isDragOver ? '#2DD4BF' : 'rgba(255,255,255,0.15)',
        boxShadow: isDragOver ? '0 0 20px 4px rgba(45,212,191,0.3)' : 'none',
        scale: isDragOver ? 1.02 : 1,
      }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-white/15 cursor-pointer hover:border-violet-400/50 transition-colors"
    >
      <span className="text-3xl">{isDragOver ? '📥' : '➕'}</span>
      <div className="text-center">
        <p className="text-sm font-heading font-semibold text-white/80">
          {isDragOver ? 'Drop it!' : 'Add Data'}
        </p>
        <p className="text-xs text-white/40 mt-0.5">images or .txt files</p>
      </div>
      <input
        id="bank-upload"
        type="file"
        accept="image/*,.txt"
        multiple
        className="hidden"
        onChange={handleFileInput}
      />
    </motion.label>
  )
}

