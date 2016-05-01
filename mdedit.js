/** Main API hook that sets up event listeners on an mdedit-host div 
@param {DomNode} host - The 'host' div. that mdedit will listen for events on
*/
function mdedit(host) {
  state = {
    host: host,
    referenceTable : {}
  };

  host.addEventListener('keydown' , dispatchEvt(state));
  host.addEventListener('keypress', dispatchEvt(state));
  host.addEventListener('input'   , renderChanges(state));
}


/////////////////////////////////
// Render Function And Helpers //
/////////////////////////////////

/** @const ulRegex - a regex identifying unordered list elements*/
ulRegex = /^\s*(-){1}\s/;

/** @const olRegex - a regex identifying ordered list elements*/
olRegex = /^\s*[0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ]+(\.|\)|:)\s/;

/** @const sepRegex - a regex identifying line separator elements*/
sepRegex = /^---.*/;

listElemClassRegex = /^(ul|ol).*/;

/** Takes a div in the mdedit host div and applies the appropriate
class tags based on the text content.

@param {DomNode} state - reference to the state of this mdedit instance
@param {DomNode} lineDiv - the line to re-evaluate
@param {DomNode} opt - optional options dictionary

  Original position of cursor and text may be used when the div's 
  textContent is modified before involking renderLine, so that renderLine
  can correctly restore the position of the cursor after modification.

@param {string} opt.originalCursor - original position of cursor
@param {string} opt.originalText - original text of div

*/
function renderLine(state, lineDiv, opt) {
  var host = state.host;
  console.log('rendering line', lineDiv);
  console.log('host div', host);
  if (opt == undefined) {
    opt = {};
  }

  // because 'ul' and 'ol' divs are special in that
  // the state of the next div depends on this div,
  // we note that the chid should be re-evaluated at end
  var evalSuccessor = (
    listElemClassRegex.test(lineDiv.className) && 
    lineDiv.nextSibling && 
    listElemClassRegex.test(lineDiv.nextSibling.className)
  );

  var lineText = lineDiv.textContent;  
  var cursorPos = opt.originalCursor || getCursorPos(lineDiv);

  // render the content of the line
  console.log('    extracting spans from', lineDiv);
  lineDiv.textContent = lineText;
  extractSpan(host, lineDiv, '`'  , 'code');
  extractSpan(host, lineDiv, '**' , 'bold');
  extractSpan(host, lineDiv, '*'  , 'italic');
  extractSpan(host, lineDiv, '_'  , 'underline');

  console.log('handlers:', linkTextHandler, linkHrefHandler);

  function linkTextHandler(parent, elem, text) {
    return insertTag(parent, elem, 'linktext', text);
  };
  function linkHrefHandler(parent, elem, href){
    var div = document.createElement('a')
    div.className = 'linkhref';
    div.textContent = href;
    div.href = href;
    parent.insertBefore(div, elem);
    return div;
  }
  function imgSrcHandler(parent, elem, text){
    // link href
    var tag = linkHrefHandler(parent, elem, text);

    // add the image to the data object for this line
    return tag
  }

  // images
  extractLinks(
    host, lineDiv, ['[', ']', '(', ')'],
    linkTextHandler, imgSrcHandler
    );

  extractLinks(
    host, lineDiv, ['[', ']', '(', ')'],
    linkTextHandler, linkHrefHandler
    );

  // insert cursor at saved position relative to line
  var cursorPosAdjustment = 0;

  // determine class of this line
  var lineClass = classifyLine(lineText);
  switch(lineClass) {
    case 'h':
      lineDiv.className = 'h' + countHeaderHashes(lineText)
      break;

    case 'ul':
    case 'ol':
      lineDiv.className = lineClass;

      var depth = calculateListElemDepth(lineDiv);
      var oldTextContent = opt.originalText || lineDiv.textContent
      console.log('old text content', oldTextContent);
      lineDiv.textContent = fixListElementSpaces(lineDiv.textContent, depth);
      cursorPosAdjustment += (lineDiv.textContent.length - oldTextContent.length);
      console.log(cursorPos, cursorPosAdjustment);

      lineDiv.classList.add('depth-' + depth);

      break;

    case 'sep':
      // if there is trailing text, clear it to the next line
      // and mark the successor for re-evaluation.
      // also move the cursor pos to the end of the next line if the
      // cursor is in this line
      var sepText = lineDiv.textContent;
      if (sepText.length > 3) {
        lineDiv.textContent = '---';
        var successorDiv = document.createElement('div');
        successorDiv.textContent = sepText.substring(3);
        host.insertBefore(successorDiv, lineDiv.nextSibling)
        if (cursorPos >=0 ) {
          cursorPos = -1;
          setCursorPos(successorDiv, sepText.length - 3);
        }
      }
      lineDiv.className = lineClass;
      break;

    case 'p':
    default:
      lineDiv.className = lineClass;
  }

  if (cursorPos != -1) {
    setCursorPos(lineDiv, cursorPos + cursorPosAdjustment);
  }

  if (evalSuccessor && lineDiv.nextSibling) {
    console.log('evaluating next child', lineDiv.nextSibling);
    renderLine(state, lineDiv.nextSibling);
  }
}

