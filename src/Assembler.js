let vm = require('vm'),
    fs = require('fs'),
    path = require('path'),
	{ SkipDirective } = require('./Directives');

class Memory {
    constructor(processor, Name, Interpreter, Allocator, Compiler){
        this.Processor = processor;
        this.Name = Name;
        this.Interpreter = new Interpreter(this);
        this.Allocator = new Allocator(this);
        this.Compiler = new Compiler(this);
        this.Identifiers = new Map();
    }

    get(id){
        if( this.Identifiers.has(id) ){
            return this.Identifiers.get(id);
        }
        return this.new(id);
    }

    compile(){
        let filepath = this.Processor.Parameters.Source[this.Name];

        if(filepath){
            this.Processor.Log.Compiler.Log(`Compiling ${this.Name} from ${filepath}...`);
            
            this.Interpreter.parseFile(filepath)
            this.Allocator.compile();
            this.Compiler.compile();

            this.Processor.Log.Compiler.Log(`...Done Compiling ${this.Name}`);
        }
    }
}

class Interpreter {
    constructor(memory){
        this.Memory = memory;
        this.Name = memory.Name;
        this.Context = this.generateContext();
        this.Object = this.parse('Object');
    }
    parse(script, filepath){
        return vm.runInContext(script, this.Context, filepath);
    }
    parseFile(filepath){
        try{
            let parentDir = this.Context.__dirname,
                fullpath = path.resolve(parentDir, filepath);
            
            this.Context.__dirname = path.dirname(fullpath);

            let script = fs.readFileSync(fullpath);
            this.parse(script, fullpath);

            this.Context.__dirname = parentDir;
        }
        catch(e){
            console.log(e)
            this.Memory.Processor.Log.Compiler.Error(`Error parsing '${filepath}'`);
        }
    }
    parseJSON(filepath){
        try{
            let parentDir = this.Context.__dirname,
                fullpath = path.resolve(parentDir, filepath);
            
            let json = fs.readFileSync(fullpath),
                obj = JSON.parse(json);
            
            return this.parse( '(' + JSON.stringify(obj) + ')', fullpath);
        }
        catch(e){
            this.Memory.Processor.Log.Compiler.Error(`Error parsing '${filepath}'`);
        }
    }
    generateContext(context = {}){
        context.__dirname = path.resolve('.');
        context.require = (...args) => require(...args);
        context.log = msg => { this.Memory.Processor.Log.User.Log(msg, true) };
        context.json = filepath => this.parseJSON(filepath);
        context.include = filepath => { this.parseFile(filepath) };
        context.Section = (...args) => { this.Memory.Allocator.allocateNamedSection(...args) };
        context.Skip = (...args) => { new SkipDirective(this.Memory, ...args) };
        context.Goto = (...args) => { this.Memory.Allocator.gotoSection(...args) };

        return vm.createContext(context);
    }
}

class Allocator {
    constructor(memory, homeStartAddress, bankStartAddress){
        this.Memory = memory;
        this.HomeStartAddress = homeStartAddress;
        this.BankStartAddress = bankStartAddress;

		this.Name = memory.Name;
        this.initialSection = [];
        
        this.Sections = new Map();

        this.AllocatedSectionNames = new Set();
        this.UndefinedSectionNames = new Set();
        this.DefinedSectionNames = new Set();
        this.UnallocatedSectionNames = new Set();

        this.Structure = new Map();
        this.CustomStructure = new Map();

        this.ActiveSection = this.initialSection;
    }

    getStartAddress(bankIndex){
        return bankIndex ? this.BankStartAddress : this.HomeStartAddress
    }

    addSectionName(name){
        if( !/^[a-zA-Z$_][a-zA-Z0-9$_]*$/.exec(name) ){
            this.Memory.Processor.Log.Compiler.Error(`Invalid Section name in _Structure.${this.Name}_: ${name}`);
        }

        if( this.AllocatedSectionNames.has(name) ){
            this.Memory.Processor.Log.Compiler.Error(`Cannot place ${this.Name} Section<${name}> in multiple locations`);
        }

        this.AllocatedSectionNames.add(name);
        this.UnallocatedSectionNames.delete(name);

        // If this section has not been defined yet, add it to the undefined section names list
        if( !this.DefinedSectionNames.has(name) ){
            this.UndefinedSectionNames.add(name);
        }
    }

