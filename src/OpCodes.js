let { IndeterminateJump } = require('./Directives');

class OpCodeCallbackWrapper {
	constructor(code, size, data, isExit = false){
		this.code = code;
		this.size = size;
		this.data = data;
		this.isExit = isExit;
	}
}

let rstOpCodes = {
		0x00 : 0xC7,
		0x08 : 0xCF,
		0X10 : 0XD7,
		0x18 : 0xDF,
		0X20 : 0XE7,
		0x28 : 0xEF,
		0X30 : 0XF7,
		0x38 : 0xFF,
	},
	RstWrapperMap = new Map();

class RstWrapper extends OpCodeCallbackWrapper{
	constructor(code){
		// RstWrappers dont need to be unique
		if( RstWrapperMap.has(code) ) return RstWrapperMap.get(code);
		super(code, 1, [0]);

		this.callback = ptr => {
			if( !ptr ) return data[0] = 0;
			let opcode = rstOpCodes[ ptr.Address ];
			//TODO - proper error with BANK:ADDRESS and code.Name...
			if( !opcode ) throw Error(`Not a valid RST address: ${ptr.Address}`)
			this.data[0] = opcode;
		}
		RstWrapperMap.set(code,this);
	}
	getCallback(){
		return this.callback;
	}
}

let JrOpCodes = {
	'' : 0x18,
	'nz' : 0x20,
	'z' : 0x28,
	'nc' : 0x30,
	'c' : 0x38
}

class JrWrapper extends OpCodeCallbackWrapper{
	constructor(code, cond){
		super(code, 2, [JrOpCodes[cond], 0], !cond);
	}
	getCallback(bank, address){
		let addr = address+2;

		return ptr => {
			if( !ptr ) return this.data[1] = 0;
			let diff = ptr.Address - addr;
			if( diff >= 0x80 || diff < -0x80 ) throw Error(`Invalid JR Size: ${diff.toString(16)}`)
			
			//TODO - warning
			if( bank !== ptr.Bank && !bank && !ptr.Bank ) throw Error();

			if( diff < 0 ) diff += 0x100;
			this.data[1] = diff;
		};
	}
}

class OpCodeWrapper {
	constructor(opcode, data = []){
		this.opcode = opcode;
		this.data = data;
	}
}

class OpCode {
	constructor( code, name, size, isExit = false ){
		this.code = code;
		this.name = name;
		this.size = size;
		this.isExit = isExit;
		OpCodes[name] = this;
	}
}

class EmptyOpCode extends OpCode {
	constructor( code, name, size, isExit ){
		super( code, name, size, isExit );
		this.wrapper = new OpCodeWrapper(this);
	}
	compile(){
		return this.wrapper;
	}
}

class SingleOpCode extends EmptyOpCode {
	constructor( code, name, isExit ){
		super( code, name, 1, isExit );
	}
}

class PrefixOpCode extends EmptyOpCode {
	constructor( code, name, isExit ){
		super( [0xCB, code], name, 2, isExit );
	}
	compile(){
		return this.wrapper;
	}
}

class ByteOpCode extends OpCode {
	constructor( prefix, name, isExit ){
		super( prefix, name, 2, isExit );
	}
	compile(data){
		if( typeof data === 'number' ){
			if(data < 0) data += 0x100;
		}
		return new OpCodeWrapper(this, data);
	}
}

class WordOpCode extends OpCode {
	constructor( prefix, name, isExit ){
		super( prefix, name, 3, isExit );
	}
	compile(data){
		if( typeof data === 'number' ){
			if(data < 0) data += 0x10000;
			data = [data % 0x100, Math.floor( data / 0x100 )];
		}
		return new OpCodeWrapper(this, data);
	}
}

let OpCodes = {
	Jump( ptr ){
		return new IndeterminateJump( ptr );
	},
	rst( code ){
		return new RstWrapper( code );
	},
	jr( code, cond ){
		return new JrWrapper(code, cond);
	}
}

