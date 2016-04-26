// external use function that sets up the event hooks
function mdedit(host) {
  host.addEventListener('input', dispatchEvt(host));
  host.addEventListener('keydown',  dispatchEvt(host));
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
    var classKey = evt.target.classList[0];
    if (docParts[classKey] != undefined &&
        docParts[classKey][evt.type] != undefined ) {
      docParts[classKey][evt.type](host, target, evt);
    }

    if (docParts['*'] != undefined &&
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

function renderLine(host, lineDiv, evt) {
  var lineText = lineDiv.textContent;  
  var cursorPos = getCursorPos(lineDiv);

  // render the content of the line
  console.log('    extracting spans from', lineDiv);
  lineDiv.textContent = lineText;
  extractSpan(host, lineDiv, '`'  , 'code');
  extractSpan(host, lineDiv, '**' , 'bold');
  extractSpan(host, lineDiv, '*'  , 'italic');
  extractSpan(host, lineDiv, '_'  , 'underline');

  // insert cursor at saved position relative to line
  console.log('    setting cursor pos');
  if (cursorPos != -1) {
    setCursorPos(lineDiv, cursorPos);
  }





  // determine class of this line
  if (lineText[0] == '#') {
    lineDiv.className = 'h' + countHeaderHashes(lineText)
    return;
  }

  else {
    lineDiv.className = 'p'
  }
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

var docParts = expandCharClassKeys({
  '*': {
    // grab things that have changed
    keydown: matchRuleset([
      [always,  markForChange],
    ]),

    // on input change, update only the things that have changed
  },

  'mdedit': {
    input: matchRuleset([
      [always,  renderChanges],
    ]),
  },

  'h[1,2,3,4,5,6]': {
    keydown: matchRuleset([
      //[keyCode(keys.ENTER), clearToParagraph]
    ])
  },

  'p': {
    keydown: matchRuleset([
      [keyCode(keys.ENTER), clearToParagraph]
    ])
  }
});

function matchRuleset(mappings) {
  //console.log(mappings);
  return function(host, target, evt) {
    var content = target.textContent;
    for(var i=0; i<mappings.length; i++) {
      if (mappings[i][0](content, evt)) {
        // console.log('triggered', i);
        mappings[i][1](host, target, evt);
      }
    }
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

function keyCode(code){
  return function(str, evt){ return evt.keyCode == code; };
}

function keyCodes(codes){
  return function(str, evt){ 
    for (var i=0; i<codes.length; i++) {
      console.log(evt.keyCode, codes[i]);
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
}

function renderChanges(host, target, evt) {
  // TODO only update
  for (var i=0; i<host.children.length; i++) {
    if (host.children[i].getAttribute('changed')) {
      renderLine(host, host.children[i], evt);
      host.children[i].removeAttribute('changed');
    }
  }
}

function clearToParagraph(host, target, evt) {
  console.log('clearToParagraph');
  evt.preventDefault();

  var p = document.createElement('div');
  p.className = 'p';

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