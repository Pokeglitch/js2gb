# js2gb

A Javascript based Gameboy Z80 compiler

---

# Notes

*NOTATION:*
  * <bool> - A boolean value (`true` or `false`)
  * <int> - Any whole number
    * <+int> - Positive integer values only (not including `0`)
    * <!-int> - Non-negatives integer values only (including `0`)
  * <byte> - <int> in range: `[-255 , 255]`
  * <char> - Single string character where corresponding `charCode` is a valid <byte>
  * <ascii> - <char> or the corresponding <byte> with value in range: `[0, 127]`
    * <ascii(x)>- <string|array> of maximum length `x` with each element being an <ascii>
  * <dict> - A simple <Object> with key/value pairs

---

# Instructions

First, import into your module:

`let js2gb = require('js2gb');`

The <js2gb> class will compile the ROM.

`let rom = new js2gb(<inputs>);`

*Inputs*

The inputs are arranged as an <dict> with the following properties:

  * *Source* <dict> - Source locations
    * *ROM* <string> - The path to the ROM source
    * *RAM* <string> - The path to the RAM source
  * *Header* <dict> - The values to populate the Cartridge Header (see Header section for specifics)
  * *CharMap* <dict> - The map of <char|string> to a <!-int>
    * Can also be <string> as the path to a CharMap JSON file
  * *Structure* <dict> - The structure of the cartridge
    * *ROM* <array|dict> -  The order in which the ROM is compiled
      * If <array>, the elements must be <routine|data|directive>
      * If <dict>, the key must be a bank index, and the value must be a <array> of <routine|data|directive>
      * If <undefined>, the ROM will be compiled in the order of which each <routine|data|directives> is defined
  * *Output* <dict> - Output locations
    * *ROM* <string> - The path to write the compiled ROM file
    * *SYM* <string> - The path to write the compiled symbols (symfile)
  * *Base* <dict> - Used for new disassemblies
    * *ROM* <string> - The path to the base ROM file
      * All compiled bytes will be compared to the base ROM
      * All undefined bytes will be pulled from the base ROM (instead of filling with `0x00`)
    * *SYM* <string> - The path to the symbols (symfile)
      * Used to refer to <routine|data> which have not been disassembled yet
  * *Options* <dict> - Compilation options
    * *Strict* <bool> | `true` - Whether built in OpCode macros should be permitted
      * When not in *Strict* mode, additional opcode inputs will be permitted
      * See *Opcodes* page for more details
    * *BigEndian* <bool> | `true` - Whether Numbers/Points should be output in big-endian order vs little-endian order.
    * *Global* <bool> | `true` - Whether RAM and ROM identifiers should be globally accessible
  * *Suppress* - Whether or not to suppress Tips/Warnings/Errors
      * <bool> | `false` - To designate the same value to all Tips/Warnings/Errors
      * <dict> - To designate separate values for each:
          * *Tips* <bool> - Whether or not to suppress Tips
          * *Warnings* <bool> - Whether or not to suppress Warnings
          * *Errors* <bool> - Whether or not to suppress Errors, wherever possible

*Outputs*

The output is a <js2gb> instance with the following properties:
  * *Binary* <array> - The compiled ROM as a <byte> <array>
  * *Symbols* <array> - Contains all identnfiers for each ROM address

If *Output* is defined in the above input arguments, it will also write the Binary and Symbols to the specified files

---

# Header

_NOTES:_
  * All <byte> inputs are the explicit values that are written directly to the header
  * If no _default_ is listed, then the default is `0x00` (or an array of `0x00`s)

The following are properties to the <js2gb> input *Header* <dict>:

  * *Title* <ascii(16)> - The Title of the cartridge
    * If the length > 15, it will conflict with the *ColorByte* byte
    * If the length > 11, it will conflict the *Manufacturer* bytes
  * *Manufacturer* <ascii(4)> - The Manufacturer of the cartridge
  * *OriginalGB* <bool> | `true` - Whether or not the cartridge supports the Original Gameboy
  * *ColorGB* <bool> | `false` - Whether or not the cartridge supports the Color Gameboy
  * *ColorByte* <byte> - The explicit byte value to represent the color compatability
    * Can be used instead of *OriginalGB* and *ColorGB*
  * *NewLicensee* <ascii(2)> - The company/publisher of the cartridge (used in newer releases)
  * *SuperGB* <bool|byte> | `false` - Whether or not the cartridge supports the Super Gameboy
  * *Type* <byte> - The MBC & external hardware the cartride uses
  * *ROMBanks* <+int> | `2` - The number of ROM banks in the cartridge
    * Value must be one of: `[2, 4, 8, 16, 32, 64, 72, 80, 96, 128, 256, 512]`
  * *ROMByte* <byte> - The explicit byte value to represent the number of ROM banks
    * Can be used instead of *ROMBanks*
  * *RAMBanks* <!-int> | `0` - The number of RAM banks in the cartridge
    * Value must be one of: `[0, .25, 1, 4, 16, 8]`
  * *RAMByte* <byte> - The explicit byte value to represent the number of RAM banks
    * Can be used instead of *RAMBanks*
  * *ForJapan* <bool|byte> | `true` - Whether or not the cartridge is made for Japan
  * *OldLicensee* <byte> - The company/publisher of the cartridge (used in older releases)
    * _default:_ `0x33` if *SuperGB* is `true` or *NewLicensee* is provided, otherwise `0x00`
  * *Version* <byte> - The version of the cartridge

