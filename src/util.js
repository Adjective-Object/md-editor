import {
MAX_HEADER_DEPTH,
OFFSET_INVALID,
DOCUMENT_POSITION_FOLLOWING,
} from './constants';

// ////////
// UTIL //
// ////////

/** Checks if a div is a 'block div' that should be treated as a signle
element in thye case of backspace or delete

@param {DomNode} div - the line div to check
*/
export function isBlockDiv(div) {
  return div.className.startsWith('sep');
}

/** Counts the number of '#' characters at the beginning of a string,
  capped at 6

  @param {string} str - the string to check
*/
export function countHeaderHashes(str) {
  let i = 0;
  while (i < MAX_HEADER_DEPTH && str.charAt(i) === '#') {
    i++;
  }
  return i;
}

/** Expands a character class string by repeating comma separated strings
between square braces

@param {string} str - string

@example
expandCharClass('this is [test,example] [string,text]');

// expands to
[
  'this is a test string'
  'this is a test text'
  'this is a example string'
  'this is a example text'
]
*/
export function expandCharClass(str) {
  const start = str.indexOf('[');
  const end = str.indexOf(']');

  // if not found, short circuit
  if (start === OFFSET_INVALID || end === OFFSET_INVALID) {
    return [ str ];
  }

  const classes = str.substring(start + 1, end).split(',');

  const outputs = [];
  const stem = str.substring(0, start);
  const leaves = expandCharClass(str.substring(end + 1));
  for (let i = 0; i < classes.length; i++) {
    for (let j = 0; j < leaves.length; j++) {
      outputs.push(stem + classes[i] + leaves[j]);
    }
  }

  return outputs;
}

/** Creates a new object byu expanding fields of a reference object using
expandCharClass. Used for convenience when declaring the event map

@param {Object} - the object to expand

@example
expandCharClass({
  '[a,b,c,d]': 0
  'e': 1
});

// expands to
{
  a: 0
  b: 0
  c: 0
  d: 0
  e: 1
}
*/
export function expandCharClassKeys(obj) {
  const newObj = {};
  for (const prop in obj) {
    const expansions = expandCharClass(prop);
    for (let i = 0; i < expansions.length; i++) {
      newObj[expansions[i]] = obj[prop];
    }
  }
  return newObj;
}

/** Get the containing tag of a text node;
@param {DomNode} textNode - the node to get the containing tag for
*/
export function tagOf(textNode) {
  if (textNode.nodeName === '#text') {
    textNode = textNode.parentElement;
  }
  return textNode;
}

