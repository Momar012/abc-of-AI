import { MISSION_TOTAL } from './missions'
import { POINTS_PER_MISSION } from '@/store/useMissionStore'

/** The most points a kid can earn: 10 per mission × 13 missions = 130. */
export const MAX_POINTS = MISSION_TOTAL * POINTS_PER_MISSION

/** Point milestones: each one gets a full-screen celebration the first time a kid reaches it. */
export interface Milestone {
  id: string
  emoji: string
  title: string
  text: string
  /** Reached when total points ≥ points, or when this many missions are done. */
  points?: number
  missions?: number
  /** The big end-of-challenge celebration. */
  grand?: boolean
}

export const MILESTONES: Milestone[] = [
  { id: 'points-30', points: 30, emoji: '🌟', title: 'Rising Star!', text: 'You earned 30 XP! You can find any block like a pro.' },
  { id: 'points-60', points: 60, emoji: '🛠️', title: 'Super Builder!', text: '60 XP! You are moving and arranging blocks like a real builder.' },
  { id: 'points-100', points: 100, emoji: '🚀', title: 'Playground Hero!', text: '100 XP! You can wire switches to bulbs, fans and doors.' },
  {
    id: 'all-missions',
    missions: MISSION_TOTAL,
    emoji: '🎉',
    title: 'Congratulations!',
    text: "You finished all 13 missions. You're now familiar with the ABITA Playground, and you earned the 🎯 Mission Master badge!",
    grand: true,
  },
  { id: 'points-130', points: MAX_POINTS, emoji: '👑', title: 'Perfect Score!', text: `All ${MAX_POINTS} XP! Every mission done without needing a single hint.`, grand: true },
]

export const isReached = (m: Milestone, points: number, done: number) =>
  (m.points !== undefined && points >= m.points) || (m.missions !== undefined && done >= m.missions)

/** The best title reached so far (the kid's rank). */
export function currentRank(points: number, done: number) {
  const reached = MILESTONES.filter((m) => m.points !== undefined && isReached(m, points, done))
  return reached.at(-1) ?? null
}

/** The next points goal, if any. */
export const nextGoal = (points: number) => MILESTONES.find((m) => m.points !== undefined && points < m.points) ?? null
