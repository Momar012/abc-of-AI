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
}

export interface ConditionBlock {
  id: string
  type: 'condition'
  position: { x: number; y: number }
  name: string
  linkedSensorId: string | null
  operator: RuleOperator
  threshold: number | boolean | string
  linkedModelId?: string | null
  modelCondition?: string | null
  currentOutput: boolean | null
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
  durationMinutes: number
  durationSeconds: number
  linkedRuleBlockId: string | null
  isRunning: boolean
  remainingSeconds: number
  currentOutput: boolean | null
  lastTriggerInput: boolean | null
}
