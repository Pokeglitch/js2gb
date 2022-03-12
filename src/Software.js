	// Import some references
let { OpCodes, OpCodeWrapper, OpCodeCallbackWrapper } = require('./OpCodes'),
	Processor;

function validateName(name, dotsAllowed){
	if(typeof name !== 'string'){
		Processor.Log.Compiler.Error(`Name must be a <string>. Received ${name}`);
	}

	if(!name.length){
		Processor.Log.Compiler.Error(`Name cannot be an empty <string>`);
	}

	if( dotsAllowed ){
		if( name[0] === '.' ){
			Processor.Log.Compiler.Error(`Name cannot start with a '.'. Received ${name}`);
		}

		// TODO - temporary remove this check to see if can access array indices...
		if( /^[a-zA-Z$_][a-zA-Z0-9$_]*(\.[a-zA-Z$_][a-zA-Z0-9$_]*)*$/.exec(name) || true){
			return true;
		}
	}
	else if( /^[a-zA-Z$_][a-zA-Z0-9$_]*$/.exec(name) ){
		return true;
	}
	
	Processor.Log.Compiler.Error(`Invalid name characters. Received '${name}'`);
}

function validateGlobalName(name, type){
	if( Processor.inRoutine() ){
		Processor.Log.Compiler.Error(`Cannot define ${type}<${name}> from inside a <Routine>`);
	}

	validateName(name, false);

	let internal = Processor.NameMap.get(name);
	if(internal instanceof Addressable){
		Processor.Log.Compiler.Error(`_${name}_ has already been defined`);
	}
}

/********** Structure Classes *************/
class Tree {
	constructor(name){
		this.Name = name;
		this.Parent = null;
		this.Children = new Set();
	}
}

class RoutineTree extends Tree {
	constructor(name){
		super(name);
		Processor.RoutineTrees.set(name, this);
	}

	static get(name){
		return Processor.RoutineTrees.get(name) || new RoutineTree(name);
	}
}

class SurrogateTree extends Tree {
	constructor(name){
		super(name);
		Processor.SurrogateTrees.set(name, this);
	}

	add(internalSurrogate){
		if(internalSurrogate.Name === this.Name){
			this.Parent = internalSurrogate;
		}
		else{
			this.Children.add(internalSurrogate);
		}
	}

	designateRoutine(internalRoutine){
		let fromOpCode = !internalRoutine;

		if(this.Parent){
			if(internalRoutine){
				this.Parent.resolveValue(internalRoutine);
			}
			else{
				this.Parent.tryDesignateRoutine(fromOpCode);
			}
		}

		// Upgrade all children to Blocks
		for(let child of this.Children){
			child.tryDesignateBlock(fromOpCode);
		}
	}
	designateData(internalData){
		if(this.Parent){
			this.Parent.resolveValue(internalData);
		}

		for(let child of this.Children){
			let [parent, ...children] = child.Name.split('.'),
				internalChildData = InternalData.upgradeChildData(parent, children, internalData);

			child.resolveValue(internalChildData);
		}
	}

	designateUndefinedData(){
		if(this.Parent){
			this.Parent.designateData(true);
		}

		for(let child of this.Children){
			child.designateData(true);
		}
	}

	static designateData(name, internalData){
		let surrogateTree = Processor.SurrogateTrees.get(name);

		if(surrogateTree){
			if(internalData){
				Processor.SurrogateTrees.delete(name);
				surrogateTree.designateData(internalData);
			}
			else{
				surrogateTree.designateUndefinedData();
			}
		}
	}

	static designateRoutine(name, internalRoutine){
		let surrogateTree = Processor.SurrogateTrees.get(name);

		if(surrogateTree){
			Processor.SurrogateTrees.delete(name);
			surrogateTree.designateRoutine(internalRoutine);
		}
	}

	static get(name){
		return Processor.SurrogateTrees.get(name) || new SurrogateTree(name);
	}
}