/** Helper function to classify a line based on it's text content 
@param {string} lineText - text content of div
*/
function classifyLine(lineText) {
  if (lineText[0] == '#') { return 'h'; }
  else if (sepRegex.test(lineText)) { return 'sep'; }
  else if (ulRegex.test(lineText)) { return 'ul'; }
  else if (olRegex.test(lineText)) { return 'ol'; }
  else { return 'p'; }
}

/** Recursively extracts an element from a line div based on it's text content
@param {DomNode} parent - immediate parent div of the text being read
@param {TextNode} elem - node of text that is currently being visited  
@param {string} delim - string delimiter to break on
@param {string} className - className to assign to emphasized variables
@param {boolean} isChild - if the current call is working on a line div or
                           not. False in the case that it is.

@example
// with p = <div class='p'>example `to extract`</div>
extractSpan(host, p, '`', 'code'); 
// modifies div 'p' such that
// <div class='p'>example <div class='code'>`to extract`</div></div>
*/

function extractSpan(parent, elem, delim, className, isChild) {
  isChild = isChild || false;

  //console.log('extractSpan', parent, elem, delim, className, isChild);

  if (elem.nodeName == '#text') {
    var subStrings = elem.textContent.split(delim);
    parent.removeChild(elem);

    //console.log('substrings', subStrings, subStrings.length);
    for (var i=0; i<subStrings.length; i++) {
      //console.log('i =', i);

      // inside of tag
      if (i % 2 == 1 && i != subStrings.length - 1) {
        var newTag = document.createElement('div');
        newTag.className = className;
        newTag.appendChild(document.createTextNode(
          delim + subStrings[i] + delim ));

        parent.appendChild(newTag);          
      }
      
      // otherwise if it's the last element, append it as it's own or conjoin
      // it to the previous last elem
      else if (i % 2 == 1 && i == subStrings.length - 1) {
        // console.log('appending single asterisk child', delim + subStrings[i])
        // console.log(parent.childNodes)
        var parentLastChild = parent.childNodes[parent.childNodes.length - 1]; 
        if (parentLastChild.nodeName == '#text') {
          parentLastChild.textContent = parentLastChild.textContent + delim + subStrings[i];
        } else {
          parent.appendChild(
            document.createTextNode(delim + subStrings[i])
          );
        }
      }

      // non span-contained text
      else {
        // console.log('copying over text', subStrings[i])
        parent.appendChild(document.createTextNode(subStrings[i]));
      }
    }
  }

  else {
    var nonLiveChildren = []
    for (var i=0; i<elem.childNodes.length; i++) {
      nonLiveChildren.push(elem.childNodes[i]);
    }

    for (var i=0; i<nonLiveChildren.length; i++) {
      // console.log ('non-live-child', i)
      extractSpan(elem, nonLiveChildren[i], delim, className, true);
    }

    if (isChild) {
      parent.appendChild(elem)
    }
  }
}

