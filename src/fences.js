import {
	DOCUMENT_POSITION_PRECEDING,
	DOCUMENT_POSITION_FOLLOWING
} from './constants';
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
		console.log('traversing from', node);
		node = node.previousSibling
	}
	return node;
}

function getOpeningFence(node) {
	node = getPreviousFence(node)
	while (node && (
		node.getAttribute('fencestate') === 'enter' ||
		node.getAttribute('fencestate') === 'unpaired' )) {
		node = getPreviousFence(node);		
	}
	return node;
}

function getRenderRange(state, newFence) {
	openingFence = getOpeningFence(newFence);
	closingFence = getClosingFence(newFence);
	
	openingFenceState = openingFence.getAttribute('fencestate');
	newFenceState = newFence.getAttribute('fencestate');

	if (openingFenceState === 'unpaired') {
		previousFence.setAttribute('fencestate', 'enter');
		return [previousFence, newFence];
	}

}

// inserts a fence object into the fence array and returns a list of nodes
// that need to be re-evaluated
// returns a list of the fences that need to be evaluated
// TODO check if the fence already exists in the list of fences
export function insertFence(state, newFenceNode) {
	let lastFences = state.lastFences;
	let previousFence = getPreviousFence(newFenceNode);
	console.log('insertion, previous is', previousFence);

	let previousFenceType = previousFence
		? fenceType(previousFence)
		: null;
	let previousFenceState = previousFence 
		? previousFence.getAttribute('fencestate') 
		: null;

	let newFenceType = fenceType(newFenceNode);

	// find out how to handle this fence and the context of the fence
	// based on the previous fence

	let newFenceState;
	switch (previousFenceState) {
		case 'enter':
			newFenceState = (newFenceType === previousFenceType) 
				? 'exit'
				: 'ignored';
			break;

		case 'exit':
			newFenceState = 'enter';
			break;

		case 'ignored':
			newFenceState = (newFenceType !== previousFenceType) 
				? 'exit'
				: 'ignored';
			break;

		case 'unpaired':
			newFenceState = 'exit';
			break;

		default:
			// log warning and fall though to null case
			console.log(
				'unhandled case for previousFenceState',
				previousFenceState);
		case null:
			newFenceState = 'unpaired';
			break;
	}

	// assign newFenceState
	newFenceNode.setAttribute('fencestate', newFenceState);

	// register newest fence as the last fence if it is beyond the previous
	// last fence
	if (!(newFenceType in lastFences) ||
		(lastFences[newFenceType].compareDocumentPosition(newFenceNode) &
		 DOCUMENT_POSITION_PRECEDING) !== 0
	   ) {
		lastFences[newFenceType] = newFenceNode
	}
	console.log(lastFences);

	// repair following fences if needed

	switch (newFenceState) {
		case 'exit':
		return null;
		//return getRenderRange(state, previousFence, newFenceNode);
		
		case 'enter':
		return null;
		//return getRenderRange(state, previousFence, newFenceNode);
		
		case 'ignored':
		case 'unpaired':
		default:
		return null
	}

	return null;
}

export function inFence(state, lineDiv) {
	if (lineDiv.classList.contains('codeFence')) return false;

	let previousFence = getPreviousFence(lineDiv);
	console.log('preceded by', previousFence);
	if (previousFence === null) return false;

	if (state.lastFences[fenceType(previousFence)].compareDocumentPosition(
		lineDiv) & DOCUMENT_POSITION_PRECEDING !== 0) {
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