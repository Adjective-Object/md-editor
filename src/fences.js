import {
	DOCUMENT_POSITION_PRECEDING,
	DOCUMENT_POSITION_FOLLOWING
} from './constants';
import {
	isBefore
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
	// console.log('"'+node.textContent+'"');
	return node.textContent.charAt(0);
}

function getPreviousFence(node) {
	node = node.previousSibling;
	while (node && !node.classList.contains('codeFence')) {
		node = node.previousSibling
	}
	return node;
}

function getNextFence(node) {
	node = node.nextSibling;
	while (node && !node.classList.contains('codeFence')) {
		node = node.nextSibling
	}
	return node;
}

function getOpeningFence(node) {
	node = getPreviousFence(node)
	while (node && !(
		node.getAttribute('fencestate') === 'enter' ||
		node.getAttribute('fencestate') === 'unpaired' )) {
		if (node.getAttribute('fencestate') === 'exit') {
			return null;
		}
		node = getPreviousFence(node);
	}
	return node;
}

function getClosingFence(node) {
	node = getNextFence(node)
	while (node && !(node.getAttribute('fencestate') === 'exit')) {
		node = getNextFence(node);
	}
	return node;	
}
function repairFenceStates(state, delims) {
	let current = delims[0];
	const final = delims[1];

	console.log('repairing fence state', delims);

	let currentFenceType = null; 
	while (current && !current.isSameNode(final)) {
		console.log(current);

		if (currentFenceType === null ) {
			let thisFenceType = fenceType(current);
			currentFenceType = thisFenceType;
			if (!current.isSameNode(state.lastFences[fenceType(current)])) {
				current.setAttribute('fencestate', 'enter');
			} else {
				current.setAttribute('fencestate', 'unpaired');
			}
		} else if ( currentFenceType === fenceType(current)) {
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
	let newFenceType = fenceType(node);
	console.log(newFenceType, state.lastFences);
	if (!(newFenceType in state.lastFences) ||
		isBefore(state.lastFences[newFenceType], node)) {
		state.lastFences[newFenceType] = node
	}
}

function removeLastFence(state, node) {
	for (let type in state.lastFences) {
		if (state.lastFences[type].isSameNode(node)) {
			// find the last fence
			node = getPreviousFence(node);
			while (node && fenceType(node) !== type) {
				node = getPreviousFence(node);
			}
			if (node !== null ) {
				state.lastFences[type] = node;
			} else {
				delete state.lastFences[type];
			}
		}
	}
}

// returns bounds on nodes that need to be re-evaluated
// [firstnode, lastnode]
export function insertFence(state, newFence) {
	let openingFence = getOpeningFence(newFence);
	let nextFence = getNextFence(newFence);

	let openingFenceState = openingFence ? openingFence.getAttribute('fencestate') : null;
	let newFenceState = newFence ? newFence.getAttribute('fencestate') : null;

	// update last fence if needed
	insertLastFence(state, newFence);

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
		return [openingFence, newFence];

	} else if (openingFenceState === 'enter') {
		// if the fence types don't match, ignore this fence
		if (fenceType(openingFence) !== fenceType(newFence)) {
			newFence.setAttribute('fencestate', 'ignored');
			return null;
		}

		// if we are pre-empting an existing fence,
		// make this an exit fence and re-render the text
		// following this
		newFence.setAttribute('fencestate', 'exit');
		repairFenceStates(state, [nextFence, null]);
		return [newFence.nextSibling, null];

	} else if (openingFenceState === null) {
		// if we are inserting in an empty block,
		// scan downwards
		repairFenceStates(state, [newFence, null]);
		return [newFence.nextSibling, null];
	}

	return null;
}

export function removeFence(state, node) {
	// update lastFence by removing this fence
	removeLastFence(state, node);

	let fenceState = node.getAttribute('fencestate');
	let other;
	let scanRange;
	switch(fenceState) {
		// on exit, remove and stuff
		case 'exit':
			// re-scan from opening fence
			console.log('remove exit node', node);
			scanRange = [getOpeningFence(node), null];
			console.log(scanRange);
			repairFenceStates(state, scanRange);
			return scanRange;

		case 'enter':
			// re-scan from fences below this
			console.log('remove entry node', node);
			scanRange = [node, null];
			repairFenceStates(state, scanRange);
			return scanRange;
	}

	return null;
}

export function inFence(state, node) {
	if (node.classList.contains('codeFence')) return false;

	let previousFence = getPreviousFence(node);
	// console.log('preceded by', previousFence);
	if (previousFence === null) return false;

	if (state.lastFences[fenceType(previousFence)].compareDocumentPosition(
		node) & DOCUMENT_POSITION_PRECEDING !== 0) {
		return false;
	}

	console.log(previousFence);

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