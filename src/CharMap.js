function escapeRegex(string) {
    return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

class CharMap {
    constructor(processor){
        this.Processor = processor;
        this.Map = {};
        this.RegexStr = "";

        this.import();
    }
    // TODO - permit Array?
    import(){
        let charmap = this.Processor.Parameters.CharMap;

        if( typeof charmap === 'string' ){
            let source = this.Processor.readFile('CharMap', charmap, 'utf8');

            try{
                charmap = JSON.parse(source);
            }
            catch(e){
                this.Processor.Log.Compiler.Error(`Unable to parse '${charmap}' into JSON data`);
            }
        }
        
        if( !charmap || charmap.constructor !== Object ){
            this.Processor.Log.Compiler.Error(`_CharMap_ data must be a <dict>`);
        }

        // Sort from longest to shortest so longer 'chars' will match first
        let charList = Object.keys(charmap).sort((a,b) => b.length - a.length);
        
        // Validate the charmap values
        charList.forEach(char => {
            let value = charmap[char];

            // TODO - permit an array of integers?
            if( value < 0 || !Number.isInteger(value) ){
                this.Processor.Log.Compiler.Error(`_CharMap_ value for '${char}' must be a <!-int>`);
            }

            this.Map[char] = value;
        });

        this.RegexStr = charList.map(escapeRegex).join("|");

    }
    convert(str){
        let regex = RegExp(this.RegexStr, "g"),
            result = [],
            match = str.matchAll(regex),
            success = false,
            i = 0;

        while(true){
            let next = match.next();

            if(next.done){
                if(i === str.length){
                    success = true;
                }
                break;
            }
            else if(next.value.index !== i){
                break;
            }

            let value = next.value[0];
            
            result.push(this.Map[value]);
            
            i += value.length;
        }

        if( !success ){
            this.Processor.Log.Compiler.Error(`Unable to convert '${str}' into chars`);
        }

        return result;
    }
}

module.exports = CharMap;