    allocateNamedSection(name){
        this.addSectionName(name);

        let section = this.Sections.get(name);

        // If the section has not been defined yet, then initialize it
        if( !section ){
            section = [];
            this.Sections.set(name, section);
        }
        else if( section === this.ActiveSection ){
            this.Memory.Processor.Log.Compiler.Error(`${this.Name} Section<${name}> is already the current Section. Cannot allocate to itself`);
        }

        this.ActiveSection.push(section);
    }
    
	createBankStructure(bank){
		let bankStructure = new Map();
		this.Structure.set(bank, bankStructure);
		return bankStructure;
    }
    
	convertContinuous(bankIndex, section){
		let bankStructure = this.createBankStructure(bankIndex),
            startAddress =  this.getStartAddress(bankIndex);

		bankStructure.set(startAddress, section);
		return bankStructure;
    }

    defineNamedSection(name){
        if( !/^[a-zA-Z$_][a-zA-Z0-9$_]*$/.exec(name) ){
            this.Memory.Processor.Log.Compiler.Error(`Invalid ${this.Name} Section name: ${name}`);
        }

        let section = this.Sections.get(name);
    
        if( section ){
            if( section === this.ActiveSection ){
                this.Memory.Processor.Log.Compiler.Warning(`${this.Name} Section<${name}> is already the current Section. Appending to end`);
            }
            else if( this.DefinedSectionNames.has(name) ){
                this.Memory.Processor.Log.Compiler.Warning(`${this.Name} Section<${name}> was already initialized.  Appending to end`);
            }
            // Otherwise, it was already allocated and tagged as undefined, so set it as defined
            else{
                this.DefinedSectionNames.add(name);
                this.UndefinedSectionNames.delete(name);
            }
        }
        else{
            // If a section does not exist, then it has not been allocated yet
            this.DefinedSectionNames.add(name);
            this.UnallocatedSectionNames.add(name);

            section = [];
            this.Sections.set(name, section);
        }
    
        this.ActiveSection = section;
    }

    allocateContinuousSection(bank){
        let customBankStucture = this.CustomStructure.get(bank),
            startAddress =  this.getStartAddress(bank);

        if(customBankStucture && customBankStucture.has(startAddress) ){
            this.Memory.Processor.Log.Compiler.Error(`${this.Name} Section<HEX(${bank})> is already defined in the input _Structure.${this.Name}_`);
        }
    
        let bankStructure = this.Structure.get(bank);
    
        if( bankStructure === undefined ){
            bankStructure = [];
            this.Structure.set(bank, bankStructure);
        }
        else if( Array.isArray(bankStructure) ){	
            this.Memory.Processor.Log.Compiler.Warning(`${this.Name} Section<HEX(${bank})> was already initialized.  Appending to end`);
        }
        else if(bankStructure === this.ActiveSection){
            this.Memory.Processor.Log.Compiler.Warning(`${this.Name} Section<HEX(${bank})> is already the current Section. Appending to end`);
        }
        else{
            this.Memory.Processor.Log.Compiler.Error(`${this.Name} Section<HEX(${bank})> is not continuous, so a specific address must be provided`);
        }
    
        this.ActiveSection = bankStructure;
    }

    allocateSegmentedSection(bank, address){
        let customBankStucture = this.CustomStructure.get(bank);
        if(customBankStucture && customBankStucture.has(address)){
            this.Memory.Processor.Log.Compiler.Error(`${this.Name} Section<ADDR(${bank}, ${address})> is already defined in the input _Structure.${this.Name}_`);
        }
    
        let section = [];
        this.allocateSegment(bank, address, section);

        this.ActiveSection = section;
    }
    
    allocateSegment(bank, address, section){
        let bankStructure = this.Structure.get(bank);
		
		if(bankStructure === undefined ){
            bankStructure = this.createBankStructure(bank);
		}
		else{
			if( Array.isArray(bankStructure) ){
				bankStructure = this.convertContinuous(bank, bankStructure);
			}

			if( bankStructure.has(address) ){
				this.Memory.Processor.Log.Compiler.Error(`${this.Name} Section<ADDR(${bank}, ${address})> is already defined`);
			}
		}

        bankStructure.set(address, section);
	}
    
