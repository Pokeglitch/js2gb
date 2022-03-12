let { Memory, Interpreter, Compiler, Allocator, Flags } = require('./Assembler'),
	Software = require('./Software'),
	{ Directive, SkipDirective } = require('./Directives'),
    { Registers, Interrupt } = require('./Hardware'),
    { a, f, b, c, d, e, h, l,
		af, bc, de, hl, sp,
		$bc, $de, $hl, $ff } = Registers,
    { Pointer, Code, InternalCode, InternalData, InternalPointer, PointerByte, PointerAddress, Surrogate } = Software,
    { RAM } = require('./RAM'),
    { OpCodes, OpCodeWrapper, OpCodeCallbackWrapper } = require('./OpCodes');

class ReadOnlyMemory extends Memory {
    constructor(processor){
        super(processor, "ROM", ROMInterpreter, ROMAllocator, ROMCompiler);
    }
	compile(){
		super.compile();

		let outputPath = this.Processor.Parameters.Output.ROM;
		if(outputPath){
			let buffer = Buffer.from(this.Compiler.Binary);
			this.Processor.writeFile('Output.ROM', outputPath, buffer);
			this.Processor.Log.Compiler.Log(`Successfully Exported ROM to ${outputPath}`);
		}
	}
}

class ROMInterpreter extends Interpreter {
    generateContext(){
        let memory = this.Memory;

		function Data(...args){
			return Software.InternalData.define(memory, ...args);
		}
		Data.prototype = Software.Data.prototype;

		function Routine(...args){
			return Software.InternalRoutine.define(memory, ...args);
		}
		Routine.prototype = Software.Routine.prototype;

		function Block(...args){
			return Software.InternalBlock.define(...args);
		}
		Block.prototype = Software.Block.prototype;

		function ret(){
			memory.Processor.Code.addOpCode('ret');
		}
		ret[Registers.f.c] = ret.c = () => this.Memory.Processor.Code.addOpCode('ret c');
		ret[Registers.f.nc] = ret.nc = () => this.Memory.Processor.Code.addOpCode('ret nc');
		ret[Registers.f.z] = ret.z = () => this.Memory.Processor.Code.addOpCode('ret z');
		ret[Registers.f.nz] = ret.nz = () => this.Memory.Processor.Code.addOpCode('ret nz');

		let context = {
            def : data => {
                if( data && data.constructor === this.Object ){
                    let keys = Object.keys(data);
                    keys.forEach(key => {
                        let value = data[key],
                            result;

                        if( typeof value === 'function' ){
                            if( this.Memory.Processor.inRoutine() ){
                                // TODO - assign to the parent Routine object?
                                result = Block(key, value);
                            }
                            else{
                                // TODO - how to handle functions with a 'call' macro?
                                result = Routine(key, value);
                            }
                        }
                        else{
                            result = Data(key, value);
                        }

                        if( !this.Memory.Processor.inRoutine() ){
                            Object.defineProperty(context, key, {
                                value : result
                            });
                        }
                    })
                }
                else if( typeof data === 'function' ){
                    if( this.Memory.Processor.inRoutine() ){
                        return Block(data);
                    }
                    else{
                        return Routine(data);
                    }
                }
                else{
                    return Data(data);
                }
            },
            $ : name => Software.LookupByName(name),
            nop : ()=>{ this.Memory.Processor.Code.addOpCode('nop') },
            halt : ()=>{ this.Memory.Processor.Code.addOpCode('halt') },
            stop : ()=>{ this.Memory.Processor.Code.addOpCode('stop') },
            Data, Routine, Block, Interrupt,
			ret,
            a, f, b, c, d, e, h, l,
            af, bc, de, hl,
            $bc, $de, $hl,
            sp, $ff
        };

        // Define 'self' to refer to the current code, so it can be used in macros and arrow functions
        Object.defineProperty(context, 'self', {
            get : ()=>{
                return this.Memory.Processor.Code.Start;
            } 
        })

		// Make all of the RAM identifiers globally accessible
        if( this.Memory.Processor.Parameters.Options.Global ){
            for(let [name,data] of this.Memory.Processor.RAM.Identifiers){
                Object.defineProperty(context, name, {
                    get : data.getStart
                });
            }
        }
        return super.generateContext(context)
    }
}

