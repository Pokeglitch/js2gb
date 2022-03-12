function isByte(val){
	return typeof val === 'number' && Number.isInteger(val) && val >= 0;
}

// To convert the given value (as ASCII array) into a byte array (or null if invalid)
function fromASCII(val, len){
	let invalidASCIIvalue = false,
		checkByte = val => {
			if(isByte(val)){
				if(val >= 0x80){
					invalidASCIIvalue = true;
				}
				return true;
			}
			return false;
		};

	// If the input is a single byte, convert it to a 1 element array
	if(checkByte(val)){
		val = [val]
	}
	// Input must be string or array within given length
	else if( ( typeof val !== 'string' && !Array.isArray(val) ) || val.length > len ){
		return [null,true];
	}

	let output = [];

	if(typeof val === 'string'){
		for(let i=0; i<val.length; i++){
			let el = val.charCodeAt(i);
			if( !checkByte(el) ){
				return [null,true];
			}
			output.push(el);
		}
	}
	else{
		for(let i=0; i<val.length; i++){
			let el = val[i];
			if(typeof el === 'string'){
				if(el.length > 1){
					return [null,true];
				}
				el = el.charCodeAt(0);
			}
			if(!checkByte(el)){
				return [null,true];
			}
			output.push(el);
		}
	}
	return [output, invalidASCIIvalue];
}

// To convert a byte array back into an ASCII string
// This should only be called with a valid byte array
// If the input is null, then return an empty string
function toASCII(arr){
	return arr ?
		arr.map(x => String.fromCharCode(x)).join('') :
		'';
}
	
// To see if the given array is all zeroes
function isAllZeroes(arr){
	for(let i=0; i<arr.length; i++){
		if(arr[i] !== 0){
			return false;
		}
	}
	return true;
}

