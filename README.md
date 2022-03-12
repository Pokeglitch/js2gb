# js2gb

A Javascript based Gameboy ASM compiler

---

# Notes

*NOTATION:*
  * &lt;bool&gt; - A boolean value (`true` or `false`)
  * &lt;int&gt; - Any whole number
    * &lt;+int&gt; - Positive integer values only (not including `0`)
    * &lt;!-int&gt; - Non-negatives integer values only (including `0`)
  * &lt;byte&gt; - &lt;int&gt; in range: `[-255 , 255]`
  * &lt;char&gt; - Single string character where corresponding `charCode` is a valid &lt;byte&gt;
  * &lt;ascii&gt; - &lt;char&gt; or the corresponding &lt;byte&gt; with value in range: `[0, 127]`
    * &lt;ascii(x)&gt;- &lt;string|array&gt; of maximum length `x` with each element being an &lt;ascii&gt;
  * &lt;dict&gt; - A simple &lt;Object&gt; with key/value pairs

---

# Instructions

First, import into your module:

`let js2gb = require('js2gb');`

The &lt;js2gb&gt; class will compile the ROM.

`let rom = new js2gb(&lt;inputs&gt;);`

*Inputs*

The inputs are arranged as an &lt;dict&gt; with the following properties:

  * *Source* &lt;dict&gt; - Source locations
    * *ROM* &lt;string&gt; - The path to the ROM source
    * *RAM* &lt;string&gt; - The path to the RAM source
  * *Header* &lt;dict&gt; - The values to populate the Cartridge Header (see Header section for specifics)
  * *CharMap* &lt;dict&gt; - The map of &lt;char|string&gt; to a &lt;!-int&gt;
    * Can also be &lt;string&gt; as the path to a CharMap JSON file
  * *Structure* &lt;dict&gt; - The structure of the cartridge
    * *ROM* &lt;array|dict&gt; -  The order in which the ROM is compiled
      * If &lt;array&gt;, the elements must be &lt;routine|data|directive&gt;
      * If &lt;dict&gt;, the key must be a bank index, and the value must be a &lt;array&gt; of &lt;routine|data|directive&gt;
      * If &lt;undefined&gt;, the ROM will be compiled in the order of which each &lt;routine|data|directives&gt; is defined
  * *Output* &lt;dict&gt; - Output locations
    * *ROM* &lt;string&gt; - The path to write the compiled ROM file
    * *SYM* &lt;string&gt; - The path to write the compiled symbols (symfile)
  * *Base* &lt;dict&gt; - Used for new disassemblies
    * *ROM* &lt;string&gt; - The path to the base ROM file
      * All compiled bytes will be compared to the base ROM
      * All undefined bytes will be pulled from the base ROM (instead of filling with `0x00`)
    * *SYM* &lt;string&gt; - The path to the symbols (symfile)
      * Used to refer to &lt;routine|data&gt; which have not been disassembled yet
  * *Options* &lt;dict&gt; - Compilation options
    * *Strict* &lt;bool&gt; | `true` - Whether built in OpCode macros should be permitted
      * When not in *Strict* mode, additional opcode inputs will be permitted
      * See *Opcodes* page for more details
    * *BigEndian* &lt;bool&gt; | `true` - Whether Numbers/Points should be output in big-endian order vs little-endian order.
    * *Global* &lt;bool&gt; | `true` - Whether RAM and ROM identifiers should be globally accessible
  * *Suppress* - Whether or not to suppress Tips/Warnings/Errors
      * &lt;bool&gt; | `false` - To designate the same value to all Tips/Warnings/Errors
      * &lt;dict&gt; - To designate separate values for each:
          * *Tips* &lt;bool&gt; - Whether or not to suppress Tips
          * *Warnings* &lt;bool&gt; - Whether or not to suppress Warnings
          * *Errors* &lt;bool&gt; - Whether or not to suppress Errors, wherever possible