/********** Public Classes *************/
class PointerNumber {
	constructor(internal, isStart, key){
		let internalPointerNumber = new InternalPointerNumber(internal, isStart ? 'Before' : 'After', key);
		Processor.PublicToInternalMap.set(this, internalPointerNumber);
	}
}

class PointerByte extends PointerNumber {
	constructor(pointer, internal, isStart, key){
		super(internal, isStart, key);
		this.Pointer = pointer;
	}
}

class PointerAddress extends PointerNumber {
	constructor(pointer, isBigEndian, internal, isStart){
		super(internal, isStart, isBigEndian ? 'BigEndian' : 'LittleEndian');
		this.Pointer = pointer;
		this[0] = new PointerByte(pointer, internal, isStart, isBigEndian ? 'Hi' : 'Lo');
		this[1] = new PointerByte(pointer, internal, isStart, isBigEndian ? 'Lo' : 'Hi');
	}
}

class Pointer extends PointerNumber {
	constructor(reference, internal, isStart){
		let defaultEndianness = Processor.Parameters.Options.BigEndian ? 'BigEndian' : 'LittleEndian';
		super(internal, isStart, defaultEndianness);

		this.Reference = reference;
		this.BigEndian = new PointerAddress(this, true, internal, isStart);	
		this.LittleEndian = new PointerAddress(this, false, internal, isStart);
		
		this[0] = this[defaultEndianness][0];
		this[1] = this[defaultEndianness][1];

		this.Bank = new PointerByte(this, internal, isStart, 'Bank');
	}
}

class Surrogate {
	constructor(internal, isStart = true){
		this.Pointer = new Pointer(this, internal, isStart);
		this.Bank = this.Pointer.Bank

		this.rst = (...args) => {
			let internal = Processor.PublicToInternalMap.get(this),
				routine = internal.tryDesignateRoutine(true, this);

			return routine.rst(...args);
		}

		this.call = (...args) => {
			let internal = Processor.PublicToInternalMap.get(this),
				routine = internal.tryDesignateRoutine(true, this);

			return routine.call(...args);
		}
		
		this.jp = (...args) => {
			let internal = Processor.PublicToInternalMap.get(this),
				code = internal.designateBlockOrRoutine(true, this);
			return code.jp(...args);
		}

		this.jr = (...args) => {
			let internal = Processor.PublicToInternalMap.get(this),
				code = internal.designateBlockOrRoutine(true, this);
			return code.jr(...args);
		}
		
		let f = require('./Hardware').Registers.f;
		[f.c, f.nc, f.z, f.nz].forEach( flag => {
			this.call[flag] = this.call[flag.Condition] = (...args) => {
				let internal = Processor.PublicToInternalMap.get(this),
					routine = internal.tryDesignateRoutine(true, this);
				return routine.call[flag](...args);
			}
			
			this.jp[flag] = this.jp[flag.Condition] = (...args) => {
				let internal = Processor.PublicToInternalMap.get(this),
					code = internal.designateBlockOrRoutine(true, this);
				return code.jp[flag](...args);
			}
			
			this.jr[flag] = this.jr[flag.Condition] = (...args) => {
				let internal = Processor.PublicToInternalMap.get(this),
					code = internal.designateBlockOrRoutine(true, this);
				return code.jr[flag](...args);
			}
		});
		
		// TODO - only permit the MBC1 addresses?
		// TODO - fix this when the name is in the SYM only...
		this.ld = (...args) => {
			let internal = Processor.PublicToInternalMap.get(this),
				data = internal.designateData(true, this);
			return data.ld(...args);
		}
	}
}

class AddressableFlag {
	constructor(internal){
		Processor.PublicToInternalMap.set(this, internal);
		this.RAM = internal.RAM.Start
		this.Index = internal.Index
		this.Mask = {
			on : 1 << this.Index,
			off : (1 << this.Index) ^ 0xff
		}
	}
	// TODO - dont permit these in strict mode
	set(other){		
		if( other instanceof require('./Hardware').Register8BitMainClass ){
			other[ this.Index ].set()
		}
		else{
			throw Error(`Cannot set bits of ${other && other.Name}`);
		}

		return this;
	}
	res(other){		
		if( other instanceof require('./Hardware').Register8BitMainClass ){
			other[ this.Index ].res()
		}
		else{
			throw Error(`Cannot set bits of ${other && other.Name}`);
		}

		return this;
	}
}

