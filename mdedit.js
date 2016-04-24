// external use function that sets up the event hooks
function mdedit(host) {
	host.addEventListener('keypress', dispatchKeypress(host));
}


// Dispatcher for the keypress event,
// allows us to do incremental changes to the div
// and separate logic with docParts
function dispatchKeypress(host) {
	return function dispatch(evt) {
		var selection = window.getSelection();
		if (selection.type='Caret') {

			// get the node the cursor is in
			var node = selection.anchorNode;
			var target = selection.anchorNode;
			if (node.nodeName == '#text') {
				node = node.parentElement;
			}

			// dispatch based on the node's class
			var classKey = node.classList[0];
			console.log('dispatching keypress on', node, classKey);
			if (docParts[classKey] == undefined) {
				console.log("docParts not found for ", classKey)
			} else {
				docParts[classKey].keypress(host, target, evt);
			}
			
  		}
	}
}

var keys = {
	TAB:	"\t".charCodeAt(0),
	ENTER:	"\n".charCodeAt(0),
	HASH:	"#".charCodeAt(0)
}

var docParts = {
	// root elem
	mdedit: {
		keypress: function(host, evt) {
		}
	},

	p: {
		keypress: 	
			eventSet({
				[keys.HASH]: hashHeader,
			})
	},

	h1: {
		keypress:
			eventSet({
				[keys.ENTER]: clearToParagraph
			})
	}
};

function eventSet(events) {
	return function(host, target, evt) {
		if (events[evt.keyCode] != undefined) {
			events[evt.keyCode](host, target, evt);
		}
	}
}


////////////////////
// Actual events  //
////////////////////

function hashHeader(host, target, evt) {
	console.log("hash header");
	var selection = window.getSelection();
	if (selection.anchorOffset == countHashes(target.textContent)) {
		target.className = 'h1';
	} else {

	}

}

function clearToParagraph(host, target, evt) {
	
}


//////////
// UTIL //
//////////

function countHashes(str) {
	var i = 0;
	while (str.charAt(i) == '#') { i++; }
	return i;
}