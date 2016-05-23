export function refExists(state, refName) {
	if (!(refName in state.refLinks)) { return false; }
	return state.refLinks[refName].href !== null
}

export function refAdd(state, refName, href=null, elem=null) {
	if (!(refName in state.refLinks)) {
		state.refLinks[refName] = {
			links: [],
			href: href
		}
	}
	if (elem !== null) {
		state.refLinks[refName].links.push(elem)
	}
}

export function ref(state, refName) {
	return state.refLinks[refName].href;
}