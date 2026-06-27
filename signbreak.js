// This is a very direct translation from signbreak.py, but it has been developed further since then and no longer corresponds directly to that code

var sign_breaking = (function() {

const LONG2SHORT = {
	'ā' : 'a',
	'ē' : 'e',
	'ī' : 'i',
	'ō' : 'o',
	'ū' : 'u',
	'â' : 'a',
	'ê' : 'e',
	'î' : 'i',
	'ô' : 'o',
	'û' : 'u',
}

const REPLACE = { // Sometimes the sign used in Hittite isn't the one with the most obvious name; for example, PI isn't used in Hittite (it's Hittite /wa/) and PÍ is used instead
	'pi' : 'pí',
	'pe' : 'pé',
	'be' : 'bé',
	'wi' : 'wi₅',
	'ḫe' : 'ḫé', // These two have both he/ze and hé/zé used in Hittite, but
	'ze' : 'zé', // the second ones are distinct from hi/zi and thus better
//	'gu' : 'ku', // Kloekhorst says GU is basically never used phonetically
				 // Similarly BA is rarely used except in names but since it does appear in names I'm leaving it intact here
}

const DOUBLE_REPLACE = [ // In this particular case, Hittite invariably uses a sign that's not V, CV, or VC, so we have to handle it specially
	{'first':'ay', 'second':'ya', 'replace':'ayya'},
]

const PRE_REPLACE = [ // Words always written with particular signs, which we should extract before doing anything else
	[/=k[aá]n$/gu, '-kán'], // enclitic kan
	[/=p[aá]t$/gu, '-pát'], // enclitic pat
	[/`/gu, '-:-'], // glossenkeil before word
	[/[=⸗]/gu, ''], // clitic boundaries
]

const DONT_SYLLABIFY = [
	'kán', 'pát'
]

const SEP = /[\.\-\^]/u; // . - ^ are things that can separate signs within a word
const V = "[aeiouāēīōūâêîôû]";
const C = "[bcdfghjklmnpqrstvwxyzšḫṣṭḳśŋĝř]";
const ONLYSEPS = /^[\.\-\^]*$/u; // Only separators, nothing else

//const FIXED = new Set(["pát", "kán", ":"]); // Hittite words written phonetically but with specific signs (and the Glossenkeil which has no Cs or Vs in it)

const STANDARDIZE_BOUND = [ // Convert phonemic bound transcription to standard bound transcription (which doesn't distinguish o/u or f/w)
	['ō', 'ū'],
	['o', 'u'],
	['f', 'w'],
]

function word_to_bound(s){
	for(let repl of STANDARDIZE_BOUND){
		s = s.replace(repl[0], repl[1]);
	}
	return s;
}

function syllabify(s){
	// First, we draw the syllable boundaries
	// If a vowel has one or more consonants before it, put a boundary before the first one
	s = s.replace(RegExp(`(${C}${V})`, "gu"), "+$1");
	// Then, if two vowels are next to each other, put a boundary between them
	s = s.replace(RegExp(`(${V})(${V})`, "gu"), "$1+$2");
	// Now we can break our word at these boundaries, and we're *almost* done
	let sylls = s.split("+");
	// But we might have a stray '' at the beginning, if the word started with a consonant
	// We could also have a stray consonant or cluster at the beginning, if words were allowed to start with multiple consonants, but Hittite doesn't allow that (at least not the way it's usually transcribed)
	if(!sylls[0]) sylls.shift();
//	console.log(sylls);
	return sylls;
}

// Turn a word into an array of signs
function word_to_signs(s){
	if(ONLYSEPS.test(s)) return []; // If we get a word that's only separators, or is empty, don't try to parse it any further; that means no signs at all
	
	// Do a bit of cleanup on the word before anything else, since there are a few clitics in Hittite that are treated specially
	for(let before of PRE_REPLACE){
		s = s.replace(before[0], before[1]);
	}
	
	// If there are sign boundaries explicitly marked inside it, like in NINDA-an or nu-kán, respect them
	let parts = s.split(SEP) // Break it at explicit sign boundaries
	if(parts.length > 1){
		let out = []; // Recurse on the parts, combining the lists it returns
		for(let i=0; i<parts.length; i++){
			out.push(...word_to_signs(parts[i]));
		}
		return out;
	}
	
	// Also check if this represents a single sign and should not be broken down syllabically
	for(let sign of DONT_SYLLABIFY){
		if(s == sign) return [s];
	}
	
	// If it's entirely in capitals (or has no letters at all, i.e. it's a number or punctuation mark), it's a sumerogram, don't try to divide it
	if(s == s.toUpperCase()) return [s];
	else s = s.toLowerCase(); // In case someone capitalizes the first letter of a name or whatever
	
	// Otherwise, we've got one or more syllabic signs on our hand! Let's try to break them down!
	let sylls = syllabify(s);
	
	// And now, just break down each syllable
	let out = [];
	for(let i=0; i<sylls.length; i++){
		out.push(...syllable_to_signs(sylls[i]));
	}
	
	// And run the sign replacements just to be safe - these ones replace one sign name with another, for instances where e.g. Hittite uses WI5 rather than WI, or PÍ rather than PI
	// (amusingly WI and PI are the same sign)
	for(let i=0; i<out.length; i++){
		if(out[i] in REPLACE){
			out[i] = REPLACE[out[i]];
		}
	}
	
	// And double replacements - when we look for two adjacent signs and replace them with a single one if the sequence is found
	// Currently this is exclusively for the sequence -ayya-, which should not be -ay-ya- but the single sign -AYYA- (= A.A)
	for(let i=0; i<out.length-1; i++){
		let first = out[i];
		let second = out[i+1];
		for(let repl of DOUBLE_REPLACE){
			if(first == repl.first && second == repl.second){
				out[i] = repl.replace; // Change first entry to the new sign
				out.splice(i+1, i+1); // Delete second entry
				break;
			}
		}
	}
	
	return out;
}

function syllable_to_signs(s){
	let pieces = s.split(RegExp(`(${V})`, "gu"));
	if(pieces.length != 3){
		console.error(`PROBLEM: Couldn't break syllable ${s} into onset/nucleus/coda, ended up with ${pieces}!`);
		return ['XXX']; // Error code
	}
	
	let [onset, nucleus, coda] = pieces;
	let plene = false;
	if(nucleus in LONG2SHORT){
		nucleus = LONG2SHORT[nucleus];
		plene = true;
	}
	if(!onset && !coda){ // Gotta include the vowel as its own unit if it wouldn't be included in a CV or VC sign
		plene = true;
	}
	
	// There are no separate Co and oC signs in Hittite (though I have tried to introduce those readings)
	let o = false;
	if(nucleus == "o"){
		nucleus = "u";
		o = true;
	}
	
	let out = [];
	
	if(onset){
		// A couple defects in the Hittite spelling system require us to be circumspect here
		// Transcriptions generally shouldn't include spellings like "we" but sometimes they do and we should be prepared
		if(onset == "w" && nucleus != "a" && nucleus != "i"){
			out.push("ú"); // Hittite varies between ú and u depending on context for this but ú is more common
			plene = true;
		}else if(onset == "y" && nucleus != "a"){
			out.push("i");
			plene = true;
		}else if(onset == "f"){
			out.push("w" + nucleus + nucleus); // Standard name for FA is WAA etc (properly with a subscript but that's not easy in Unicode)
		}else{
			out.push(onset + nucleus); // Can't be more than one consonant in Hittite
		}
	}
	if(plene){
		if(nucleus == "u" && !o){
			out.push("ú") // Use the ú sign for /u/ and the u sign for /o/
//		}else if(o){
//			out.push("o"); // Disable this if you want to call it "u" instead
		}else{
			out.push(nucleus);
		}
	}
	for(let i=0; i<coda.length; i++){ // Multiple coda consonants are possible
		out.push(nucleus + coda[i]); // We do link => li-in-ik not li-in-ak or li-na-ak etc, it's unambiguous and imo more elegant
	}
	
	return out;
}

return {
	word_to_bound : function(s) { return word_to_bound(s); },
	word_to_signs : function(s) { return word_to_signs(s); }
};

})();