class ExtensibleFunction extends Function {
	constructor(f) {
	  return Object.setPrototypeOf(f, new.target.prototype);
	}
  }

class Addressable extends ExtensibleFunction {
	#Internal;

	constructor(internal, isStart = true){
		super( i => internal.getFlag(i).Start );
		this.Pointer = new Pointer(this, internal, isStart);
		this.#Internal = internal;
	}

    toString(){
        return this.#Internal.toString()
    }
}

class Data extends Addressable {
	constructor(...args){
		super(...args);
		this.Bank = this.Pointer.Bank;
	}
	// TODO - only permit the MBC1 addresses?
	ld( other ){
		if( other === require('./Hardware').Registers.sp ){
			Processor.Code.addOpCode( `ld @,${ other.Name }`, this );
		}
		else if( other === require('./Hardware').Registers.a ){
			Processor.Code.addOpCode( `ld @,${ other.Name }`, this );
		}
		else{
			//TODO - use the name of this data
			throw Error(`The given value cannot be loaded into XXX`);
		}
		
		return this;
	}
}
class SYM extends Addressable {}
class Code extends Addressable {}

class Routine extends Code{
	constructor(internal, isStart){
		super(internal, isStart);

		this.rst = (...args) => {
			let returnObject = Processor.PublicToInternalMap.get(this).callMacro(...args);
			Processor.Code.addContent( OpCodes.rst(this) );
			return returnObject;
		}

		this.call = (...args) => {
			let returnObject = Processor.PublicToInternalMap.get(this).callMacro(...args);
			Processor.Code.addOpCode( `call @`, this );
			return returnObject;
		}
		
		this.jp = (...args) => {
			let returnObject = Processor.PublicToInternalMap.get(this).callMacro(...args);
			Processor.Code.addOpCode( `jp @`, this );
			return returnObject;
		}

		this.jr = (...args) => {
			let returnObject = Processor.PublicToInternalMap.get(this).callMacro(...args);
			Processor.Code.addContent( OpCodes.jr(this,'') );
			return returnObject;
		}
		
		let f = require('./Hardware').Registers.f;
		[f.c, f.nc, f.z, f.nz].forEach( flag => {
			this.call[flag] = this.call[flag.Condition] = (...args) => {
				let returnObject = Processor.PublicToInternalMap.get(this).callMacro(...args);
				Processor.Code.addOpCode( `call ${flag.Condition},@`, this );
				return returnObject;
			}
			
			this.jp[flag] = this.jp[flag.Condition] = (...args) => {
				let returnObject = Processor.PublicToInternalMap.get(this).callMacro(...args);
				Processor.Code.addOpCode( `jp ${flag.Condition},@`, this );
				return returnObject;
			}
			
			this.jr[flag] = this.jr[flag.Condition] = (...args) => {
				let returnObject = Processor.PublicToInternalMap.get(this).callMacro(...args);
				Processor.Code.addContent( OpCodes.jr(this,flag.Condition) );
				return returnObject;
			}
		});
	}
}
class Block extends Code{
	constructor(internal, isStart){
		super(internal, isStart);
		
		this.call = () => {
			Processor.Log.Compiler.Error(`_${internal.Name}_ is not a Routine and cannot be called`);
		}

		this.jp = () => {
			Processor.Code.addOpCode( `jp @`, this );
			return this;
		}

		this.jr = () => {
			Processor.Code.addContent( OpCodes.jr(this,'') );
			return this;
		}
		
		let f = require('./Hardware').Registers.f;
		[f.c, f.nc, f.z, f.nz].forEach( flag => {
			this.jp[flag] = this.jp[flag.Condition] = () => {
				Processor.Code.addOpCode( `jp ${flag.Condition},@`, this );
				return this;
			}
		
			this.jr[flag] = this.jr[flag.Condition] = () => {
				Processor.Code.addContent( OpCodes.jr(this,flag.Condition) );
				return this;
			}
		});
	}
}

