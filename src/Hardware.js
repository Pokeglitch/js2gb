let { Surrogate, Data, Pointer, PointerByte, PointerAddress, Addressable } = require('./Software'),
	{ RAM } = require('./RAM'),
	FFOffsetInstances = new Map(),
	SPOffsetInstances = new Map(),
	Processor;

/*
Helpers
*/
function isIntInRange(x,min,max){
	if( Array.isArray(x) ){
		let reducer = (prev, val, i) => prev + (val << (i*8) );
		x = x.reduce(reducer)
	}

	return typeof x === 'number' && Number.isInteger(x) && x >= min && x <= max;
}

function isByte(x){
	return isIntInRange(x,-0xff,0xff);
}

function isWord(x){
	return isIntInRange(x,-0xffff,0xffff);
}

/*
Flags and Bits
*/
class FlagClass {
	constructor( register, name, cond, not){
		let sym = Symbol();
		this.toString = () => sym; // Hack so a Flag instance can be used as an object property
		this.Condition = cond;
		this.Register = register;
		this.Name = name;
		this.Not = not || new FlagClass( register, name, 'n' + cond, this);
	}
}

class RegisterFlagClass {
	constructor(register, name, cond){
		this.Register = register;
		this.Name = name;
		
        let flag = new FlagClass(register, name, cond);
		this.isSet = typeof name === 'number' ? flag.Not : flag;
		this.isNotSet = this.isSet.Not;
		this.toString = this.isSet.toString;
	}
}

// Bits 0-7 of a, b, c, d, e, h, l, $hl
class RegisterBitClass extends RegisterFlagClass {
    constructor(register, index){
        super(register, index, 'z');
    }
	set(){
		Processor.Code.addOpCode(`set ${this.Name},${this.Register.Name}`);
		return this;
	}
	res(){
		Processor.Code.addOpCode(`res ${this.Name},${this.Register.Name}`);
		return this;
	}
	bit(){
		Processor.Code.addOpCode(`bit ${this.Name},${this.Register.Name}`);
		return this;
	}
}

// Carry flag
class CarryFlagClass extends RegisterFlagClass {
	cpl(){
		Processor.Code.addOpCode( 'ccf' );
		return this;
	}
	set(){
		Processor.Code.addOpCode( 'scf' );
		return this;
	}
}

/*
The Registers
*/
class RegisterClass {
	constructor( name ){
		this.Name = name;
	}
}

class Register8BitBaseClass extends RegisterClass {
	ld( other ){
		throw Error(`The given value cannot be loaded into 8-Bit Register ${ this.Name }`);
	}
}

// For $bc, $de, $FF+c
class Register8BitSimpleClass extends Register8BitBaseClass {
	ld( other ){
		if( other === a ){
			Processor.Code.addOpCode( `ld ${ this.Name },a` );
		}
		else{
			super.ld( other );
		}
		return this;
	}
}

class Register8BitAtFFOffsetClass extends Register8BitBaseClass {
	constructor( Offset, ...args ){
		if( FFOffsetInstances.has(Offset) ){
			return FFOffsetInstances.get(Offset);
		}
		super('$ff+_', ...args);
		this.Offset = Offset;
		FFOffsetInstances.set(Offset, this);
	}
	
	ld( other ){
		if( other === a ){
			Processor.Code.addOpCode( `ld ${ this.Name },a`, this.Offset );
		}
		else{
			super.ld( other );
		}
		return this;
	}
}

class Register8BitFClass extends Register8BitBaseClass {
	constructor(){
		super('f');
		
		this.Zero = new RegisterFlagClass(this,'z','z');
		this.Carry = new CarryFlagClass(this, 'c', 'c');
		
		this.c = this.Carry.isSet;
		this.nc = this.Carry.isNotSet;
		this.z = this.Zero.isSet;
		this.nz = this.Zero.isNotSet;
	}
}