function extractLinks(host, elem, delims, textCallback, linkCallback) {
  console.log('extractLinks');
  console.dir(textCallback);
  console.dir(linkCallback);
  if (elem.nodeName == '#text') {

    var startIndex = 0
    var elemText = elem.textContent;
    var parent = elem.parentElement;
    while (startIndex < elemText.length) {
      // get the index of all the delimiters. Return if any are not found
      var inds = []
      for(var i in delims) {
        var searchIndes = (i == 0) ? startIndex : delims[i-1];
        inds.push(elemText.indexOf(delims[i]))

        if (inds[i] == -1) {
          // append remaining text as a new element
          if (startIndex != 0) {
            parent.insertBefore(document.createTextNode(
              elemText.substring(startIndex)), elem);
            parent.removeChild(elem);
          }
          return;
        }
      }

      // append tect between first index and start index as a text node
      parent.insertBefore(
        document.createTextNode(
          elemText.substring(startIndex, inds[0])),
        elem);

      insertTag(parent, elem, 'linkdelim', delims[0]);

      console.log(host, elem, delims, textCallback, linkCallback);
      textCallback(parent, elem, 
        elemText.substring(inds[0] + delims[0].length, inds[1]))

      insertTag(parent, elem, 'linkdelim', delims[1]);
      insertTag(parent, elem, 'linkdelim', delims[2]);

      linkCallback(parent, elem, 
        elemText.substring(inds[2] + delims[2].length, inds[3]))

      insertTag(parent, elem, 'linkdelim', delims[3]);

      startIndex = inds[3] + 1;
    }
    parent.removeChild(elem);
  } 
  else {
    // traverse children
    for(var c in elem.childNodes) {
      extractLinks(
        host, elem.childNodes[c], delims,
        textCallback, linkCallback);
    }
  }
}

////////////////////////
// Event Dispatching  //
////////////////////////


/** Event Dispatcher for arbitrary events
retruns a dispatcher for events to divs according to the docParts 
event dispatching / callback declaration

@param {DomNode}  - the host div to listen to events on
*/
function dispatchEvt(state) {
  return function dispatch(evt) {
    var selection = window.getSelection();
    var target = selection.anchorNode;
    var node = tagOf(target);

    // dispatch based on the node's class if a handler exists
    var classKey = node.classList[0];
    // console.log('dispatch on target', target);
    var ignoreDefault = false;
    if (docParts[classKey] != undefined &&
        docParts[classKey][evt.type] != undefined ) {
      ignoreDefault = docParts[classKey][evt.type](state, target, evt);
    }

    if (!ignoreDefault && 
        docParts['*'] != undefined &&
        docParts['*'][evt.type] != undefined ) {
      docParts['*'][evt.type](state, target, evt);
    }

    // otherwise, just re-render the line the edit happend on
    // else {
    //   while(target.parentElement != host && target != host) {
    //     target = target.parentElement;
    //   }      
    //   renderLine(target, evt);
    // }
  }
}

/** convenience dictionary of some commonly used keycodes */
var keys = {
  HASH:       '#'.charCodeAt(0),
  BACKTICK:   '`'.charCodeAt(0),
  ASTERISK:   '*'.charCodeAt(0),
  UNDERSCORE: '_'.charCodeAt(0),
  SPACE:      ' '.charCodeAt(0),

  ENTER:      '\r'.charCodeAt(0),
  BACKSPACE:  '\b'.charCodeAt(0),
  DELETE:     46, 
  TAB:        '\t'.charCodeAt(0),
}

/** list of keycodes for all ascii characters during a keypress event */
var asciiKeys = makeKeySet(' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~');

/** Event mapping dict that defines context-sensitive event handling in mdedit*/
var docParts = expandCharClassKeys({
  // 
  '*': {
    // grab things that have changed
    keydown: matchRuleset({
      actions: [
      [keyCodes([keys.BACKSPACE, keys.DELETE]) , checkAndDeleteBlockDiv],
      [always                                  , markForChange]]
    }),

    // on input change, update only the things that have changed
  },

  'h[1,2,3,4,5,6]': {
    keydown: matchRuleset({
      actions: []
    })
  },

  p: {
    keydown: matchRuleset({
    })
  },

  '[ul,ol]': {
    keydown: matchRuleset({
      actions: [
        [keyCode(keys.TAB),   elevateListElement],
        [keyCode(keys.ENTER), continueListElement]
      ],
      ignoreDefault: true
    })
  },
});

