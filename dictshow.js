// Goal: whenever someone clicks on a .word span, look at the string stored in the span's data-word property, split it into "words", look up each string in the dictionary, and fill the #dictionary div with the definitions and paradigms

var currently_shown_dictionary_entry; // We don't want to replace an existing entry with the same entry, because that will destroy and recreate the elements inside it, and that will interrupt a double-click in progress on one of those elements

function show_dictionary_entry(node) {
	let word = node.dataset.word;
	if(!word) {
		console.error(`Node ${node} was clicked, but it has no data-word attribute!`);
		return;
	}
	
	// Remove stray punctuation from the beginning and end
	word = word.replace(/[\.\?!,]+$/, "").replace(/^[\.\?!,]+/, "");
	// Don't worry about casing distinctions
	word = word.toLowerCase();
	// And now break it at clitic and determiner boundaries
	word = word.replace(/=/, " =").replace(/\^/, " ");
	
	if(word == currently_shown_dictionary_entry) return; // See above
	currently_shown_dictionary_entry = word;
	
	// The only space characters at this point should be from our determiner- and clitic-breaking, but it's also possible there were spaces inside the data-word property, in which case this is also an appropriate way to treat them
	console.log("word: " + word);
	let pieces = word.match(/\S+/g);
	console.log("pieces: " + pieces);
	
	let defns = [];
	for(let piece of pieces) {
		let clarify = pieces.length > 1 ? ` (from ${word})` : ""; // If a word is broken into multiple pieces, include the original in the error message
		if(!(piece in dictionary_forms)) {
			console.error(`Tried to look up word ${piece}${clarify}, but it has no headword in the dictionary!`);
			return;
		}
		let lemma = dictionary_forms[piece];
		if(!(lemma in dictionary_defns)) {
			console.error(`Word ${piece}${clarify} has headword ${lemma}, but that headword has no definition!`);
			return;
		}
		let defn = dictionary_defns[lemma];
		defns.push(`<h2 class="lemma">${lemma}</h1>\n${defn}`);
	}
	
	$("#dictionary").html(defns.join("\n\n<hr />\n\n"));
}

function insert_dictionary_word(node) {
	let word = node.dataset.word;
	if(!word) {
		console.error(`Node ${node} was double-clicked, but it has no data-word attribute!`);
		return;
	}
	
	// Remove stray punctuation from the beginning and end
	word = word.replace(/[\.\?!,]+$/, "").replace(/^[\.\?!,]+/, "");
	// Don't worry about casing distinctions
	word = word.toLowerCase();
	
	let clitic = word.startsWith("=");
	let existing = $("#aainput").val().trimRight();
	// Have a space between words unless the right one is a clitic or the left one doesn't exist
	// And leave a space at the end in case the user wants to type
	$("#aainput").val(existing + ((clitic || !existing) ? "" : " ") + word + " ");
}

$(document).on('click', '.word', function() { show_dictionary_entry(this); });
$(document).on('dblclick', '.word', function() { insert_dictionary_word(this); });