// For b, c, d, e, h, l
class Register8BitMainClass extends Register8BitBaseClass {
	constructor(...args){
		super(...args);
		for(let i=0; i<8; i++){
			this[i] = new RegisterBitClass(this,i);
		}
	}
	ld( other ){
		// Convert a string using the charmap
		if(typeof other === "string"){
			other = Processor.CharMap.convert(other);
		}

		if( other instanceof Register8BitMainClass ){
			Processor.Code.addOpCode( `ld ${ this.Name },${ other.Name }` );
		}
		else if( isByte(other) ){
			Processor.Code.addOpCode( `ld ${ this.Name },_`, other );
		}
		else if( other instanceof PointerByte ){
			Processor.Code.addOpCode( `ld ${ this.Name },_`, other );
		}
		else{
			super.ld( other );
		}
		return this;
	}
	inc(){
		Processor.Code.addOpCode( `inc ${ this.Name }` );
		return this;
	}
	dec(){
		Processor.Code.addOpCode( `dec ${ this.Name }` );
		return this;
	}
	swap(){
		Processor.Code.addOpCode( `swap ${ this.Name }` );
		return this;
	}
	rlc(){
		Processor.Code.addOpCode( `rlc ${ this.Name }` );
		return this;
	}
	rl(){
		Processor.Code.addOpCode( `rl ${ this.Name }` );
		return this;
	}
	rrc(){
		Processor.Code.addOpCode( `rrc ${ this.Name }` );
		return this;
	}
	rr(){
		Processor.Code.addOpCode( `rr ${ this.Name }` );
		return this;
	}
	sla(){
		Processor.Code.addOpCode( `sla ${ this.Name }` );
		return this;
	}
	sra(){
		Processor.Code.addOpCode( `sra ${ this.Name }` );
		return this;
	}
	srl(){
		Processor.Code.addOpCode( `srl ${ this.Name }` );
		return this;
	}
}

// For $hl
class Register8BitAtHLClass extends Register8BitMainClass {
	constructor( ...args ){
		super( '$hl', ...args );
	}
	ld( other ){
		if( other === $hl ){
			throw Error(`The given value cannot be loaded into 8-Bit Register ${ this.Name }`);
		}
		else{
			super.ld( other );
		}
		return this;
	}
	ldi( other ){
		if( other === a ){
			Processor.Code.addOpCode( `ldi hl,${other.Name}` );
		}
		else{
			Processor.Log.Compiler.Error(`The given value cannot be with the *ldi* instruction`);
		}
		return this;
	}
	ldd( other ){
		if( other === a ){
			Processor.Code.addOpCode( `ldd hl,${other.Name}` );
		}
		else{
			Processor.Log.Compiler.Error(`The given value cannot be with the *ldd* instruction`);
		}
		return this;
	}
}