/*************** Internal Classes ***************/
class InternalPointerNumber {
	constructor(internal, which, key){
		this.Internal = internal;
		this.Which = which;
		this.Key = key;
	}
	resolve(){
		let addressable = this.Internal instanceof InternalSurrogate ?
			this.Internal.Value :
			this.Internal;

		return addressable[this.Which][this.Key];
	}
}

class InternalPointer {
	constructor( reference, isStart ){		
		this.Reference = reference;
		this.isStart = isStart;
		this.Name = reference.Name;
		if(!isStart){
			this.Name += ':End';
		}
		this.Bank = [0];
		this.Hi = [0];
		this.Lo = [0];
		this.BigEndian = [this.Hi, this.Lo];
		this.LittleEndian = [this.Lo, this.Hi];
		this.Data = null;
		this.isResolved = false;
		this.callbacks = [];
	}
	compareToSYM(bank, address){
		this.Reference.compareToSYM(bank, address, this.isStart);
	}
	onResolve( fn ){
		this.callbacks.push(fn);
		if(this.isResolved) fn(this.Data);
	}
	resolve(location){
		let id, address;
		// TODO - remove the need for this
		if( location.hasOwnProperty("id") ){
			id = location.id;
			address = location.address;
		}
		else{
			id = location.Bank;
			address = location.Address;
		}

		if( this.isResolved ){
			
			if( id === this.Data.Bank && address === this.Data.Address ){
				Processor.Log.Compiler.Warning(`${this.Name} already resolved`)
				// TODO - only error for ROM?
				// throw Error(`Pointer already resolved`);
				return
			}
			else{
				Processor.Log.Compiler.Error(`Pointer ${this.Name} already resolved at ${this.Data.Bank}:${this.Data.Address.toString(16)}. Received ${id}:${address.toString(16)} }`);
			}
		}
		
		this.Bank[0] = id;
		
		let bytes = [ Math.floor( address/0x100 ), address % 0x100 ];
		
		this.Hi[0] = bytes[0];
		this.Lo[0] = bytes[1];
		
		this.Data = {
			Bank : id,
			Address : address
		};

		this.isResolved = true;
		this.runCallbacks();
		return this;
	}
	unresolve(){
		this.Bank[0] = this.Hi[0] = this.Lo[0] = 0;
		this.Data = null;
		this.isResolved = false;
		this.runCallbacks();
		return this;
	}
	runCallbacks(){
		this.callbacks.forEach( fn => fn(this.Data) );
	}
}

