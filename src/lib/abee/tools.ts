// Function tools for the Realtime session. They all run in the browser
// (see takeover.ts); the server only registers them with the session.

const str = (description: string) => ({ type: 'string', description })

function tool(name: string, description: string, properties: Record<string, unknown> = {}, required: string[] = []) {
  return {
    type: 'function',
    name,
    description,
    parameters: { type: 'object', properties, required, additionalProperties: false },
  }
}

export const ABEE_TOOLS = [
  tool(
    'point_at',
    'Your main teaching tool: a glowing laser pointer showing the student where to click or look. It never clicks or opens anything. For a menu item whose menu is closed (e.g. "menu.item.condition"), it points at the menu first and moves to the item once the student opens it. For a Properties-panel field (e.g. "inspector.condition.operator") pass `block`: it points at that block ("Double-click") and moves to the field once the student opens its panel.',
    {
      target: str('A target id: a data-abee id like "toolbar.rules", "menu.item.fan", "inspector.condition.value", "curriculum.next"; "block:<blockId>"; a dot from a block\'s inDots/outDots like "handle:<blockId>:rule-out"; or a control like "control:<blockId>:toggle".'),
      note: str('Optional 1-4 word label shown next to the pointer, like "Click here".'),
      block: str('For inspector.* targets: the id of the block whose Properties panel holds that field.'),
    },
    ['target'],
  ),
  tool(
    'show_wire',
    'Show the student how to wire two blocks: a dotted laser line from the correct dot on the first block to the correct dot on the second (the app picks the dots). It never changes the canvas; the student drags the wire. If that wire isn\'t allowed, it returns why, so you can teach it.',
    {
      from_block: str('Id of the block the signal comes FROM (e.g. the IF).'),
      to_block: str('Id of the block it goes TO (e.g. the Fan).'),
      note: str('Optional 1-4 word label, like "Drag from here".'),
    },
    ['from_block', 'to_block'],
  ),
  tool(
    'no_pointer',
    'Use when nothing on screen would help this answer (a pure "why" explanation). Every question starts by choosing what to show: point_at, show_wire, or this.',
  ),
  tool(
    'start_takeover',
    'LAST RESORT. Take over the mouse to demonstrate one step, only when the student already tried it, is still stuck, and asked you to show them. Afterwards the canvas is automatically put back the way it was, so the student does it themselves. Esc stops it.',
    { summary: str('One short sentence describing what you will show, like "I\'ll connect your IF to the Fan."') },
    ['summary'],
  ),
  tool(
    'open_menu',
    'Demo only. Open one of the toolbar menus.',
    { menu: { type: 'string', enum: ['datasets', 'model', 'actions', 'rules'] } },
    ['menu'],
  ),
  tool(
    'add_block',
    'Demo only. Add a block to the canvas from the toolbar menus. Returns the new block id.',
    { blockType: str('A palette item from targets.menuItems, like "switch", "bulb", "sensor-temperature", "condition", "logic-and", "model-image-supervised".') },
    ['blockType'],
  ),
  tool(
    'connect',
    'Demo only. Wire one block\'s output into another block\'s input. One output can feed many blocks (an IF can drive a Bulb AND a Fan); adding a wire never removes existing ones. Moves the blocks side by side first if they are far apart.',
    {
      sourceId: str('Id of the block the signal comes from.'),
      targetId: str('Id of the block receiving it.'),
      input: str('Only for model blocks: "in" for training data (default) or "test-in" for test data.'),
    },
    ['sourceId', 'targetId'],
  ),
  tool(
    'toggle_switch',
    'Demo only. Flip a Switch block on or off.',
    { id: str('The Switch block id.') },
    ['id'],
  ),
  tool(
    'set_property',
    'Demo only. Change a setting on a block: a sensor\'s value, an IF Condition\'s operator or threshold, or a Display\'s message.',
    {
      id: str('Block id.'),
      field: { type: 'string', enum: ['value', 'operator', 'threshold', 'message'] },
      value: str('New value. Numbers as digits, booleans as "true"/"false". Operators: >, <, >=, <=, ==, !=, contains, is.'),
    },
    ['id', 'field', 'value'],
  ),
  tool(
    'open_properties',
    'Demo only. Open a block\'s Properties panel (same as the student double-clicking it).',
    { id: str('Block id.') },
    ['id'],
  ),
  tool(
    'click',
    'Demo only. Press a button on screen by its data-abee target id, like "inspector.train", "inspector.test", "databank.open" or "curriculum.chapters".',
    { target: str('A data-abee target id that is visible now.') },
    ['target'],
  ),
  tool(
    'close_panels',
    'Close any open toolbar menu and the Properties panel.',
  ),
  tool(
    'go_to_step',
    'Move the curriculum to the next or previous step. ONLY when the student\'s latest message explicitly asks to go to the next/previous step ("next step please", "go back"). Never call it because a task is finished.',
    { direction: { type: 'string', enum: ['next', 'prev'] } },
    ['direction'],
  ),
  tool(
    'end_takeover',
    'Finish the demo and give control back to the student.',
  ),
]