class Register8BitAClass extends Register8BitMainClass {
	constructor( ...args ){
		super( 'a', ...args );
	}
	ld( other ){
		if( other instanceof Register8BitAtFFOffsetClass ){
			Processor.Code.addOpCode( `ld ${ this.Name },${ other.Name }`, other.Offset );
		}
		else if(other instanceof Surrogate){
			let internalSurrogate = Processor.PublicToInternalMap.get(other),
				data = internalSurrogate.designateData(true, other);
			Processor.Code.addOpCode( `ld ${ this.Name },@`, data );
		}
		// TODO - Make sure the 'Value' associated with the 'Data' is a single byte
		// i.e. if ROMData('abc') has a size of two, this this must be ROMData('abc.0'), not ROMData('abc')
		// Or, just assume its pointing to the first? (warning)
		else if( other instanceof Data ){
			Processor.Code.addOpCode( `ld ${ this.Name },@`, other );
		}
		else if( other instanceof RAM ){
			let internalRAM = Processor.PublicToInternalMap.get(other);
			// TODO - need way to explicitly use the long address..
			if(internalRAM.Before.Data.Address >= 0xff00){
				Processor.Code.addOpCode( `ld ${ this.Name },$ff+_`, internalRAM.Before.Data.Address - 0xff00);}
			else{
				Processor.Code.addOpCode( `ld ${ this.Name },@`, other );
			}
		}
		else if( other instanceof Register8BitBaseClass ){
			Processor.Code.addOpCode( `ld ${ this.Name },${ other.Name }` );
		}
		else if( other === undefined ){
			if( Processor.Parameters.Options.Strict){
				Processor.Log.Compiler.Error(`*a.ld()* is not a valid OpCode in *Strict* mode`);
			}
			else{
				Processor.Code.addOpCode( `ld ${ this.Name },${this.Name}` );
			}
		}
		else{
			return super.ld(other)
		}
		return this;
	}
	ldi( other ){
		if( other === hl ){
			Processor.Code.addOpCode( `ldi ${this.Name},${other.Name}` );
		}
		else if( other === $hl ){
			Processor.Code.addOpCode( `ldi ${this.Name},hl` );
		}
		else{
			Processor.Log.Compiler.Error(`The given value cannot be with the *ldi* instruction`);
		}
		return this;
	}
	ldd( other ){
		if( other === hl ){
			Processor.Code.addOpCode( `ldd ${this.Name},${other.Name}` );
		}
		else if( other === $hl ){
			Processor.Code.addOpCode( `ldd ${this.Name},hl` );
		}
		else{
			Processor.Log.Compiler.Error(`The given value cannot be with the *ldd* instruction`);
		}
		return this;
	}
	add( other ){
		if( other instanceof Register8BitMainClass ){
			Processor.Code.addOpCode( `add ${ this.Name },${ other.Name }` );
		}
		else if( other === undefined ){
			if( Processor.Parameters.Options.Strict){
				Processor.Log.Compiler.Error(`*a.add()* is not a valid OpCode in *Strict* mode`);
			}
			else{
				Processor.Code.addOpCode( `add ${ this.Name },${this.Name}` );
			}
		}
		else if( isByte(other) ){
			Processor.Code.addOpCode( `add ${ this.Name },_`, other );
		}
		else if( other instanceof PointerByte ){
			Processor.Code.addOpCode( `add ${ this.Name },_`, other );
		}
		else{
			throw Error(`The given value cannot be added to 8-Bit Register ${ this.Name }`);
		}
		return this;
	}
	adc( other ){
		if( other instanceof Register8BitMainClass ){
			Processor.Code.addOpCode( `adc ${ this.Name },${ other.Name }` );
		}
		else if( other === undefined ){
			if( Processor.Parameters.Options.Strict){
				Processor.Log.Compiler.Error(`*a.adc()* is not a valid OpCode in *Strict* mode`);
			}
			else{
				Processor.Code.addOpCode( `adc ${ this.Name },${ this.Name }` );
			}
		}
		else if( isByte(other) ){
			Processor.Code.addOpCode( `adc ${ this.Name },_`, other );
		}
		else if( other instanceof PointerByte ){
			Processor.Code.addOpCode( `adc ${ this.Name },_`, other );
		}
		else{
			throw Error(`The given value cannot be added to 8-Bit Register ${ this.Name }`);
		}
		return this;
	}
	sub( other ){
		if( other instanceof Register8BitMainClass ){
			Processor.Code.addOpCode( `sub ${ this.Name },${ other.Name }` );
		}
		else if( other === undefined ){
			if( Processor.Parameters.Options.Strict){
				Processor.Log.Compiler.Error(`*a.sub()* is not a valid OpCode in *Strict* mode`);
			}
			else{
				Processor.Code.addOpCode( `sub ${ this.Name },${ this.Name }` );
			}
		}
		else if( isByte(other) ){
			Processor.Code.addOpCode( `sub ${ this.Name },_`, other );
		}
		else if( other instanceof PointerByte ){
			Processor.Code.addOpCode( `sub ${ this.Name },_`, other );
		}
		else{
			throw Error(`The given value cannot be subtracted from 8-Bit Register ${ this.Name }`);
		}
		return this;
	}
	sbc( other ){
		if( other instanceof Register8BitMainClass ){
			Processor.Code.addOpCode( `sbc ${ this.Name },${ other.Name }` );
		}
		else if( other === undefined ){
			if( Processor.Parameters.Options.Strict){
				Processor.Log.Compiler.Error(`*a.sbc()* is not a valid OpCode in *Strict* mode`);
			}
			else{
				Processor.Code.addOpCode( `sbc ${ this.Name },${ this.Name }` );
			}
		}
		else if( isByte(other) ){
			Processor.Code.addOpCode( `sbc ${ this.Name },_`, other );
		}
		else if( other instanceof PointerByte ){
			Processor.Code.addOpCode( `sbc ${ this.Name },_`, other );
		}
		else{
			throw Error(`The given value cannot be subtracted from 8-Bit Register ${ this.Name }`);
		}
		return this;
	}
	and( other ){
		if( other instanceof Register8BitMainClass ){
			Processor.Code.addOpCode( `and ${ this.Name },${ other.Name }` );
		}
		else if( other === undefined ){
			if( Processor.Parameters.Options.Strict){
				Processor.Log.Compiler.Error(`*a.and()* is not a valid OpCode in *Strict* mode`);
			}
			else{
				Processor.Code.addOpCode( `and ${ this.Name },${ this.Name }` );
			}
		}
		else if( isByte(other) ){
			Processor.Code.addOpCode( `and ${ this.Name },_`, other );
		}
		else if( other instanceof PointerByte ){
			Processor.Code.addOpCode( `and ${ this.Name },_`, other );
		}
		else{
			throw Error(`The given value cannot be ANDed with 8-Bit Register ${ this.Name }`);
		}
		return this;
	}
	or( other ){
		if( other instanceof Register8BitMainClass ){
			Processor.Code.addOpCode( `or ${ this.Name },${ other.Name }` );
		}
		else if( other === undefined ){
			if( Processor.Parameters.Options.Strict){
				Processor.Log.Compiler.Error(`*a.or()* is not a valid OpCode in *Strict* mode`);
			}
			else{
				Processor.Code.addOpCode( `or ${ this.Name },${ this.Name }` );
			}
		}
		else if( isByte(other) ){
			Processor.Code.addOpCode( `or ${ this.Name },_`, other );
		}
		else if( other instanceof PointerByte ){
			Processor.Code.addOpCode( `or ${ this.Name },_`, other );
		}
		else{
			throw Error(`The given value cannot be ORed with 8-Bit Register ${ this.Name }`);
		}
		return this;
	}
	xor( other ){
		if( other instanceof Register8BitMainClass ){
			Processor.Code.addOpCode( `xor ${ this.Name },${ other.Name }` );
		}
		else if( other === undefined ){
			if( Processor.Parameters.Options.Strict){
				Processor.Log.Compiler.Error(`*a.xor()* is not a valid OpCode in *Strict* mode`);
			}
			else{
				Processor.Code.addOpCode( `xor ${ this.Name },${ this.Name }` );
			}
		}
		else if( isByte(other) ){
			Processor.Code.addOpCode( `xor ${ this.Name },_`, other );
		}
		else if( other instanceof PointerByte ){
			Processor.Code.addOpCode( `xor ${ this.Name },_`, other );
		}
		else{
			throw Error(`The given value cannot be XORed with 8-Bit Register ${ this.Name }`);
		}
		return this;
	}
	cp( other ){
		if( other instanceof Register8BitMainClass ){
			Processor.Code.addOpCode( `cp ${ this.Name },${ other.Name }` );
		}
		else if( other === undefined ){
			if( Processor.Parameters.Options.Strict){
				Processor.Log.Compiler.Error(`*a.cp()* is not a valid OpCode in *Strict* mode`);
			}
			else{
				Processor.Code.addOpCode( `cp ${ this.Name },${ this.Name }` );
			}
		}
		else if( isByte(other) ){
			Processor.Code.addOpCode( `cp ${ this.Name },_`, other );
		}
		else if( other instanceof PointerByte ){
			Processor.Code.addOpCode( `cp ${ this.Name },_`, other );
		}
		else{
			throw Error(`The given value cannot be CPed with 8-Bit Register ${ this.Name }`);
		}
		return this;
	}
	da(){
		Processor.Code.addOpCode( `da${ this.Name }` );
		return this;
	}
	cpl(){
		Processor.Code.addOpCode( `cpl a` );
		return this;
	}
	rlc(){
		Processor.Code.addOpCode( `rlc${ this.Name }` );
		return this;
	}
	rl(){
		Processor.Code.addOpCode( `rl${ this.Name }` );
		return this;
	}
	rrc(){
		Processor.Code.addOpCode( `rrc${ this.Name }` );
		return this;
	}
	rr(){
		Processor.Code.addOpCode( `rr${ this.Name }` );
		return this;
	}
	rlcCB(){
		return super.rlc();
	}
	rlCB(){
		return super.rl();
	}
	rrcCB(){
		return super.rrc();
	}
	rrCB(){
		return super.rr();
	}
}