class InternalSurrogate {
	constructor(parentName, name){
		this.Name = name;
		this.Value = null;
		this.Surrogate = new Surrogate(this, true);

		this.Start = this.Surrogate;
		this.End = new Surrogate(this, false);

		SurrogateTree.get(parentName).add(this);
		Processor.PublicToInternalMap.set(this.Surrogate, this);
		Processor.NameMap.set(name, this);
	}
	getPointer(surrogate){
		return surrogate == this.Start ?
			this.Value.Before :
			this.Value.After;
	}
	resolveValue(value){
		this.Value = value;
	}
	// Validate if this Surrogate can be resolved at this point
	validateCanResolve(fromOpCode){
		if(fromOpCode && !Processor.inRoutine() ){
			Processor.Log.Compiler.Error(`Cannot create OpCodes outside of <Routines>`);
		}
	}
	designateData(fromOpCode, surrogate){
		if(this.Value){
			return surrogate == this.Start ? 
				this.Value.Start :
				this.Value.End;
		}

		this.validateCanResolve(fromOpCode);
		
		if(fromOpCode){
			Processor.Log.Compiler.Tip(`Designating *$('${this.Name}')* as a <Data>`);
		}
		let internalData = new InternalData(this.Name);
		this.resolveValue(internalData);
		SurrogateTree.designateData(this.Name.split('.')[0]);
		
		return surrogate == this.Start ?
			internalData.Start :
			internalData.End;
	}
	tryDesignateBlock(fromOpCode, surrogate){
		if(this.Value){
			return surrogate == this.Start ?
				this.Value.Start :
				this.Value.End;
		}
		this.validateCanResolve(fromOpCode);

		if( this.Name.indexOf('.') === - 1){
			Processor.Log.Compiler.Error(`*$('${this.Name}') cannot be designated as a <Block>`);
		}
		return this.designateBlock(fromOpCode, surrogate);
	}
	designateBlock(fromOpCode, surrogate){
		if(fromOpCode){
			Processor.Log.Compiler.Tip(`Designating *$('${this.Name}')* as a <Block>`);
		}
		let internalBlock = new InternalBlock(this.Name);
		this.resolveValue(internalBlock);
		SurrogateTree.designateRoutine(this.Name.split('.')[0]);

		return surrogate == this.Start ?
			internalBlock.Start :
			internalBlock.End;
	}
	tryDesignateRoutine(fromOpCode, surrogate){
		if(this.Value){
			return surrogate == this.Start ?
				this.Value.Start :
				this.Value.End;
		}

		this.validateCanResolve(fromOpCode);

		if( this.Name.indexOf('.') > - 1){
			Processor.Log.Compiler.Error(`*$('${this.Name}') cannot be designated as a <Routine>`);
		}
		return this.designateRoutine(fromOpCode, surrogate);
	}
	designateRoutine(fromOpCode, surrogate){
		if(fromOpCode){
			Processor.Log.Compiler.Tip(`Designating *$('${this.Name}')* as a <Routine>`);
		}
		let internalRoutine = new InternalRoutine(this.Name);
		this.resolveValue(internalRoutine);
		SurrogateTree.designateRoutine(this.Name);

		return surrogate == this.Start ?
			 internalRoutine.Start :
			 internalRoutine.End;
	}
	designateBlockOrRoutine(fromOpCode, surrogate){
		if(this.Value){
			return surrogate == this.Start ?
				this.Value.Start :
				this.Value.End;
		}

		this.validateCanResolve(fromOpCode);

		if(this.Name.indexOf('.') === -1){
			return this.designateRoutine(fromOpCode, surrogate);
		}
		else{
			return this.designateBlock(fromOpCode, surrogate);
		}
	}
	designateSYM(){
		if(this.Value){
			this.Value.designateSYM();
		}
		else{
			let internalSYM = new InternalSYM(this.Name);
			this.resolveValue(internalSYM);
		}
	}
}

class InternalAddressableFlag {
	constructor(ram, index){
		this.RAM = ram
		this.Index = index
		ram[index] = this
		this.Public = new AddressableFlag(this)
	}
}

class InternalAddressable {
	constructor(name, publicClass){
		this.Name = name;

        this.Before = new InternalPointer(this, true);
		this.After = new InternalPointer(this, false);

		this.SYM = Processor.Symbols.get(this.Name);
		
		if( publicClass ){
			this.initialize(publicClass)
		}
	}
	initialize(publicClass){
		this.Start = new publicClass(this);
		this.End = new publicClass(this, false);

		Processor.PublicToInternalMap.set(this.Start, this);
		Processor.PublicToInternalMap.set(this.End, this);

		Processor.NameMap.set(this.Name, this);
	}
	getPointer( publicInstance ){
		return publicInstance == this.Start ?
			this.Before :
			this.After;
	}
	compareToSYM(bank, address, isStart){
		let sym = this.SYM && this.SYM[isStart ? 'Before' : 'After'];

		if(!sym){
			return;
		}

		let name = this.toString();
		if(!isStart){
			name = name.replace('>', ':End>');
		}

		if(sym.id === bank && sym.address === address){
			Processor.Log.Compiler.Tip(`${name} is defined in both source and SYM`);
		}
		else{
			Processor.Log.Compiler.Error(`${name} is defined in source at ADDR(${bank}, ${address}) but in SYM at ADDR(${sym.id}, ${sym.address})`)
		}

	}
}

