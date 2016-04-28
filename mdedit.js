// external use function that sets up the event hooks
function mdedit(host) {
  host.addEventListener('keydown',  dispatchEvt(host));
  host.addEventListener('keypress',  dispatchEvt(host));
  host.addEventListener('input',    renderChanges(host));
  //host.addEventListener('keydown', dispatchSpecialKeypress(host));
}


// Dispatcher for the keypress event,
// allows us to do incremental changes to the div
// and separate logic with docParts
function dispatchEvt(host) {
  return function dispatch(evt) {
    var selection = window.getSelection();
    var target = selection.anchorNode;
    var node = tagOf(target);

    // dispatch based on the node's class if a handler exists
    var classKey = node.classList[0];
    console.log(classKey);
    var ignoreDefault = false;
    if (docParts[classKey] != undefined &&
        docParts[classKey][evt.type] != undefined ) {
      ignoreDefault = docParts[classKey][evt.type](host, target, evt);
    }

    if (!ignoreDefault && 
        docParts['*'] != undefined &&
        docParts['*'][evt.type] != undefined ) {
      docParts['*'][evt.type](host, target, evt);
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

/////////////////////
// Render Function //
/////////////////////

ulRegex = /^\s*(-){1}\s/;
olRegex = /^\s*[0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ]+(\.|\)|:)\s/;
sepRegex = /^---.*/;

listElemClassRegex = /^(ul|ol).*/;

function renderLine(host, lineDiv, opt) {
  if (opt == undefined) {
    opt = {};
  }

  // because 'ul' and 'ol' divs are special in that
  // the state of the next div depends on this div,
  // we note that the chid should be re-evaluated at end
  var evalSuccessor = listElemClassRegex.test(lineDiv.className);

  var lineText = lineDiv.textContent;  
  var cursorPos = opt.originalCursor || getCursorPos(lineDiv);

  // render the content of the line
  console.log('    extracting spans from', lineDiv);
  lineDiv.textContent = lineText;
  extractSpan(host, lineDiv, '`'  , 'code');
  extractSpan(host, lineDiv, '**' , 'bold');
  extractSpan(host, lineDiv, '*'  , 'italic');
  extractSpan(host, lineDiv, '_'  , 'underline');

  // insert cursor at saved position relative to line
  console.log('    setting cursor pos');

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
    renderLine(host, lineDiv.nextSibling);
  }


}

function classifyLine(lineText) {
  if (lineText[0] == '#') { return 'h'; }
  else if (sepRegex.test(lineText)) { return 'sep'; }
  else if (ulRegex.test(lineText)) { return 'ul'; }
  else if (olRegex.test(lineText)) { return 'ol'; }
  else { return 'p'; }
}


function extractSpan(parent, elem, delim, className, isChild) {
  isChild = isChild || false;

  console.log('extractSpan', parent, elem, delim, className, isChild);

  if (elem.nodeName == '#text') {
    var subStrings = elem.textContent.split(delim);
    parent.removeChild(elem);

    console.log('substrings', subStrings, subStrings.length);
    for (var i=0; i<subStrings.length; i++) {
      console.log('i =', i);

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
        console.log('appending single asterisk child', delim + subStrings[i])
        console.log(parent.childNodes)
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
        console.log('copying over text', subStrings[i])
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
      console.log ('non-live-child', i)
      extractSpan(elem, nonLiveChildren[i], delim, className, true);
    }

    if (isChild) {
      parent.appendChild(elem)
    }
  }
}

/////////////////////////////////
// Event Dispatching Strucutre //
/////////////////////////////////

var keys = {
  HASH:   '#'.charCodeAt(0),
  BACKTICK: '`'.charCodeAt(0),
  ASTERISK: '*'.charCodeAt(0),
  UNDERSCORE: '_'.charCodeAt(0),
  SPACE:      ' '.charCodeAt(0),

  ENTER:      '\r'.charCodeAt(0),
  BACKSPACE:  '\b'.charCodeAt(0),
  DELETE:     46, 
  TAB:        '\t'.charCodeAt(0),
}
var asciiKeys = makeKeySet(' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~');

var docParts = expandCharClassKeys({
  // 
  '*': {
    // grab things that have changed
    keydown: matchRuleset({
      actions: [
      [always,  markForChange]],
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
    })
  },
});

function matchRuleset(opt) {
  var mappings = opt.actions || [];
  var ignoreDefault = opt.ignoreDefault;
  if (ignoreDefault === undefined) {
    ignoreDefault = false;
  }

  //console.log(mappings);
  return function(host, target, evt) {
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

function keyCode(code, opt){
  opt = opt || {};
  return function(str, evt){ 
    if (opt.ctrl ^ evt.ctrlKey) { return false; }
    if (opt.shift ^ evt.shiftKey) { return false; }
    if (opt.alt ^ evt.altKey) { return false; }

    return evt.keyCode == code;
  };
}

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

function markForChange(host, target, evt) {
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

function renderChanges(host) {
  return function(evt) {
    for (var i=0; i<host.children.length; i++) {
      if (host.children[i].getAttribute('changed')) {
        renderLine(host, host.children[i]);
        host.children[i].removeAttribute('changed');
      }
    }
  }
}

function clearToType(host, target, evt, className) {
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
    moveSelection(ptext, 0);

    // re-evaluate this and the other thing
    renderLine(host, lineOf(host, target));
    renderLine(host, lineOf(host, p));
}

function clearToParagraph(host, target, evt) {
  clearToType(host,target,evt,'p');
}
function clearToSame(host, target, evt) {
  clearToType(host,target,evt,lineOf(host, target).className);
}

function elevateListElement(host, target, evt) {
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
  var lineDiv = lineOf(host, target);
  var cursorPos = getCursorPos(lineDiv);
  var orgText = target.textContent;

  // fix the leading spaces
  target.textContent = fixListElementSpaces(target.textContent, newDepth);

  // strip the leading header if we are going to depth 0
  if (newDepth == 0) {
    target.textContent = stripListElemHead(target.textContent);
  }

  // re-render this element using the original text & cursor for reference
  renderLine(host, lineDiv, {
    originalCursor: cursorPos,
    originalText: orgText
  });

}

function continueListElement(host, target, evt) {
  evt.preventDefault();
  if (stripListElemHead(target.textContent).length > 0) {
    clearToSame(host, target, evt)
    var newKid = lineOf(host, target).nextSibling;
    var nextHeader = nextListElementHeader(target.textContent)
    newKid.textContent = nextHeader + newKid.textContent;
    setCursorPos(newKid, nextHeader.length);
  } else {
    clearToParagraph(host, target, evt)
  }
}

//////////
// UTIL //
//////////

function countHeaderHashes(str) {
  var i = 0;
  while (i < 6 && str.charAt(i) == '#') { i++; }
  return i;
}

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

function tagOf(textNode) {
  if (textNode.nodeName == '#text') {
    textNode = textNode.parentElement;
  }
  return textNode;
}

function predictText(textNode, charKey) {
  var selection = window.getSelection();
  if (textNode == selection.anchorNode) {
    var offset = selection.anchorOffset;
    // console.log('predictText inserting', offset, String.fromCharCode(charKey))
    var content = textNode.textContent;
    return (
      content.substring(0,offset) + 
      String.fromCharCode(charKey) + 
      content.substring(offset)
    );
  }
  return textNode.textContent
}

function predictTextRecursive(node, evt) {
  // if the node is text, either modify it's text according to event
  // or don't
  if (node.nodeName == '#text') {
    if (window.getSelection().anchorNode == node || 
        (window.getSelection().anchorNode == node.parentElement && 
          node.parentElement.childNodes.length == 1)) {
      var content = node.textContent;
      var offset = window.getSelection().anchorOffset;
      return (
        content.substring(0,offset) + 
        strCharCode(evt.keyCode) + 
        content.substring(offset)
      );
    }

    else {
      return node.textContent;
    }
  }

  // handle case of empty div
  else if (node.childNodes.length == 0) {
    return strCharCode(evt.keyCode);
  }

  // otherwise, concatenate the children's text
  else {
    var x = [];
    for (var i=0; i<node.childNodes.length; i++) {
      x.push(predictTextRecursive(node.childNodes[i], evt));
    }
    return x.join('');
  }
}

function locations(string, substring){
  var a=[],i=-1;
  while((i=string.indexOf(substring,i+1)) >= 0) a.push(i);
  return a;
}

function moveSelection(elem, offset) {
  var range = document.createRange();
  range.setStart(elem, offset);
  range.collapse(true);

  var sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

function escapeHTML(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

// TODO make more efficient or something
function getCursorPos(div) {
  var selection = window.getSelection();

  var length = 0;
  var frontier = ([]).concat(Array.prototype.slice.call(div.childNodes));
  while (frontier.length > 0) {    
    if (frontier[0] == selection.anchorNode) {
      return length + selection.anchorOffset;
    } 
    
    else if (frontier[0].nodeName == "#text") {
      length += frontier[0].textContent.length;
      frontier = frontier.slice(1)
    }

    else {
      frontier = Array.prototype.slice.call(frontier[0].childNodes).concat(frontier.slice(1));
    }
  }

  return -1;
}

// TODO make more efficient or something
function setCursorPos(div, length) {
  console.log('setCursorPos');
  var selection = window.getSelection();

  var frontier = ([]).concat(Array.prototype.slice.call(div.childNodes));
  while (frontier.length > 0) {
    if (frontier[0].nodeName == "#text" && 
        frontier[0].textContent.length >= length) {
      console.log('length is ' + length);
      moveSelection(frontier[0], length)
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

function removeTextBeforeCursor() {
  var selection = window.getSelection();
  if (selection.anchorOffset != 0) {
    var node = selection.anchorNode
    node.textContent = (
      node.textContent.substring(0, selection.anchorOffset - 1) +
      node.textContent.substring(selection.anchorOffset));

    setCursorPos(node, selection.anchorOffset);
  } else {
    // TODO get preceeding text node;
  }
}

function strCharCode(code) {
  switch (code) {
    case keys.SPACE:
      return '\xA0';
    case keys.BACKSPACE:
      return '\b';
    case keys.DELETE:
      return '\x7F';
    default:
      return String.fromCharCode(code);
  }
}

function flattenDeletes(str){
  for (var index = 0; index < str.length; index ++) {
    switch(str[index]) {
        case '\b':
          str = str.substring(0,index-1) + str.substring(index+1)
          break;

        case '\x7F':
          str = str.substring(0,index) + str.substring(index+2)
          index --;
          break;
        default:
    }
  }
  return str;
}

function makeKeySet(str) {
  set = []
  for (var i=0; i<str.length; i++) {
    set.push(str.charCodeAt(i));
  }
  return set;
}

function lineOf(host, elem) {
  while(elem.parentElement != host && elem != host) {
    elem = elem.parentElement;
  }
  return elem
}

function stripListElemHead(str) {
  // TODO actually implement things
  return str.substring(2);
}

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

function headerCharSuccessor(str) {
  function incrementHeader(alphabet, str) {
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

  if (/[0123456789]+/.test(str)) {
    return "" + (parseInt(str) + 1);
  }

  if (/[abcdefghijklmnopqrstuvwxyz]+/.test(str)) {
    return incrementHeader('abcdefghijklmnopqrstuvwxyz', str);
  }
  if (/[ABCDEFGHIJKLMNOPQRSTUVWXYZ]+/.test(str)) {
    return incrementHeader('ABCDEFGHIJKLMNOPQRSTUVWXYZ', str);
 
  }
}

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

function fixListElementSpaces(str, depth) {
  // console.log('fixing spaces to', depth)
  // console.log('"' + ' '.repeat(depth) + '"');
  return str.replace(/^\s*/, ' '.repeat(depth));
}