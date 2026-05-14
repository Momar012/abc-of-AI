export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2)
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1)
}

function buildVocab(sentences: string[]): string[] {
  const set = new Set<string>()
  for (const s of sentences) for (const w of tokenize(s)) set.add(w)
  return Array.from(set)
}

function tf(word: string, tokens: string[]): number {
  const count = tokens.filter((t) => t === word).length
  return count / tokens.length
}

function idf(word: string, sentences: string[]): number {
  const docsWithWord = sentences.filter((s) => tokenize(s).includes(word)).length
  return docsWithWord === 0 ? 0 : Math.log(sentences.length / docsWithWord)
}

function tfidfVector(text: string, allSentences: string[], vocab: string[]): number[] {
  const tokens = tokenize(text)
  return vocab.map((word) => tf(word, tokens) * idf(word, allSentences))
}

function cosineSim(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    magA += a[i] * a[i]
    magB += b[i] * b[i]
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB)
  return denom === 0 ? 0 : dot / denom
}

export function trainTextCorpus(items: { content: string }[]): { sentences: string[] } {
  const sentences: string[] = []
  for (const item of items) {
    for (const s of splitSentences(item.content)) {
      sentences.push(s)
    }
  }
  return { sentences }
}

export function queryTextCorpus(
  question: string,
  sentences: string[]
): { answer: string; score: number } {
  if (!sentences.length) {
    return { answer: "I haven't learned anything yet! Feed me some text first.", score: 0 }
  }

  const vocab = buildVocab([question, ...sentences])
  const questionVec = tfidfVector(question, sentences, vocab)

  let bestScore = -1
  let bestSentence = ''

  for (const sentence of sentences) {
    const sentVec = tfidfVector(sentence, sentences, vocab)
    const score = cosineSim(questionVec, sentVec)
    if (score > bestScore) {
      bestScore = score
      bestSentence = sentence
    }
  }

  if (bestScore < 0.05) {
    return {
      answer: "I'm not sure about that. Try asking something from the text you gave me!",
      score: bestScore,
    }
  }

  return { answer: bestSentence, score: bestScore }
}