---

# Environment Context

During compilation, the *Source* *RAM* and *ROM* files will be executed in a special environment context, with the following globally accessible members:

  * *require(id)* - To import node modules
    * id <string> - Module name or path
  * *log(message)* - To log a message to the console
    * message <string> - Message to be logged
  * *json(path)* - To import a JSON file
    * path <string> - Path to file
  * *include(path)* - To execute another source file
    * path <string> - Path to file
  * *Skip(size)* - To shift the current position by the given amount
    * size <+int> - Amount of bytes to skip
  * *Goto(...)* - To change the current position to a new location
    * Goto(<string>) - To go to a section with the given name
      * Named sections must be explicitly allocated using the *Section* method (below) or through the *Structure.ROM* input argument
    * Goto(<bank>, <address>) - To go to a given address at the given bank
  * *Section(name)* - To allocate the given section to the current section
    * name <string> - Name of the section to be allocated

In addition to the above, *RAM* and *ROM* environments have unique context members:

*RAM*
  * *def(...)* - To define *RAM* identifiers
    * def(<dict>) - The *key* represents the idenitifier, while the *value* must be one of:
      * <!-int> - <byte> size of the data
        * If the size is more than 1, each <byte> will be accessible by its index via dot or bracket notation
      * <array> - To assign index based child members to this identifier.  Each *value* in the array must be one of <!-int>, <array>, <dict>, <Flags>
      * <dict> - To assign name based child members this idenfitier. The *key* represents the member name and the *value* must be one of <!-int>, <array>, <dict>, <Flags>
        * Each child member will be accessible by its name via dot or bracket notation
      * <Flags> - To set this argument as a single <byte> with named bits (see *Flags* definition below)
    * def(<dict>,<dict>,...) - A union can be defined by passing multiple <dict> to the *def* function.  All <dict> will have the same starting address.  The address after the *def* is executed will be based on the largest <dict> defined
  * *Flags(...)* - To defined names for specific bits
    * *Flags(<array>)* - The index corresponds to the indentifiers bit, and the *value* must be a <string> defining the name of the bit
      * The bit will be accessible by its name via dot or bracket notation
    * *Flags(<dict>)* - The *key* represents the name of the bit, and the value represents the index.
      * The bit will be accessible by its name via dot or bracket notation

