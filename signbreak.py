import re

SEPARATOR = set('.-^')
VOWEL = set('aeiouāēīōūâêîôû')
CONSONANT = set('bcdfghjklmnpqrstvwxyzšḫṣṭḳśŋĝř')
FIXED = {'pát', 'kán'} # Words always written with single signs that should not be broken down

LONG2SHORT = {
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

REPLACE = { # Sometimes the sign used in Hittite isn't the one with the most obvious name; for example, PI isn't used in Hittite (it's Hittite /wa/) and PÍ is used instead
	'pi' : 'pí',
	'bi' : 'bí',
	'pe' : 'pé',
	'be' : 'bé',
	'wi' : 'wi₅',
}

def regexify(s): return '[' + ''.join(s) + ']'

SEP = r'[\.\-=\^]'
V = regexify(VOWEL)
C = regexify(CONSONANT)

# Turn a word into a list of syllables
def syllabify(s):
	s = s.lower() # Precaution, though sumerograms should never get here
	
	# First, we draw the syllable boundaries
	# If a vowel has one or more consonants before it, put a boundary before the first one
	s = re.sub(fr'({C}{V})', r'.\1', s)
	# Then, if two vowels are next to each other, put a boundary between them
	s = re.sub(fr'({V})({V})', r'\1.\2', s)
	# Now we can break our word at these boundaries, and we're *almost* done
	sylls = s.split('.')
	# But we might have a stray '' at the beginning, if the word started with a consonant
	# We could also have a stray consonant or cluster at the beginning, if words were allowed to start with multiple consonants, but Hittite doesn't allow that (at least not the way it's usually transcribed)
	if not sylls[0]: sylls = sylls[1:]
	return sylls

# Turn a word into a list of signs
def breakdown(s):
	# If there are sign boundaries inside it, respect them
	parts = re.split(SEP, s) # Break it at explicit sign boundaries
	if len(parts) > 1: return sum((breakdown(part) for part in parts), start=[]) # Recurse on the parts, combining the lists it returns
	
	# If it's entirely in capitals, it's a sumerogram, don't try to divide it
	if s.isupper(): return [s]
	else: s = s.lower() # In case someone capitalizes the first letter of a name or whatever
	
	# If it's a "fixed word", that's always written the same way in Hittite, respect that too
	if s in FIXED: return [s]
	
	# Otherwise, we've got one or more syllables on our hand! Let's try to break them down!
	sylls = syllabify(s)
	print(sylls)
	
	# And now, just break down each syllable
	out = sum((breakdown_syll(syll) for syll in sylls), start=[])
	
	# And run the replacements just to be safe
	for i in range(len(out)):
		if out[i] in REPLACE: out[i] = REPLACE[out[i]]
	
	return out

def breakdown_syll(s):
	pieces = re.split(fr'({V})', s)
	if len(pieces) != 3:
		raise ValueError('Couldn\'t break syllable into onset, nucleus, and coda!', s, pieces)
	
	onset, nucleus, coda = pieces
	if nucleus in LONG2SHORT:
		nucleus = LONG2SHORT[nucleus]
		plene = True
	else:
		plene = False
	if not onset and not coda: # Gotta include the vowel as its own unit if it wouldn't be included in a CV or VC sign
		plene = True
	
	# There are no separate Co and oC signs in Hittite, if o even exists
	if nucleus == 'o':
		nucleus = 'u'
		o = True
	else:
		o = False
	
	out = []
	if onset:
		# A couple defects in the Hittite spelling system require us to be circumspect here
		# Transcriptions generally shouldn't include spellings like "we" but sometimes they do and we should be prepared
		if onset == 'w' and nucleus not in {'a', 'i'}:
			out.append('ú')
			plene = True
		elif onset == 'y' and nucleus != 'a':
			out.append('i')
			plene = True
		else:
			out.append(onset + nucleus) # Can't be more than one consonant in Hittite
	if plene:
		if nucleus == 'u' and not o:
			out.append('ú') # Use the ú sign for /u/ and the u sign for /o/
		elif o:
			out.append('u') # Disable this if you want to call it "u" instead
		else:
			out.append(nucleus)
	for c in coda: # Multiple coda consonants are possible
		out.append(nucleus + c)
	
	return out

if __name__ == '__main__':
	while True:
		words = input('>').split()
		words2 = ['-'.join(s for s in breakdown(word)) for word in words]
		print(' '.join(words2))