*Outputs*

The output is a &lt;js2gb&gt; instance with the following properties:
  * *Binary* &lt;array&gt; - The compiled ROM as a &lt;byte&gt; &lt;array&gt;
  * *Symbols* &lt;array&gt; - Contains all identnfiers for each ROM address

If *Output* is defined in the above input arguments, it will also write the Binary and Symbols to the specified files

---

# Header

_NOTES:_
  * All &lt;byte&gt; inputs are the explicit values that are written directly to the header
  * If no _default_ is listed, then the default is `0x00` (or an array of `0x00`s)

The following are properties to the &lt;js2gb&gt; input *Header* &lt;dict&gt;:

  * *Title* &lt;ascii(16)&gt; - The Title of the cartridge
    * If the length &gt; 15, it will conflict with the *ColorByte* byte
    * If the length &gt; 11, it will conflict the *Manufacturer* bytes
  * *Manufacturer* &lt;ascii(4)&gt; - The Manufacturer of the cartridge
  * *OriginalGB* &lt;bool&gt; | `true` - Whether or not the cartridge supports the Original Gameboy
  * *ColorGB* &lt;bool&gt; | `false` - Whether or not the cartridge supports the Color Gameboy
  * *ColorByte* &lt;byte&gt; - The explicit byte value to represent the color compatability
    * Can be used instead of *OriginalGB* and *ColorGB*
  * *NewLicensee* &lt;ascii(2)&gt; - The company/publisher of the cartridge (used in newer releases)
  * *SuperGB* &lt;bool|byte&gt; | `false` - Whether or not the cartridge supports the Super Gameboy
  * *Type* &lt;byte&gt; - The MBC & external hardware the cartride uses
  * *ROMBanks* &lt;+int&gt; | `2` - The number of ROM banks in the cartridge
    * Value must be one of: `[2, 4, 8, 16, 32, 64, 72, 80, 96, 128, 256, 512]`
  * *ROMByte* &lt;byte&gt; - The explicit byte value to represent the number of ROM banks
    * Can be used instead of *ROMBanks*
  * *RAMBanks* &lt;!-int&gt; | `0` - The number of RAM banks in the cartridge
    * Value must be one of: `[0, .25, 1, 4, 16, 8]`
  * *RAMByte* &lt;byte&gt; - The explicit byte value to represent the number of RAM banks
    * Can be used instead of *RAMBanks*
  * *ForJapan* &lt;bool|byte&gt; | `true` - Whether or not the cartridge is made for Japan
  * *OldLicensee* &lt;byte&gt; - The company/publisher of the cartridge (used in older releases)
    * _default:_ `0x33` if *SuperGB* is `true` or *NewLicensee* is provided, otherwise `0x00`
  * *Version* &lt;byte&gt; - The version of the cartridge

---

# Environment Context

During compilation, the *Source* *RAM* and *ROM* files will be executed in a special environment context, with the following globally accessible members:

  * *require(id)* - To import node modules
    * id &lt;string&gt; - Module name or path
  * *log(message)* - To log a message to the console
    * message &lt;string&gt; - Message to be logged
  * *json(path)* - To import a JSON file
    * path &lt;string&gt; - Path to file
  * *include(path)* - To execute another source file
    * path &lt;string&gt; - Path to file
  * *Skip(size)* - To shift the current position by the given amount
    * size &lt;+int&gt; - Amount of bytes to skip
  * *Goto(...)* - To change the current position to a new location
    * Goto(&lt;string&gt;) - To go to a section with the given name
      * Named sections must be explicitly allocated using the *Section* method (below) or through the *Structure.ROM* input argument
    * Goto(&lt;bank&gt;, &lt;address&gt;) - To go to a given address at the given bank
  * *Section(name)* - To allocate the given section to the current section
    * name &lt;string&gt; - Name of the section to be allocated

In addition to the above, *RAM* and *ROM* environments have unique context members:

