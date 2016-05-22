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

function getOpeningFence(node) {
  node = getPreviousFence(node);
  while (node && !(
        node.getAttribute('fencestate') === 'enter' ||
        node.getAttribute('fencestate') === 'unpaired')) {
    if (node.getAttribute('fencestate') === 'exit') {
      return null;
    }
    node = getPreviousFence(node);
  }
  return node;
}

function getClosingFence(node) {
  node = getNextFence(node);
  while (node && !(node.getAttribute('fencestate') === 'exit')) {
    node = getNextFence(node);
  }
  return node;
}

function repairFenceStates(state, delims) {
  let current = delims[0];
  const final = delims[1];

  let currentFenceType = null;
  while (current && !current.isSameNode(final)) {
    if (currentFenceType === null) {
      const thisFenceType = fenceType(current);
      currentFenceType = thisFenceType;
      if (!current.isSameNode(state.lastFences[fenceType(current)])) {
        current.setAttribute('fencestate', 'enter');
      } else {
        current.setAttribute('fencestate', 'unpaired');
      }
    } else if (currentFenceType === fenceType(current)) {
      currentFenceType = null;
      current.setAttribute('fencestate', 'exit');
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
  const openingFence = getOpeningFence(newFence);
  const nextFence = getNextFence(newFence);

  const openingFenceState = openingFence ? openingFence.getAttribute('fencestate') : null;

    // update last fence if needed
  insertLastFence(state, newFence);

  // If we are closing an unpaired fence
  if (openingFenceState === 'unpaired') {
    // if the fence types don't match, ignore this fence
    if (fenceType(openingFence) !== fenceType(newFence)) {
      newFence.setAttribute('fencestate', 'ignored');
      return null;
    }

    // if we are closing an unpaired fence, turn it into
    // an enter fence
    openingFence.setAttribute('fencestate', 'enter');
    newFence.setAttribute('fencestate', 'exit');
    return [ openingFence, newFence ];

  // If we might be pre-empting an exisiting pair
  } else if (openingFenceState === 'enter') {
    // if the fence types don't match, ignore this fence
    if (fenceType(openingFence) !== fenceType(newFence)) {
      newFence.setAttribute('fencestate', 'ignored');
      return null;
    }

    // otherwise, we are pre-empting an existing fence.
    // make this an exit fence and re-render the text
    // following this
    newFence.setAttribute('fencestate', 'exit');
    repairFenceStates(state, [ nextFence, null ]);
    return [ newFence.nextSibling, null ];

  // if we are inserting in an empty block,
  // scan downwards
  } else if (openingFenceState === null) {
    repairFenceStates(state, [ newFence, null ]);
    return [ newFence.nextSibling, null ];
  }

  return null;
}

export function removeFence(state, node) {
    // update lastFence by removing this fence
  removeLastFence(state, node);

  const fenceState = node.getAttribute('fencestate');
  let scanRange = null;
  switch (fenceState) {
        // on exit, remove and stuff
    case 'exit':
            // re-scan from opening fence
      scanRange = [ getOpeningFence(node), null ];
      repairFenceStates(state, scanRange);
      return scanRange;

    case 'enter':
            // re-scan from fences below this
      scanRange = [ node, null ];
      repairFenceStates(state, scanRange);
      return scanRange;

    default:
      return null;
  }
}

export function inFence(state, node) {
  if (node.classList.contains('codeFence')) { return false; }

  const previousFence = getPreviousFence(node);
  if (previousFence === null) { return false; }

  if (isBefore(node.state.lastFences[fenceType(previousFence)])) {
    return false;
  }

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
