let { base16 } = require('./Helpers');

class Symbols{
	constructor(processor){
		this.Processor = processor;

		this.Input = new Map();
		this.Output = [];
	}

	has(name){
		return this.Input.has(name);
	}

	get(name){
		return this.Input.get(name);
	}

	import(){
		let path = this.Processor.Parameters.Base.SYM;
	
		if(path){
			let symfile = this.Processor.readFile('Base.SYM', path, 'utf8'),
				lines = symfile.split(/\r\n|\r|\n/);
	
			lines.forEach( (line,i) => {
				// Get rid of comments
				let [content] = line.split(';');
				
				// Ignore empty lines
				if(content.match(/^\W*$/)){
					return;
				}
				
				let match = content.match(/([0-9a-fA-F]{1,2}):([0-9a-fA-F]{4}) (.+)/);
				if(!match){
					this.Processor.Log.Compiler.Error(`Invalid _Base.SYM_ file syntax at line ${i+1}`);
				}
	
				let [fullContent, bankStr, addrStr, nameStr] = match,
					nameMatch = nameStr.match(/^([a-zA-Z$_][a-zA-Z0-9$_]*(?:\.[a-zA-Z$_][a-zA-Z0-9$_]*)*)(:End)?$/);
				if( !nameMatch ){
					this.Processor.Log.Compiler.Error(`Invalid _Base.SYM_ name at line ${i+1}: _${nameStr}_`)
				}
	
				let [fullName, name, end] = nameMatch,
					which = end ? 'After' : 'Before',
					id = parseInt(bankStr, 16),
					address = parseInt(addrStr, 16);
	
				// Validate the name
				let sym = this.Input.get(name);
				if(sym && sym[which]){
					if( sym[which].id === id && sym[which].address === address ){
						this.Processor.Log.Compiler.Warning(`_Base.SYM_ has duplicated name with the same address: _${nameStr}_`);
					}
					else{
						this.Processor.Log.Compiler.Error(`_Base.SYM_ has duplicated name with different addresess: _${nameStr}_`);
					}
				}
	
				// Validate the address
				let invalidAddress = false;
	
				// Address does not exist in this Cartridge
				if( id > this.Processor.Header.ROMBanks ){
					invalidAddress = true;
				}
				// Home bank but address is is between 0x4000-0x7FFF
				else if(id === 0){
					if( address > 0x7FFF ){
						let data = this.Processor.RAM.get(name);
						data["resolve" + which]({ id, address });
					}
					else if(address > 0x3FFF ){
						invalidAddress = true;
					}
				}
				// Not home bank and address is outside 0x4000-0x7FFF
				else {
					if( address > 0x7FFF && address < 0xE000 ){
						let data = this.Processor.RAM.get(name);
						data["resolve" + which]({ id, address });
					}
					else if(address < 0x4000 || address > 0xE000 ){
						invalidAddress = true;
					}
				}
				if(invalidAddress){
					this.Processor.Log.Compiler.Suppressable(`Invalid _Base.SYM_ address at line ${i+1}: _${bankStr}:${addrStr}_`)
				}
	
				// Store it to the output
				this.storeOutput(id, address, nameStr);
				
				if(sym){
					sym[which] = {id, address};
				}
				else{
					this.Input.set(name,{ [which]: { id, address } });
				}
			});
			
			this.Processor.Log.Compiler.Log('Successfully Imported Base.SYM');
		}
	}

	export(){
		let path = this.Processor.Parameters.Output.SYM;
	
		if(path){
			let string = this.compileOutput();
			this.Processor.writeFile('Output.SYM', path, string);
		}
	}

	// TODO - RAM should get stored to the output sym as well
	storeOutput(bank, address, name){
		// Store it to the output
		if(!this.Output[bank]){
			this.Output[bank] = [];
		}

		if(!this.Output[bank][address]){
			this.Output[bank][address] = new Set();
		}
		this.Output[bank][address].add(name);
	}

	compileOutput(){
		let str = '';
		this.Output.forEach( (bankArray, bank) => {
			bankArray.forEach( (names, addr) => {
				let addrStr = `${base16(bank, 2)}:${base16(addr, 4)} `;
				for(let name of names){
					str += `${addrStr}${name}\n`;
				}
			});
		});
		return str;
	}
}

module.exports = Symbols;