class ROMAllocator extends Allocator {
	constructor(memory){
		super(memory, 0x0000, 0x4000);
		this.validateCustomStructure( this.Memory.Processor.Parameters.Structure.ROM );
    }

    /*
    TODO -
    If the last argument is a function:
    - switch to that section
    - execture that function (within that section)
    - return to the previous section after function is completed
    */
    gotoSection(...args){
        if(args.length === 1){
            // TODO - should this just be considered an address instead?
            if(typeof args[0] === 'number'){
                let [bank] = args;
                this.checkValidROMBank('Section', bank);
                this.allocateContinuousSection(bank);
            }
            else{
                this.defineNamedSection(args[0]);
            }
        }
        else{
            let [bank, address] = args;
            this.checkValidROMBank('Section', bank);
    
            if( !Number.isInteger(address) || address < 0 ){
                this.Memory.Processor.Log.Compiler.Error(`_Section_ input is not a valid ROM address: ${address}`);
            }
    
            if( (bank && (address >= 0x4000 && address <= 0x7FFF)) ||
                (!bank && address <= 0x3FFF) ){
                this.allocateSegmentedSection(bank, address);
            }
            else{
                this.Memory.Processor.Log.Compiler.Error(`_Section_ value is not a valid ROM address: ADDR(${bank}, ${address})`);
            }
        }
    }
	

	checkValidROMBank(name, bank){
		if( !Number.isInteger(bank) || bank < 0 || bank > this.Memory.Processor.Header.ROMBanks ){
			this.Memory.Processor.Log.Compiler.Error(`_${name}_ value is not a valid ROM Bank: ${bank}`);
		}
	}
    
	validateStructureEntry(key, value){
        if( !key.match(/^[0-9]+$/) ){
            this.Memory.Processor.Log.Compiler.Error(`_Structure.ROM_ key of '${key}' is not a valid bank index`);
        }
        
        let bank = parseInt(key);
        if( bank >= this.Memory.Processor.Header.ROMBanks ){
            this.Memory.Processor.Log.Compiler.Error(`_Structure.ROM_ key of '${bank}' exceeds the maximum number ROM banks in this <Cartridge> (${this.Memory.Processor.Header.ROMBanks})`);
        }

        let bankStructure = new Map();
        if( value && value.constructor === Object){
            //Make sure the keys are valid addresses
            Object.keys(value).forEach( addrStr => {
                if( !addrStr.match(/^[0-9]+$/) ){
                    this.Memory.Processor.Log.Compiler.Error(`_Structure.ROM.${bank}_ key of '${addrStr}' is not a valid address`);
                }

                let addr = parseInt(addrStr);
                if( (!bank && addr > 0x3FFF) || (bank && (addr < 0x4000 || addr > 0x7FFF) ) ){
                    this.Memory.Processor.Log.Compiler.Error(`_Structure.ROM.${bank}_ key of '${base16(addr, 4)}' does not exist in the bank`);
                }

                let section = value[addrStr];
                if( Array.isArray(section) ){
                    let newSection = [];
                    section.forEach(name => {
                        this.addSectionName(name);
                        newSection.push(name);
                    });
                    bankStructure.set(addr, newSection);
                }
                else if( typeof section === 'string' ){
                    this.addSectionName(section);
                    bankStructure.set(addr, [section]);
                }
                else{
                    this.Memory.Processor.Log.Compiler.Error(`_Structure.ROM.${bank}_ value for key '${addrStr}' must be a <string|array>`);
                }
            });
        }
        else if( Array.isArray(value) ){
            let section = [];
            value.forEach(name => {
                this.addSectionName(name);
                section.push(name);
            })
            bankStructure.set(bank ? 0x4000 : 0, section);
        }
        else if(typeof value === 'string'){
            this.addSectionName(value);
            bankStructure.set(bank ? 0x4000 : 0, [value]);
        }
        else{
            this.Memory.Processor.Log.Compiler.Error(`_Structure.ROM_ value for key '${key}' must be a <string|array|dict>`);
        }
        this.CustomStructure.set(bank, bankStructure);
    }
}

