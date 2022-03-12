let { Memory, Interpreter, Compiler, Allocator, Flags } = require('./Assembler'),
    { InternalAddressable, InternalAddressableFlag, Addressable } = require('./Software'),
    { UnionDirective, UnionEndDirective } = require('./Directives');

class RandomAccessMemory extends Memory {
    constructor(processor){
        super(processor, "RAM", RAMInterpreter, RAMAllocator, RAMCompiler);
    }

    new(id, parent){
        return new InternalRAM(this, id, parent);
    }
}

class RAMInterpreter extends Interpreter{
    constructor(memory){
        super(memory)
        this.SymbolMap = new Map();
    }
    toSymbol(value){
        let symbol = Symbol()
        this.SymbolMap.set(symbol, value)
        return symbol;
    }
    fromSymbol(symbol){
        return this.SymbolMap.get(symbol)
    }
    generateContext(){
        return super.generateContext({
            def : (...args) => {
                if( args.length === 1){
                    // TODO - validate / clone
                    this.Memory.Allocator.ActiveSection.push(args[0]);
                }
                else if( args.length ){
                    let union = new UnionDirective(this.Memory);
                    args.forEach(arg => {
                        this.Memory.Allocator.ActiveSection.push(union);
                        if( typeof arg === 'function' ){
                            arg();
                        }
                        else{
                            // TODO - validate / clone
                            this.Memory.Allocator.ActiveSection.push(arg);
                        }
                    })
                    this.Memory.Allocator.ActiveSection.push(union.End);
                }
            },
            Flags : (...args) => Flags.define(this, ...args)
        });
    }
}

// TODO - handle bank overflow
class RAMAllocator extends Allocator {
    constructor(memory){
        super(memory, 0x8000, 0xC000)
        // TODO - handle custom structure definition
    }
    gotoSection(...args){
        if(args.length === 1){
            // TODO - should this be considered bank or address?
            if( typeof args[0] === 'number' ){
                // TODO - Validate address
                // TODO - use current bank index, not 0 (error if section is names, so the bank isnt known...)
                this.allocateSegmentedSection(0, args[0])
            }
            else{
                this.defineNamedSection(args[0]);
            }
    
        }
        else if(args.length === 2){
            let [bank, address] = args;
            // TODO - Validate Bank, address
            this.allocateSegmentedSection(bank, address);
        }
        else{
            // TODO
            throw Error()
        }
    }

    // TODO
    validateStructureEntry(){}
}

class RAMCompiler extends Compiler {
    compile(){
        for(let [bank,bankMap] of this.Memory.Allocator.Structure){
            this.setBank(bank);
            for(let [address, section] of bankMap){
                this.setAddress(address);
                section.forEach(value => this.Handle(value, null))
            }
        }
    }

    Handle(value, parent){
        if( value.constructor === this.Memory.Interpreter.Object ){
            this.Dict(value, parent)
        }
        else if( value instanceof UnionDirective ){
            this.Union(value)
        }
        else if( value instanceof UnionEndDirective ){
            this.UnionEnd(value)
        }
        // An allocated section will be an array
        else if( Array.isArray(value) ){
            value.forEach(element => this.Handle(element, null) );
        }
        else{
            super.Handle(value, parent)
        }
    }

    Union(value){
        if( value.Location ){
            value.End.setLocation( this.getLocation() )
            this.setLocation( value.Location )
        }
        else{
            value.setLocation( this.getLocation() );
        }
    }

    UnionEnd(value){
        value.setLocation( this.getLocation() )
        this.setLocation( value.Location )
    }

    Dict(dict, parent){
        for(let key in dict){
            this.handleName(key, dict[key], parent);
        }
    }

    /*
    TODO
    - validate name
    - test if exists in sym
    -- test if child and exists in sym (and parent doesnt)
    */
    handleName(name, value, parent){
        let map = parent ?
                parent.Children :
                this.Memory.Identifiers,
            InternalRAMInstance = map.get(name);
        
        if( !InternalRAMInstance ){
            //TODO - VALIDATE name
            InternalRAMInstance = this.Memory.new(name, parent);
        }

        let startLocation = this.getLocation();

        InternalRAMInstance.resolveBefore(startLocation);
        this.Memory.Processor.Symbols.storeOutput(startLocation.Bank, startLocation.Address, InternalRAMInstance.Before.Name);

        if(typeof value === "symbol"){
            value = this.Memory.Interpreter.fromSymbol(value)
        }

        if( value.constructor === this.Memory.Interpreter.Object ){
            this.Dict(value, InternalRAMInstance);
        }
        else if( Array.isArray(value) ){
            InternalRAMInstance.setLength(value.length)
            for(let i=0; i<value.length; i++){
                let newInstance = this.handleName(i, value[i], InternalRAMInstance);

                // Also set the negative value
                InternalRAMInstance.Children.set( i-value.length, newInstance );
            }
        }
        else if(value instanceof Flags){
            InternalRAMInstance.defineFlags(value);
            this.shiftAddress(value.Size);
        }

        else if( value instanceof Number || typeof value === "number" ){
            if( value <= 0 || !Number.isInteger(value) ){
                this.Memory.Processor.Log.Compiler.Error(`Allocation for ${InternalRAMInstance} must be a <+int>`);
            }
            if( value > 1 ){
                InternalRAMInstance.setLength(value)
                for(let i=0; i<value; i++){
                    let newInstance = this.handleName(i, 1, InternalRAMInstance);

                    // Also set the negative value
                    InternalRAMInstance.Children.set( i-value, newInstance );
                }
            }
            else{
                this.shiftAddress(value);
            }
        }
        else{
            this.Memory.Processor.Log.Compiler.Error(`${value} is not a valid Allocation input for ${InternalRAMInstance}`);
        }

        let endLocation = this.getLocation();
        InternalRAMInstance.resolveAfter( endLocation );

        // Only add the :End to the SYM if the size > 1
        if(InternalRAMInstance.Size > 1){
            this.Memory.Processor.Symbols.storeOutput(endLocation.Bank, endLocation.Address, InternalRAMInstance.After.Name);
        }

        return InternalRAMInstance;
    }
}

