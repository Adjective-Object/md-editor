// external use function that sets up the event hooks
function mdedit(host) {
  //host.addEventListener('input', dispatchInput(host))
  host.addEventListener('keypress', dispatchEvt(host));
  host.addEventListener('keydown', dispatchEvt(host));
  //host.addEventListener('keydown', dispatchSpecialKeypress(host));
}


function dispatchInput(host) {
  return function dispatch(evt) {
    console.log(evt);
  }
}


// Dispatcher for the keypress event,
// allows us to do incremental changes to the div
// and separate logic with docParts
function dispatchEvt(host) {
  return function dispatch(evt) {
    var selection = window.getSelection();
    if (selection.type='Caret') {

      // get the node the cursor is in
      var target = selection.anchorNode;
      var node = tagOf(target);

      // dispatch based on the node's class
      var classKey = node.classList[0];
      if (docParts[classKey] == undefined) {
        console.log("docParts not found for ", classKey)
      } else if (docParts[classKey][evt.type] != undefined) {
        docParts[classKey][evt.type](host, target, evt);
      }
      
      }
  }
}

var keys = {
  HASH:   "#".charCodeAt(0),
  BACKTICK: '`'.charCodeAt(0),
  ASTERISK: "*".charCodeAt(0),

  ENTER:      "\r".charCodeAt(0),
  BACKSPACE:  "\b".charCodeAt(0),
  DELETE:  "\d".charCodeAt(0), 
  TAB:    "\t".charCodeAt(0),
}

var docParts = expandCharClassKeys({
  // root elem
  mdedit: {
  },

  p: {
    // keypress events are needed for anything that
    // takes compound character codes (i.e. # as a special code)
    keypress: matchRuleset([
      [keyCode(keys.HASH)     , hashHeader],
      [keyCode(keys.BACKTICK) , clipSubsequence('`', 'code')],
    ]),

  },

  'h[1,2,3,4,5,6]': {
    keypress: matchRuleset([
      [always                 , hashHeader],
      [keyCode(keys.BACKTICK) , clipSubsequence('`', 'code')],
    ]),

    keydown: matchRuleset([
      [keyCode(keys.ENTER)  , clearToParagraph],
      [specialKeydown       , hashHeader],
    ])
  },

  'code': {
    keypress: matchRuleset([
      [always       , maintainDelim('`')],
    ])
  }

});

function keySet(events) {
  return function(host, target, evt) {
    console.log(evt.keyCode, Object.keys(events));
    if (events[evt.keyCode] != undefined) {
      events[evt.keyCode](host, target, evt);
    }
  }
}

function matchRuleset(mappings) {
  console.log(mappings);
  return function(host, target, evt) {
    var content = target.textContent;
    for(var i=0; i<mappings.length; i++) {
      if (mappings[i][0](content, evt)) {
        // console.log('triggered', i);
        mappings[i][1](content, target, evt);
      }
    }
  }
}

//////////////////////////
// Event Pattern Match  //
//////////////////////////

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

////////////////////
// Actual events  //
////////////////////

function hashHeader(host, target, evt) {
  console.log("hashHeader");
  var selection = window.getSelection();
  var headerHashes = countHeaderHashes(predictText(target, evt.keyCode));

  if (headerHashes == 0) {
    tagOf(target).className = 'p';
    return;
  }
  else {
    tagOf(target).className = 'h' + (headerHashes);
  }

}

function clearToParagraph(host, target, evt) {
  console.log("clearToParagraph");
  evt.preventDefault();
  var p = document.createElement('div');
  p.className = 'p';

  // create the next element
  var targetNode = tagOf(target);
  targetNode.parentElement.insertBefore(
    p, targetNode.nextSibling);

  var selection = window.getSelection();
  var cursorOff = selection.anchorOffset;
  p.appendChild(
    document.createTextNode(target.textContent.substring(cursorOff))
  );
  target.textContent = target.textContent.substring(0, cursorOff);

  // move cursor to target of next element
  moveSelection(p, 0);
}

function clipSubsequence(delim, className) {
  return function(host, target, evt) {
    console.log('clipSubsequence', delim, className)

    var content = predictText(target, evt.keyCode);
    var first = content.indexOf(delim);
    var second = content.indexOf(delim, first + delim.length);

    if (first != -1 && second != -1) {
      var targetTag = tagOf(target);
      second += delim.length;

      // insert first text node
      targetTag.insertBefore(
        document.createTextNode(escapeHTML(content.substring(0,first))),
        target);

      // create and insert the classe'd tag
      var subTag = document.createElement('div');
      subTag.className = className;
      targetTag.insertBefore(subTag, target)
      subTag.appendChild(document.createTextNode(content.substring(first, second)));

      // insert trailing text node
      targetTag.insertBefore(
        document.createTextNode(escapeHTML(content.substring(second))),
        target);

      targetTag.removeChild(target);

      evt.preventDefault();
    }
  };
}

function maintainDelim(delim) {
  return function(host, target, evt) {
    var content = predictText(target, evt.keyCode);
    var substrs = content.split(delim);
    var targetTag = tagOf(target);

    var head = substrs[0];
    var body = substrs[1];
    var tail = substrs[2];

    // trim leading
    if (head != "") {
      targetTag.parentElement.insertBefore(
        document.createTextNode(head),
        targetTag);

      evt.preventDefault();
    }

    // trim trailing, put cursor at end of trail
    if (body != "") {
      var tailText = document.createTextNode(tail);
      targetTag.parentElement.insertBefore(
        tailText,
        targetTag.nextSibling);

      moveSelection(tailText, tail.length);
      evt.preventDefault();
    }
    
    if (tail != content.substring(delim.length, content.length-delim.length)) {
      target.textContent = delim + body + delim;
      evt.preventDefault();
    }

    // trim text
    else if (substr.length == 3) {
      evt.preventDefault();
    }
  }
}


//////////
// UTIL //
//////////

function countHeaderHashes(str) {
  var i = 0;
  while (i <= 6 && str.charAt(i) == '#') { i++; }
  return i;
}

function expandCharClassKeys(obj) {
  var newObj = {}
  for (var prop in obj) {
    var expansions = expandCharClass(prop);
    console.log(expansions)
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
};
