import {
  insertTag, countHeaderHashes,
 calculateListElemDepth, getLeadingTextNode,
 fixListElementSpaces, makeListNonLive,
 getCursorPos, setCursorPos,
} from './util';
import {
  OFFSET_INVALID, SEPARATOR_DASH_LENGTH,
} from './constants';


// ///////////////////////////////
// Render Function And Helpers //
// ///////////////////////////////

/** @const ulRegex - a regex identifying unordered list elements*/
const ulRegex = /^\s*(-){1}\s/;

/** @const olRegex - a regex identifying ordered list elements*/
const olRegex = /^\s*[0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ]+(\.|\)|:)\s/;

/** @const sepRegex - a regex identifying line separator elements*/
const sepRegex = /^---.*/;

/** @const codeBlockRegex - a regex identifying code blocks*/
const indentedCodeBlockRegex = /^\s{4}/;

/** @const codeFenceRegex - a regex identifying code fences*/
const codeFenceRegex = /^(```|~~~)/;

const emptyLineRegex = /^\s*$/;

/** Helper function to classify a line based on it's text content
@param {string} lineText - text content of div
*/
function classifyLine(lineDiv) {
  const lineText = lineDiv.textContent;
  if (codeFenceRegex.test(lineText)) {
    return 'codeFence';
  }else if (indentedCodeBlockRegex.test(lineText) && 
            isIndentedCodeBlockValid(lineDiv)) {
    return 'codeBlock';
  } else if (lineText[0] === '#') {
    return 'h';
  } else if (sepRegex.test(lineText)) {
    return 'sep';
  } else if (ulRegex.test(lineText)) {
    return 'ul';
  } else if (olRegex.test(lineText)) {
    return 'ol';
  }

  return 'p';
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

function extractSpan(parent, elem, delim, tagCallback, isChild) {
  isChild = isChild || false;

  if (elem.nodeName === '#text') {
    const subStrings = elem.textContent.split(delim);
    parent.removeChild(elem);

    for (let i = 0; i < subStrings.length; i++) {
      if (i % 2 === 1 && i !== subStrings.length - 1) {
        // inside of tag
        const newTag = document.createElement('div');
        tagCallback(newTag);
        newTag.appendChild(document.createTextNode(
          delim + subStrings[i] + delim));

        parent.appendChild(newTag);
      } else if (i % 2 === 1 && i === subStrings.length - 1) {
        // otherwise if it's the last element, append it as it's own or conjoin
        // it to the previous last elem
        const parentLastChild = parent.childNodes[parent.childNodes.length - 1];
        if (parentLastChild.nodeName === '#text') {
          parentLastChild.textContent = parentLastChild.textContent + delim + subStrings[i];
        } else {
          parent.appendChild(
            document.createTextNode(delim + subStrings[i])
          );
        }
      } else {
      // non span-contained text
        parent.appendChild(document.createTextNode(subStrings[i]));
      }
    }
  } else {
    // do not traverse literal elements
    if (!elem.getAttribute('literal')) {
      // convert live list to non-live list and traverse
      const nonLiveChildren = makeListNonLive(elem.childNodes);
      for (let i = 0; i < nonLiveChildren.length; i++) {
        extractSpan(elem, nonLiveChildren[i], delim, tagCallback, true);
      }
    }

    if (isChild) {
      parent.appendChild(elem);
    }
  }
}

const DELIM_TEXT_START = 0;
const DELIM_TEXT_END = 1;
const DELIM_LINK_START = 2;
const DELIM_LINK_END = 3;
function extractLinks(host, elem, delims, textCallback, linkCallback) {
  if (elem.nodeName === '#text') {
    let startIndex = 0;
    const elemText = elem.textContent;
    const parent = elem.parentElement;
    while (startIndex < elemText.length) {
      // get the index of all the delimiters. Return if any are not found
      const inds = [];
      for (const i in delims) {
        const searchIndex = (i === 0) ? startIndex : inds[i - 1];
        inds.push(elemText.indexOf(delims[i], searchIndex));

        if (inds[i] === OFFSET_INVALID) {
          // append remaining text as a new element
          if (startIndex !== 0) {
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
          elemText.substring(startIndex, inds[DELIM_TEXT_START])),
        elem);

      insertTag(parent, elem, 'linkdelim', delims[DELIM_TEXT_START]);

      textCallback(parent, elem,
        elemText.substring(
          inds[DELIM_TEXT_START] + delims[DELIM_TEXT_START].length,
          inds[DELIM_TEXT_END]));

      insertTag(parent, elem, 'linkdelim', delims[DELIM_TEXT_END]);
      insertTag(parent, elem, 'linkdelim', delims[DELIM_LINK_START]);

      linkCallback(parent, elem,
        elemText.substring(
          inds[DELIM_LINK_START] + delims[DELIM_LINK_START].length,
          inds[DELIM_LINK_END]));

      insertTag(parent, elem, 'linkdelim', delims[DELIM_LINK_END]);

      startIndex = inds[DELIM_LINK_END] + 1;
    }
    parent.removeChild(elem);
  } else {
    // non-#text element

    // do not traverse literal elements
    if (elem.getAttribute('literal')) { return; }

    // traverse children
    for (let c = 0; c < elem.childNodes.length; c++) {
      extractLinks(
        host, elem.childNodes[c], delims,
        textCallback, linkCallback);
    }
  }
}

export function setClass(c) {
  return function setClassAction(div) {
    div.className = c;
  };
}

export function setAttrs(attrs) {
  return function setAttrsAction(div) {
    for (const i in attrs) {
      div.setAttribute(i, attrs[i]);
    }
  };
}


function linkTextHandler(parent, elem, text) {
  return insertTag(parent, elem, 'linktext', text);
}
function linkHrefHandler(parent, elem, href) {
  const div = document.createElement('a');
  div.className = 'linkhref';
  div.setAttribute('literal', 'true');
  div.textContent = href;
  div.href = href;
  parent.insertBefore(div, elem);
  return div;
}

// because 'ul' and 'ol' divs are special in that
// the state of the next div depends on this div,
// we note that the chid should be re-evaluated at end
function imgSrcHandler(parseState) {
  return function handleImgSrc(parent, elem, imgSrc) {
    // link href
    const tag = linkHrefHandler(parent, elem, imgSrc);

    // add the image to the data object for this line
    if (imgSrc !== '') {
      const embed = document.createElement('img');
      embed.className = 'embedImage';
      embed.src = imgSrc;
      parseState.embeddedElements.push(embed);
    }
    return tag;
  };
}

function domManipUlOl(parseState) {
  const depth = calculateListElemDepth(parseState.lineDiv);
  const oldTextContent = parseState.opt.originalText || parseState.lineDiv.textContent;
  // fix first node (which is hopefully a text node?
  const lineTextNode = getLeadingTextNode(parseState.lineDiv);
  lineTextNode.textContent = fixListElementSpaces(lineTextNode.textContent, depth);
  parseState.cursorPosAdjustment += (
    parseState.lineDiv.textContent.length - oldTextContent.length);

  parseState.lineDiv.setAttribute('depth', depth);
}

function domManipSep(parseState) {
  // if there is trailing text, clear it to the next line
  // and mark the successor for re-evaluation.
  // also move the cursor pos to the end of the next line if the
  // cursor is in this line
  const sepText = parseState.lineDiv.textContent;
  if (sepText.length > SEPARATOR_DASH_LENGTH) {
    parseState.lineDiv.textContent = '---';
    const successorDiv = document.createElement('div');
    successorDiv.textContent = sepText.substring(SEPARATOR_DASH_LENGTH);
    parseState.host.insertBefore(successorDiv, parseState.lineDiv.nextSibling);
    if (parseState.cursorPos !== OFFSET_INVALID) {
      parseState.cursorPos = OFFSET_INVALID;
      setCursorPos(successorDiv, sepText.length - SEPARATOR_DASH_LENGTH);
    }
  }
}

function isIndentedCodeBlockValid(lineDiv) {
  // indented code blocks
  console.log (lineDiv, lineDiv.textContent);
  if (/^\s{4}/.test(lineDiv.textContent)) {
    console.log('candidate');
    console.dir(lineDiv);
    if (
      lineDiv.previousSibling === null ||
      lineDiv.previousSibling.classList.contains('codeBlock') ||
      emptyLineRegex.test(lineDiv.previousSibling.textContent)) {

      return true;
    }
  }
  return false;
}

function renderStepTextManip(parseState) {
  const lineDiv = parseState.lineDiv;

  // determine class of this line and perform changes which can change the text
  // content of a line based on the classs. Also sets the className of the line
  const lineClass = classifyLine(lineDiv);
  parseState.evalSuccessor = parseState.evalSuccessor || (
    (lineDiv.className === 'ul' ||
      lineDiv.className === 'ol') &&
    lineClass !== lineDiv.className);

  switch (lineClass) {
    case 'h':
      lineDiv.className = `h${ countHeaderHashes(parseState.lineText) }`;
      break;

    case 'ul':
    case 'ol':
      lineDiv.className = lineClass;
      domManipUlOl(parseState);
      break;

    case 'sep':
      lineDiv.className = lineClass;
      domManipSep(parseState);
      break;

    case 'codeBlock':
    case 'p':
    default:
      lineDiv.className = lineClass;
  }
}

function renderStepExtractDomElements(parseState) {
  const host = parseState.host;
  const lineDiv = parseState.lineDiv;
  // first we do the ones that can create literal text
  extractLinks(
    host, lineDiv, [ '![', ']', '(', ')' ],
    linkTextHandler, imgSrcHandler(parseState)
  );

  extractLinks(
    host, lineDiv, [ '[', ']', '(', ')' ],
    linkTextHandler, linkHrefHandler
  );

  extractSpan(host, lineDiv, '`', setAttrs({ 'class': 'code', 'literal': true }));

  // extract spans from nonliteral classes
  extractSpan(host, lineDiv, '**', setClass('bold'));
  extractSpan(host, lineDiv, '*', setClass('italic'));
  extractSpan(host, lineDiv, '_', setClass('underline'));
}