/** Function to map between conditions and event handlers
@param {Object} opt - 
  options dictionary mapping from name of event to a series of separate
  event condition / handler pairs
@param {Object} opt.(evtName).actions
  list of (condition, handler) list pairs, where (handler) will be called
  if (condition) evaluates to true. If multiple conditions are satisfied on 
  a given string / event pair, all of them will be called in sequence.
@param {Function} opt.(evtName).actions.(index).(0)
  function of the form condition(str, evt), taking the string content of the
  event target and the event object
@param {Function} opt.(evtName).actions.(index).(1)
  function of the form handler(host, target, evt), that performs some action
  to the dom in the event that something should be handled

@example
matchRuleset({
    actions: [
      [keyCode([keys.BACKSPACE]) , checkAndDeleteBlockDiv],
      [always                    , markForChange]
    ],
    ignoreDefault: true
  })
*/
function matchRuleset(opt) {
  var mappings = opt.actions || [];
  var ignoreDefault = opt.ignoreDefault;
  if (ignoreDefault === undefined) {
    ignoreDefault = false;
  }

  return function(host, target, evt) {
    console.log('match ruleset on target', target);
    var content = target.textContent;
    var shouldIgnore = false;
    for(var i=0; i<mappings.length; i++) {
      if (mappings[i][0](content, evt)) {
        // console.log('triggered', i);
        mappings[i][1](host, target, evt);
        shouldIgnore = ignoreDefault;
      }
    }
    return shouldIgnore;
  }
}

////////////////////////////
// Event Pattern Matches  //
////////////////////////////

