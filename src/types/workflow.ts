export interface IfElseBlock {
  id: string
  type: 'ifelse'
  position: { x: number; y: number }
  name: string
  condition: string | null
  linkedModelId: string | null
  currentOutput: boolean | null
}

export interface DoorBlock {
  id: string
  type: 'door'
  position: { x: number; y: number }
  name: string
  linkedIfElseId: string | null
  isOpen: boolean
}

export interface BulbBlock {
  id: string
  type: 'bulb'
  position: { x: number; y: number }
  name: string
  linkedIfElseId: string | null
  isOn: boolean
}