class InternalROM extends InternalAddressable {
	constructor(name, publicClass){
		super(name, publicClass);
		this.Content = [];
        this.toROM = [this.Before, this.Content, this.After];
	}

	addContent( content ){
		this.Content.push( content );
	}

	designateSYM(doLog){
		if( !this.SYM ){
			Processor.Log.Compiler.Error(`${this.Name} is not defined`);
		}
		
		if(doLog){
			Processor.Log.Compiler.Warning(`${this} exists in SYM but not in source`);
		}

		if(this.SYM.Before){
			this.Before.resolve(this.SYM.Before)
		}
		else{
			Object.defineProperty(this,'Before',{
				get(){
					Processor.Log.Compiler.Error(`${this} does not have a <Pointer> defined in the SYM`);
				}
			});
		}

		if(this.SYM.After){
			this.After.resolve(this.SYM.After);
		}
		else{
			Object.defineProperty(this,'After',{
				get(){
					Processor.Log.Compiler.Error(`${this} does not have an _End_ <Pointer> defined in the SYM`);
				}
			});
		}
	}
}

class InternalSYM extends InternalROM {
	constructor(name){
		super(name, SYM);
		this.designateSYM();
	}
	toString(){
		return `Pointer<${this.Name}>`;
	}
}

class InternalData extends InternalROM {
    constructor(name, value, isUpgrade){
		super(name, Data);

		if(value !== undefined){
			// If its an upgrade, it has already been cloned
			this.addContent( isUpgrade ? value : cloneData(name, value, Processor) );
		}
	}
	toString(){
		return `Data<${this.Name}>`;
	}
	
	addContent(content){
		super.addContent(content);

		if( Array.isArray(content) ){
			for(let i=0; i<content.length; i++){
				this.addChild(content, i);
			}
		}
		else if( content && content.constructor === Processor.ROM.Interpreter.Object ){
			Object.keys(content).forEach(key => this.addChild(content, key) );
		}
	}
	addChild(parent, key){
		Object.defineProperty(this.Start, key, {
			get(){
				let data = parent[key];
				// Upgrade the child if it hasn't already been upgraded
				if( !(data instanceof InternalData) ){
					data = new InternalData(`${this.Name}.${key}`, data, true);
					parent[key] = data;
				}
				return data.Start;
			}
		})
	}

	static define(memory, name, value){
		validateGlobalName(name, 'Data');

		let internalData = new InternalData(name, value),
			data = internalData.Start;

		SurrogateTree.designateData(name, internalData);
		memory.Allocator.ActiveSection.push(data);
		return data;
	}

	static upgradeChildData(fullName, children, parentData){
		let content = parentData.Content[0];

		if(content === undefined){
			children.forEach( key => fullName += `.${key}` );
			return new InternalData(fullName);
		}

		children.forEach( (key,i) => {
			fullName += `.${key}`;
			
			if( content instanceof InternalData ){
				content = content.Content[0];
			}

			// If the content is a structure, and has the provided key:
			if( (Array.isArray(content) || content.constructor === Object ) && content.hasOwnProperty(key) ){
				// If its the last key, then upgrade
				if( i === children.length-1 ){
					content[key] = new InternalData(fullName, content[key], true);
				}
				content = content[key];
			}
			// Otherwise, error
			else{
				Processor.Log.Compiler.Error(`Data<${fullName}> is not defined`);
			}	
		});

		return content;
	}
}

function numToByteArray(value){
	if(!value){
		return [0];
	}

	let isNeg = value < 0;

	if(isNeg){
		value = -value;
	}

	let arr = [];

	while(value){
		let byteVal = value & 0xFF;
		if( byteVal && isNeg ) byteVal = 0x100-byteVal;
		arr.push(byteVal)
		value >>= 8
	}
	
	return Processor.Parameters.Options.BigEndian ? arr.reverse() : arr;
}