	validateCustomStructure(structure){
        if(structure && structure.constructor === Object){
            Object.keys(structure).forEach( key => this.validateStructureEntry(key, structure[key]) );
        }
        else if(structure !== undefined){
            this.Memory.Processor.Log.Compiler.Error(`_Structure.${this.Name}_ value must be a <dict>`);
        }
	}
	
	compile(){
        if(this.UndefinedSectionNames.size){
            let names = [...this.UndefinedSectionNames.values()].join(', ');
            this.Memory.Processor.Log.Compiler.Warning(`The following ${this.Memory.Name} Sections were not defined in the source: ${names}`);
        }
    
        if(this.UnallocatedSectionNames.size){
            let names = [...this.UnallocatedSectionNames.values()].join(', ');
            this.Memory.Processor.Log.Compiler.Warning(`The following ${this.Memory.Name} Sections were not allocated to the ROM: ${names}`);
        }

		// Convert all continuous sections
		for( let [bank, bankStructure] of this.Structure){
			if( Array.isArray(bankStructure) ){
				this.convertContinuous(bank, bankStructure);
			}
		}

		// Allocate the Initial Section if it was used
		if(this.initialSection.length){
			this.allocateInitial();
		}

		//Go through the custom structure and add the corresponding section to the map
		for(let [bank, bankStructure] of this.CustomStructure){
			for( let [addr, sections] of bankStructure){
				sections.forEach(name => {
					let section = this.Sections.get(name);

					if( !section.length ){
						this.Memory.Processor.Log.Compiler.Warning(`Section('${name}') is empty`);
					}

					this.allocateSegment(bank, addr, section);
				})
			} 
		}
    }
    
    allocateInitial(){
		//The initial section goes at 00:000, so make sure there is no conflict
		let customBankStucture = this.CustomStructure.get(0);
		if(customBankStucture && customBankStucture.has( this.HomeStartAddress )){
			this.Memory.Processor.Log.Compiler.Error(`Cannot add content to implicit ADDR(0, ${this.HomeStartAddress}) since it is allocated in _Structure.ROM_`);
		}
		
		let bankStructure = this.Structure.get(0);
		if(bankStructure === undefined){
			bankStructure = this.createBankStructure(0);
		}
		else if( bankStructure.has( this.HomeStartAddress ) ){
			this.Memory.Processor.Log.Compiler.Error(`Cannot add content to implicit ADDR(0, ${this.HomeStartAddress}) since it is allocated via a _Section_`);
		}

		bankStructure.set( this.HomeStartAddress, this.initialSection);
	}
}

// TODO - need to validate the address is within the range of the bank
class Compiler {
    Address = 0;
    Bank = 0;

    constructor(memory){
        this.Memory = memory;
    }

    setAddress(address){
        this.Address = address;
    }
    shiftAddress(amount){
        this.Address += amount;
    }
    setBank(bank){
        this.Bank = bank;
    }
    setLocation(location){
        this.Bank = location.Bank;
        this.Address = location.Address;
    }
    getLocation(){
        return {
            Bank : this.Bank,
            Address : this.Address
        }
    }
    
    compile(){}
    
    Handle(value, parent){
        if( value instanceof SkipDirective ){
            this.Skip(value);
		}
        else{
            // TODO
            throw Error()
        }
    }

    Skip(value){
        this.shiftAddress(value.Offset);
    }
}

/*
TODO -
- Handle flags of multiple bytes
- Handle flags in ROM, meaning we need to define a struct, and then the value...
*/
class Flags {
    constructor(Interpreter, data){
        this.Max = 1
        this.byName = {}
        this.byIndex = {}

        if( Array.isArray(data) ){
            for(let i=0; i<data.length; i++){
                if( data[i] ){
                    this.add( data[i], i )
                }
            }
        }
        else if(data.constructor === Interpreter.Object ){
            for(let name in data){
                this.add(name, data[name])
            }
        }
        else{
            throw Error('Flags argument must be a <dict> or <array>')
        }

        this.Size = Math.ceil(this.Max/8)
        this.Symbol = Interpreter.toSymbol(this)
    }
    add(name, index){
        this.byName[name] = index
        this.byIndex[index] = name
        if(index > this.Max){
            this.Max = index
        }
    }

    static define(Interpreter, ...args){
        return new Flags(Interpreter, ...args).Symbol
    }
}

module.exports = {
    Memory, Interpreter, Compiler, Allocator, Flags
}