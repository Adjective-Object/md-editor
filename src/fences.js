import {
    isBefore,
} from './util';
/** @module fences

Utility functions for keeping track of the code fences
references the 'host' and 'fences' fields of the state object

lastFences: [
    '~': int,
    '`': int
]


THIS IS STUPID, WE ONLY NEED TO TRACK LAST FENCES
INFORMATION IS ALREADY STORED IN HTML DOM
GET FENCES ON EACH PASS BY CALLING
host.getElementsByClassName('codeFence');

*/

function fenceType(node) {
  return node.textContent.charAt(0);
}

function getPreviousFence(node) {
  node = node.previousSibling;
  while (node && !node.classList.contains('codeFence')) {
    node = node.previousSibling;
  }
  return node;
}

function getNextFence(node) {
  node = node.nextSibling;
  while (node && !node.classList.contains('codeFence')) {
    node = node.nextSibling;
  }
  return node;
}

function getOpeningFence(node, forceRoot=true, sameType=true) {
  let origFenceType = fenceType(node);  
  node = getPreviousFence(node);
  while (node && !(fenceType(node) === origFenceType && (
        node.getAttribute('fencestate') === 'enter' ||
        node.getAttribute('fencestate') === 'unpaired'))) {
    if (forceRoot && node.getAttribute('fencestate') === 'exit') {
      return null;
    }
    node = getPreviousFence(node);
  }
  return node;
}

// function getClosingFence(node) {
//   node = getNextFence(node);
//   while (node && !(node.getAttribute('fencestate') === 'exit')) {
//     node = getNextFence(node);
//   }
//   return node;
// }

function repairFenceStates(state, delims) {
  let current = delims[0];
  const final = delims[1];

  console.log('REPAIR FENCE STATES');

  let currentFenceType = null;
  while (current && (final === null || !current.isSameNode(final))) {
    console.log(currentFenceType, current);
 
    if (currentFenceType === null) {
      const thisFenceType = fenceType(current);
      if (current.isSameNode(state.lastFences[thisFenceType])) {
        current.setAttribute('fencestate', 'unpaired');
      } else {
        current.setAttribute('fencestate', 'enter');
        currentFenceType = thisFenceType;
      }
    } else if (currentFenceType === fenceType(current)) {
      current.setAttribute('fencestate', 'exit');
      currentFenceType = null;
    } else {
      current.setAttribute('fencestate', 'ignored');
    }
    current = getNextFence(current);
  }
}

function insertLastFence(state, node) {
  // register newest fence as the last fence if it is beyond the previous
  // last fence
  const newFenceType = fenceType(node);
  if (!(newFenceType in state.lastFences) ||
        isBefore(state.lastFences[newFenceType], node)) {
    state.lastFences[newFenceType] = node;
  }
}

function removeLastFence(state, node) {
  for (const type in state.lastFences) {
    if (state.lastFences[type].isSameNode(node)) {
      // find the last fence
      node = getPreviousFence(node);
      while (node && fenceType(node) !== type) {
        node = getPreviousFence(node);
      }

      if (node === null) {
        Reflect.deleteProperty(state.lastFences, type);
      } else {
        state.lastFences[type] = node;
      }
    }
  }
}

// returns bounds on nodes that need to be re-evaluated
// [firstnode, lastnode]
export function insertFence(state, newFence) {
  insertLastFence(state, newFence);

  let first = getNextFence(state.host.firstChild);
  repairFenceStates(state, [first, null])
  return [first, null];
}

export function removeFence(state, node) {
    // update lastFence by removing this fence
  removeLastFence(state, node);

  let first = getNextFence(state.host.firstChild);
  repairFenceStates(state, [first, null])
  return [first, null];
}

export function inFence(state, node) {
  if (node.classList.contains('codeFence')) { return false; }

  const previousFence = getPreviousFence(node);
  if (previousFence === null) { return false; }

  switch (previousFence.getAttribute('fencestate')) {
    case 'ignored':
    case 'enter':
      return true;
    case 'unpaired':
    case 'exit':
    default:
      return false;
  }
}