*RAM*
  * *def(...)* - To define *RAM* identifiers
    * def(&lt;dict&gt;) - The *key* represents the idenitifier, while the *value* must be one of:
      * &lt;!-int&gt; - &lt;byte&gt; size of the data
        * If the size is more than 1, each &lt;byte&gt; will be accessible by its index via dot or bracket notation
      * &lt;array&gt; - To assign index based child members to this identifier.  Each *value* in the array must be one of &lt;!-int&gt;, &lt;array&gt;, &lt;dict&gt;, &lt;Flags&gt;
      * &lt;dict&gt; - To assign name based child members this idenfitier. The *key* represents the member name and the *value* must be one of &lt;!-int&gt;, &lt;array&gt;, &lt;dict&gt;, &lt;Flags&gt;
        * Each child member will be accessible by its name via dot or bracket notation
      * &lt;Flags&gt; - To set this argument as a single &lt;byte&gt; with named bits (see *Flags* definition below)
    * def(&lt;dict&gt;,&lt;dict&gt;,...) - A union can be defined by passing multiple &lt;dict&gt; to the *def* function.  All &lt;dict&gt; will have the same starting address.  The address after the *def* is executed will be based on the largest &lt;dict&gt; defined
  * *Flags(...)* - To defined names for specific bits
    * *Flags(&lt;array&gt;)* - The index corresponds to the indentifiers bit, and the *value* must be a &lt;string&gt; defining the name of the bit
      * The bit will be accessible by its name via dot or bracket notation
    * *Flags(&lt;dict&gt;)* - The *key* represents the name of the bit, and the value represents the index.
      * The bit will be accessible by its name via dot or bracket notation

*ROM*
  * *def(...)* - To define a &lt;Routine&gt; or &lt;Data&gt;
    * *def(&lt;function&gt;)* - To define a &lt;Routine&gt; if in the Top Level, otherwise to define a &lt;Block&gt;
    * *def(&lt;dict&gt;)* - To define multiple &lt;Routine&gt; or &lt;Data&gt; sequentially. The *key* represents the name, and the *value* can be a &lt;function&gt; to define a &lt;Routine&gt;, or &lt;array|dict&gt; to define a &lt;Data&gt;
    * *def(&lt;array&gt;)* - To define the contents of the &lt;Data&gt;
  * *$(name)* - To get an identifier by name
    * name &lt;string&gt; - The name of the idenfitier
      * The name can also access child members via dot notation
    * This is necessary to reference *ROM* identifiers for Top Level &lt;Data&gt; definitions
    * It is also necessary to reference child members of &lt;Routine&gt; or &lt;Data&gt; before they are defined
    * ":End" can be placed at the end of the name to get the &lt;Pointer&gt; to the end of the &lt;Data&gt;
  * *Data( (name, )content)* - To define a &lt;Data&gt; and write to the *ROM*
    * name &lt;string&gt; - An optional name for the &lt;Data&gt; for external reference
    * content &lt;array&gt; - To define the content of the &lt;Data&gt; to write to the *ROM*, where each element in the array is &lt;byte|array|dict&gt;
      * Each child member can be accessed by its index via dot or bracket notation
    * content &lt;dict&gt; - To define the content of the &lt;Data&gt; to write to the *ROM*, where each *key* is the name of the child member and each *value* is &lt;byte|array|dict&gt;
      * Each child member can be accessed by its name via dot or bracket notation
  * *Routine( (name,) (macro, ) code)* - To define a &lt;Routine&gt;
    * name &lt;string&gt; - An optional name for the &lt;Routine&gt; for external reference
    * macro &lt;function&gt; - An optional macro to handle input arguments when this &lt;Routine&gt; is called
    * code &lt;function&gt; - The function containing the opcodes to be compiled to the *ROM*
  * *Block( (name,) code)* - To create a block of code within a &lt;Routine&gt;
    * name &lt;string&gt; - An optional name for the block for external reference
    * code &lt;function&gt; - The function containing the opcodes to be compiled to the &lt;Routine&gt;
  * *self* - To refer to the current &lt;Routine&gt; or &lt;Block&gt;
    * This is necessary for a &lt;macro&gt; to refer to the current &lt;Routine&gt;/&lt;Block&gt;
  * *a, f, b, c, d, e, h, l* - The 8 bit registers
    * TODO (see *Hardware.js* for now)
  * *af, bc, de, hl* - The 16 bit registers
    * TODO (see *Hardware.js* for now)
  * *$bc, $de, $hl* - The &lt;Data&gt; at the location specified by address stored in the 16 bit registers
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

  * Specific bits of *ROM* and *RAM* &lt;Data&gt; idenfitiers can be accessed through parenthesis notation, where the argument is the index of the bit

