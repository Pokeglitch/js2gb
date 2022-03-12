let { base16 } = require('./Helpers');

function format(str, normalCode){
	let newStr = str.replace(/(\<[^>]*\>)|\*([^*]*)\*|\`([^`]*)\`|\_([^_]*)\_|HEX\(([0-9]*)\)|INDEX\(([0-9]*)\)|ADDR\(([0-9]*), *([0-9]*)\)/g,function(orig,type,opcode,code,prop,hex,index,bankStr,addrStr){
		let out, bank, addr;
		if(type){
			out = `\x1b[34m${type}`;
		}
		if(opcode){
			out = `\x1b[44m\x1b[37m ${opcode} `;
		}
		if(prop){
			out = `\x1b[97m${prop}`;
		}
		if(hex){
			code = '0x' + base16( Number(hex) );
		}
		if(code){
			out = `\x1b[100m\x1b[95m ${code} `;
		}
		if(index){
			let num = Number(index);
			
			bank = Math.floor(num/0x4000),
			addr = num % 0x4000;
			if(bank){
				addr += 0x4000;
			}
		}
		if( bankStr ){
			bank = parseInt(bankStr);
			addr = parseInt(addrStr);
		}
		if(bank !== undefined){
			out = `\x1b[36m${base16(bank, 2)}:${base16(addr, 4)}`;
		}
		return out + `\x1b[0m${normalCode}`;
	});
	return `\x1b[0m ${normalCode}${newStr}\x1b[0m`;
}

class Log {
	constructor( type, color, processor ){
		this.type = type;
		this.color = color;
		this.Processor = processor;
	}
	Log( str, dontSuppress ){
		if( dontSuppress || !this.Processor.Parameters.Suppress.Logs ){
			console.log(`\x1b[${ this.color }m ${ this.type } \x1b[47m\x1b[30m   LOG   ${format(str, '\x1b[37m')}`);
		}
	}
	Tip( str ){
		if( !this.Processor.Parameters.Suppress.Tips ){
			console.log(`\x1b[${ this.color }m ${ this.type } \x1b[102m\x1b[30m   TIP   ${format(str, '\x1b[32m')}`);
		}
	}
	Warning( str ){
		if( !this.Processor.Parameters.Suppress.Warnings ){
			console.log(`\x1b[${ this.color }m ${ this.type } \x1b[43m\x1b[30m WARNING ${format(str, '\x1b[33m')}`);
		}
	}
	getErrorLog(str){
		return `\x1b[${ this.color }m ${ this.type } \x1b[41m\x1b[37m  ERROR  ${format(str, '\x1b[31m')}`
	}
	Error( str ){
		let errorLog = this.getErrorLog(str);
		console.log(errorLog)
		throw Error(errorLog);
	}
	Suppressable( str1, str2 = '' ){
		if( this.Processor.Parameters.Suppress.Errors ){
			console.log(this.getErrorLog(str1));
			console.log(`                   \x1b[47m\x1b[31m SUPPRESSED ${format(str2, '\x1b[37m')}`);
		}
		else{
			this.Error(str1);
		}
	}
};

class Logger {
	constructor(processor){
		this.Header = new Log(' HEADER ', 35, processor);
		this.Compiler = new Log('COMPILER', 36, processor);
		this.User = new Log('  USER  ', 37, processor);
	}
}

module.exports = Logger;