function beginsHash(str, evt){ return str.indexOf('#') == 0; }
function getsNewline(str, evt){ return evt.keyCode == keys.ENTER; }
function always(str, evt){ return true; }
function specialKeydown(str, evt) {
  return (evt.keyCode == keys.ENTER || 
          evt.keyCode == keys.BACKSPACE ||
          evt.keyCode == keys.DELETE);
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
function keyCode(code, opt){
  opt = opt || {};
  return function(str, evt){ 
    if (opt.ctrl  == evt.ctrlKey) { return false; }
    if (opt.shift == evt.shiftKey) { return false; }
    if (opt.alt   == evt.altKey) { return false; }

    return evt.keyCode == code;
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
function keyCodes(codes, opt){
  opt = opt || {};

  return function(str, evt){

    console.log(evt.keyCode);

    for (var i=0; i<codes.length; i++) {
      console.log(evt.keyCode, codes[i]);

      // if modifier requires ctrl key and ctrl key not down
      if (opt.ctrl ^ evt.ctrlKey) { return false; }
      if (opt.shift ^ evt.shiftKey) { return false; }
      if (opt.alt ^ evt.altKey) { return false; }

      if( evt.keyCode == codes[i] ) return true;
    };
    return false;
  }
}


////////////////////////
// Event Implementors //
////////////////////////

/** Marks a line div as changed (to be re-rendered on the next render pass)
@param {DomNode} state - reference to the state of this mdedit instance
@param {DomNode} target - The div the event is being applied to
@param {KeyEvent} evt - event that caused the change
*/
function markForChange(state, target, evt) {
  var host = state.host;
  while (target.parentElement != host && target != host) {
    target = target.parentElement;
  }
  console.log('marking for change', target);

  target.setAttribute('changed', true);

  // on backspace, mark predecessor for re-evaluation
  if(evt.keyCode == keys.BACKSPACE) {
    var prev = lineOf(host, target).previousSibling;
    if (prev) {prev.setAttribute('changed', true);}
  }
}

/** Passes over all line divs (all direct children of the host div)
And re-renders all that have been marked for change
@param {DomNode} state - reference to the state of this mdedit instance
*/
function renderChanges(state) {
  host = state.host;
  return function(evt) {
    for (var i=0; i<host.children.length; i++) {
      if (host.children[i].getAttribute('changed')) {
        renderLine(state, host.children[i]);
        host.children[i].removeAttribute('changed');
      }
    }
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
function clearToType(state, target, evt, className) {
    console.log('clearToParagraph');
    evt.preventDefault();

    var p = document.createElement('div');
    p.className = className;

    // create the next element
    var targetNode = tagOf(target);
    targetNode.parentElement.insertBefore(
      p, targetNode.nextSibling);

    var selection = window.getSelection();
    var cursorOff = selection.anchorOffset;
    var ptext = document.createTextNode(target.textContent.substring(cursorOff))
    p.appendChild(ptext);
    target.textContent = target.textContent.substring(0, cursorOff);

    // move cursor to target of next element
    moveCursor(ptext, 0);

    // re-evaluate this and the other thing
    renderLine(state, lineOf(host, target));
    renderLine(state, lineOf(host, p));
}

//TODO document these clearToX methods
function clearToParagraph(state, target, evt) {
  clearToType(state,target,evt,'p');
}

function clearToSame(state, target, evt) {
  clearToType(state,target,evt,lineOf(state.host, target).className);
}

/** Indents / unindents a list (ul/ol) element
@param {DomNode} state - reference to the state of this mdedit instance
@param {DomNode} target - the list element line div to be indented
@param {KeyEvent} evt - the keycode event triggering this indent
*/
function elevateListElement(state, target, evt) {
  console.log('elevate')
  evt.preventDefault();
  var target = tagOf(target);
  // get the depth class
  var depthClass = 'depth-1';
  for (var i=0; i < target.classList.length; i++) {
    if(target.classList[i].startsWith('depth-')) {
      depthClass = target.classList[i];
      break;
    }
  }

  var newDepth = Math.min(6, 
    parseInt(depthClass.substring('depth-'.length)) + 
    (evt.shiftKey ? -1 : 1)
  );


  // get state variables before editing the text
  var lineDiv = lineOf(state.host, target);
  var cursorPos = getCursorPos(lineDiv);
  var orgText = target.textContent;

  // fix the leading spaces
  target.textContent = fixListElementSpaces(target.textContent, newDepth);

  // strip the leading header if we are going to depth 0
  if (newDepth == 0) {
    target.textContent = stripListElemHead(target.textContent);
  }

  // re-render this element using the original text & cursor for reference
  renderLine(state, lineDiv, {
    originalCursor: cursorPos,
    originalText: orgText
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
function continueListElement(state, target, evt) {
  evt.preventDefault();
  console.log('continueListElement', target);
  console.dir(target);
  if (stripListElemHead(target.textContent).length > 0) {
    var me = lineOf(state.host, target);
    clearToSame(state, target, evt)
    var newKid = me.nextSibling;
    var nextHeader = nextListElementHeader(target.textContent)
    newKid.textContent = nextHeader + newKid.textContent;

    renderLine(state, newKid);
    setCursorPos(newKid, nextHeader.length);
  } else {
    clearToParagraph(state, target, evt)
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
function checkAndDeleteBlockDiv(state, target, evt) {
  var tline = lineOf(host, target);
  var cpos = getCursorPos(tline);
  if (cpos == 0 && 
      evt.keyCode == keys.BACKSPACE && 
      isBlockDiv(tline.previousSibling)) {
    evt.preventDefault();
    state.host.removeChild(tline.previousSibling);
  }

  else if (cpos == tline.textContent.length && 
      evt.keyCode == keys.DELETE &&
      isBlockDiv(tline.nextSibling)) {
    evt.preventDefault();
    state.host.removeChild(tline.nextSibling);
  }
}

//////////
// UTIL //
//////////

/** Checks if a div is a 'block div' that should be treated as a signle
element in thye case of backspace or delete

@param {DomNode} div - the line div to check
*/
function isBlockDiv(div) {
  return div.className.startsWith('sep');
}


/** Counts the number of '#' characters at the beginning of a string, 
  capped at 6
  
  @param {string} str - the string to check
*/
function countHeaderHashes(str) {
  var i = 0;
  while (i < 6 && str.charAt(i) == '#') { i++; }
  return i;
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
function expandCharClassKeys(obj) {
  var newObj = {}
  for (var prop in obj) {
    var expansions = expandCharClass(prop);
    // console.log(expansions)
    for (var i=0; i<expansions.length; i++) {
      newObj[expansions[i]] = obj[prop]
    }
  }
  return newObj;
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
function expandCharClass(str) {
  var start = str.indexOf('[');
  var end = str.indexOf(']');

  if (start == -1 || end == -1) {
    return [str];
  }

  classes = str.substring(start + 1, end).split(',');

  var outputs = Array()
  var stem = str.substring(0, start);
  var leaves = expandCharClass(str.substring(end + 1));
  for (var c=0; c<classes.length; c++) {
    for (var i=0; i<leaves.length; i++) {
      outputs.push(stem + classes[c] + leaves[i]);
    }
  }

  return outputs
}

/** Get the containing tag of a text node;
@param {DomNode} textNode - the node to get the containing tag for
*/
function tagOf(textNode) {
  if (textNode.nodeName == '#text') {
    textNode = textNode.parentElement;
  }
  return textNode;
}

/** Move the text cursor to a specified offset within a text object.
For setting the position within nested structures, see get/setCursorPos

@param {DomNode} elem - the element that will contain the cursor
@param {number} offset - the offset in the element to set the cursor
*/
function moveCursor(elem, offset) {
  var range = document.createRange();
  range.setStart(elem, offset);
  range.collapse(true);

  var sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

/** Escape characters in a string in html
  @param {string} str - the string to escape
*/
function escapeHTML(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

// TODO make more efficient or something
/** recursively gets the text offset of the cursor in a div. If the cursor is
not in the div, returns -1.

@param {div} - The div in which to look for the cursor
*/
function getCursorPos(div) {
  var selection = window.getSelection();

  var length = 0;
  var frontier = ([div]).concat(Array.prototype.slice.call(div.childNodes));
  while (frontier.length > 0) {    
    if (frontier[0] == selection.anchorNode) {
      return length + selection.anchorOffset;
    } 
    
    else if (frontier[0].nodeName == "#text") {
      length += frontier[0].textContent.length;
      frontier = frontier.slice(1)
    }

    else {
      // Array.prototype.slice.call is to turn the childNodes into an array
      // which we can call concat() on
      frontier = Array.prototype.slice.call(
        frontier[0].childNodes).concat(frontier.slice(1));
    }
  }

  return -1;
}


// TODO make more efficient or something
/** Move the cursor to a text offset within a div, handling nested elements

  @param {div} - The div to place the cursor in
*/
function setCursorPos(div, length) {
  var selection = window.getSelection();

  var frontier = ([]).concat(Array.prototype.slice.call(div.childNodes));
  while (frontier.length > 0) {
    if (frontier[0].nodeName == "#text" && 
        frontier[0].textContent.length >= length) {
      moveCursor(frontier[0], length)
      return 0;
    } 
    
    else if (frontier[0].nodeName == "#text") {
      length -= frontier[0].textContent.length;
      frontier = frontier.slice(1);
    }

    else {
      frontier = Array.prototype.slice.call(frontier[0].childNodes).concat(frontier.slice(1));
    }
  }

  return 1;
}

/** Expands a string into a list of the corresponding keycodes
@param {string} str - the string to expand
*/
function makeKeySet(str) {
  set = []
  for (var i=0; i<str.length; i++) {
    set.push(str.charCodeAt(i));
  }
  return set;
}

/** Get the line div (direct child of host) containing the elem DomNode
@param {DomNode} host - reference to the host DomNode
@param {DomNode} elem - element to find the line of 
*/
function lineOf(host, elem) {
  while(elem.parentElement != host && elem != host) {
    elem = elem.parentElement;
  }
  return elem
}

// TODO actually implement things
/** Strips the list header from a string
@param {string} str - the string to strip the list header form
  
@example
stripListElemHead('- unordered list')
// returns 'unordered list'

stripListElemHead('1. ordered list')
// returns 'ordered list'

*/
function stripListElemHead(str) {
  return str.substring(2);
}

/** Gets the successor list element header to a string
@param {string} str - the string to get the successor of

@example
nextListElementHeader('1. ordered list')
// returns '2. '

*/
function nextListElementHeader(str) {
  var numLeadingSpaces = 0;
  while(/\s/.test(str.substring(numLeadingSpaces, numLeadingSpaces + 1))) {
    numLeadingSpaces++;
  }

  // case of digits
  var digRegex = /[0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ]/;
  if (digRegex.test(str.substring(numLeadingSpaces, numLeadingSpaces+1))) {
    var numDigits = 0;
    while (digRegex.test(
      str.substring(
        numLeadingSpaces + numDigits, 
        numLeadingSpaces + numDigits + 1))) {
      numDigits++;
    }

    var numDigits = numDigits + numLeadingSpaces

    return (str.substring(0,numLeadingSpaces) + 
      headerCharSuccessor(str.substring(numLeadingSpaces, numDigits)) +
      str.substring(numDigits, numDigits + 1) + '\xA0');
  }
  else {
    return (str.substring(0,numLeadingSpaces) + 
      (str.substring(numLeadingSpaces, numLeadingSpaces + 1)) +
      '\xA0');
  }
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
function headerCharSuccessor(str) {
  if (/[0123456789]+/.test(str)) {
    return "" + (parseInt(str) + 1);
  }

  if (/[abcdefghijklmnopqrstuvwxyz]+/.test(str)) {
    return incrementString('abcdefghijklmnopqrstuvwxyz', str);
  }
  if (/[ABCDEFGHIJKLMNOPQRSTUVWXYZ]+/.test(str)) {
    return incrementString('ABCDEFGHIJKLMNOPQRSTUVWXYZ', str);
 
  }
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
function incrementString(alphabet, str) {
  var index = str.length - 1;
  var carry = 1
  while(index > -1) {
    var charInd = alphabet.indexOf(str.charAt(index));
    if (charInd == alphabet.length - 1) {
      str = (
        str.substring(0, index) + 
        alphabet.charAt(0) + 
        str.substring(index + 1)
      );
      index--;
    }

    else {
      return (
        str.substring(0, index) + 
        alphabet.charAt(charInd + 1) + 
        str.substring(index + 1));
    }
  }

  return alphabet.charAt(0) + str;
}

/** Gets the depth of a list element based on the number of leading spaces in
the preceeding sibling nodes

@param {DomNode} elem - the dom node
*/
function calculateListElemDepth(elem) {
  var leadingSpaces = getLeadingSpaces(elem.textContent);
  
  depth = 1;
  var ref = elem.previousSibling;
  while(ref != null) {
    var refLeadingSpaces = getLeadingSpaces(ref.textContent);
    if (! listElemClassRegex.test(ref.className)) {
      break;
    }
    if (leadingSpaces > refLeadingSpaces) {
      depth ++;
      leadingSpaces = refLeadingSpaces;
    }
    ref = ref.previousSibling;
  }
  return depth;
}

/** Returns the number of leading whitespace characters in a string
@param {string} str - string to check against
*/
function getLeadingSpaces(str) {
  var ind = 0;
  while (/\s/.test(str.substring(ind, ind+1))) {
    // console.log(str, '"'+str.substring(ind, ind+1) + '"');
    ind ++;
  }
  // console.log(str, str.substring(ind, ind+1));
  // console.log('leading spaces', ind);
  return ind;
}

/** Sets the leading spaces of a string to a fixed level
@param {string} str - string to fix the number of leading spaces of
@param {number} depth - depth level to fix to
*/
function fixListElementSpaces(str, depth) {
  // console.log('fixing spaces to', depth)
  // console.log('"' + ' '.repeat(depth) + '"');
  return str.replace(/^\s*/, ' '.repeat(depth));
}

function insertTag(parent, elem, className, text) {
  var div = document.createElement('div')
  div.className = className;
  div.textContent = text;
  parent.insertBefore(div, elem);
  return div;
}