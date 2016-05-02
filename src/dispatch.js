import { lineOf } from './util';

/** Event Dispatching */


/** Event Dispatcher for arbitrary events
retruns a dispatcher for events to divs according to the evtMapping
event dispatching / callback declaration

@param {DomNode}  - the host div to listen to events on
*/
export function dispatchEvt(state, evtMapping) {
  return function dispatch(evt) {
    const selection = window.getSelection();
    const target = selection.anchorNode;
    const node = lineOf(state.host, target);

    // dispatch based on the node's class if a handler exists
    const classKey = node.classList[0];
    let ignoreDefault = false;
    if (typeof evtMapping[classKey] !== 'undefined' &&
        typeof evtMapping[classKey][evt.type] !== 'undefined') {
      ignoreDefault = evtMapping[classKey][evt.type](state, node, evt);
    }

    if (!ignoreDefault &&
        typeof evtMapping['*'] !== 'undefined' &&
        typeof evtMapping['*'][evt.type] !== 'undefined') {
      evtMapping['*'][evt.type](state, node, evt);
    }

    // otherwise, just re-render the line the edit happend on
    // else {
    //   while(target.parentElement != host && target != host) {
    //     target = target.parentElement;
    //   }
    //   renderLine(target, evt);
    // }
  };
}


/** Function to map between conditions and event handlers
@param {Object} opt -
  options dictionary evtMapping from name of event to a series of separate
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
export function matchRuleset(opt) {
  const evtMappings = opt.actions || [];
  let ignoreDefault = opt.ignoreDefault;
  if (typeof ignoreDefault === 'undefined') {
    ignoreDefault = false;
  }

  return function mapRulesAction(host, target, evt) {
    const content = target.textContent;
    let shouldIgnore = false;
    for (let i = 0; i < evtMappings.length; i++) {
      if (evtMappings[i][0](content, evt)) {
        evtMappings[i][1](host, target, evt);
        shouldIgnore = ignoreDefault;
        if (evtMappings[i][2]) {
          break;
        }
      }
    }
    return shouldIgnore;
  };
}
