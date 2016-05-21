import { lineOf, tagOf,
         isBlockDiv,
         getCursorPos, setCursorPos, moveCursor,
         insertTextAtCursor,

         fixListElementSpaces, stripListElemHead,
         nextListElementHeader, getLeadingSpaces,
       } from './util';
import { MAX_HEADER_DEPTH, keys } from './constants';
import { renderLine } from './render';


// //////////////////////
// Event Implementors //
// //////////////////////

/** Marks a line div as changed (to be re-rendered on the next render pass)
@param {DomNode} state - reference to the state of this mdedit instance
@param {DomNode} target - The div the event is being applied to
@param {KeyEvent} evt - event that caused the change
*/
export function markForChange(state, target, evt) {
  const host = state.host;
  while (target.parentElement !== host && target !== host) {
    target = target.parentElement;
  }

  target.setAttribute('changed', true);

  // on backspace, mark predecessor for re-evaluation
  if (evt && evt.keyCode === keys.BACKSPACE) {
    const prev = lineOf(host, target).previousSibling;
    if (prev) { prev.setAttribute('changed', true); }
  }
}

/** Creates a new line of some class after the specified line,
and move the text after the cursor to the new line, if the
cusror is on the line specified by target

@param {DomNode} state - reference to the state of this mdedit instance
@param {DomNode} target - the line div that should be split
@param {KeyEvent} evt - the keypress event. It will be disabled (preventDefault'd)
@param {string} className - the name of the class to clear to
*/
export function clearToType(state, target, evt, className) {
  evt.preventDefault();

  const p = document.createElement('div');
  p.className = className;

    // create the next element
  const targetNode = tagOf(target);
  targetNode.parentElement.insertBefore(
      p, targetNode.nextSibling);

  const selection = window.getSelection();
  const cursorOff = selection.anchorOffset;
  const ptext = document.createTextNode(target.textContent.substring(cursorOff));
  p.appendChild(ptext);
  target.textContent = target.textContent.substring(0, cursorOff);

  // move cursor to target of next element
  moveCursor(ptext, 0);

  // re-evaluate this and the other thing
  console.log('re-rendering original');
  renderLine(state, lineOf(state.host, target));
  console.log('re-rendering next');
  renderLine(state, lineOf(state.host, p));
  return p;
}

// TODO document these clearToX methods
export function clearToParagraph(state, target, evt) {
  console.log('clearToParagraph');
  clearToType(state, target, evt, 'p');
}

export function clearToSame(state, target, evt) {
  clearToType(state, target, evt, lineOf(state.host, target).className);
}

/** Indents / unindents a list (ul/ol) element
@param {DomNode} state - reference to the state of this mdedit instance
@param {DomNode} target - the list element line div to be indented
@param {KeyEvent} evt - the keycode event triggering this indent
*/
export function elevateListElement(state, target, evt) {
  evt.preventDefault();
  target = tagOf(target);
  let currentDepth = parseInt(target.getAttribute('depth'), 10);
  if (typeof currentDepth === 'undefined') {
    currentDepth = 1;
  }
  const newDepth = Math.min(MAX_HEADER_DEPTH,
    (evt.shiftKey ? currentDepth - 1 : currentDepth + 1));

  // get state variables before editing the text
  const lineDiv = lineOf(state.host, target);
  const cursorPos = getCursorPos(lineDiv);
  const orgText = target.textContent;

  // fix the leading spaces
  target.textContent = fixListElementSpaces(target.textContent, newDepth);

  // strip the leading header if we are going to depth 0
  if (newDepth === 0) {
    target.textContent = stripListElemHead(target.textContent);
  }

  // re-render this element using the original text & cursor for reference
  renderLine(state, lineDiv, {
    originalCursor: cursorPos,
    originalText: orgText,
  });
}

/** Continues an ordered/unordered list by appending an element at the same
indentation level as the target following it. Increments the header as well
(e.g, if the current line starts with '1.', the next line will start
with '2.')

@param {DomNode} state - reference to the state of this mdedit instance
@param {DomNode} target - the list element to insert after
@param {KeyEvent} evt - the key event triggering this insert
*/
export function continueListElement(state, target, evt) {
  evt.preventDefault();
  if (stripListElemHead(fixListElementSpaces(target.textContent, 0)).length > 0) {
    const me = lineOf(state.host, target);
    clearToSame(state, target, evt);
    const newKid = me.nextSibling;
    const nextHeader = nextListElementHeader(target.textContent);
    newKid.textContent = nextHeader + newKid.textContent;

    renderLine(state, newKid);
    setCursorPos(newKid, nextHeader.length);
  } else {
    const me = lineOf(state.host, target);
    me.textContent = '';
    renderLine(state, me);
  }
}

/**
when the backspace or delete key is pressed, checks if the cursor is at the
end or beginning of a line and if the following or preceeding div is a
'block div', i.e. a 'sep'.

If that is the case, it deletes the whole div.

@param {DomNode} state - reference to the state of this mdedit instance
@param {DomNode} target - the list element the backspace/delete key was
                          pressed in
@param {KeyEvent} evt - the key event triggering this delete evt
*/
export function checkAndDeleteBlockDiv(state, target, evt) {
  const tline = lineOf(state.host, target);
  const cpos = getCursorPos(tline);
  if (cpos === 0 &&
      evt.keyCode === keys.BACKSPACE &&
      isBlockDiv(tline.previousSibling)) {
    evt.preventDefault();
    state.host.removeChild(tline.previousSibling);
  } else if (cpos === tline.textContent.length &&
      evt.keyCode === keys.DELETE &&
      isBlockDiv(tline.nextSibling)) {
    evt.preventDefault();
    state.host.removeChild(tline.nextSibling);
  }
}

export function insertSpaces(numspaces) {
  return function insertSpacesAction(state, target, evt) {
    insertTextAtCursor(state.host, '\xA0'.repeat(numspaces));
    evt.preventDefault();
    renderLine(state, target, evt);
    return true;
  };
}

export function continueCodeBlock(state, target, evt) {
  const newElem = clearToType(state, target, evt, 'codeBlock');
  const numSpaces = getLeadingSpaces(target.textContent);
  newElem.insertBefore(
    document.createTextNode('\xA0'.repeat(numSpaces)),
    newElem.childNodes[0]);
  moveCursor(newElem.childNodes[0], numSpaces);
  renderLine(state, newElem, evt);
}

export function clearCodeBlock(state, target, evt) {
  const line = lineOf(state.host, target);
  const numSpaces = getLeadingSpaces(target.textContent);
  if (getCursorPos(line) === numSpaces) {
    line.textContent = line.textContent.substring(numSpaces);
    evt.preventDefault();
    renderLine(state, target, evt);
  }
}
