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

	return [changeRangeStart.node, changeRangeEnd.node];
}

// inserts a fence object into the fence array and returns a list of nodes
// that need to be re-evaluated
// returns a list of the fences that need to be evaluated
// TODO check if the fence already exists in the list of fences
export function insertFence(state, newFenceNode) {
	let fences = state.fences;
	let lastFences = state.lastFences;

	let insertionPoint = getInsertionIndex(fences, newFenceNode);

	console.log('inserting at index', insertionPoint);
	let insertionFence = fences[insertionPoint - 1];

	console.log('insertionFence', insertionFence);
	let insertionType = insertionFence ? insertionFence.type : null;
	
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
		case 'unpaired':
			newFenceState = 'exit';
			insertionFence.scanState = 'enter';
			break;
		case null:
			newFenceState = 'unpaired';
			break;
	}

	// get the current state
	let currentBlock = null;
	switch (newFenceState) {
		case 'enter': currentBlock = newFenceType; break;
		case 'exit': currentBlock = null; break;
		case 'ignored': currentBlock = (newFenceType == '~') ? '`' : '~'; break;
		case 'unpaired': currentBlock = null; break;
	}

	// insert the new fence
	fences.splice(insertionPoint, 0, {
		node: newFenceNode,
		type: newFenceType,
		scanState: newFenceState
	})

	// register newest fence as the last fence if it is beyond the previous
	// last fence
	console.log('insert..', insertionPoint, lastFences, newFenceType);
	if (!(newFenceType in lastFences) ||
		lastFences[newFenceType] < insertionPoint) {
		lastFences[newFenceType] = insertionPoint
	}
	console.log(lastFences);

	// repair following fences if needed

	switch (newFenceState) {
		case 'exit':
		console.log('exiting');
		return repairFences(state, insertionPoint - 1, currentBlock);
		
		case 'enter':
		console.log('entering');
		return repairFences(state, insertionPoint, currentBlock);
		
		case 'ignored':
		case 'unpaired':
		default:
		return null
	}

	return null;
}

export function removeFence(state, fenceDiv) {
	console.log('removeFence', fenceDiv);
	let foundFenceIndex = -1;
	for (let i=0; i<state.fences.length; i++) {
		if (state.fences[i].node.isSameNode(fenceDiv)) {
			foundFenceIndex = i;
			break;
		}
	}

	if (foundFenceIndex === -1) {
		console.log('error: tried to remove fence not in list of fences');
		console.log('fences:', state.fences);
		console.log('fence div:', fenceDiv);		
	}

	// todo repair lastFences
	state.fences.splice(foundFenceIndex,1);

	let foundKey = null;
	for (let f in state.lastFences) {
		if (state.lastFences[f] == foundFenceIndex) {
			delete state.lastFences[f]; // find index of last fences
			foundKey = f;
			break;
		}
	}
	
	if (foundKey !== null) {
		for (let i=state.fences.length-1; i>=0; i--) {
			if (state.fences[i].type === foundKey) {
				state.lastFences[foundKey] = i;
				break;
			}
		}
	}
}

export function inFence(state, lineDiv) {
	let currentFence = null;
	console.log('trying to determine if is in fence');
	for (let i=0; i<state.fences.length; i++) {
		let position = lineDiv.compareDocumentPosition(state.fences[i].node);
		console.log(
			state.fences[i],
			position & DOCUMENT_POSITION_PRECEDING,
			state.lastFences);

		if (position & DOCUMENT_POSITION_PRECEDING) {
			if (currentFence === null) {
				if (i < state.lastFences[state.fences[i].type]) {
					// transitioning from empty to a type
					currentFence = state.fences[i].type
				}
			} else if (currentFence === state.fences[i].type) {
				// transitioning from a type to null on exit
				currentFence = null;
			}
		} else {
			return currentFence !== null;
		}
		console.log(currentFence);
	}
	return currentFence !== null;
}