&lt;Routine&gt; have the following properties (in addition to the defined child members):
  * *Pointer* - The &lt;Pointer&gt; to the start of this &lt;Data&gt;
  * *call( (...) )* - To create the opcode to call this &lt;Routine&gt;
    * Optional input arguments will be passed to the &lt;Routine&gt; macros
    * *call.c(...)*
    * *call.nc(...)*
    * *call.z(...)*
    * *call.nz(...)*
  * *jp( (...) )* - To create the opcode to jump to this &lt;Routine&gt;
    * Optional input arguments will be passed to the &lt;Routine&gt; macros
    * *jp.c(...)*
    * *jp.nc(...)*
    * *jp.z(...)*
    * *jp.nz(...)*
  * *jr( (...) )* - To create the opcode to relative jump to this &lt;Routine&gt;
    * Optional input arguments will be passed to the &lt;Routine&gt; macros
    * An error will be thrown if this &lt;Routine&gt; is out of range from when this *.jr* is called
    * *jr.c(...)*
    * *jr.nc(...)*
    * *jr.z(...)*
    * *jr.nz(...)*
  * *rst(...) - To create an *rst* opcode to call this &lt;Routine&gt;
    * Optional input arguments will be passed to the &lt;Routine&gt; macros
    * An error will be thrown if this &lt;Routine&gt; is not placed at an *rst* address


*ROM* &lt;Data&gt; have the following properties (in addition to the defined child members):
  * *Pointer* - The &lt;Pointer&gt; to the start of this &lt;Data&gt;
  * *Parent* - The parent &lt;Data&gt; or &lt;null&gt;
  * *Size* - The &lt;byte&gt; size of this &lt;Data&gt;. If it is an &lt;array&gt; or &lt;dict&gt;, it will include the size of all of its children
  * *Length* - The number of children of this &lt;Data&gt;
  * Specific bits of can be accessed through parenthesis notation, where the argument is the index of the bit

*RAM* &lt;Data&gt; have the above properties, as well as:
  * *ld(...)*, *load(...)* - To load data into this *RAM* location
    * TODO
  
&lt;Pointers&gt; have the following properties:
  * *Reference* - The corresponding &lt;Routine&gt;, &lt;Block&gt;, or *RAM/ROM* &lt;Data&gt; instance
  * *BigEndian* - The address as a 2 &lt;byte&gt; array in *BigEndian* format
  * *LittleEndian* - The address as a 2 &lt;byte&gt; array in *LittleEndian* format
  * *[0]* - The low &lt;byte&gt; of the address, where the endianness comes from the input *Options.BigEndian*
  * *[1]* - The high &lt;byte&gt; of the address, where the endianness comes from the input *Options.BigEndian*
  * *Bank* - The bank this &lt;Pointer&gt; is allocated to

---


I tried to keep the code as clean and straightforward as possible, undoubtedly at the cost of efficiency.

Once some projects start being build around this, efficiency will become a higher priority

There are no unit tests at this time.

Since it is being built alongside the pokeredjs decompilation, that is used for testing and can be used for code reference