class Register16BitBaseClass extends RegisterClass {
	constructor( name, hi = null, lo = null, $ = null ){
		super( name );
		this.hi = hi;
		this.lo = lo;
		this.$ = $;
	}
}

class Register16BitMainClass extends Register16BitBaseClass {
	ld( other ){
		if( isWord(other) ){
			Processor.Code.addOpCode( `ld ${this.Name},@`, other );
		}
		else if( other instanceof Pointer ){
			Processor.Code.addOpCode( `ld ${this.Name},@`, other.LittleEndian );
		}
		else if( other instanceof PointerAddress ){
			Processor.Code.addOpCode( `ld ${this.Name},@`, other );
		}
		else if( other instanceof PointerByte ){
			Processor.Code.addOpCode( `ld ${this.Name},@`, [0, other] );
		}
		else if( other instanceof Addressable ){
			Processor.Code.addOpCode( `ld ${this.Name},@`, other );
		}
		else if( other instanceof Surrogate ){
			Processor.Code.addOpCode( `ld ${this.Name},@`, other );
		}
		else{
			throw Error( `The given value cannot be loaded into 16 Bit Register ${ this.Name }: ${other}` );
		}
		return this;
	}
	inc(){
		Processor.Code.addOpCode( `inc ${ this.Name }` );
		return this;
	}
	dec(){
		Processor.Code.addOpCode( `dec ${ this.Name }` );
		return this;
	}
}