class ROMCompiler extends Compiler {
    Binary = [];
    Checksum = 0;
    Index = 0;
    Output; Stack; State;
    MaxAddress;
    ExpectedPointers;
    ReferencedPointers = new Set;

    compile(){
		// Make sure all undefined names exist in the SYM
		for(let [name, internal] of this.Memory.Processor.NameMap){
			if( internal instanceof Software.InternalSurrogate && !this.Memory.Processor.Symbols.has(name)){
				this.Memory.Processor.Log.Compiler.Error(`$('${name}') does not exist in source or SYM`);
			}
		}

        this.Banks = [];
        for(let i=0; i < this.Memory.Processor.Header.ROMBanks; i++){
            let bank = {};
            this.Banks.push(bank);

            let structure = this.Memory.Allocator.Structure.get(i);
            if(!structure){
                continue;
            }

            //TODO - This should be done beforehand
            if( Array.isArray(structure) ){
                let section = structure;
                structure = new Map();
                structure.set( i ? 0x4000 : 0, section);
            }

            [...structure.keys()].sort().forEach(address => {
                let content = structure.get(address),
                    bankArray = bank[address] = [];

                this.handleContent(content, bankArray)
            });
        }

		// TODO - does this code ever get used?
		// Ensure all Code is defined or in SYM
		for(let [name, routineTree] of this.Memory.Processor.RoutineTrees){
			let isDefined = routineTree.Parent;

			if( isDefined && !routineTree.Parent.isCompiled ){
				routineTree.Parent.designateSYM(false);
				isDefined = false;
			}

			if( !isDefined ){
				for(let child of routineTree.Children){
					child.designateSYM(false);
				}
			}
		}

		// Designate any Surrogates that remain undefined as SYM only
		for(let [name, surrogateTree] of this.Memory.Processor.SurrogateTrees){
			if(surrogateTree.Parent){
				surrogateTree.Parent.designateSYM();
			}

			for(let child of surrogateTree.Children){
				child.designateSYM();
			}
		}

		// Compile
		let rom = [];
		
		for( let i=0; i < this.Banks.length; i++ ){
            let bank = this.Banks[i],
                compiled = [];

            this.setBank(i);
            this.setAddress(i ? 0x4000 : 0x0000);

            this.MaxAddress = i ? 0x8000 : 0x4000;
            this.ExpectedPointers = new Set;
                
            Object.keys(bank).forEach( addr => {
                let address = parseInt(addr);
    
                if( address < this.Address){
                    this.Memory.Processor.Log.Compiler.Error(`Cannot place section at ADDR(${i},${address}) since prior section overflows into it`);
                }
    
                // Fill in the gap
                compiled.push( Array(address - this.Address) );
    
                // Go to the given address
                this.setAddress(address);
    
                this.Process( bank[addr] );

                compiled.push(this.Output);
            });
                
            // TODO - while processing all pointers that are jumped/called (unless source is home back or target is home bank)
            if( this.ExpectedPointers.size ){
                let names = [...this.ExpectedPointers.values()].map(ptr => ptr.Reference.Name).join(', ');
                // TODO - suppressable
                this.Memory.Processor.Log.Compiler.Error(`The following pointers were accessed in Bank ${this.Bank}, but not allocated to Bank ${this.Bank}: ${names}`);
            }

            if( this.Address >= this.MaxAddress ){
                this.Memory.Processor.Log.Compiler.Error(`Overflow in ${this.Memory.Name} Bank HEX(${i})`)
            }

            compiled.push( new Array(this.MaxAddress - this.Address) )

			rom.push(compiled);
		}
		
		// Ensure all references pointers have been allocated
		if( this.ReferencedPointers.size ){
            let names = [...this.ReferencedPointers.values()].map(ptr => ptr.Reference.Name).join(', ');
			this.Memory.Processor.Log.Compiler.Error(`The following pointers were referenced but not allocated to the ROM: ${names}`);
		}

		this.flatten(rom);

		// Store the Checksum
		this.storeChecksum(this.Checksum >> 8, 0x14e);
		this.storeChecksum(this.Checksum, 0x14f);
    }