*ROM*
  * *def(...)* - To define a <Routine> or <Data>
    * *def(<function>)* - To define a <Routine> if in the Top Level, otherwise to define a <Block>
    * *def(<dict>)* - To define multiple <Routine> or <Data> sequentially. The *key* represents the name, and the *value* can be a <function> to define a <Routine>, or <array|dict> to define a <Data>
    * *def(<array>)* - To define the contents of the <Data>
  * *$(name)* - To get an identifier by name
    * name <string> - The name of the idenfitier
      * The name can also access child members via dot notation
    * This is necessary to reference *ROM* identifiers for Top Level <Data> definitions
    * It is also necessary to reference child members of <Routine> or <Data> before they are defined
    * ":End" can be placed at the end of the name to get the <Pointer> to the end of the <Data>
  * *Data( (name, )content)* - To define a <Data> and write to the *ROM*
    * name <string> - An optional name for the <Data> for external reference
    * content <array> - To define the content of the <Data> to write to the *ROM*, where each element in the array is <byte|array|dict>
      * Each child member can be accessed by its index via dot or bracket notation
    * content <dict> - To define the content of the <Data> to write to the *ROM*, where each *key* is the name of the child member and each *value* is <byte|array|dict>
      * Each child member can be accessed by its name via dot or bracket notation
  * *Routine( (name,) (macro, ) code)* - To define a <Routine>
    * name <string> - An optional name for the <Routine> for external reference
    * macro <function> - An optional macro to handle input arguments when this <Routine> is called
    * code <function> - The function containing the opcodes to be compiled to the *ROM*
  * *Block( (name,) code)* - To create a block of code within a <Routine>
    * name <string> - An optional name for the block for external reference
    * code <function> - The function containing the opcodes to be compiled to the <Routine>
  * *self* - To refer to the current <Routine> or <Block>
    * This is necessary for a <macro> to refer to the current <Routine>/<Block>
  * *a, f, b, c, d, e, h, l* - The 8 bit registers
    * TODO (see *Hardware.js* for now)
  * *af, bc, de, hl* - The 16 bit registers
    * TODO (see *Hardware.js* for now)
  * *$bc, $de, $hl* - The <Data> at the location specified by address stored in the 16 bit registers
    * TODO (see *Hardware.js* for now)
  * *sp* - The stack pointer
    * TODO (see *Hardware.js* for now)
  * $ff* - To refer to a specific HRAM address
    * TODO (see *Hardware.js* for now)
  * *Interrupt* - The interrupt abstracted as a class
    * *Interrupt.disable()* - The *di* opcode 
    * *Interrupt.enable()* - The *ei* opcode 
    * *Interrupt.ret()* - The *reti* opcode 
  * *nop()* - The *nop* opcode
  * *halt()* - The *halt* opcode
  * *stop()* - The *stop* opcode
  * *ret()* - The *ret* opcode
    * *ret.c()* - The *ret c* opcode
    * *ret.nc()* - The *ret nc* opcode
    * *ret.z()* - The *ret z* opcode
    * *ret.nz()* - The *ret nz* opcode

_NOTES:_
  * The same context is used for all source files, so all globally named variables will be accessible in all files
  * If *Options.Global* input agument is `true`:
    * All *RAM* identifiers will be accessible at the top-level of the *ROM* code
    * All top-level *ROM* identifiers will be accessible at the *Routine* level code

  * Specific bits of *ROM* and *RAM* <Data> idenfitiers can be accessed through parenthesis notation, where the argument is the index of the bit

<Routine> have the following properties (in addition to the defined child members):
  * *Pointer* - The <Pointer> to the start of this <Data>
  * *call( (...) )* - To create the opcode to call this <Routine>
    * Optional input arguments will be passed to the <Routine> macros
    * *call.c(...)*
    * *call.nc(...)*
    * *call.z(...)*
    * *call.nz(...)*
  * *jp( (...) )* - To create the opcode to jump to this <Routine>
    * Optional input arguments will be passed to the <Routine> macros
    * *jp.c(...)*
    * *jp.nc(...)*
    * *jp.z(...)*
    * *jp.nz(...)*
  * *jr( (...) )* - To create the opcode to relative jump to this <Routine>
    * Optional input arguments will be passed to the <Routine> macros
    * An error will be thrown if this <Routine> is out of range from when this *.jr* is called
    * *jr.c(...)*
    * *jr.nc(...)*
    * *jr.z(...)*
    * *jr.nz(...)*
  * *rst(...) - To create an *rst* opcode to call this <Routine>
    * Optional input arguments will be passed to the <Routine> macros
    * An error will be thrown if this <Routine> is not placed at an *rst* address


*ROM* <Data> have the following properties (in addition to the defined child members):
  * *Pointer* - The <Pointer> to the start of this <Data>
  * *Parent* - The parent <Data> or <null>
  * *Size* - The <byte> size of this <Data>. If it is an <array> or <dict>, it will include the size of all of its children
  * *Length* - The number of children of this <Data>
  * Specific bits of can be accessed through parenthesis notation, where the argument is the index of the bit

*RAM* <Data> have the above properties, as well as:
  * *ld(...)*, *load(...)* - To load data into this *RAM* location
    * TODO
  
<Pointers> have the following properties:
  * *Reference* - The corresponding <Routine>, <Block>, or *RAM/ROM* <Data> instance
  * *BigEndian* - The address as a 2 <byte> array in *BigEndian* format
  * *LittleEndian* - The address as a 2 <byte> array in *LittleEndian* format
  * *[0]* - The low <byte> of the address, where the endianness comes from the input *Options.BigEndian*
  * *[1]* - The high <byte> of the address, where the endianness comes from the input *Options.BigEndian*
  * *Bank* - The bank this <Pointer> is allocated to

---


I tried to keep the code as clean and straightforward as possible, undoubtedly at the cost of efficiency.

Once some projects start being build around this, efficiency will become a higher priority

There are no unit tests at this time.

Since it is being built alongside the pokeredjs decompilation, that is used for testing and can be used for code reference