export interface DoorBlock {
  id: string
  type: 'door'
  position: { x: number; y: number }
  name: string
  linkedRuleBlockId: string | null
  isOpen: boolean
}

export interface BulbBlock {
  id: string
  type: 'bulb'
  position: { x: number; y: number }
  name: string
  linkedRuleBlockId: string | null
  isOn: boolean
}