    storeChecksum(checksum, pos){
		let byteVal = checksum % 0x100,
			binVal = this.Binary[pos];

		if(this.Memory.Processor.BaseROM){
			let baseVal = this.Memory.Processor.BaseROM[pos];
			if(binVal === undefined){
				this.Binary[pos] = baseVal;
			}
			else if(binVal === baseVal){
				this.Memory.Processor.Log.Compiler.Warning(`Data exists in the reserved Checksum position at INDEX(${pos}), but it matches the _Base.ROM_ value`);
			}
			else{
				this.Memory.Processor.Log.Compiler.Error(`_Base.ROM_ mismatch in the reserved Checksum position at INDEX(${pos})    Expected: HEX(${baseVal})    Received: HEX(${binVal})`);
			}
			if(baseVal !== byteVal){
				this.Memory.Processor.Log.Compiler.Warning(`_Base.ROM_ Checksum is incorrect at INDEX(${pos}).    Base.ROM: HEX(${baseVal})    Correct: HEX(${byteVal})`);
			}
			return;
		}
		
		if(binVal === undefined){
			this.Binary[pos] = byteVal;
		}
		else if(binVal === byteVal){
			this.Memory.Processor.Log.Compiler.Warning(`Data exists in the reserved Checksum position at INDEX(${pos}), but it matches the Checksum value`);
		}
		else{
			this.Memory.Processor.Log.Compiler.Warning(`Data exists in the reserved Checksum position at INDEX(${pos})`);
		}
	}
    addToBinary(val){
		if(this.Memory.Processor.BaseROM){
			let baseVal = this.Memory.Processor.BaseROM[this.Index];
			if(val === undefined){
				val = baseVal;
			}
			else if(val != baseVal){
				this.Memory.Processor.Log.Compiler.Error(`_Base.ROM_ mismatch at INDEX(${this.Index})    Expected: HEX(${baseVal})    Received: HEX(${val})`);
			}
		}
		if(val === undefined){
			val = 0;
		}
		this.Binary[this.Index++] = val;
		this.Checksum += val;
	}
    flatten(arr){
		for(let i=0;i<arr.length;i++){
			let val = arr[i];
			if( Array.isArray(val) ){
				this.flatten(arr[i]);
			}
			else{
				// Header & Checksum
				if( this.Index < 0x150){
					// Checksum
					if(this.Index > 0x14D){
						if(val === undefined){
							this.Index++;
							continue;
						}
						else{
							this.Checksum -= val;
						}
					}
					// Header
					else if(this.Index > 0x103){
						let headerVal = this.Memory.Processor.Header.Compiled[this.Index-0x104];
						if(val === undefined){
							val = headerVal;
						}
						else if(val === headerVal){
							this.Memory.Processor.Log.Compiler.Warning(`Data exists in the reserved Header position at INDEX(${this.Index}), but it matches the Header value`);
						}
						else{
							this.Memory.Processor.Log.Compiler.Error(`Data exists in the reserved Header position at INDEX(${this.Index})`);
						}
					}
				}
				
				this.addToBinary(val);
			}
		}
	}
    /********** Old Code ****************/
	handleContent(content, bankArray){
		content.forEach( val => {
			if( val instanceof Software.Surrogate){
				let internalSurrogate = this.Memory.Processor.PublicToInternalMap.get(val);
				if( !internalSurrogate.Value ){
					this.Memory.Processor.Log.Compiler.Error(`$('${internalSurrogate.Name}') is not defined in source`)
				}
				val = internalSurrogate.Value;
			}

			if( val instanceof Software.Routine ){
				// Get the code data
				let internalRoutine = this.Memory.Processor.PublicToInternalMap.get(val);

				// TODO - can this even happen?
				if( !internalRoutine.DefinitionFunction ){
					this.Memory.Processor.Log.Compiler.Error(`Cannot write *${internalRoutine}* to ROM since it is not defined in the source`);
				}
				
				// Compile the Routine
				internalRoutine.compile();

				// Check for unresolved Blocks
				let routineTree = Software.RoutineTree.get(internalRoutine.Name);

				// If the Block has not been compiled, it must be in the SYM
				for(let block of routineTree.Children){
					if( !block.isCompiled ){
						block.designateSYM(true);
					}
				}

				bankArray.push(internalRoutine);
			}
			else if( val instanceof Software.Data ){
				let internal = this.Memory.Processor.PublicToInternalMap.get(val);
				bankArray.push( internal ); 
			}
			else if( val instanceof Directive ){
				bankArray.push(val);
			}
			// A nested section will appear as an array
			else if( Array.isArray(val) ){
				this.handleContent(val, bankArray);
			}
			else{
				this.Memory.Processor.Log.Compiler.Error(`Invalid ROM Input: ${val}`);
			}
		});	
	}
    /********** End Old Code *************/

