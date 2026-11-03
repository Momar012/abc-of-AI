// Works out which language the student just used, so Abee can be told
// explicitly to answer in it. Everything else Abee reads (its instructions,
// the lab text, block names) is English, which pulls its replies into English
// unless each answer gets a clear nudge.

export type StudentLanguage = 'en' | 'ur' | 'roman-ur'

// Common Urdu words as they're typed in English letters
const ROMAN_URDU = new Set([
  'hai', 'hain', 'ho', 'hoon', 'tha', 'thi', 'kya', 'kyun', 'kyu', 'kaise', 'kese', 'kaisay', 'kahan', 'kab', 'kon', 'kaun',
  'mein', 'main', 'mai', 'mujhe', 'mujhay', 'meri', 'mera', 'mere', 'hum', 'tum', 'aap', 'ap', 'yeh', 'ye', 'woh', 'wo',
  'aur', 'ya', 'ka', 'ki', 'ke', 'ko', 'se', 'par', 'pe', 'nahi', 'nahin', 'nai', 'haan', 'han', 'ji', 'bhi', 'sirf',
  'karo', 'karna', 'karen', 'karein', 'kar', 'karta', 'karti', 'raha', 'rahi', 'rahe', 'gaya', 'gayi', 'batao', 'bataen',
  'samajh', 'samjhao', 'dikhao', 'chalo', 'theek', 'thik', 'acha', 'achha', 'abhi', 'phir', 'pehle', 'baad', 'kuch',
  'kaam', 'lagao', 'jodo', 'jorna', 'chahiye', 'sakta', 'sakti', 'wala', 'wali', 'agar', 'tou', 'to', 'koi', 'yahan', 'wahan',
])

export function detectLanguage(text: string): StudentLanguage {
  const t = text.trim()
  if (!t) return 'en'
  // Urdu (Arabic) script, or Devanagari, which speech-to-text sometimes uses for spoken Urdu
  const nonLatin = (t.match(/[؀-ۿݐ-ݿऀ-ॿ]/g) ?? []).length
  if (nonLatin >= 3) return 'ur'

  const words = t.toLowerCase().match(/[a-z']+/g) ?? []
  // A few words like "to"/"ko" also show up in English, so need more than one hit
  const hits = words.filter((w) => ROMAN_URDU.has(w)).length
  if (hits >= 2 && hits / Math.max(words.length, 1) >= 0.15) return 'roman-ur'
  return 'en'
}

/** A short system note placed just before Abee answers */
export function languageNote(lang: StudentLanguage): string {
  switch (lang) {
    case 'ur':
      return '[LANGUAGE] The student is speaking Urdu (maybe mixed with English). Your whole reply MUST be in Urdu — simple, warm, kid-friendly Urdu, written in Urdu script. Keep app names in English (Switch, Bulb, Fan, IF Condition, Rule-Based menu).'
    case 'roman-ur':
      return '[LANGUAGE] The student is writing Roman Urdu (Urdu in English letters, mixed with English). Your whole reply MUST be in the same Roman Urdu style, e.g. "IF block pe double-click karo". Keep app names in English.'
    default:
      return '[LANGUAGE] The student is using English. Reply in English.'
  }
}