function renderStepRepairCursor(parseState) {
  // if the cursor pos is set, move the cursor there
  if (parseState.cursorPos >= 0) {
    setCursorPos(
      parseState.lineDiv,
      parseState.cursorPos + parseState.cursorPosAdjustment);
  }
}

function renderStepInsertEmbeds(parseState) {
  if (parseState.embeddedElements.length !== 0) {
    const embDiv = document.createElement('div');
    embDiv.classList.add('embed');
    parseState.lineDiv.appendChild(embDiv);
    for (let i = 0; i < parseState.embeddedElements.length; i++) {
      embDiv.appendChild(parseState.embeddedElements[i]);
    }
  }
}

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
export function renderLine(state, lineDiv, opt) {
  if (typeof opt === 'undefined') {
    opt = {};
  }

  const parseState = {
    opt, lineDiv,
    host: state.host,
    lineText: lineDiv.textContent,
    cursorPos: opt.originalCursor || getCursorPos(lineDiv),
    cursorPosAdjustment: 0,
    embeddedElements: [],
    evalSuccessor: false,
  };

  parseState.evalSuccessor = (
    lineDiv.nextSibling !== null && ( 
      lineDiv.nextSibling.className == 'codeBlock' ||
      emptyLineRegex.test(lineDiv.textContent)
    ));

  // reset div to just text
  lineDiv.textContent = parseState.lineText;

  /* CLASS-BASED TEXT TRANSFORMATION */
  renderStepTextManip(parseState);

  /* NON-TEXT-ALTERING OPERATIONS */
  renderStepExtractDomElements(parseState);

  /*  OPERATIONS THAT DO NOT ALTER THE LINE */
  renderStepRepairCursor(parseState);
  renderStepInsertEmbeds(parseState);

  if (parseState.evalSuccessor && lineDiv.nextSibling) {
    renderLine(state, lineDiv.nextSibling);
  }
}
