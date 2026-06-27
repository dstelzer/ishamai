# Generate JavaScript files from the various Hantatallas data
# The data needed is:
# hzl.dat : Hantatallas data on all the signs, includes a mapping from sign names to HZL numbers
# unicode_cleaned.csv : data from Wiktionary, includes a mapping from HZL numbers to Unicode codepoints

import csv
from pathlib import Path
import json

def get_unicode(path):
	data = {}
	with path.open('r', newline='') as f:
		r = csv.DictReader(f)
		for i, row in enumerate(r):
			# The important columns for us are "HethZL" and "Unicode Glyph"
			# But we also look at "Sign Name" for error messages
			hzl = row['HethZL'].strip()
			unicode = row['Unicode Glyph'].strip()
			name = row['Sign Name'].strip()
			
			if not hzl: continue # Some signs in unicode.csv aren't actually in the HZL; we ignore them
			if not unicode: continue # And same if it has no codepoints
			if hzl.startswith('('): continue # And if it's a provisional assignment
			
			codepoints = []
			for c in unicode.split():
				if c.startswith('U+'):
					codepoints.append(int(c[2:], 16)) # Read as hex
			if not codepoints:
				print(f'\tWarning: couldn\'t parse unicode for {name}: "{unicode}" on line {i+2}')
				continue
			
			new = ''.join(chr(cp) for cp in codepoints)
			if hzl in data:
				print(f'\tWarning: entry for {hzl} exists already, {data[hzl]} being replaced by {new} on line {i+2}')
			# If we've gotten to here, we have a valid HZL number and list of one or more codepoints
			data[hzl] = new
	
	data['-1'] = '\ufffd' # For an error code
	
	return data

def get_hzl(path):
	backward = {}
	with path.open('r') as f:
		current = None
		namefound = False
		for i, line in enumerate(f): # i is for error message purposes
			if namefound:
				namefound = False
				if current is None: raise ValueError(current, line, i+1)
				if current in backward:
					print(f'\tWarning: entry for {current} already exists, {backward[current]} being replaced by {line.strip().split()} on line {i+1}')
				backward[current] = line.strip().split()
				current = None
			elif not line.startswith('\t'): # At the left column: new identifier
				if line.strip(): # And not a blank line, notably!
					current = line.strip()
			elif line.startswith('\tNAME'): # NAME in the second column: the next line will be the names
				namefound = True
	
	data = {}
	for hzl, rs in backward.items():
		for reading in rs:
			if reading in data:
				print(f'\tWarning: reading {reading} already corresponds to HZL {data[reading]}, now being assigned to {hzl}')
			data[reading] = hzl
	
	data['×××'] = '-1' # For an error code
	
	return data

def get_cleanup(path):
	data = {}
	with path.open('r') as f:
		for line in f:
			if not line.strip(): continue
			before, after = line.strip().split()
			if before in data: print(f'\tWarning: cleanup {before} already corresponds to {data[before]}, now being replaced by {after}')
			data[before] = after
			data[before.lower()] = after.lower()
	return data

def write_file(path, unicode, hzl, cleanup):
	unidata = json.dumps(unicode, indent='\t')
	hzldata = json.dumps(hzl, indent='\t')
	cleandata = json.dumps(cleanup, indent='\t')
	with path.open('w') as f:
		f.write('name_hzl = ' + hzldata + ';\n\n')
		f.write('hzl_unicode = ' + unidata + ';\n\n')
		f.write('sign_cleanup = ' + cleandata + ';\n')

if __name__ == '__main__':
	base = Path.home() / 'Projects/Cuneiform/hantatallas/data'
	print('Getting unicode')
	uni = get_unicode(base / 'unicode_cleaned.csv') # A version of the file cleaned up to remove warnings in this code
	print('Getting HZL')
	hzl = get_hzl(base / 'hzl.dat')
	print('Getting cleanup')
	clean = get_cleanup(base / 'cleanup.dat')
	print('Writing')
	write_file(Path('./hzl.js'), uni, hzl, clean)
	print('Done!')