class InternalRAM extends InternalAddressable{
    #Start;
    Memory; Parent; Flags; Size;
    Length = 0;
    Bits = new Array(8);
    Children = new Map();

    constructor(memory, name, parent=null){
        let fullName = parent ?
            `${parent.Name}.${name}` :
            name;

		super(fullName);

        this.Memory = memory;
        this.Parent = parent;

        if(parent){
            parent.Children.set(name, this);
        }
        
        memory.Identifiers.set(this.Name, this);

        this.getStart = () => this.Start;
    }

    get Start(){
        if( !this.#Start ){
            this.initialize();
        }
        return this.#Start;
    }

    // todo - when does before/after get accessed?
    initialize(){
		this.#Start = new RAM(this);
		this.Memory.Processor.PublicToInternalMap.set(this.#Start, this);

		if( !this.Before.isResolved ){
			Object.defineProperty(this,'Before',{
				get(){
					this.Memory.Processor.Log.Compiler.Error(`${this} does not have a <Pointer> defined`);
				}
			});
		}

		if( !this.After.isResolved ){
			Object.defineProperty(this,'After',{
				get(){
					this.Memory.Processor.Log.Compiler.Error(`${this} does not have an _End_ <Pointer> defined`);
				}
			});
		}

		this.Memory.Processor.NameMap.set(this.Name, this);
    }

    resolveBefore(location){
        this.Before.resolve(location);
        if( this.After.isResolved ){
            this.resolveSize();
        }
    }

    resolveAfter(location){
        this.After.resolve(location);
        if( this.Before.isResolved ){
            this.resolveSize();
        }
    }

    resolveSize(){
        this.Size = this.After.Data.Address - this.Before.Data.Address;
    }

    setLength(length){
        this.Length = length;
    }

    defineFlags(flags){
        this.Flags = flags;
    }

    getFlag(index){
        let i = index;
        if( typeof i === "number" || i instanceof Number ){
            if( i < 0 ){
                i = this.Bits.length-i;
            }

            if( this.Bits[i] ){
                return this.Bits[i];
            }

            if( i < 0 || i >= this.Bits.length ){
                this.Memory.Processor.Log.Compiler.Error(`${index} exceeds the number of bits in ${this}`);
            }

            let flag = new InternalAddressableFlag(this, i);
            this.Bits[i] = flag;
            return flag;
        }

        this.Memory.Processor.Log.Compiler.Error(`${index} is not a valid bit identifier for ${this}`)
    }

	toString(){
		return `RAM<${this.Name}>`
	}
}

class RAM extends Addressable {
    #Internal;

	constructor(Internal, isStart = true){
		super(Internal, isStart);
        this.#Internal = Internal;

        for(let [name, child] of Internal.Children){
            this.#defineChild(name, child);
        }

        if( Internal.Flags ){
            for(let key in Internal.Flags.byName ){
                this.#defineFlag(key, Internal.Flags.byName[key]);
            }
        }
	}
    
    #defineChild(name, child){
        Object.defineProperty(this, name, { get : child.getStart })
    }

    #defineFlag(name, index){
        Object.defineProperty(this, name, { get : () => this.#Internal.getFlag(index).Public })
    }

	#ld( other ){
		if( other === require('./Hardware').Registers.sp ){
			this.#Internal.Memory.Processor.Code.addOpCode( `ld @,${ other.Name }`, this );
		}
		else if( other === require('./Hardware').Registers.a ){
			// TODO - need way to explicitly use the long address..
			if(this.#Internal.Before.Data.Address >= 0xff00){
				this.#Internal.Memory.Processor.Code.addOpCode( `ld $ff+_,a`, this.#Internal.Before.Data.Address - 0xff00);
			}
			else{
				this.#Internal.Memory.Processor.Code.addOpCode( `ld @,${ other.Name }`, this );
			}
		}
		else{
			this.#Internal.Memory.Processor.Log.Compiler.Error(`${other} cannot be loaded into ${this}`);
		}
		
		return this;
	}

    get Parent(){
        return this.#Internal.Parent && this.#Internal.Parent.Start;
    }

    get Size(){
        if( this.#Internal.Size ){
            return this.#Internal.Size;
        }
        this.#Internal.Memory.Processor.Log.Compiler.Error(`${this} does not have a defined Size`);
    }

    get Length(){
        return this.#Internal.Length;
    }

    get load(){
        return this.#ld;
    }

    get ld(){
        return this.#ld;
    }

	thru(other, fn){
		this.#Internal.Memory.Processor.setThru(other, this)

		other.ld(this)
		fn.call(this)
		this.ld(other)
		
		this.#Internal.Memory.Processor.resetThru(other, this)
	}
}

RandomAccessMemory.RAM = RAM;

module.exports = RandomAccessMemory;