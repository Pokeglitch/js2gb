function base16(x, len){
    let str = x.toString(16).toUpperCase();
    while(str.length < len) str = '0' + str;
    return str;
}

module.exports = { base16 };