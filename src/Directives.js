class Directive {
	constructor(Memory, name){
		this.Memory = Memory;

		if( this.Memory.Processor.inRoutine() ){
			this.Memory.Processor.Log.Compiler.Error(`A <${name}> cannot be executed inside a <Routine>`);
		}

		this.Memory.Allocator.ActiveSection.push(this);
	}
}

class NumericalDirective extends Directive {
	constructor(Memory, name, value){
		super(Memory, name);

		if(typeof value !== 'number' || !Number.isInteger(value) || value < 0){
			this.Memory.Processor.Log.Compiler.Error(`A <${name}> input must be an <+int>`);
		}
	}
}

class GotoDirective extends NumericalDirective {
	constructor(Memory, address){
		super(Memory, 'Goto', address);

		if(this.Memory.Name === "ROM"){
			if(address > 0x7FFF){
				this.Memory.Processor.Log.Compiler.Error(`<Goto> input must be less than 0x8000`);
			}
		}
		else{
			if(address < 0x8000){
				this.Memory.Processor.Log.Compiler.Error(`<Goto> input must be greater than 0x7FFF`);
			}
		}

		this.Address = address;
	}
}

// todo - allow negative values if RAM...
class SkipDirective extends NumericalDirective {
	constructor(Memory, offset){
		super(Memory, 'Skip', offset);

		if(offset === 0){
			this.Memory.Processor.Log.Compiler.Warning(`<Skip> input is 0`);
		}

		this.Offset = offset;
	}
}

class UnionDirective extends Directive {
	constructor(Memory){
		super(Memory, 'Union');
		this.Location = null;
		this.End = new UnionEndDirective(this.Memory, this)
	}
	setLocation(location){
		this.Location = location;
	}
}

class UnionEndDirective extends Directive {
	constructor(Memory, union){
		super(Memory, 'Union');
		this.Location = null;
		this.Union = union
	}
	setLocation(location){
		if( !this.Location ){
			this.Location = location;
		}
		else if( this.Location.Bank < location.Bank ){
			this.Location = location;
		}
		else if( this.Location.Bank == location.Bank && this.Location.Address < location.Address ){
			this.Location = location;
		}
	}
}

class IndeterminateOpCode {
	constructor( ptr, cond = null ){
		this.Pointer = ptr;
		this.Condition = cond;
	}
}

class IndeterminateJump extends IndeterminateOpCode {};
class IndeterminateCall extends IndeterminateOpCode {};

module.exports = {
	GotoDirective, SkipDirective,
	UnionDirective, UnionEndDirective,
	Directive,
	IndeterminateJump, IndeterminateCall
};