export type SensorType = 'temperature' | 'light' | 'motion' | 'humidity' | 'text-input'
export type RuleOperator = '>' | '<' | '>=' | '<=' | '==' | '!=' | 'contains' | 'is'

export interface SensorBlock {
  id: string
  type: 'sensor'
  sensorType: SensorType
  position: { x: number; y: number }
  name: string
  value: number | boolean | string
  min?: number
  max?: number
  unit?: string
  // Only meaningful for 'text-input' sensors: false means the student has
  // never clicked Send, so `value` is still just its empty-string default,
  // not a real submitted value. undefined/true means it has a real value.
  hasSent?: boolean
}

export interface ConditionBlock {
  id: string
  type: 'condition'
  position: { x: number; y: number }
  name: string
  linkedSensorId: string | null
  operator: RuleOperator
  // null means "no value entered yet" — numeric thresholds start empty rather
  // than defaulting to a specific number, so a real "> 0" is unambiguous from
  // an untouched field.
  threshold: number | boolean | string | null
  linkedModelId?: string | null
  modelCondition?: string | null
  currentOutput: boolean | null
}

export interface SwitchBlock {
  id: string
  type: 'switch'
  position: { x: number; y: number }
  name: string
  isOn: boolean
}

export interface LogicBlock {
  id: string
  type: 'logic'
  logicType: 'and' | 'or' | 'not'
  position: { x: number; y: number }
  name: string
  linkedInputIds: (string | null)[]
  currentOutput: boolean | null
}

export interface FanBlock {
  id: string
  type: 'fan'
  position: { x: number; y: number }
  name: string
  linkedRuleBlockId: string | null
  isOn: boolean
}

export interface AlarmBlock {
  id: string
  type: 'alarm'
  position: { x: number; y: number }
  name: string
  linkedRuleBlockId: string | null
  isOn: boolean
}

export interface ACBlock {
  id: string
  type: 'ac'
  position: { x: number; y: number }
  name: string
  linkedRuleBlockId: string | null
  isOn: boolean
}

export interface TimerBlock {
  id: string
  type: 'timer'
  position: { x: number; y: number }
  name: string
  timerMode?: 'duration' | 'delay-on'
  durationMinutes: number
  durationSeconds: number
  linkedRuleBlockId: string | null
  isRunning: boolean
  remainingSeconds: number
  currentOutput: boolean | null
  lastTriggerInput: boolean | null
}

export interface TextBlock {
  id: string
  type: 'text'
  position: { x: number; y: number }
  text: string
  width: number
  height: number
  fontSize: number
  autoWidth?: boolean
}

export interface ImageBlock {
  id: string
  type: 'image'
  position: { x: number; y: number }
  src: string
  width: number
  height: number
}

export type BlockType =
  | 'labelled' | 'unlabelled' | 'rl-gridworld' | 'door' | 'bulb'
  | 'sensor-temperature' | 'sensor-light' | 'sensor-motion' | 'sensor-humidity' | 'sensor-text'
  | 'condition' | 'switch' | 'logic-and' | 'logic-or' | 'logic-not'
  | 'fan' | 'alarm' | 'ac' | 'timer'
  | 'model-image-supervised' | 'model-image-unsupervised' | 'model-image-classifier'
  | 'model-text-corpus' | 'model-text-supervised' | 'model-text-unsupervised'