// For bc, de
class Register16BitPairClass extends Register16BitMainClass {
	ld(other){
		if(other instanceof Register16BitPairClass){
			if( Processor.Parameters.Options.Strict){
				Processor.Log.Compiler.Error(`*${this.Name}.ld(${other.Name})* is not a valid OpCode in *Strict* mode`);
			}
			else{
				this.hi.ld(other.hi);
				this.lo.ld(other.lo);
			}
		}
		else{
			return super.ld(other);
		}
	}
	push(){
		Processor.Code.addOpCode( `push ${ this.Name }` );
		return this;
	}
	pop(){
		Processor.Code.addOpCode( `pop ${ this.Name }` );
		return this;
	}
}

// For hl
class Register16BitHLClass extends Register16BitPairClass {
	constructor( ...args ){
		super( 'hl', ...args );
	}
	ld( other ){
		if( other instanceof Register16BitSPOffsetClass ){
			Processor.Code.addOpCode( `ld ${ this.Name },${ other.Name }`, other.Offset )
		}
		else{
			super.ld( other );
		}
		return this;
	}
	ldi( other ){
		if( other === a ){
			Processor.Code.addOpCode( `ldi ${this.Name},${other.Name}` );
		}
		else{
			Processor.Log.Compiler.Error(`The given value cannot be with the *ldi* instruction`);
		}
		return this;
	}
	ldd( other ){
		if( other === a ){
			Processor.Code.addOpCode( `ldd ${this.Name},${other.Name}` );
		}
		else{
			Processor.Log.Compiler.Error(`The given value cannot be with the *ldd* instruction`);
		}
		return this;
	}
	add( other ){
		if( other instanceof Register16BitMainClass ){
			Processor.Code.addOpCode( `add ${ this.Name },${ other.Name }` );
		}
		else{
			throw Error( `The given value cannot be added to 16 Bit Register ${ this.Name }` );
		}
		return this;
	}
	jp(){
		Processor.Code.addOpCode( `jp ${ this.Name }` );
		return this;
	}
}