class Header {
	constructor(processor){
		this.Processor = processor;

		this.Processor.Log.Compiler.Log('Parsing Input Header...');

		// The Nintendo Logo Bytes
		this.Logo = [
			0xCE, 0xED, 0x66, 0x66, 0xCC, 0x0D, 0x00, 0x0B,
			0x03, 0x73, 0x00, 0x83, 0x00, 0x0C, 0x00, 0x0D,
			0x00, 0x08, 0x11, 0x1F, 0x88, 0x89, 0x00, 0x0E,
			0xDC, 0xCC, 0x6E, 0xE6, 0xDD, 0xDD, 0xD9, 0x99,
			0xBB, 0xBB, 0x67, 0x63, 0x6E, 0x0E, 0xEC, 0xCC,
			0xDD, 0xDC, 0x99, 0x9F, 0xBB, 0xB9, 0x33, 0x3E
		];
		this.Binary = new Array(25).fill(0);
		// Initialize the Checksum value...skip the step of adding 1 for each byte (there are 25 bytes)
		this.Checksum = 25;

		let {
			Title, Manufacturer, OriginalGB, ColorGB, ColorByte,
			OldLicensee, NewLicensee, SuperGB, Type, ROMByte,
			ROMBanks, RAMByte, RAMBanks, ForJapan, Version
		} = this.Processor.Parameters.Header;
		
		let conflictingManufacturer, conflictingColorByte;
		[this.Title, conflictingManufacturer, conflictingColorByte] = this.validateTitle(Title);
		this.Manufacturer = this.validateManufacturer(Manufacturer, conflictingManufacturer);
		this.ColorByte = this.validateColorByte(OriginalGB, ColorGB, ColorByte, conflictingColorByte);
		[this.OldLicensee, this.NewLicensee] = this.validateLicensee(OldLicensee, NewLicensee);
		this.SuperGB = this.validateSuperGB(SuperGB);
		this.Type = this.validateType(Type);
		let validROMBanksValues = [2, 4, 8, 16, 32, 64, 128, 256, 512].concat(Array(73), 72, 80, 96);
		[this.ROMByte, this.ROMBanks] = this.validateBankSize('ROM', 20, ROMByte, ROMBanks, validROMBanksValues);
		[this.RAMByte, this.RAMBanks] = this.validateBankSize('RAM', 21, RAMByte, RAMBanks, [0, .25, 1, 4, 16, 8]);
		this.ForJapan = this.validateForJapan(ForJapan);
		this.Version = this.validateVersion(Version);

		// Reduce the Checksum to a single byte
		this.Checksum %= 0x100;
		// Convert to a negative value
		if(this.Checksum){
			this.Checksum = 0x100 - this.Checksum;
		}

		// Compile into a single array
		this.Compiled = this.Logo.concat( this.Binary, this.Checksum );
		
		this.Processor.Log.Compiler.Log('...Done Parsing Input Header');
	}
	storeHeaderValue(addr, val){
		if( typeof val == 'number' ){
			this.Binary[addr] = val;
			this.Checksum += val;
		}
		else if( Array.isArray(val) ){
			for(let i=0; i<val.length; i++, addr++){
				this.storeHeaderValue(addr, val[i]);
			}
		}
	}
	validateBoolean(name, val, def){
		if(val === undefined){
			this.Processor.Log.Header.Warning(`_${name}_ value is not defined. Defaulting to \`${def}\``)
			return def;
		}
		if(typeof val !== 'boolean'){
			this.Processor.Log.Header.Suppressable(`_${name}_ must be a <bool>`, `Defaulting to \`${def}\``);
			return def;
		}
		return val
	}
	validateTitle(title){
		let [asciiBytes, invalidASCIIvalue] = fromASCII(title, 16),
			conflictingManufacturer = null,
			conflictingColorByte = null;
		
		if(asciiBytes){
			if( invalidASCIIvalue ){
				this.Processor.Log.Header.Suppressable('_Title_ contains an ASCII value greater than 0x7F');
			}
			if( isAllZeroes(asciiBytes) ){
				this.Processor.Log.Header.Tip(`_Title_ value of only \`0x00\` is the default value`);
			}
			else{
				this.storeHeaderValue(0, asciiBytes);
			}
			// Extract conflicting values for Manufacturer and ColorByte
			if(title.length > 11){
				let conflictingManufacturerLength = Math.min(title.length - 11, 4);
				conflictingManufacturer = asciiBytes.slice(11, 11 + conflictingManufacturerLength);
				this.Processor.Log.Header.Warning('_Title_ overlaps the _Manufacturer_ position');

				if(title.length > 15){
					conflictingColorByte = asciiBytes[15];
					this.Processor.Log.Header.Warning('_Title_ overlaps the _ColorByte_ position');
				}
			}
		}
		else if(title === undefined){
			this.Processor.Log.Header.Warning('_Title_ value is not defined. Defaulting to filling with `0x00`')
		}
		else{
			this.Processor.Log.Header.Suppressable('_Title_ must be a <ascii(16)>', 'Defaulting to filling with `0x00`');
		}
		return [toASCII(asciiBytes), conflictingManufacturer, conflictingColorByte];
	}
	validateManufacturer(manufacturer, conflictingManufacturer){
		let [asciiBytes, invalidASCIIvalue] = fromASCII(manufacturer, 4);
		if(asciiBytes){
			if(conflictingManufacturer === null){
				if( invalidASCIIvalue ){
					this.Processor.Log.Header.Suppressable('_Manufacturer_ contains an ASCII value greater than 0x7F');
				}
				if( isAllZeroes(asciiBytes) ){
					this.Processor.Log.Header.Tip(`_Manufacturer_ value of only \`0x00\` is the default value`);
				}
				else{
					this.storeHeaderValue(11, asciiBytes);
				}
			}
			else{
				let match = conflictingManufacturer.length === asciiBytes.length;
				if(match){
					for(let i=0; i<asciiBytes.length; i++){
						if(conflictingManufacturer[i] !== asciiBytes[i]){
							match = false;
							break;
						}
					}
				}
				if(match){
					this.Processor.Log.Header.Tip('_Manufacturer_ value is the default value since it matches the overlapping _Title_ bytes');
				}
				else{
					this.Processor.Log.Header.Error('_Manufacturer_ value does not match the overlapping _Title_ bytes');
				}
			}
		}
		else{
			let defaultString = 'Defaulting to filling with `0x00`';
			asciiBytes = [0,0,0,0];

			if( conflictingManufacturer !== null ){
				while(conflictingManufacturer.length < 4){
					conflictingManufacturer.push(0);
				}
				defaultString = `Defaulting to filling all bytes not overlapped by _Title_ to 0x00`;
				asciiBytes = conflictingManufacturer;
			}
			if(manufacturer === undefined){
				this.Processor.Log.Header.Warning(`_Manufacturer_ value is not defined. ${defaultString}`)
			}
			else{
				this.Processor.Log.Header.Suppressable('_Manufacturer_ must be a <ascii(4)>', defaultString);
			}
		}
		return toASCII(asciiBytes);
	}
	validateColorByte(originalGB, colorGB, colorByte, conflictingColorByte){
		let validByte = isByte(colorByte);

		// If the ColorByte input is not valid, but there is a conflictingColorByte, default to that value
		if(!validByte && conflictingColorByte !== null){
			let defaultString = `Defaulting to the overlapping _Title_ byte value of HEX(${conflictingColorByte})`;
			if(colorByte === undefined){
				this.Processor.Log.Header.Warning(`_ColorByte_ value is not defined. ${defaultString}`);
			}
			else{
				this.Processor.Log.Header.Suppressable('_ColorByte_ must be a <byte>', defaultString);
			}
			colorByte = conflictingColorByte;
			conflictingColorByte = null;
			validByte = true;
		}

		if( validByte ){
			if( conflictingColorByte !== null ){
				if(colorByte === conflictingColorByte){
					this.Processor.Log.Header.Tip(`_ColorByte_ value of HEX(${colorByte}) is the default value since it matches the conflicting _Title_ byte`);
				}
				else{
					this.Processor.Log.Header.Error(`_ColorByte_ value of HEX(${colorByte}) conflicts with the overlapping _Title_ byte value of HEX(${conflictingColorByte})`);
				}
			}

			let extractedColorGB = (colorByte & 0x80) !== 0,
				ColorGBReasonString = `since _ColorByte_ value ${extractedColorGB ? 'has' : 'doesn\'t have'} bit 7 set`,
				ColorGBDefaultString = `Defaulting to \`${extractedColorGB}\` ${ColorGBReasonString}`;
			
			if(colorGB === undefined){
				this.Processor.Log.Header.Warning(`_ColorGB_ value is not defined. ${ColorGBDefaultString}`);
			}
			else if(typeof colorGB === 'boolean'){
				if(colorGB === extractedColorGB){
					this.Processor.Log.Header.Tip(`_ColorGB_ value of \`${extractedColorGB}\` is the default value ${ColorGBReasonString}`);
				}
				else{
					this.Processor.Log.Header.Error(`_ColorGB_ value of \`${extractedColorGB}\` conflicts with _ColorByte_ since bit 7 ${extractedColorGB ? 'is' : 'isn\'t' } set`);
				}
			}
			else{
				this.Processor.Log.Header.Suppressable('_ColorGB_ must be a <bool>', ColorGBDefaultString)
			}

			let extractedOriginalGB = extractedColorGB ?
					(colorByte & 0x40) !== 0 :
					true,
				OriginalGBReasonString = extractedColorGB ?
					`since _ColorGB_ is \`true\` and _ColorByte_ value ${extractedOriginalGB ? 'doesn\'t have' : 'has'} bit 6 set` :
					'since _ColorGB_ is `false`',
				OriginalGBDefaultString = `Defaulting to \`${extractedOriginalGB}\` ${OriginalGBReasonString}`;

			if(originalGB === undefined){
				this.Processor.Log.Header.Warning(`_OriginalGB_ value is not defined. ${OriginalGBDefaultString}`);
			}
			else if(typeof originalGB === 'boolean'){
				if(originalGB === extractedOriginalGB){
					this.Processor.Log.Header.Tip(`_OriginalGB_ value of \`${extractedOriginalGB}\` is the default value ${OriginalGBReasonString}`);
				}
				else if(extractedColorGB){
					this.Processor.Log.Header.Error(`_OriginalGB_ value of \`${extractedOriginalGB}\` conflicts with _ColorByte_ since _ColorGB_ is \`true\` and bit 6 ${extractedOriginalGB ? 'isn\'t' : 'is' } set`);
				}
				else{
					this.Processor.Log.Header.Error('_OriginalGB_ value of `false` is invalid since _ColorGB_ is also `false`');
				}
			}
			else{
				this.Processor.Log.Header.Suppressable('_OriginalGB_ must be a <bool>', OriginalGBDefaultString);
			}
				
			this.ColorGB = extractedColorGB;
			this.OriginalGB = extractedOriginalGB;
			if(colorByte){
				this.storeHeaderValue(15, colorByte);
			}
			return colorByte;
		}

		// Get the OriginalGB and ColorGB values
		this.ColorGB = this.validateBoolean('ColorGB', colorGB, false);
		this.OriginalGB = this.validateBoolean('OriginalGB', originalGB, true);

		let defaultString = 'Defaulting to ',
			defaultByte = 0;

		if(this.ColorGB){
			defaultByte = 1 << 7;
			if(this.OriginalGB){
				defaultString += '`0x80` since _OriginalGB_ and _ColorGB_ are both `true`';
			}
			else{
				defaultByte += 1 << 6;
				defaultString += '`0xC0` since _OriginalGB_ is `false` and _ColorGB_ is `true`';
			}
			this.storeHeaderValue(15, defaultByte);
		}
		else if(this.OriginalGB){
			defaultString += '`0x00` since _ColorGB_ is `false`';
		}
		else{
			this.Processor.Log.Header.Error('_OriginalGB_ and _ColorGB_ cannot both be `false`');
		}

		if(colorByte === undefined){
			this.Processor.Log.Header.Tip(`_ColorByte_ value is not defined. ${defaultString}`);
		}
		else{
			this.Processor.Log.Header.Suppressable('_ColorByte_ must be a <byte>', defaultString);
		}

		return defaultByte;
	}
	validateLicensee(oldLicensee, newLicensee){
		let [asciiBytes, invalidASCIIvalue] = fromASCII(newLicensee, 2),
			defaultString;

		if(asciiBytes){
			if( invalidASCIIvalue ){
				this.Processor.Log.Header.Suppressable('_NewLicensee_ contains an ASCII value greater than 0x7F');
			}
			if( isAllZeroes(asciiBytes) ){
				this.Processor.Log.Header.Tip(`_NewLicensee_ value of only \`0x00\` is the default value`);
			}
			else{
				this.storeHeaderValue(16, asciiBytes);
			}
		}
		else if(newLicensee === undefined){
			this.Processor.Log.Header.Warning('_NewLicensee_ value is not defined. Defaulting to filling with `0x00`');
		}
		else{
			this.Processor.Log.Header.Suppressable('_NewLicense_ must be a <ascii(2)>','Defaulting to filling with `0x00`');
		}

		if( oldLicensee === undefined ){
			[oldLicensee, defaultString] = this.getOldLicenseeDefaultValue(asciiBytes);
			this.Processor.Log.Header.Warning(`_OldLicensee_ value is not defined. ${defaultString}`);
		}
		else if(!isByte(oldLicensee)){
			[oldLicensee, defaultString] = this.getOldLicenseeDefaultValue(asciiBytes);
			this.Processor.Log.Header.Suppressable('_OldLicensee_ must be a <byte>',defaultString);
		}
		else if(oldLicensee === 0){
			this.Processor.Log.Header.Tip('_OldLicensee_ value of `0x00` is the default value');
		}

		if(oldLicensee){
			this.storeHeaderValue(23, oldLicensee);
		}
		return [oldLicensee, toASCII(asciiBytes) ];
	}
	getOldLicenseeDefaultValue(newLicensee){
		let oldLicensee = 0x33,
			defaultString = 'Defaulting to ';

		if(newLicensee){
			if(this.SuperGB){
				defaultString += '`0x33` since _NewLicensee_ is defined and _SuperGB_ is `true`';
			}
			else{
				defaultString += '`0x33` since _NewLicensee_ is defined';
			}
		}
		else if(this.SuperGB){
			defaultString += '`0x33` since _SuperGB_ is `true`';
		}
		else{
			defaultString += '`0x00`';
			oldLicensee = 0x00;
		}

		return [oldLicensee, defaultString];
	}
	validateSuperGB(superGB){
		if(superGB === undefined){
			this.Processor.Log.Header.Warning('_SuperGB_ value is not defined. Defaulting to `false`');
			return false;
		}

		if(superGB === true){
			this.storeHeaderValue(18, 0x03);
			return true;
		}
		
		if(superGB === false){
			this.Processor.Log.Header.Tip('_SuperGB_ value of `false` is the default value');
			return false;
		}

		if(!isByte(superGB)){
			this.Processor.Log.Header.Suppressable('_SuperGB_ must be a <bool|byte>', 'Defaulting to `false`');
			return false;
		}

		this.storeHeaderValue(18, superGB);

		if(superGB == 0x03){
			this.Processor.Log.Header.Tip('_SuperGB_ value of `0x03` is the same as `true`');
			return true;
		}
		
		if(superGB == 0x00){
			this.Processor.Log.Header.Tip('_SuperGB_ value of `0x00` is the default value');
			return false;
		}
		
		this.Processor.Log.Header.Suppressable(`_SuperGB_ value of HEX(${superGB}) is non-standard`, 'Defaulting to `false`');
		return false;
	}
	validateType(type){
		if( type === undefined ){
			this.Processor.Log.Header.Warning('_Type_ value is not defined. Defaulting to `0x00`');
			type = 0;
		}
		else if( !isByte(type) ){
			this.Processor.Log.Header.Suppressable('_Type_ value must be a <byte>','Defaulting to `0x00`');
			type = 0;
		}
		else if(type === 0){
			this.Processor.Log.Header.Tip('_Type_ value of `0x00` is the default value');
		}
		else{
			this.storeHeaderValue(19, type);
		}
		return type;
	}
	validateBankSize( key, index, byteValue, banksValue, values ){
		let suppressedBanksError = false,
			suppressedByteError = false,
			allowZero = values[0] === 0;

		// Error if banksValue is invalid
		if( banksValue !== undefined && (typeof banksValue !== 'number' || banksValue < (allowZero ? 0 : 1) || !Number.isInteger(banksValue)) ){
			this.Processor.Log.Header.Suppressable(`_${key}Banks_ must be a <${allowZero ? '!-' : '+' }int>`,`Defaulting to \`${values[0]}\``);
			suppressedBanksError = true;
			banksValues = values[0];
		};

		// If a byteValue is not provided:
		if( byteValue === undefined){
			// If a banksValue is also not provided, then use default
			if( banksValue === undefined ){
				this.Processor.Log.Header.Warning(`_${key}Byte_ is not defined. Defaulting to \`0x00\``);
				this.Processor.Log.Header.Warning(`_${key}Banks_ is not defined. Defaulting to \`${values[0]}\``);
				return [ 0, values[0] ]
			}

			// Derive the corresponding byteValue from the given banksValue
			byteValue = values.indexOf(banksValue);

			if( byteValue === -1 ){
				this.Processor.Log.Header.Error(`_${key}Banks_ value of \`${banksValue}\` is non-standard, so a _${key}Byte_ value must be provided`);
			}

			if( byteValue == 0 && !suppressedBanksError ){
				this.Processor.Log.Header.Tip(`_${key}Banks_ value of \`${banksValue}\` is the default value`);
			}
		}
		else{ 
			// Validate the byteValue
			if( !isByte(byteValue) ){
				this.Processor.Log.Header.Suppressable(`_${key}Byte_ must be a <byte>`,`Defaulting to \`0x00\``);
				suppressedByteError = true;
				byteValue = 0;
			}

			// Derive the banksValue if not provided
			if( banksValue === undefined ){
				if(values[byteValue] === undefined){
					this.Processor.Log.Header.Error(`_${key}Byte_ value of HEX(${byteValue}) is non-standard, so a _${key}Banks_ value must be provided`);
				}

				if( byteValue == 0 && !suppressedByteError ){
					this.Processor.Log.Header.Tip(`_${key}Byte_ value of \`0x00\` is the default value`);
				}

				banksValue = values[byteValue];
			}
			// Check to see if the provided combination is valid
			else{
				let banksValueIndex = values.indexOf(banksValue);
				// If the byteValue is non-standard
				if(values[byteValue] === undefined){
					// But the banksValue is
					if(banksValueIndex > -1){
						this.Processor.Log.Header.Suppressable(`_${key}Byte_ value of HEX(${byteValue}) is non-standard, but the _${key}Banks_ value of \`${banksValue}\` corresponds to a _${key}Byte_ value of HEX(${banksValueIndex})`);
					}
					// And the banksValue isn't
					else{
						this.Processor.Log.Header.Suppressable(`_${key}Byte_ value of HEX(${byteValue}) and _${key}Banks_ value of \`${banksValue}\` are non-standard`);
					}
				}
				else{
					// The byteValue is standard but the banksValue isn't
					if( banksValueIndex === -1 ){
						this.Processor.Log.Header.Suppressable(`_${key}Banks_ value of \`${banksValue}\` is non-standard, but the _${key}Byte_ value of HEX(${byteValue}) corresponds to a _${key}Banks_ value of \`${values[byteValue]}\``);
					}
					else if( banksValueIndex === byteValue && !suppressedBanksError && !suppressedByteError){
						this.Processor.Log.Header.Tip(`_${key}Byte_ and _${key}Banks_ value were both provided, but only one is necessary`);
					}
					else{
						this.Processor.Log.Header.Warning(`_${key}Byte_ value of HEX(${byteValue}) equates to a _${key}Banks_ value of \`${values[byteValue]}\`, but \`${banksValue}\` was provided`);
					}
				}
			}
		}
		this.storeHeaderValue(index, byteValue);
		return [byteValue, banksValue];
	}
	validateForJapan(forJapan){
		if(forJapan === undefined){
			this.Processor.Log.Header.Warning('_ForJapan_ value is not defined. Defaulting to `true`');
			return true;
		}
		
		if(forJapan === true){
			this.Processor.Log.Header.Tip('_ForJapan_ value of `true` is the default value');
			return true;
		}

		if(forJapan === false){
			this.storeHeaderValue(22, 0x01);
			return false;
		}

		if(!isByte(forJapan)){
			this.Processor.Log.Header.Suppressable('_ForJapan_ must be a <bool|byte>', 'Defaulting to `true`');
			return true;
		}

		this.storeHeaderValue(22, forJapan);
		if(forJapan == 0x01){
			this.Processor.Log.Header.Tip('_ForJapan_ value of `0x01` is the same as `false`');
			return true;
		}
		
		if(forJapan == 0){
			this.Processor.Log.Header.Tip('_ForJapan_ value of `0x00` is the default value');
			return false;
		}

		this.Processor.Log.Header.Suppressable(`_ForJapan_ value of HEX(${forJapan}) is non-standard`,'Defaulting to `true`');
		return false;
	}
	validateVersion(version){
		if(version === undefined){
			this.Processor.Log.Header.Warning('_Version_ is not defined. Defaulting to `0x00`');
			return 0;
		}

		if(!isByte(version)){
			this.Processor.Log.Header.Suppressable('_Version_ must be a <byte>', 'Defaulting to `0x00`');
			return 0;
		}

		this.storeHeaderValue(24, version);
		if(version == 0){
			this.Processor.Log.Header.Tip('_Version_ value of `0x00` is the default value');
		}
		return version;
	}
}



module.exports = Header;