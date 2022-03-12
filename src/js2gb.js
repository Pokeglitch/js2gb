let fs = require('fs'),
	CharMap = require('./CharMap'),
	RAM = require('./RAM'),
	Symbols = require('./Symbols'),
	Header = require('./Header'),
	Parameters = require('./Parameters'),
	ROM = require('./ROM'),
	Logger = require('./Logger'),
	Hardware = require('./Hardware'),
	Software = require('./Software');

class BaseCode {
	constructor(processor){
		this.Processor = processor;
	}
	addContent(){
		this.Processor.Log.Compiler.Error('Cannot create OpCodes outside of a <Routine>');
	}
	addOpCode(){
		this.Processor.Log.Compiler.Error('Cannot create OpCodes outside of a <Routine>');
	}
}

class Processor {
	constructor(input){
		Hardware.setProcessor(this);
		Software.setProcessor(this);
		
        this.PublicToInternalMap = new Map();
        this.RoutineTrees = new Map();
        this.SurrogateTrees = new Map();
        this.NameMap = new Map();

		this.Code = new BaseCode(this);
		
        this.Thru = {
            byRegister : new Map(),
            byRAM : new Map()
        }
		this.Log = new Logger(this);

		this.Parameters = new Parameters(this);
		this.Parameters.parse(input);

		this.CharMap = new CharMap(this);

		this.RAM = new RAM(this);
	
		this.BaseROM = this.importBaseROM();

		this.Header = new Header(this);
	
		this.Symbols = new Symbols(this);
		this.Symbols.import();
	
		this.RAM.compile();
	
		this.ROM = new ROM(this);
		this.ROM.compile();
	
		this.Symbols.export();
	}

	readFile(name, path, encoding){
		try{
			return fs.readFileSync(path, encoding);
		}
		catch(e){
			this.Log.Compiler.Error(`Unable to read from _${name}_ path`);
		}
	}
	
	writeFile(name, path, data){
		try{
			fs.writeFileSync(path, data);
		}
		catch(e){
			this.Log.Compiler.Error(`Unable to write to _${name}_ path`);
		}
	}

	importBaseROM(){
		let path = this.Parameters.Base.ROM;
	
		if(!path){
			return null;
		}
	
		let buffer = this.readFile('Base.ROM', path),
			baserom = [...buffer];
	
		if(baserom.length % 0x4000){
			this.Log.Compiler.Error('_Base.ROM_ file size is not valid');
		}
	
		this.Log.Compiler.Log('Successfully Imported Base.ROM');
	
		return baserom;
	}
	
    inRoutine(){
        return !(this.Code instanceof BaseCode);
    }

    setThru(register, RAM){
        if(this.Thru.byRegister.has(register)){
            throw Error(`${register.Name} is currently a surrogate for ${this.Thru.byRegister.get(register).Name}`)
        }
        
        if(this.Thru.byRAM.has(RAM)){
            throw Error(`${this.Thru.byRAM.get(RAM).Name} is currently a surrogate for ${RAM.Name}`)
        }

        this.Thru.byRegister.set(register, RAM)
        this.Thru.byRAM.set(RAM, register)
    }

    resetThru(register, RAM){
        this.Thru.byRegister.delete(register)
        this.Thru.byRAM.delete(RAM)
    }
}

class js2gb {
	constructor(input){
		let processor = new Processor(input);

		this.Binary = processor.ROM.Compiler.Binary;
		// TODO - also include the symbols as a map of key -> address
		this.Symbols = processor.Symbols.Output;
	}
}

module.exports = js2gb;