class Register16BitStackPointerClass extends Register16BitMainClass {
	constructor( ...args ){
		super( 'sp', ...args );
	}
	ld( other ){
		if( other === hl ){
			Processor.Code.addOpCode( `ld ${ this.Name },${ other.Name }` );
		}
		else{
			super.ld( other );
		}
		return this;
	}
	add( other ){
		if( isByte(other) ){
			Processor.Code.addOpCode( `add ${ this.Name },_`, other );
		}
		else if( other instanceof PointerByte ){
			Processor.Code.addOpCode( `add ${ this.Name },_`, other );
		}
		else{
			throw Error( `The given value cannot be added to 16 Bit Register ${ this.Name }` );
		}
		return this;
	}
	plus( other ){
		if( isByte(other) ){
			return new Register16BitSPOffsetClass( other )
		}
		else{
			throw Error( `The given value is not a valid offset to ${ this.Name }` );
		}
	}
}

class Register16BitSimpleClass extends Register16BitBaseClass {}

class Register16BitAFClass extends Register16BitSimpleClass {
	constructor( ...args ){
		super( 'af', ...args );
	}
	push(){
		Processor.Code.addOpCode( `push ${ this.Name }` );
		return this;
	}
	pop(){
		Processor.Code.addOpCode( `pop ${ this.Name }` );
		return this;
	}
}

class Register16BitSPOffsetClass extends Register16BitSimpleClass {
	constructor( Offset, ...args ){
		if( SPOffsetInstances.has(Offset) ){
			return SPOffsetInstances.get(Offset);
		}
		super( 'sp+_', ...args );
		this.Offset = Offset;
		SPOffsetInstances.set(Offset, this);
	}
}

/*
Interrupt
*/
class InterruptClass {
	disable(){
		Processor.Code.addOpCode( 'di' );
		return this;
	}
	enable(){
		Processor.Code.addOpCode( 'ei' );
		return this;
	}
	ret(){
		Processor.Code.addOpCode( 'reti' );
		return this;
	}
}

let	a = new Register8BitAClass(),
	f = new Register8BitFClass(),
	b = new Register8BitMainClass( 'b' ),
	c = new Register8BitMainClass( 'c' ),
	d = new Register8BitMainClass( 'd' ),
	e = new Register8BitMainClass( 'e' ),
	h = new Register8BitMainClass( 'h' ),
	l = new Register8BitMainClass( 'l' ),
	$hl = new Register8BitAtHLClass(),
	$bc = new Register8BitSimpleClass( '$bc' ),
	$de = new Register8BitSimpleClass( '$de' ),
	$ffc = new Register8BitSimpleClass( '$ff+c' ),
	$ff_plus = function( other ){
		if( other === c ){
			return $ffc;
		}
		else if( isByte(other) ){
			return new Register8BitAtFFOffsetClass( other )
		}
		else{
			throw Error( `The given value is not a valid offset to $ff+_` );
		}
	},
	$ff = new class RegisterFFPlus extends RegisterClass{
		plus(other){
			return $ff_plus(other);
		}
	},
	sp = new Register16BitStackPointerClass(),
	af = new Register16BitAFClass( a, f ),
	bc = new Register16BitPairClass( 'bc', b, c, $bc ),
	de = new Register16BitPairClass( 'de', d, e, $de ),
	hl = new Register16BitHLClass( h, l, $hl );
		
module.exports = {
	setProcessor(processor){
		Processor = processor;
	},
	Registers : { a, f, b, c, d, e, h, l, sp, af, bc, de, hl, $hl, $bc, $de, $ff },
	Interrupt : new InterruptClass(),
	Register8BitMainClass, Register16BitPairClass
}