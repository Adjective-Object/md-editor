
// //////////////////////////
// Event Pattern Matches  //
// //////////////////////////

export function beginsHash(str, evt) { return str.indexOf('#') === 0; }
export function getsNewline(str, evt) { return evt.keyCode === keys.ENTER; }
export function always(str, evt) { return true; }
export function specialKeydown(str, evt) {
  return (evt.keyCode === keys.ENTER ||
          evt.keyCode === keys.BACKSPACE ||
          evt.keyCode === keys.DELETE);
}

/** Creates a condition that triggers on a specific keycode.
Expects a keyboard event (i.e. keypress, keydown, keyup)

@param {Number} code - The keycode to trigger on
@param {Object} opt - option dictionary
@param {boolean} opt.ctrlKey
  Whether the control key needs to be held to trigger the condition
@param {boolean} opt.shiftKey
  whether the shift key needs to be held to trigger the condition
@param {boolean} opt.altKey
  whether the alt key needs to be held to trigger the condition
*/
export function keyCode(code, opt) {
  opt = opt || {};
  return function keyCodeAction(str, evt) {
    if (typeof opt.ctrl !== 'undefined' && opt.ctrl !== evt.ctrlKey) { return false; }
    if (typeof opt.shift !== 'undefined' && opt.shift !== evt.shiftKey) { return false; }
    if (typeof opt.alt !== 'undefined' && opt.alt !== evt.altKey) { return false; }

    return evt.keyCode === code;
  };
}

/** Creates a condition that triggers on one of a set of keycodes.
Expects a keyboard event (i.e. keypress, keydown, keyup)

@param {Number} code - The keycode to trigger on
@param {Object} opt - option dictionary
@param {boolean} opt.ctrlKey
  Whether the control key needs to be held to trigger the condition
@param {boolean} opt.shiftKey
  whether the shift key needs to be held to trigger the condition
@param {boolean} opt.altKey
  whether the alt key needs to be held to trigger the condition
*/
export function keyCodes(codes, opt) {
  opt = opt || {};

  return function keyCodesAction(str, evt) {
    for (let i = 0; i < codes.length; i++) {
      // if modifier requires ctrl key and ctrl key not down
      if (typeof opt.ctrl !== 'undefined' && opt.ctrl !== evt.ctrlKey) { return false; }
      if (typeof opt.shift !== 'undefined' && opt.shift !== evt.shiftKey) { return false; }
      if (typeof opt.alt !== 'undefined' && opt.alt !== evt.altKey) { return false; }

      if (evt.keyCode === codes[i]) { return true; }
    }

    return false;
  };
}