function cloneData(name, value, processor){
	if( typeof value === 'number' ){
		return numToByteArray(value);
	}
	else if( typeof value === 'string'){
		return processor.CharMap.convert(value);
	}
	else if( value instanceof Addressable || value instanceof PointerNumber || value instanceof Surrogate ){
		return value;
	}
	else if( Array.isArray(value) ){
		let arr = [];
		for(let i=0; i<value.length; i++){
			arr[i] = cloneData(`${name}.${i}`, value[i], processor);
		}
		return arr;
	}
	else if( value && value.constructor === Processor.ROM.Interpreter.Object ){
		let obj = {};
		Object.keys(value).forEach( k => obj[k] = cloneData(`${name}.${k}`, value[k], processor) );
		return obj;
	}
	else{
		Processor.Log.Compiler.Error(`Invalid input for Data<${name}>. Received: ${value}`);
	}
}

class InternalCode extends InternalROM {
	constructor(name, publicClass){
		super(name, publicClass);
		this.isCompiled = false;
		this.BlockSurrogates = new Map();
	}

	addBlockSurrogate(name, internalBlock){
		let set = this.BlockSurrogates.get(name);

		if(!set){
			set = new Set();
			this.BlockSurrogates.set(name, set)
		}

		set.add(blockSurrogate);
	}
	
	compile(){
		let parentCode = Processor.Code;
		Processor.Code = this;
		this.DefinitionFunction.call( this.Start );
		this.isCompiled = true;
		Processor.Code = parentCode;
	}
	
	addOpCode(id, other){
		this.addContent( OpCodes[id].compile(other) );
	}
	
	autoReturn(){
		let lastAdd = this.Content[ this.Content.length-1 ];
		
		if( lastAdd instanceof InternalBlock ){
			return lastAdd.autoReturn();
		}
		
		if( lastAdd === undefined || 
			(lastAdd instanceof OpCodeCallbackWrapper && !lastAdd.isExit) ||
			(lastAdd instanceof OpCodeWrapper && !lastAdd.opcode.isExit) ){
			return this.addOpCode('ret');
		}
	}
}

class InternalRoutine extends InternalCode {
	constructor(name, macro, definitionFunction){
		super(name, Routine);
		this.Macro = macro;
		this.DefinitionFunction = definitionFunction;

		let routineTree = RoutineTree.get(name);
		routineTree.Parent = this;
	}
	
	compile(){
		super.compile();
		this.autoReturn();
	}

	callMacro(...args){
		let returnObject;
		
		if( this.Macro ){
			returnObject = this.Macro.call(this.Start, ...args);
		}
		
		return returnObject === undefined ?
			this.Start :
			returnObject;
	}

	toString(){
		return `Routine<${this.Name}>`;
	}

	static define(memory, name, macro, fn){
		validateGlobalName(name, 'Routine');

		if( typeof macro !== 'function' ){
			Processor.Log.Compiler.Error(`Routine<${name}> macro/definition must be a <function>`);
		}
		if( fn === undefined ){
			fn = macro;
			macro = null;
		}
		else if(typeof fn !== 'function'){
			Processor.Log.Compiler.Error(`Routine<${name}> definition must be a <function>`);
		}

		let internalRoutine = new InternalRoutine(name, macro, fn),
			routine = internalRoutine.Start;
		SurrogateTree.designateRoutine(name, internalRoutine);
		memory.Allocator.ActiveSection.push(routine);
		return routine;
	}
}

class InternalBlock extends InternalCode {
	constructor(name){
		super( name, Block);
		
		let parentName = name.split('.')[0],
			{Parent, Children} = RoutineTree.get(parentName);			

		// If the Routine has already been compiled, then this must be in the SYM
		if(Parent && Parent.isCompiled){
			this.designateSYM(true);
		}

		Children.add(this);
	}

