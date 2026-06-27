var cuneiform = (function() {

// Utility functions for DOM manipulation
function make_span(cls){
	let out = document.createElement("span");
	out.setAttribute("class", cls);
	return out;
}
function add_text(parent, text){
	let inner = document.createTextNode(text);
	parent.appendChild(inner);
}

// More utility functions for the dropdowns that change body classes
// Now requires jQuery!
var dropdown_values = {};
function load_dropdowns() {
	$(".settings").each(function(_) {
		let value = this.options[this.selectedIndex].value;
		dropdown_values[this.id] = value;
		document.body.classList.add(value);
	});
}
function update_dropdowns(which) {
	let value = which.options[which.selectedIndex].value;
	let old = dropdown_values[which.id];
	dropdown_values[which.id] = value;
	document.body.classList.remove(old);
	document.body.classList.add(value);
}
$(function() {
	load_dropdowns();
	$(".settings").on("change", function() { update_dropdowns(this); } );
});

var cleanup_regexes = null;
function make_cleanup_regexes(){ // Take the sign_cleanup dictionary and turn it into a list of regexes for speed purposes
	cleanup_regexes = [];
	for(let [key, value] of Object.entries(sign_cleanup)){
		cleanup_regexes.push([new RegExp(key), value]);
	}
}

const SIGN = "(?:\\p{Letter}|\\p{Number}|\\+|:|×)+"; // Any sequence of letters, numbers, and three punctuation marks that can appear in sign names (+, ×, :), using non-capturing groups
const SEPS = "[\\-\\.\\^=]"; // Dash (for phonograms), dot (for logograms), equals (for clitics), caret (for determiners)
const WORD = new RegExp(`((?:${SEPS}*${SIGN})+${SEPS}*)`, "gu"); // We now allow separators optionally at either end, to avoid problems with Akkadograms (which are in their own <em> tags) leaving dangling = and - next to them
const SEPARATOR = new RegExp(`${SEPS}`, "gu");

// Create the element representing a sign: a "sign" span containing a "glyph" span (Unicode) and a "read" span (reading)
function make_sign_element(reading, unicode){
	let sign = make_span("sign");
	let glyph = make_span("glyph");
	add_text(glyph, unicode);
	let read = make_span("read");
	add_text(read, reading);
	sign.appendChild(glyph);
	sign.appendChild(read);
	return sign;
}

// Take a reading and convert it to Unicode characters
function get_unicode_for(reading){
	if(!cleanup_regexes) make_cleanup_regexes();
	
	reading = reading.toUpperCase();
	for(let [key, value] of cleanup_regexes){ // H to Ḫ etc
		reading = reading.replace(key, value);
	}
	
	if(!(reading in name_hzl)){
		console.error("Unrecognized sign name " + reading);
		return hzl_unicode["-1"];
	}
	let hzl = name_hzl[reading];
	if(!(hzl in hzl_unicode)){
		console.error("Unrecognized HZL index " + hzl + " (for " + reading + ")");
		return hzl_unicode["-1"];
	}
	return hzl_unicode[hzl];
}

// Take a word and split it up into signs, returning an array of readings
function divide_signs(word, bound){
	if(bound){
		return sign_breaking.word_to_signs(word); // See signbreak.js for the syllabification and syllable-to-signs algorithms
	}else{
		return word.split(SEPARATOR); // If it's a transliteration instead of a bound transcription, we only have to split by separators
	}
}

// Take a word, split it into signs, then make an element for each one and return an array of them
function shatter_word(word, bound, all_the_way=true){
	let node = make_span("word");
	node.setAttribute("data-word", word);
	if(!all_the_way){ // If we're not going all the way, we're done here
		add_text(node, sign_breaking.word_to_bound(word));
		return node;
	}
	
	let signs = divide_signs(word, bound);
	let result = [];
	for(sign of signs){ // Not using .map here because we don't want to include anything (not even `undefined`) in the output if we get an empty string as input
		if(sign){
			node.appendChild(make_sign_element(sign, get_unicode_for(sign)));
		}
	}
	return node;
}

// Take whitespace and embed it in an element, in case we use this for the future I guess
function shatter_whitespace(word, all_the_way=true){
	if(!all_the_way) return document.createTextNode(word); // Just a text node
	let node = make_span("whitespace"); // Otherwise we wrap it in .whitespace
	add_text(node, word);
	return node;
}

// Take a text element and return an array of nodes to replace it with in the translit version
// If `bound` is true it will assume this is a bound transcription and run the word -> syllables -> signs processing; otherwise it will assume this is a transliteration and it only needs to split on sign dividers
// If `all_the_way` is false it will divide the words and whitespace but not take the last step of turning them into cuneiform
function shatter_text(text, bound, all_the_way=true){
	let segments = text.split(WORD); // 1, 3, 5, etc will be the words, 0, 2, 4, etc will be whatever's in between them (or at either end)
//	console.log("Segments: "+segments);
	let out = [];
	segments.forEach(function(word, index){
		if(!word) ;
		else if(index%2 == 1) out.push(shatter_word(word, bound, all_the_way));
		else out.push(shatter_whitespace(word, all_the_way));
	});
//	console.log(out);
	return out;
}

// Check the data-language property of a text node's parents to figure out if it should be English or Hittite (needed for the Å-machine because its output spans are messy and this works better than checking the class)
function latest_parent_language(node){
	let l;
	if(node.nodeType == Node.TEXT_NODE) node = node.parentNode; // can't access dataset of a text node
	while(true){
		l = node.dataset.language;
		if(l) return l;
		node = node.parentNode;
		if(!node || node == node.getRootNode()) break; // can't access dataset of the root node either
	}
	return null;
}

// Take an element and make two versions of it, "bound" and "translit"
function process_element(element, include_bound=true){
	// First, see if it already has a child of class "translit"
	let child = element.querySelector(".translit");
	if(child) return; // Already done, nothing to do here
	
	// Create a span of class "translit" to be a child of it
	let translit = make_span("translit");
	// And move all children over
	while(element.childNodes.length > 0) translit.appendChild(element.childNodes[0]);
	
	if(include_bound){
		// Then copy it to make "bound"
		var bound = translit.cloneNode(true); // Deep copy
		bound.setAttribute("class", "bound");
		element.appendChild(bound); // Put this first
	}
	
	// Then put the translit inside the element
	element.appendChild(translit);
	
	// Now we need to find all the TEXT_NODE nodes within this…which we can't do with querySelectorAll! So we need to do this manually, selecting `element` and all its descendants, then scanning the children of each one.
	let elnodes = Array.from(translit.querySelectorAll("*")); // All descendant elements - cannot get text nodes with querySelectorAll sadly
	elnodes.push(translit);
	let textnodes = [];
	for(let i=0; i<elnodes.length; i++){
		let el = elnodes[i];
		for(let j=0; j<el.childNodes.length; j++){
			let ch = el.childNodes[j];
			if(ch.nodeType == Node.TEXT_NODE && latest_parent_language(ch) != 'en'){
				textnodes.push(ch);
			}
		}
	}
//	console.log("Text nodes: " + textnodes.map(node => node.textContent));
	textnodes.forEach(node => node.replaceWith(... shatter_text(node.textContent, include_bound)) );
	
	if(!include_bound) return;
	// If include_bound, we have to do the same for the bound one
	elnodes = Array.from(bound.querySelectorAll("*"));
	elnodes.push(bound);
	textnodes = [];
	for(let i=0; i<elnodes.length; i++){
		let el = elnodes[i];
		for(let j=0; j<el.childNodes.length; j++){
			let ch = el.childNodes[j];
			if(ch.nodeType == Node.TEXT_NODE && latest_parent_language(ch) != 'en'){
				textnodes.push(ch);
			}
		}
	}
	textnodes.forEach(node => node.replaceWith(... shatter_text(node.textContent, true, false)) );
}

// Do this to every line on the page
function process_all(){
	let hittite = document.getElementsByClassName("hittite");
	for(let node of hittite) process_element(node, true);
	
	let signs = document.getElementsByClassName("signs");
	for(let node of signs) process_element(node, false);
}

// For the Å-machine, we need to do this differently because of how it structures the page
function process_paragraphs(){
	let paras = document.getElementsByTagName("p");
	for(let node of paras) process_element(node, true);
}

return {
	process_element : function(element, include_bound=true) { process_element(element, include_bound); },
	process_all : function() { process_all(); },
	process_paragraphs : function() { process_paragraphs(); }
};

})();

document.addEventListener("DOMContentLoaded", cuneiform.process_all, false); // Run that when the whole page is ready
