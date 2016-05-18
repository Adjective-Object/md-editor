import {
	DOCUMENT_POSITION_PRECEDING,
	DOCUMENT_POSITION_FOLLOWING
} from './constants';
/** @module fences

Utility functions for keeping track of the code fences
references the 'host' and 'fences' fields of the state object

fences is a sorted list of objects keeping track of all the fence nodes
fences: [
	{ node : DOMNode
	, type: '~'|'`' (type not implemented)
	, scanState: 'enter' / 'exit' / 'ignored'
	}
]
lastFences: [
	'~': int,
	'`': int
]


*/

/**
find the index that this node should be inserted before.
Returns length of list if should be inserted at end
*/
// TODO implement a faster search algo
function getInsertionIndex(fences, newFence) {
	for (let i = 0; i < fences.length; i++) {
		let position = fences[i].node.compareDocumentPosition(newFence);
		if (position & DOCUMENT_POSITION_PRECEDING) {
			return i;
		}
	}
	return fences.length;
}

function fenceType(node) {
	return node.textContent.charAt(0);
}

function repairFences(state, index, currentBlock) {
	let fences = state.fences;
	let lastFences = state.lastFences;
	
	let changeRangeStart = null;
	let changeRangeEnd = null;

	for (let i = index; i < fences.length; i++) {
		let newScanState = 'ignored';

		if (fences[i].type === currentBlock) {
			newScanState = 'exit';
		}

		if (currentBlock === null && lastFences[fences[i].type] > i) {
			newScanState = 'enter';
		}

		if (newScanState !== fences[i].scanState) {
			// mark the beginning / end of a changed range
			if (changeRangeStart === null) {
				changeRangeStart = fences[i];
			}
			changeRangeEnd = fences[i];
		}
	}

	return [changeRangeStart, changeRangeEnd];
}

// inserts a fence object into the fence array and returns a list of nodes
// that need to be re-evaluated
// returns a list of the fences that need to be evaluated
// TODO check if the fence already exists in the list of fences
export function insertFence(state, newFenceNode) {
	let fences = state.fences;
	let lastFences = state.lastFences;

	let insertionPoint = getInsertionIndex(fences, newFenceNode);
	let insertionFence = fences[insertionPoint];
	let insertionType = insertionFence ? fences[insertionPoint].type : null;
	
	let scanState = insertionFence ? insertionFence.scanState : null;
	let newFenceType = fenceType(newFenceNode);

	// figure out if this insertion requires a re-evaluation of the things after
	// this point

	let newFenceState = 'ignored';
	switch (scanState) {
		case 'enter':
			currentBlock = null;
			newFenceState = 'enter';
			break;
		case 'exit':
			newFenceState = (newFenceType === insertionType) 
				? 'exit'
				: 'ignored';
			break;
		case 'ignored':
			newFenceState = (newFenceType !== insertionType) 
				? 'exit'
				: 'ignored';
			break;
	}

	// get the current state
	let currentBlock = null;
	switch (newFenceState) {
		case 'enter': currentBlock = newFenceType; break;
		case 'exit': currentBlock = null; break;
		case 'ignored': currentBlock = (newFenceType == '~') ? '`' : '~'; break;
	}

	// insert the new fence
	fences.splice(insertionPoint, 0, {
		node: newFenceNode,
		type: newFenceType,
		scanState: newFenceState
	})

	// register newest fence as the last fence if it is beyond the previous
	// last fence
	lastFences[newFenceType] = Math.max(
		insertionPoint, 
		lastFences[newFenceType]);

	// repair following fences if needed
	if (newFenceState !== 'ignored') {
		return repairFences(state, insertionPoint + 1, currentBlock);
	}

	return null;
}

export function removeFence(state, fenceDiv) {
	for (let i=0; i<state.fences.length; i++) {
		if (state.fences[i].node.isSameNode(fenceDiv)) {
			state.fences.splice(i,1);
			return;
		}
	}
	console.log('error: tried to remove fence not in list of fences');
	console.log('fences:', state.fences);
	console.log('fence div:', fenceDiv);
}

export function inFence(state, lineDiv) {
	let currentFence = null;
	for (let i=0; i<state.fences.length; i++) {
		let position = lineDiv.compareDocumentPosition(state.fences[i].node);

		if ((position & DOCUMENT_POSITION_PRECEDING) && 
			i < state.lastFences[currentFence] && 
			currentFence === null) {
			currentFence = state.fences[i].node.type;
		} else if (position & (DOCUMENT_POSITION_PRECEDING) && 
			currentFence === state.fences[i].node.type) {
			currentFence = null;
		} else if (position & DOCUMENT_POSITION_FOLLOWING) {
			return currentFence !== null;
		}
	}
	return currentFence !== null;
}