	setDefinitionFunction(definitionFunction){
		this.DefinitionFunction = definitionFunction;
		
		Processor.Code.addContent(this);
		this.compile();
	}

	toString(){
		return `Block<${this.Name}>`;
	}

	static define(name, definitionFunction){
		if( !Processor.inRoutine() ){
			Processor.Log.Compiler.Error(`Cannot define a <Block> outside of a <Routine>`);
		}

		if( definitionFunction === undefined ){
			definitionFunction = name;
			name = null;
		}
		else{
			if( typeof name !== 'string' ){
				Processor.Log.Compiler.Error(`<Block> name must be an optional <string>`);
			}
			validateName(name, false);
		}

		if(typeof definitionFunction !== 'function' ){
			Processor.Log.Compiler.Error(`Block<${name}> defintion must be a <function>`);
		}

		if(Processor.NameMap.has(name)){
			Processor.Log.Compiler.Error(`_${name}_ has already been defined globally`);
		}

		let fullName = `${Processor.Code.Name}.${name}`,
			internalBlock = Processor.NameMap.get(fullName);

		if(!internalBlock){
			internalBlock = new InternalBlock(fullName);
		}
		else if(internalBlock.DefinitionFunction){
			Processor.Log.Compiler.Error(`Block<${fullName}> has already been defined`);
		}
		
		internalBlock.setDefinitionFunction(definitionFunction);
		return internalBlock.Start;
	}
}

/*********** Lookup ****************/
function LookupByName(name){
	let isStart = true;

	if(/:End$/.exec(name)){
		[name] = name.split(/:End$/);
		isStart = false;
	}

	validateName(name, true);

	let internal = Processor.NameMap.get(name);

	// If the name is globally defined, return that instance
	if( internal ){
		return isStart ?
			internal.Start :
			internal.End;
	}
	
	// If it is a RAM:
	let ramData = Processor.RAM.Identifiers.get(name)
	if( ramData ){
		internal = ramData.Start;

		return isStart ?
			internal :
			internal.End;
	}

	// TODO - instead, check if a RoutineFamily exists
	// This way, mySymRoutine.B can be upgraded, and later mySymRoutine.C will become a block
	let [parent, ...children] = name.split('.'),
		internalParent = Processor.NameMap.get(parent);

	// If the parent is globally defined:
	if(internalParent){
		// If the parent is a Data
		if(internalParent instanceof InternalData ){
			internal = InternalData.upgradeChildData(parent, children, internalParent);
			
			return isStart ?
				internal.Start :
				internal.End;
		}

		// If the parent is a Routine, then return a Block
		if(internalParent instanceof InternalRoutine ){
			internal = new InternalBlock(name);

			return isStart ?
				internal.Start :
				internal.End;
		}
	}
	
	// If a Cartridge isn't compiling yet, or it exists in the SYM, return a surrogate
	if( !Processor.inRoutine() || Processor.Symbols.has(name) ){
		internal = new InternalSurrogate(parent, name);
		
		return isStart ?
			internal.Start :
			internal.End;
	}

	// Otherwise, it must be a local block
	let fullName = `${Processor.Code.Name}.${name}`;

	if( Processor.NameMap.has(fullName) ){
		internal = Processor.NameMap.get(fullName);

		return isStart ?
			internal.Start :
			internal.End;
	}

	internal = new InternalBlock(fullName);
	
	return isStart ?
		internal.Start :
		internal.End;
}

/*********** Exports ****************/
module.exports = {
	setProcessor(processor){
		Processor = processor;
	},
	LookupByName,
	Surrogate, InternalSurrogate, SurrogateTree,
	Addressable, Code, InternalCode,
	Block, InternalBlock,
	Routine, InternalRoutine, RoutineTree,
    Pointer, PointerNumber, PointerByte, PointerAddress, InternalPointer,
	InternalAddressable, InternalAddressableFlag,
    Data, InternalData
};