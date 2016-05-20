import { expandCharClassKeys } from './util';
import { renderLine } from './render';
import { keys, TAB_WIDTH } from './constants';

import {
  dispatchEvt, matchRuleset,
} from './dispatch';

import {
  keyCode, keyCodes, always,
} from './triggers';

import {
  checkAndDeleteBlockDiv,

  elevateListElement,
  continueListElement,

  continueCodeBlock,
  clearCodeBlock,

  insertSpaces,
  markForChange,
} from './evts';

/** Event mapping dict that defines context-sensitive event handling in mdedit*/
const evtMapping = expandCharClassKeys({
  //
  '*': {
    // grab things that have changed
    keydown: matchRuleset({
      actions: [
      [ keyCode(keys.TAB), insertSpaces(TAB_WIDTH) ],
      [ keyCodes([ keys.BACKSPACE, keys.DELETE ]), checkAndDeleteBlockDiv ],
      [ always, markForChange ],
      ],
    }),

    // on input change, update only the things that have changed
  },

  '[ul,ol]': {
    keydown: matchRuleset({
      actions: [
        [ keyCode(keys.TAB), elevateListElement ],
        [ keyCode(keys.ENTER), continueListElement ],
      ],
      ignoreDefault: true,
    }),
  },

  'codeBlock': {
    keydown: matchRuleset({
      actions: [
        [ keyCode(keys.ENTER), continueCodeBlock ],
        [ keyCode(keys.BACKSPACE), clearCodeBlock ],
      ],
      ignoreDefault: true,
    }),

  },
});


/** Passes over all line divs (all direct children of the host div)
And re-renders all that have been marked for change
@param {DomNode} state - reference to the state of this mdedit instance
*/
export function renderChanges(state) {
  const host = state.host;
  return function renderChangesHandler(evt) {
    for (let i = 0; i < host.children.length; i++) {
      if (host.children[i].getAttribute('changed')) {
        renderLine(state, host.children[i]);
        host.children[i].removeAttribute('changed');
      }
    }
  };
}


/** Main API hook that sets up event listeners on an mdedit-host div
@param {DomNode} host - The 'host' div. that mdedit will listen for events on
*/
export function bind(host, docParts) {
  const state = {
    // Maintian a reference to the host div in state
    host,
    lastFences: {}
  };

  const render = renderChanges(state);
  host.addEventListener('keydown', dispatchEvt(state, evtMapping));
  host.addEventListener('keypress', dispatchEvt(state, evtMapping));
  host.addEventListener('input', render);
  host.addEventListener('mousedown', function() {
    console.log(state.lastFences);
 });

  // drag and drop events add too much othr stuff
  host.addEventListener('drop',
    (evt) => { evt.preventDefault(); });

  // do initial render
  for (let i = 0; i < host.children.length; i++) {
    markForChange(state, host.children[i]);
  }
  render();
}
