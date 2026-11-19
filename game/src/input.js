// Keyboard and mouse input for Solmar Bay. One shared state object is read by
// the player, the menus and the camera, so every system agrees on what the
// player pressed this frame.

export function createInput(canvas) {
  const input = {
    up: false,
    down: false,
    left: false,
    right: false,
    sprint: false,
    handbrake: false,
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    clicked: false,
    pressed: new Set(),
  };

  const keyMap = {
    KeyW: 'up', ArrowUp: 'up',
    KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    ShiftLeft: 'sprint', ShiftRight: 'sprint',
    Space: 'handbrake',
  };

  window.addEventListener('keydown', (event) => {
    const mapped = keyMap[event.code];
    if (mapped) {
      input[mapped] = true;
      event.preventDefault();
    }
    if (!event.repeat) input.pressed.add(event.code);
  });
  window.addEventListener('keyup', (event) => {
    const mapped = keyMap[event.code];
    if (mapped) input[mapped] = false;
  });
  window.addEventListener('blur', () => {
    input.up = input.down = input.left = input.right = false;
    input.sprint = false;
    input.handbrake = false;
  });

  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = event.clientX - rect.left;
    input.mouseY = event.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) {
      input.mouseDown = true;
      input.clicked = true;
    }
  });
  window.addEventListener('mouseup', () => {
    input.mouseDown = false;
  });

  return input;
}

// Was this key pressed since the last frame? Consumes the press.
export function wasPressed(input, code) {
  if (input.pressed.has(code)) {
    input.pressed.delete(code);
    return true;
  }
  return false;
}

// Clear the per-frame edge state (clicks and key presses) at the end of a frame.
export function endFrame(input) {
  input.clicked = false;
  input.pressed.clear();
}
