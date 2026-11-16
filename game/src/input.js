// Keyboard and mouse state for LUMEN DRIFT. The canvas reports mouse
// positions in its own coordinate space (the page scales the canvas with
// CSS, so client pixels are mapped back through the bounding box).
export function createInput(canvas) {
  const keys = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false };
  let lastClickAt = 0;

  const toGame = (clientX, clientY) => {
    const box = canvas.getBoundingClientRect();
    return {
      x: ((clientX - box.left) / box.width) * canvas.width,
      y: ((clientY - box.top) / box.height) * canvas.height,
    };
  };

  const onKeyDown = (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
      event.preventDefault();
    }
    keys.add(event.code);
  };
  const onKeyUp = (event) => keys.delete(event.code);
  const onBlur = () => keys.clear();

  const onMouseMove = (event) => {
    const p = toGame(event.clientX, event.clientY);
    mouse.x = p.x;
    mouse.y = p.y;
  };
  const onMouseDown = (event) => {
    if (event.button !== 0) return;
    const p = toGame(event.clientX, event.clientY);
    mouse.x = p.x;
    mouse.y = p.y;
    mouse.down = true;
    mouse.clicked = true;
    lastClickAt = performance.now();
  };
  const onMouseUp = (event) => {
    if (event.button !== 0) return;
    mouse.down = false;
  };
  const onContext = (event) => event.preventDefault();

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('contextmenu', onContext);

  return {
    keys,
    mouse,
    /** True while the named code is held (KeyW, ArrowUp, Space, KeyP, ...). */
    down(code) {
      return keys.has(code);
    },
    /** True once after a fresh click; clears itself when read. */
    takeClick() {
      const was = mouse.clicked;
      mouse.clicked = false;
      return was;
    },
    /** True when a key was pressed since the last check; clears itself. */
    takeKey(code) {
      if (!keys.has(code)) return false;
      keys.delete(code);
      return true;
    },
    lastClickAt: () => lastClickAt,
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('contextmenu', onContext);
    },
  };
}