	ProcessList(data){
		this.Stack.push(this.State);
		this.State = {
			data : data,
			index : 0
		}
	}

	Process(data){
        this.Output = [];
        this.Stack = [];
        this.State = {
            data : data,
            index : 0
        };

		while(true){
			while( this.State.index >= this.State.data.length ){
				if( this.Stack.length ){
					this.State = this.Stack.pop();
				}
				else{
                    return;
				}
			}
			this.Handle( this.State.data[this.State.index++] );
		}
	}
	HandleAll(...args){
		for(let i=0;i<args.length;i++){
			this.Handle( args[i] );
		}
	}
	// To handle the given value, based on it's class
	Handle( value ){
		if( value instanceof InternalCode ){
			return this.InternalCode( value );
		}
		else if( value instanceof InternalData ){
			return this.InternalData( value );
		}
		else if( value instanceof OpCodeCallbackWrapper ){
			return this.OpCodeCallbackWrapper(value);
		}
		else if( value instanceof OpCodeWrapper ){
			return this.OpCodeWrapper(value);
		}
		else if( Array.isArray(value) ){
			return this.Array( value );
		}
		else if(value instanceof Surrogate){
			let internalSurrogate = this.Memory.Processor.PublicToInternalMap.get(value),
				pointer = internalSurrogate.getPointer(value);

			return this.Addressable(pointer);
		}
		else if(value instanceof Pointer){
			return this.Pointer(value);
		}
		else if( value instanceof PointerAddress ){
			return this.PointerAddress( value );
		}
		else if( value instanceof PointerByte ){
			return this.PointerByte( value );
		}
		else if( value instanceof Code ){
			return this.Code(value);
		}
		else if( value instanceof Software.Data ){
			return this.DataInstance( value );
		}
		else if( value instanceof RAM ){
			return this.RAMInstance( value );
		}
		else if( value instanceof InternalPointer ){
			return this.InternalPointer( value );
		}
		else if( value instanceof SkipDirective ){
			return this.SkipDirective( value.Offset );
		}
		else if( value.constructor === Object ){
			return this.Object(value);
		}
		else{
			return this.Number( value );
		}
	}

	// If the element is an InternalCode, return a new Compiler for that data
	InternalCode( value ){
		this.ProcessList(value.toROM);
	}
	// If the element is an InternalData, return a new Compiler for that data
	InternalData( value ){
		this.ProcessList(value.toROM);
	}
	// If the element is an Array, return a new Compiler for that data
	Array( value ){
		this.ProcessList(value);
	}
	// If the element is an Object, return a new Compiler for that data
	Object( value ){
		let arr = [];
		Object.keys(value).forEach( k => arr.push( value[k] ) );
		
		this.ProcessList(arr);
	}
	