new SingleOpCode( 0x00 , 'nop');
new WordOpCode( 0x01 , 'ld bc,@');
new SingleOpCode( 0x02 , 'ld $bc,a');
new SingleOpCode( 0x03 , 'inc bc');
new SingleOpCode( 0x04 , 'inc b');
new SingleOpCode( 0x05 , 'dec b');
new ByteOpCode( 0x06 , 'ld b,_');
new SingleOpCode( 0x07 , 'rlca');
new WordOpCode( 0x08 , 'ld @,sp');
new SingleOpCode( 0x09 , 'add hl,bc');
new SingleOpCode( 0x0A , 'ld a,$bc');
new SingleOpCode( 0x0B , 'dec bc');
new SingleOpCode( 0x0C , 'inc c');
new SingleOpCode( 0x0D , 'dec c');
new ByteOpCode( 0x0E , 'ld c,_');
new SingleOpCode( 0x0F , 'rrca');
new SingleOpCode( 0x10 , 'stop');
new WordOpCode( 0x11 , 'ld de,@');
new SingleOpCode( 0x12 , 'ld $de,a');
new SingleOpCode( 0x13 , 'inc de');
new SingleOpCode( 0x14 , 'inc d');
new SingleOpCode( 0x15 , 'dec d');
new ByteOpCode( 0x16 , 'ld d,_');
new SingleOpCode( 0x17 , 'rla');
new ByteOpCode( 0x18 , 'jr _', true);
new SingleOpCode( 0x19 , 'add hl,de');
new SingleOpCode( 0x1A , 'ld a,$de');
new SingleOpCode( 0x1B , 'dec de');
new SingleOpCode( 0x1C , 'inc e');
new SingleOpCode( 0x1D , 'dec e');
new ByteOpCode( 0x1E , 'ld e,_');
new SingleOpCode( 0x1F , 'rra');
new ByteOpCode( 0x20 , 'jr nz,_');
new WordOpCode( 0x21 , 'ld hl,@');
new SingleOpCode( 0x22 , 'ldi hl,a');
new SingleOpCode( 0x23 , 'inc hl');
new SingleOpCode( 0x24 , 'inc h');
new SingleOpCode( 0x25 , 'dec h');
new ByteOpCode( 0x26 , 'ld h,_');
new SingleOpCode( 0x27 , 'daa');
new ByteOpCode( 0x28 , 'jr z,_');
new SingleOpCode( 0x29 , 'add hl,hl');
new SingleOpCode( 0x2A , 'ldi a,hl');
new SingleOpCode( 0x2B , 'dec hl');
new SingleOpCode( 0x2C , 'inc l');
new SingleOpCode( 0x2D , 'dec l');
new ByteOpCode( 0x2E , 'ld l,_');
new SingleOpCode( 0x2F , 'cpl a');
new ByteOpCode( 0x30 , 'jr nc,_');
new WordOpCode( 0x31 , 'ld sp,@');
new SingleOpCode( 0x32 , 'ldd hl,a');
new SingleOpCode( 0x33 , 'inc sp');
new SingleOpCode( 0x34 , 'inc $hl');
new SingleOpCode( 0x35 , 'dec $hl');
new ByteOpCode( 0x36 , 'ld $hl,_');
new SingleOpCode( 0x37 , 'scf');
new ByteOpCode( 0x38 , 'jr c,_');
new SingleOpCode( 0x39 , 'add hl,sp');
new SingleOpCode( 0x3A , 'ldd a,hl');
new SingleOpCode( 0x3B , 'dec sp');
new SingleOpCode( 0x3C , 'inc a');
new SingleOpCode( 0x3D , 'dec a');
new ByteOpCode( 0x3E , 'ld a,_');
new SingleOpCode( 0x3F , 'ccf');
new SingleOpCode( 0x40 , 'ld b,b');
new SingleOpCode( 0x41 , 'ld b,c');
new SingleOpCode( 0x42 , 'ld b,d');
new SingleOpCode( 0x43 , 'ld b,e');
new SingleOpCode( 0x44 , 'ld b,h');
new SingleOpCode( 0x45 , 'ld b,l');
new SingleOpCode( 0x46 , 'ld b,$hl');
new SingleOpCode( 0x47 , 'ld b,a');
new SingleOpCode( 0x48 , 'ld c,b');
new SingleOpCode( 0x49 , 'ld c,c');
new SingleOpCode( 0x4A , 'ld c,d');
new SingleOpCode( 0x4B , 'ld c,e');
new SingleOpCode( 0x4C , 'ld c,h');
new SingleOpCode( 0x4D , 'ld c,l');
new SingleOpCode( 0x4E , 'ld c,$hl');
new SingleOpCode( 0x4F , 'ld c,a');
new SingleOpCode( 0x50 , 'ld d,b');
new SingleOpCode( 0x51 , 'ld d,c');
new SingleOpCode( 0x52 , 'ld d,d');
new SingleOpCode( 0x53 , 'ld d,e');
new SingleOpCode( 0x54 , 'ld d,h');
new SingleOpCode( 0x55 , 'ld d,l');
new SingleOpCode( 0x56 , 'ld d,$hl');
new SingleOpCode( 0x57 , 'ld d,a');
new SingleOpCode( 0x58 , 'ld e,b');
new SingleOpCode( 0x59 , 'ld e,c');
new SingleOpCode( 0x5A , 'ld e,d');
new SingleOpCode( 0x5B , 'ld e,e');
new SingleOpCode( 0x5C , 'ld e,h');
new SingleOpCode( 0x5D , 'ld e,l');
new SingleOpCode( 0x5E , 'ld e,$hl');
new SingleOpCode( 0x5F , 'ld e,a');
new SingleOpCode( 0x60 , 'ld h,b');
new SingleOpCode( 0x61 , 'ld h,c');
new SingleOpCode( 0x62 , 'ld h,d');
new SingleOpCode( 0x63 , 'ld h,e');
new SingleOpCode( 0x64 , 'ld h,h');
new SingleOpCode( 0x65 , 'ld h,l');
new SingleOpCode( 0x66 , 'ld h,$hl');
new SingleOpCode( 0x67 , 'ld h,a');
new SingleOpCode( 0x68 , 'ld l,b');
new SingleOpCode( 0x69 , 'ld l,c');
new SingleOpCode( 0x6A , 'ld l,d');
new SingleOpCode( 0x6B , 'ld l,e');
new SingleOpCode( 0x6C , 'ld l,h');
new SingleOpCode( 0x6D , 'ld l,l');
new SingleOpCode( 0x6E , 'ld l,$hl');
new SingleOpCode( 0x6F , 'ld l,a');
new SingleOpCode( 0x70 , 'ld $hl,b');
new SingleOpCode( 0x71 , 'ld $hl,c');
new SingleOpCode( 0x72 , 'ld $hl,d');
new SingleOpCode( 0x73 , 'ld $hl,e');
new SingleOpCode( 0x74 , 'ld $hl,h');
new SingleOpCode( 0x75 , 'ld $hl,l');
new SingleOpCode( 0x76 , 'halt');
new SingleOpCode( 0x77 , 'ld $hl,a');
new SingleOpCode( 0x78 , 'ld a,b');
new SingleOpCode( 0x79 , 'ld a,c');
new SingleOpCode( 0x7A , 'ld a,d');
new SingleOpCode( 0x7B , 'ld a,e');
new SingleOpCode( 0x7C , 'ld a,h');
new SingleOpCode( 0x7D , 'ld a,l');
new SingleOpCode( 0x7E , 'ld a,$hl');
new SingleOpCode( 0x7F , 'ld a,a');
new SingleOpCode( 0x80 , 'add a,b');
new SingleOpCode( 0x81 , 'add a,c');
new SingleOpCode( 0x82 , 'add a,d');
new SingleOpCode( 0x83 , 'add a,e');
new SingleOpCode( 0x84 , 'add a,h');
new SingleOpCode( 0x85 , 'add a,l');
new SingleOpCode( 0x86 , 'add a,$hl');
new SingleOpCode( 0x87 , 'add a,a');
new SingleOpCode( 0x88 , 'adc a,b');
new SingleOpCode( 0x89 , 'adc a,c');
new SingleOpCode( 0x8A , 'adc a,d');
new SingleOpCode( 0x8B , 'adc a,e');
new SingleOpCode( 0x8C , 'adc a,h');
new SingleOpCode( 0x8D , 'adc a,l');
new SingleOpCode( 0x8E , 'adc a,$hl');
new SingleOpCode( 0x8F , 'adc a,a');
new SingleOpCode( 0x90 , 'sub a,b');
new SingleOpCode( 0x91 , 'sub a,c');
new SingleOpCode( 0x92 , 'sub a,d');
new SingleOpCode( 0x93 , 'sub a,e');
new SingleOpCode( 0x94 , 'sub a,h');
new SingleOpCode( 0x95 , 'sub a,l');
new SingleOpCode( 0x96 , 'sub a,$hl');
new SingleOpCode( 0x97 , 'sub a,a');
new SingleOpCode( 0x98 , 'sbc a,b');
new SingleOpCode( 0x99 , 'sbc a,c');
new SingleOpCode( 0x9A , 'sbc a,d');
new SingleOpCode( 0x9B , 'sbc a,e');
new SingleOpCode( 0x9C , 'sbc a,h');
new SingleOpCode( 0x9D , 'sbc a,l');
new SingleOpCode( 0x9E , 'sbc a,$hl');
new SingleOpCode( 0x9F , 'sbc a,a');
new SingleOpCode( 0xA0 , 'and a,b');
new SingleOpCode( 0xA1 , 'and a,c');
new SingleOpCode( 0xA2 , 'and a,d');
new SingleOpCode( 0xA3 , 'and a,e');
new SingleOpCode( 0xA4 , 'and a,h');
new SingleOpCode( 0xA5 , 'and a,l');
new SingleOpCode( 0xA6 , 'and a,$hl');
new SingleOpCode( 0xA7 , 'and a,a');
new SingleOpCode( 0xA8 , 'xor a,b');
new SingleOpCode( 0xA9 , 'xor a,c');
new SingleOpCode( 0xAA , 'xor a,d');
new SingleOpCode( 0xAB , 'xor a,e');
new SingleOpCode( 0xAC , 'xor a,h');
new SingleOpCode( 0xAD , 'xor a,l');
new SingleOpCode( 0xAE , 'xor a,$hl');
new SingleOpCode( 0xAF , 'xor a,a');
new SingleOpCode( 0xB0 , 'or a,b');
new SingleOpCode( 0xB1 , 'or a,c');
new SingleOpCode( 0xB2 , 'or a,d');
new SingleOpCode( 0xB3 , 'or a,e');
new SingleOpCode( 0xB4 , 'or a,h');
new SingleOpCode( 0xB5 , 'or a,l');
new SingleOpCode( 0xB6 , 'or a,$hl');
new SingleOpCode( 0xB7 , 'or a,a');
new SingleOpCode( 0xB8 , 'cp a,b');
new SingleOpCode( 0xB9 , 'cp a,c');
new SingleOpCode( 0xBA , 'cp a,d');
new SingleOpCode( 0xBB , 'cp a,e');
new SingleOpCode( 0xBC , 'cp a,h');
new SingleOpCode( 0xBD , 'cp a,l');
new SingleOpCode( 0xBE , 'cp a,$hl');
new SingleOpCode( 0xBF , 'cp a,a');
new SingleOpCode( 0xC0 , 'ret nz');
new SingleOpCode( 0xC1 , 'pop bc');
new WordOpCode( 0xC2 , 'jp nz,@');
new WordOpCode( 0xC3 , 'jp @', true);
new WordOpCode( 0xC4 , 'call nz,@');
new SingleOpCode( 0xC5 , 'push bc');
new ByteOpCode( 0xC6 , 'add a,_');
new SingleOpCode( 0xC7 , 'rst 0');
new SingleOpCode( 0xC8 , 'ret z');
new SingleOpCode( 0xC9 , 'ret', true);
new WordOpCode( 0xCA , 'jp z,@');
new PrefixOpCode( 0x00, 'rlc b');
new PrefixOpCode( 0x01, 'rlc c');
new PrefixOpCode( 0x02, 'rlc d');
new PrefixOpCode( 0x03, 'rlc e');
new PrefixOpCode( 0x04, 'rlc h');
new PrefixOpCode( 0x05, 'rlc l');
new PrefixOpCode( 0x06, 'rlc $hl');
new PrefixOpCode( 0x07, 'rlc a'); //repeat
new PrefixOpCode( 0x08, 'rrc b');
new PrefixOpCode( 0x09, 'rrc c');
new PrefixOpCode( 0x0A, 'rrc d');
new PrefixOpCode( 0x0B, 'rrc e');
new PrefixOpCode( 0x0C, 'rrc h');
new PrefixOpCode( 0x0D, 'rrc l');
new PrefixOpCode( 0x0E, 'rrc $hl');
new PrefixOpCode( 0x0F, 'rrc a');	//repeat
new PrefixOpCode( 0x10, 'rl b');
new PrefixOpCode( 0x11, 'rl c');
new PrefixOpCode( 0x12, 'rl d');
new PrefixOpCode( 0x13, 'rl e');
new PrefixOpCode( 0x14, 'rl h');
new PrefixOpCode( 0x15, 'rl l');
new PrefixOpCode( 0x16, 'rl $hl');
new PrefixOpCode( 0x17, 'rl a'); //repeat
new PrefixOpCode( 0x18, 'rr b');
new PrefixOpCode( 0x19, 'rr c');
new PrefixOpCode( 0x1A, 'rr d');
new PrefixOpCode( 0x1B, 'rr e');
new PrefixOpCode( 0x1C, 'rr h');
new PrefixOpCode( 0x1D, 'rr l');
new PrefixOpCode( 0x1E, 'rr $hl');
new PrefixOpCode( 0x1F, 'rr a'); //repeat
new PrefixOpCode( 0x20, 'sla b');
new PrefixOpCode( 0x21, 'sla c');
new PrefixOpCode( 0x22, 'sla d');
new PrefixOpCode( 0x23, 'sla e');
new PrefixOpCode( 0x24, 'sla h');
new PrefixOpCode( 0x25, 'sla l');
new PrefixOpCode( 0x26, 'sla $hl');
new PrefixOpCode( 0x27, 'sla a');
new PrefixOpCode( 0x28, 'sra b');
new PrefixOpCode( 0x29, 'sra c');
new PrefixOpCode( 0x2A, 'sra d');
new PrefixOpCode( 0x2B, 'sra e');
new PrefixOpCode( 0x2C, 'sra h');
new PrefixOpCode( 0x2D, 'sra l');
new PrefixOpCode( 0x2E, 'sra $hl');
new PrefixOpCode( 0x2F, 'sra a');
new PrefixOpCode( 0x30, 'swap b');
new PrefixOpCode( 0x31, 'swap c');
new PrefixOpCode( 0x32, 'swap d');
new PrefixOpCode( 0x33, 'swap e');
new PrefixOpCode( 0x34, 'swap h');
new PrefixOpCode( 0x35, 'swap l');
new PrefixOpCode( 0x36, 'swap $hl');
new PrefixOpCode( 0x37, 'swap a');
new PrefixOpCode( 0x38, 'srl b');
new PrefixOpCode( 0x39, 'srl c');
new PrefixOpCode( 0x3A, 'srl d');
new PrefixOpCode( 0x3B, 'srl e');
new PrefixOpCode( 0x3C, 'srl h');
new PrefixOpCode( 0x3D, 'srl l');
new PrefixOpCode( 0x3E, 'srl $hl');
new PrefixOpCode( 0x3F, 'srl a');
new PrefixOpCode( 0x40, 'bit 0,b');
new PrefixOpCode( 0x41, 'bit 0,c');
new PrefixOpCode( 0x42, 'bit 0,d');
new PrefixOpCode( 0x43, 'bit 0,e');
new PrefixOpCode( 0x44, 'bit 0,h');
new PrefixOpCode( 0x45, 'bit 0,l');
new PrefixOpCode( 0x46, 'bit 0,$hl');
new PrefixOpCode( 0x47, 'bit 0,a');
new PrefixOpCode( 0x48, 'bit 1,b');
new PrefixOpCode( 0x49, 'bit 1,c');
new PrefixOpCode( 0x4A, 'bit 1,d');
new PrefixOpCode( 0x4B, 'bit 1,e');
new PrefixOpCode( 0x4C, 'bit 1,h');
new PrefixOpCode( 0x4D, 'bit 1,l');
new PrefixOpCode( 0x4E, 'bit 1,$hl');
new PrefixOpCode( 0x4F, 'bit 1,a');
new PrefixOpCode( 0x50, 'bit 2,b');
new PrefixOpCode( 0x51, 'bit 2,c');
new PrefixOpCode( 0x52, 'bit 2,d');
new PrefixOpCode( 0x53, 'bit 2,e');
new PrefixOpCode( 0x54, 'bit 2,h');
new PrefixOpCode( 0x55, 'bit 2,l');
new PrefixOpCode( 0x56, 'bit 2,$hl');
new PrefixOpCode( 0x57, 'bit 2,a');
new PrefixOpCode( 0x58, 'bit 3,b');
new PrefixOpCode( 0x59, 'bit 3,c');
new PrefixOpCode( 0x5A, 'bit 3,d');
new PrefixOpCode( 0x5B, 'bit 3,e');
new PrefixOpCode( 0x5C, 'bit 3,h');
new PrefixOpCode( 0x5D, 'bit 3,l');
new PrefixOpCode( 0x5E, 'bit 3,$hl');
new PrefixOpCode( 0x5F, 'bit 3,a');
new PrefixOpCode( 0x60, 'bit 4,b');
new PrefixOpCode( 0x61, 'bit 4,c');
new PrefixOpCode( 0x62, 'bit 4,d');
new PrefixOpCode( 0x63, 'bit 4,e');
new PrefixOpCode( 0x64, 'bit 4,h');
new PrefixOpCode( 0x65, 'bit 4,l');
new PrefixOpCode( 0x66, 'bit 4,$hl');
new PrefixOpCode( 0x67, 'bit 4,a');
new PrefixOpCode( 0x68, 'bit 5,b');
new PrefixOpCode( 0x69, 'bit 5,c');
new PrefixOpCode( 0x6A, 'bit 5,d');
new PrefixOpCode( 0x6B, 'bit 5,e');
new PrefixOpCode( 0x6C, 'bit 5,h');
new PrefixOpCode( 0x6D, 'bit 5,l');
new PrefixOpCode( 0x6E, 'bit 5,$hl');
new PrefixOpCode( 0x6F, 'bit 5,a');
new PrefixOpCode( 0x70, 'bit 6,b');
new PrefixOpCode( 0x71, 'bit 6,c');
new PrefixOpCode( 0x72, 'bit 6,d');
new PrefixOpCode( 0x73, 'bit 6,e');
new PrefixOpCode( 0x74, 'bit 6,h');
new PrefixOpCode( 0x75, 'bit 6,l');
new PrefixOpCode( 0x76, 'bit 6,$hl');
new PrefixOpCode( 0x77, 'bit 6,a');
new PrefixOpCode( 0x78, 'bit 7,b');
new PrefixOpCode( 0x79, 'bit 7,c');
new PrefixOpCode( 0x7A, 'bit 7,d');
new PrefixOpCode( 0x7B, 'bit 7,e');
new PrefixOpCode( 0x7C, 'bit 7,h');
new PrefixOpCode( 0x7D, 'bit 7,l');
new PrefixOpCode( 0x7E, 'bit 7,$hl');
new PrefixOpCode( 0x7F, 'bit 7,a');
new PrefixOpCode( 0x80, 'res 0,b');
new PrefixOpCode( 0x81, 'res 0,c');
new PrefixOpCode( 0x82, 'res 0,d');
new PrefixOpCode( 0x83, 'res 0,e');
new PrefixOpCode( 0x84, 'res 0,h');
new PrefixOpCode( 0x85, 'res 0,l');
new PrefixOpCode( 0x86, 'res 0,$hl');
new PrefixOpCode( 0x87, 'res 0,a');
new PrefixOpCode( 0x88, 'res 1,b');
new PrefixOpCode( 0x89, 'res 1,c');
new PrefixOpCode( 0x8A, 'res 1,d');
new PrefixOpCode( 0x8B, 'res 1,e');
new PrefixOpCode( 0x8C, 'res 1,h');
new PrefixOpCode( 0x8D, 'res 1,l');
new PrefixOpCode( 0x8E, 'res 1,$hl');
new PrefixOpCode( 0x8F, 'res 1,a');
new PrefixOpCode( 0x90, 'res 2,b');
new PrefixOpCode( 0x91, 'res 2,c');
new PrefixOpCode( 0x92, 'res 2,d');
new PrefixOpCode( 0x93, 'res 2,e');
new PrefixOpCode( 0x94, 'res 2,h');
new PrefixOpCode( 0x95, 'res 2,l');
new PrefixOpCode( 0x96, 'res 2,$hl');
new PrefixOpCode( 0x97, 'res 2,a');
new PrefixOpCode( 0x98, 'res 3,b');
new PrefixOpCode( 0x99, 'res 3,c');
new PrefixOpCode( 0x9A, 'res 3,d');
new PrefixOpCode( 0x9B, 'res 3,e');
new PrefixOpCode( 0x9C, 'res 3,h');
new PrefixOpCode( 0x9D, 'res 3,l');
new PrefixOpCode( 0x9E, 'res 3,$hl');
new PrefixOpCode( 0x9F, 'res 3,a');
new PrefixOpCode( 0xA0, 'res 4,b');
new PrefixOpCode( 0xA1, 'res 4,c');
new PrefixOpCode( 0xA2, 'res 4,d');
new PrefixOpCode( 0xA3, 'res 4,e');
new PrefixOpCode( 0xA4, 'res 4,h');
new PrefixOpCode( 0xA5, 'res 4,l');
new PrefixOpCode( 0xA6, 'res 4,$hl');
new PrefixOpCode( 0xA7, 'res 4,a');
new PrefixOpCode( 0xA8, 'res 5,b');
new PrefixOpCode( 0xA9, 'res 5,c');
new PrefixOpCode( 0xAA, 'res 5,d');
new PrefixOpCode( 0xAB, 'res 5,e');
new PrefixOpCode( 0xAC, 'res 5,h');
new PrefixOpCode( 0xAD, 'res 5,l');
new PrefixOpCode( 0xAE, 'res 5,$hl');
new PrefixOpCode( 0xAF, 'res 5,a');
new PrefixOpCode( 0xB0, 'res 6,b');
new PrefixOpCode( 0xB1, 'res 6,c');
new PrefixOpCode( 0xB2, 'res 6,d');
new PrefixOpCode( 0xB3, 'res 6,e');
new PrefixOpCode( 0xB4, 'res 6,h');
new PrefixOpCode( 0xB5, 'res 6,l');
new PrefixOpCode( 0xB6, 'res 6,$hl');
new PrefixOpCode( 0xB7, 'res 6,a');
new PrefixOpCode( 0xB8, 'res 7,b');
new PrefixOpCode( 0xB9, 'res 7,c');
new PrefixOpCode( 0xBA, 'res 7,d');
new PrefixOpCode( 0xBB, 'res 7,e');
new PrefixOpCode( 0xBC, 'res 7,h');
new PrefixOpCode( 0xBD, 'res 7,l');
new PrefixOpCode( 0xBE, 'res 7,$hl');
new PrefixOpCode( 0xBF, 'res 7,a');	
new PrefixOpCode( 0xC0, 'set 0,b');
new PrefixOpCode( 0xC1, 'set 0,c');
new PrefixOpCode( 0xC2, 'set 0,d');
new PrefixOpCode( 0xC3, 'set 0,e');
new PrefixOpCode( 0xC4, 'set 0,h');
new PrefixOpCode( 0xC5, 'set 0,l');
new PrefixOpCode( 0xC6, 'set 0,$hl');
new PrefixOpCode( 0xC7, 'set 0,a');
new PrefixOpCode( 0xC8, 'set 1,b');
new PrefixOpCode( 0xC9, 'set 1,c');
new PrefixOpCode( 0xCA, 'set 1,d');
new PrefixOpCode( 0xCB, 'set 1,e');
new PrefixOpCode( 0xCC, 'set 1,h');
new PrefixOpCode( 0xCD, 'set 1,l');
new PrefixOpCode( 0xCE, 'set 1,$hl');
new PrefixOpCode( 0xCF, 'set 1,a');
new PrefixOpCode( 0xD0, 'set 2,b');
new PrefixOpCode( 0xD1, 'set 2,c');
new PrefixOpCode( 0xD2, 'set 2,d');
new PrefixOpCode( 0xD3, 'set 2,e');
new PrefixOpCode( 0xD4, 'set 2,h');
new PrefixOpCode( 0xD5, 'set 2,l');
new PrefixOpCode( 0xD6, 'set 2,$hl');
new PrefixOpCode( 0xD7, 'set 2,a');
new PrefixOpCode( 0xD8, 'set 3,b');
new PrefixOpCode( 0xD9, 'set 3,c');
new PrefixOpCode( 0xDA, 'set 3,d');
new PrefixOpCode( 0xDB, 'set 3,e');
new PrefixOpCode( 0xDC, 'set 3,h');
new PrefixOpCode( 0xDD, 'set 3,l');
new PrefixOpCode( 0xDE, 'set 3,$hl');
new PrefixOpCode( 0xDF, 'set 3,a');
new PrefixOpCode( 0xE0, 'set 4,b');
new PrefixOpCode( 0xE1, 'set 4,c');
new PrefixOpCode( 0xE2, 'set 4,d');
new PrefixOpCode( 0xE3, 'set 4,e');
new PrefixOpCode( 0xE4, 'set 4,h');
new PrefixOpCode( 0xE5, 'set 4,l');
new PrefixOpCode( 0xE6, 'set 4,$hl');
new PrefixOpCode( 0xE7, 'set 4,a');
new PrefixOpCode( 0xE8, 'set 5,b');
new PrefixOpCode( 0xE9, 'set 5,c');
new PrefixOpCode( 0xEA, 'set 5,d');
new PrefixOpCode( 0xEB, 'set 5,e');
new PrefixOpCode( 0xEC, 'set 5,h');
new PrefixOpCode( 0xED, 'set 5,l');
new PrefixOpCode( 0xEE, 'set 5,$hl');
new PrefixOpCode( 0xEF, 'set 5,a');
new PrefixOpCode( 0xF0, 'set 6,b');
new PrefixOpCode( 0xF1, 'set 6,c');
new PrefixOpCode( 0xF2, 'set 6,d');
new PrefixOpCode( 0xF3, 'set 6,e');
new PrefixOpCode( 0xF4, 'set 6,h');
new PrefixOpCode( 0xF5, 'set 6,l');
new PrefixOpCode( 0xF6, 'set 6,$hl');
new PrefixOpCode( 0xF7, 'set 6,a');
new PrefixOpCode( 0xF8, 'set 7,b');
new PrefixOpCode( 0xF9, 'set 7,c');
new PrefixOpCode( 0xFA, 'set 7,d');
new PrefixOpCode( 0xFB, 'set 7,e');
new PrefixOpCode( 0xFC, 'set 7,h');
new PrefixOpCode( 0xFD, 'set 7,l');
new PrefixOpCode( 0xFE, 'set 7,$hl');
new PrefixOpCode( 0xFF, 'set 7,a');
new WordOpCode( 0xCC , 'call z,@');
new WordOpCode( 0xCD , 'call @');
new ByteOpCode( 0xCE , 'adc a,_');
new SingleOpCode( 0xCF , 'rst 8');
new SingleOpCode( 0xD0 , 'ret nc');
new SingleOpCode( 0xD1 , 'pop de');
new WordOpCode( 0xD2 , 'jp nc,@');
new WordOpCode( 0xD4 , 'call nc,@');
new SingleOpCode( 0xD5 , 'push de');
new ByteOpCode( 0xD6 , 'sub a,_');
new SingleOpCode( 0xD7 , 'rst 10');
new SingleOpCode( 0xD8 , 'ret c');
new SingleOpCode( 0xD9 , 'reti');
new WordOpCode( 0xDA , 'jp c,@');
new WordOpCode( 0xDC , 'call c,@');
new ByteOpCode( 0xDE , 'sbc a,_');
new SingleOpCode( 0xDF , 'rst 18');
new ByteOpCode( 0xE0 , 'ld $ff+_,a');
new SingleOpCode( 0xE1 , 'pop hl');
new SingleOpCode( 0xE2 , 'ld $ff+c,a');
new SingleOpCode( 0xE5 , 'push hl');
new ByteOpCode( 0xE6 , 'and a,_');
new SingleOpCode( 0xE7 , 'rst 20');
new ByteOpCode( 0xE8 , 'add sp,_');
new SingleOpCode( 0xE9 , 'jp hl');
new WordOpCode( 0xEA , 'ld @,a');
new ByteOpCode( 0xEE , 'xor a,_');
new SingleOpCode( 0xEF , 'rst 28');
new ByteOpCode( 0xF0 , 'ld a,$ff+_');
new SingleOpCode( 0xF1 , 'pop af');
new SingleOpCode( 0xF2 , 'ld a,$ff+c');
new SingleOpCode( 0xF3 , 'di');
new SingleOpCode( 0xF5 , 'push af');
new ByteOpCode( 0xF6 , 'or a,_');
new SingleOpCode( 0xF7 , 'rst 30');
new ByteOpCode( 0xF8 , 'ld hl,sp+_');
new SingleOpCode( 0xF9 , 'ld sp,hl');
new WordOpCode( 0xFA , 'ld a,@');
new SingleOpCode( 0xFB , 'ei');
new ByteOpCode( 0xFE , 'cp a,_');
new SingleOpCode( 0xFF , 'rst 38');

module.exports = { OpCodes, OpCodeWrapper, OpCodeCallbackWrapper };