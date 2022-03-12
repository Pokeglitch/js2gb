class Parameters {
	constructor(processor){
        this.Processor = processor;

		this.Suppress = {
            Logs : false,
			Tips: false,
			Warnings : false,
			Errors : false
        };

        this.CharMap = {};

        this.Options = {
            Strict : true,
            BigEndian : true,
            Global : true
        };

        this.Source = {
            RAM : null,
            ROM : null
        };

		this.Base = {
			ROM : null,
			SYM : null
        };

		this.Output = {
			ROM : null,
			SYM : null
        };
    }
    parse(input){
		// Validate the input
		input = this.validateDict('<Cartridge> input', input);

		this.validateSuppress(input.Suppress);

        if( input.hasOwnProperty('CharMap') ){
            this.validateCharMap(input.CharMap);
        }

		let {Source, Output, Options, Base, Header, Structure} = this.validateSubDicts(input, 'Options', 'Header','Base', 'Output', 'Structure', 'Source');
        
        this.validateOption('Strict', Options.Strict);
        this.validateOption('BigEndian', Options.BigEndian);


        this.validateSource('RAM', Source.RAM, false);
        this.validateSource('ROM', Source.ROM, true);

        this.validateOutput('ROM', Output.ROM);
        this.validateOutput('SYM', Output.SYM);

        this.validateBase('ROM', Base.ROM);
        this.validateBase('SYM', Base.SYM);

        // Use in external methods
        this.Structure = Structure;
        this.Header = Header;

        this.Processor.Log.Compiler.Log('...Done Parsing Input Parameters');
    }

    logParsingParameters(){
        this.Processor.Log.Compiler.Log('Parsing Input Parameters...');
    }

    validateBoolean(name, val, def){
        if(val === undefined){
            this.Processor.Log.Compiler.Warning(`_${name}_ value is not defined. Defaulting to \`${def}\``)
            return def;
        }
        if(typeof val !== 'boolean'){
            this.Processor.Log.Compiler.Suppressable(`_${name}_ must be a <bool>`, `Defaulting to \`${def}\``);
            return def;
        }
        return val
    }

    validateString(name, val){
        if(typeof val === 'string'){
            if(val === ''){
                this.Processor.Log.Compiler.Error(`_${name}_ cannot be an empty <string>`);
            }
        }
        else if(val !== undefined){
            this.Processor.Log.Compiler.Error(`_${name}_ must be a <string>`);
        }
    }
    
    validateDict(name, value){
        if( value === undefined ){
            this.Processor.Log.Compiler.Warning(`${name} value not defined. Defaulting to an empty <dict>`);
            return {};
        }
        if(!value || value.constructor !== Object){
            this.Processor.Log.Compiler.Error(`${name} value must be a <dict>`,'Defaulting to an empty <dict>');
            return {};
        }
        return Object.assign({},value);
    }
    
    validateSubDicts(input, ...keys){
        let output = {};
        keys.forEach( key => {
            output[key] = this.validateDict(`_${key}_`, input[key]);
        });
        return output;
    }

    validateSuppressValue(name, suppress){
        let val = suppress[name];
        if(val === undefined){
            this.Processor.Log.Compiler.Warning(`_Suppress.${name}_ value is not defined. Defaulting to \`false\``);
            return;
        }
        if(typeof val !== 'boolean'){
            this.Processor.Log.Compiler.Suppressable(`_Suppress.${name}_ value must be a <bool>`, `Defaulting to \`false\``);
            return;
        }
        if(val === false){
            this.Processor.Log.Compiler.Tip(`_Suppress.${name} value of \`false\` is the default value`);
        }
    }

	validateSuppress(suppress){
		if( typeof suppress == 'boolean' ){
			this.Suppress.Logs = this.Suppress.Tips = this.Suppress.Warnings = this.Suppress.Errors = suppress;
			if( suppress === false){
                this.logParsingParameters();
				this.Processor.Log.Compiler.Tip('_Suppress_ value of `false` is the default value');
			}
		}
		else if(suppress && suppress.constructor == Object){
			if( suppress.Logs === true ){
				this.Suppress.Logs = true;
            }
            else{
                this.logParsingParameters();
            }
			if( suppress.Tips === true ){
				this.Suppress.Tips = true;
			}
			if( suppress.Warnings === true ){
				this.Suppress.Warnings = true;
			}
			if( suppress.Errors === true ){
				this.Suppress.Errors = true;
			}
			this.validateSuppressValue('Logs', suppress);
			this.validateSuppressValue('Tips', suppress);
			this.validateSuppressValue('Warnings', suppress);
			this.validateSuppressValue('Errors', suppress);
		}
		else {
            this.logParsingParameters();
            if(suppress === undefined){
                this.Processor.Log.Compiler.Warning('_Suppress_ value is not defined. Defaulting to \'false\'');
            }
            else{
                this.Processor.Log.Compiler.Suppressable('_Suppress_ value must be a <bool|dict>')
            }
        }
    }

    validateCharMap(charmap){
        if( typeof charmap === "string" ){
            this.validateString(charmap);
        }
        else if(!charmap || charmap.constructor !== Object){
            this.Processor.Log.Compiler.Error(`_CharMap_ value must be a <str|dict>`);
        }
        this.CharMap = charmap;
    }

	validateSource(name, path, required){
		this.validateString(name, path);
		if(!path){
            if(required){
                this.Processor.Log.Compiler.Error(`_Source.${name}_ path must be provided`);
            }
            return;
		}
        this.Source[name] = path;
    }

	validateOutput(name, path){
		this.validateString(`Output.${name}`, path);
		if(path){
			this.Output[name] = path;
		}
    }
    
    validateOption(name, value){
        this.Options[name] = this.validateBoolean( `Options.${name}`, value, this.Options[name] );
    }

    validateBase(name, path){
		this.validateString(`Base.${name}`, path);
		if(path){
			this.Base[name] = path;
		}
    }
};

module.exports = Parameters;