	// If the element is the SkipDirective, then Goto current address + offset
	SkipDirective( offset ){
		let addr = this.Address + offset;

		if(addr >= this.MaxAddress){
			this.Memory.Processor.Log.Compiler.Error(`<Skip> input value of '${offset}' will cause a bank overflow`);
		}

		if( addr < this.Address ){
			throw Error(`Cannot goto an earlier address`)
		}
		if( addr >= this.MaxAddress ){
			throw Error(`${ addr } is not lower than ${ this.MaxAddress }`)
		}

		this.Output.push( new Array(addr - this.Address) );
		
		this.Address = addr;
	}
	// If the element is a RAM, then get the addressable, and handle the pointer
	RAMInstance( value ){
		let internal = this.Memory.Processor.PublicToInternalMap.get( value ),
			pointer = internal.getPointer(value);

		return this.Addressable(pointer);
	}
	// If the element is a Data, then get the addressable, and handle the pointer
	DataInstance( value ){
		let internal = this.Memory.Processor.PublicToInternalMap.get( value ),
			pointer = internal.getPointer(value);

		return this.Addressable(pointer);
	}
	// If the element is a Code, then get the pointer, and handle the pointer
	Code( value ){
		let internal = this.Memory.Processor.PublicToInternalMap.get(value),
			pointer = internal.getPointer(value);

		return this.Addressable(pointer);
	}
	
	OpCodeWrapper( wrapper ){
		let { opcode, data } = wrapper;

		if( opcode.name.startsWith('jr') ){
			let internal = this.Memory.Processor.PublicToInternalMap.get(data),
				pointer = internal.getPointer(data),
				bank = this.Bank,
				addr = this.Address+2,
				diff = [0];

			pointer.onResolve( ptr => {
				if( !ptr ) return diff[0] = 0;
				//TODO, validate bank and difference
				diff[0] = ptr.Address - addr;
				if( diff[0] < 0 ) diff[0] += 0x100;
			});

			data = [diff];
		}
		return this.Array( [].concat(opcode.code, data) );
	}

	OpCodeCallbackWrapper( wrapper ){
		let internal = this.Memory.Processor.PublicToInternalMap.get(wrapper.code),
			callback = wrapper.getCallback(this.Bank, this.Address),
			pointer = internal.getPointer(wrapper.code);

		pointer.onResolve(callback);
		this.Output.push(wrapper.data);
		
		this.Address += wrapper.size;
	}
	// If the element is a Pointer, then resolve it
	Pointer(value){
		let arr = this.Memory.Processor.PublicToInternalMap.get(value).resolve();
		this.Output.push(arr);
		this.Address += 2;
	}
	// If the element is a PointerAddress, then resolve it
	PointerAddress(value){
		let arr = this.Memory.Processor.PublicToInternalMap.get(value).resolve();
		this.Output.push(arr);
		this.Address += 2;
	}
	// If the element is an PointerByte, then resolve it
	PointerByte(value){
		let arr = this.Memory.Processor.PublicToInternalMap.get(value).resolve();
		this.Output.push(arr);
		this.Address++;
	}
	// If the element is an Addressable, store the Pointer LittleEndian to the output
	// If the pointer is unresolved, add it to the set of referenced pointers
	// and run the super method to increase the bank address
	Addressable(ptr){
		this.Output.push( ptr.LittleEndian );
		if( !ptr.isResolved && !ptr.Reference.SYM){
			this.ReferencedPointers.add( ptr );
		}
		this.Address += 2;
	}
	// If the element is an InternalPointer, then remove it from the expected pointer set and the references pointer set
	// and resolve it
	InternalPointer( ptr ){
		this.ExpectedPointers.delete( ptr );
		this.ReferencedPointers.delete( ptr );

		ptr.compareToSYM(this.Bank, this.Address);

		// Store to the Output SYM if there is a name
		if( ptr.Reference.Name ){
			this.Memory.Processor.Symbols.storeOutput(this.Bank, this.Address, ptr.Name);
		}

		ptr.resolve({
			Bank : this.Bank,
			Address : this.Address
		});
	}
	// If the element is a number, store it to the output
	// and run the super method to increase the bank address
	Number( num ){
		this.Output.push( num );
		this.Address++;
	}


}

module.exports = ReadOnlyMemory;