/** Move the text cursor to a specified offset within a text object.
For setting the position within nested structures, see get/setCursorPos

@param {DomNode} elem - the element that will contain the cursor
@param {number} offset - the offset in the element to set the cursor
*/
export function moveCursor(elem, offset) {
  const range = document.createRange();
  range.setStart(elem, offset);
  range.collapse(true);

  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

/** Escape characters in a string in html
  @param {string} str - the string to escape
*/
export function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

export function makeListNonLive(liveList) {
  const nonLive = [];
  for (let i = 0; i < liveList.length; i++) {
    nonLive.push(liveList[i]);
  }
  return nonLive;
}

// TODO make more efficient (make frontier implicit )
/** recursively gets the text offset of the cursor in a div. If the cursor is
not in the div, returns -1.

@param {div} - The div in which to look for the cursor
*/
export function getCursorPos(div) {
  const selection = window.getSelection();

  let length = 0;
  let frontier = ([ div ]).concat(makeListNonLive(div.childNodes));
  while (frontier.length > 0) {
    if (frontier[0] === selection.anchorNode) {
      // if the node is a text node, return position in the node
      if (frontier[0].nodeName === '#text') {
        return length + selection.anchorOffset;
      }

      // otherwise sum the text lengths of the elements
      // before this element and return that
      return Reflect.apply(
        Array.prototype.slice,
        frontier[0].childNodes,
        [ 0, selection.anchorOffset ])
        .reduce(
          (a, b) => a + b.textContent.length,
          0);
    } else if (frontier[0].nodeName === '#text') {
      length += frontier[0].textContent.length;
      frontier = frontier.slice(1);
    } else {
      // Array.prototype.slice.call is to turn the childNodes into an array
      // which we can call concat() on
      frontier = makeListNonLive(frontier[0].childNodes).concat(frontier.slice(1));
    }
  }

  return OFFSET_INVALID;
}


// TODO make more efficient or something
/** Move the cursor to a text offset within a div, handling nested elements

  @param {div} - The div to place the cursor in
*/
export function setCursorPos(div, length) {
  let frontier = ([]).concat(makeListNonLive(div.childNodes));
  while (frontier.length > 0) {
    if (frontier[0].nodeName === '#text' &&
        frontier[0].textContent.length >= length) {
      moveCursor(frontier[0], length);
      return 0;
    } else if (frontier[0].nodeName === '#text') {
      length -= frontier[0].textContent.length;
      frontier = frontier.slice(1);
    } else {
      frontier = makeListNonLive(frontier[0].childNodes).concat(frontier.slice(1));
    }
  }

  return 1;
}

/** Expands a string into a list of the corresponding keycodes
@param {string} str - the string to expand
*/
export function makeKeySet(str) {
  const set = [];
  for (let i = 0; i < str.length; i++) {
    set.push(str.charCodeAt(i));
  }
  return set;
}

/** Get the line div (direct child of host) containing the elem DomNode
@param {DomNode} host - reference to the host DomNode
@param {DomNode} elem - element to find the line of
*/
export function lineOf(host, elem) {
  while (elem.parentElement !== host && elem !== host) {
    elem = elem.parentElement;
  }
  return elem;
}

// TODO actually this things
/** Strips the list header from a string
@param {string} str - the string to strip the list header form

@example
stripListElemHead('- unordered list')
// returns 'unordered list'

stripListElemHead('1. ordered list')
// returns 'ordered list'

*/
export function stripListElemHead(str) {
  return str.substring(2);
}

/** increments a string within an alphabet
@param {string} alphabet - the alhabet to use as reference
@param {string} str - the string to increment

@example
incrementString('abcd', 'ab')
// returns 'ac'

incrementString('abcd', 'd')
// returns 'aa'

incrementString('abcd', 'cd')
// returns 'da'
*/
export function incrementString(alphabet, str) {
  let index = str.length - 1;
  while (index !== OFFSET_INVALID) {
    const charInd = alphabet.indexOf(str.charAt(index));
    if (charInd === alphabet.length - 1) {
      str = (
        str.substring(0, index) +
        alphabet.charAt(0) +
        str.substring(index + 1)
      );
      index--;
    } else {
      return (
        str.substring(0, index) +
        alphabet.charAt(charInd + 1) +
        str.substring(index + 1));
    }
  }

  return alphabet.charAt(0) + str;
}


/** Gets the successor to the header string of an ordered list element
@param {string} str - the line in the ordered list
@example
headerCharSuccessor('123. ')
// returns '124. '

headerCharSuccessor('abc. ')
// returns 'abc. '

headerCharSuccessor('ABC. ')
// returns 'ABC. '

*/
export function headerCharSuccessor(str) {
  if (/[0123456789]+/.test(str)) {
    return String(parseInt(str, 10) + 1);
  }

  if (/[abcdefghijklmnopqrstuvwxyz]+/.test(str)) {
    return incrementString('abcdefghijklmnopqrstuvwxyz', str);
  }
  if (/[ABCDEFGHIJKLMNOPQRSTUVWXYZ]+/.test(str)) {
    return incrementString('ABCDEFGHIJKLMNOPQRSTUVWXYZ', str);
  }

  // error fallback (unknown header char pattern)
  return '?';
}

/** Gets the successor list element header to a string
@param {string} str - the string to get the successor of

@example
nextListElementHeader('1. ordered list')
// returns '2. '

*/
export function nextListElementHeader(str) {
  let numLeadingSpaces = 0;
  while (/\s/.test(str.substring(numLeadingSpaces, numLeadingSpaces + 1))) {
    numLeadingSpaces++;
  }

  // case of digits
  const digRegex = /[0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ]/;
  if (digRegex.test(str.substring(numLeadingSpaces, numLeadingSpaces + 1))) {
    let numDigits = 0;
    while (digRegex.test(
      str.substring(
        numLeadingSpaces + numDigits,
        numLeadingSpaces + numDigits + 1))) {
      numDigits++;
    }

    numDigits += numLeadingSpaces;

    const spacing = str.substring(0, numLeadingSpaces);
    const digits = headerCharSuccessor(str.substring(numLeadingSpaces, numDigits));
    const divider = str.substring(numDigits, numDigits + 1);
    return `${ spacing }${ digits }${ divider }${ '\xA0' }`;
  }

  // case of not digits
  const spacing = str.substring(0, numLeadingSpaces);
  const bullet = str.substring(numLeadingSpaces, numLeadingSpaces + 1);

  return `${ spacing }${ bullet }${ '\xA0' }`;
}


/** Returns the number of leading whitespace characters in a string
@param {string} str - string to check against
*/
export function getLeadingSpaces(str) {
  let ind = 0;
  while (/\s/.test(str.substring(ind, ind + 1))) {
    ind++;
  }
  return ind;
}

/** Gets the depth of a list element based on the number of leading spaces in
the preceeding sibling nodes

@param {DomNode} elem - the dom node
*/
export function calculateListElemDepth(elem) {
  let leadingSpaces = getLeadingSpaces(elem.textContent);

  let depth = 1;
  let ref = elem.previousSibling;
  while (ref !== null) {
    const refLeadingSpaces = getLeadingSpaces(ref.textContent);
    if (!/^(ul|ol)/.test(ref.className)) {
      break;
    }
    if (leadingSpaces > refLeadingSpaces) {
      depth++;
      leadingSpaces = refLeadingSpaces;
    }
    ref = ref.previousSibling;
  }
  return depth;
}

/** Sets the leading spaces of a string to a fixed level
@param {string} str - string to fix the number of leading spaces of
@param {number} depth - depth level to fix to
*/
export function fixListElementSpaces(str, depth) {
  return str.replace(/^\s*/, ' '.repeat(depth));
}

export function insertTag(parent, elem, className, text) {
  const div = document.createElement('div');
  div.className = className;
  div.textContent = text;
  parent.insertBefore(div, elem);
  return div;
}

export function getLeadingTextNode(elem) {
  return elem.childNodes[0];
}

export function insertTextAtCursor(host, txt) {
  const selection = window.getSelection();

  const selAnchor = selection.anchorNode;
  const oldText = selAnchor.textContent;

  const anchor = lineOf(host, selAnchor);
  const offset = getCursorPos(anchor);

  anchor.textContent = (
    oldText.substring(0, offset) +
    txt +
    oldText.substring(offset)
  );

  setCursorPos(anchor, offset + txt.length);
}

export function isBefore(a, b) {
  // have to use bitwise because the native function returns
  // a bit filter
  // eslint-disable-next-line no-bitwise
  return (a.compareDocumentPosition(b) & DOCUMENT_POSITION_FOLLOWING) !== 0;
}
