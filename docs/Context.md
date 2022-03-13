# Environment Context

These are globally accessible members available for the Source code:

## Both ROM and RAM

  * **require(*id*)** - To import node modules
    * ***id*** | **&lt;string&gt;** - Module name or path
  * **log(*message*)** - To log a message to the console
    * ***message*** | **&lt;string&gt;** - Message to be logged
  * **json(*path*)** - To import a JSON file
    * ***path*** | **&lt;string&gt;** - Path to file
  * **include(*path*)** - To execute another source file
    * ***path*** | **&lt;string&gt;** - Path to file
  * **Skip(*size*)** - To shift the current position by the given amount
    * ***size*** | **&lt;+int&gt;** - Amount of bytes to skip
  * **Goto(...)** - To change the current position to a new location
    * **Goto(*name*)** - To go to a section with the given name
      * ***name*** | *&lt;string&gt;* - The name of the section 
      * Named sections must be explicitly allocated using the **Section** method (below) or through the **Structure.ROM** input argument
    * **Goto(*bank, address*)** - To go to a given address at the given bank
      * ***bank*** | *&lt;+int&gt;* - The bank to go to
      * ***address*** | *&lt;+int&gt;* - The address within the bank to go to
  * **Section(*name*)** - To allocate the given section to the current section
    * ***name*** | *&lt;string&gt;* - Name of the section to be allocated

In addition to the above, **RAM** and **ROM** environments have unique context members:

## RAM
  * **def(...)** - To define **RAM** identifiers
    * **def(&lt;dict&gt;)** - The **key** represents the idenitifier, while the **value** must be one of:
      * **&lt;!-int&gt;** - **&lt;byte&gt;** size of the data
        * If the size &gt; `1`, each **&lt;byte&gt;** will be accessible by its index via dot or bracket notation
      * **&lt;array&gt;** - To assign index based child members to this identifier.  Each **value** in the array must be one of **&lt;!-int|array|dict|Flags&gt;**
      * **&lt;dict&gt;** - To assign name based child members this idenfitier. The **key** represents the member name and the **value** must be one of **&lt;!-int|array|dict|Flags&gt;**
        * Each child member will be accessible by its name via dot or bracket notation
      * **&lt;Flags&gt;** - To set this argument as a single **&lt;byte&gt;** with named **&lt;Bits&gt;** (see **Flags** definition below)
    * **def(&lt;dict&gt;, ...)** - A union can be defined by passing multiple **&lt;dict&gt;** as arguments
      * All **&lt;dict&gt;** will have the same starting address
      * The address after the **def** is parsed will be after on the largest **&lt;dict&gt;** defined
  * **Flags(...)** - To defined names for specific **&lt;Bits&gt;**
    * **Flags(&lt;array&gt;)** - The index corresponds to the indentifiers **&lt;Bit&gt;**, and the **value** must be a **&lt;string&gt;** defining the name of the **&lt;Bit&gt;**
      * The **&lt;Bit&gt;** will be accessible by its name via dot or bracket notation
    * **Flags(&lt;dict&gt;)** - The **key** represents the name of the **&lt;Bit&gt;**, and the value represents the index.
      * The **&lt;Bit&gt;** will be accessible by its name via dot or bracket notation

## ROM
  * **def(...)** - To define a **&lt;Routine&gt;** or **&lt;Data&gt;**
    * **def(&lt;function&gt;)** - To define a **&lt;Routine&gt;** if in the Top Level, otherwise to define a **&lt;Block&gt;**
    * **def(&lt;dict&gt;)** - To define multiple **&lt;Routine&gt;** or **&lt;Data&gt**; sequentially
      * The **key** represents the name, and the **value** can be a **&lt;function&gt;** to define a **&lt;Routine&gt;**, or **&lt;array|dict&gt;** to define a **&lt;Data&gt;**
    * **def(&lt;array&gt;)** - To define the contents of the **&lt;Data&gt;**
  * **$(*name*)** - To get an identifier by name
    * ***name*** | **&lt;string&gt;** - The name of the idenfitier
      * The name can also access child members via dot notation
    * This is necessary to reference **ROM** identifiers for **&lt;Data&gt;** content
    * It is also necessary to reference child members of **&lt;Routine&gt;** or **&lt;Data&gt;** before they are defined
    * `":End"` can be placed at the end of the name to get the **&lt;Pointer&gt;** to the end of the **&lt;Data&gt;**
  * **Routine(...)** - To define a **&lt;Routine&gt;**
    * See [Classes.md#Routine](/docs/Classes.md#Routine)
  * **Block( *(name,) code* )** - To create a block of code within a **&lt;Routine&gt;**
    * See [Classes.md#Block](/docs/Classes.md#Block)
  * **Data( *(name, ) content*)** - To define a **&lt;Data&gt;** and write to the **ROM**
    * See [Classes.md#Data](/docs/Classes.md#Data)
  * **self** - To refer to the current **&lt;Routine&gt;** or **&lt;Block&gt;**
    * This is necessary for a **macro** to refer to the current **&lt;Routine&gt;/&lt;Block&gt;**

### Hardware Registers
  * **a, f, b, c, d, e, h, l** - The 8 bit registers
  * **af, bc, de, hl** - The 16 bit registers
  * **$bc, $de, $hl** - The **&lt;Data&gt;** at the location specified by address stored in the 16 bit registers
  * **sp** - The stack pointer
  * **$ff** - To refer to a specific **HRAM** address
  * **Interrupt** - The interrupt abstracted as a class

For more details about these, read [Registers.md](/docs/Registers.md)

### Opcodes
  * **nop()** - The *nop* opcode
  * **halt()** - The *halt* opcode
  * **stop()** - The *stop* opcode
  * **ret()** - The *ret* opcode
    * Conditional returns are also avilable as child members:
      * **ret.c()** - The *ret c* opcode
      * **ret.nc()** - The *ret nc* opcode
      * **ret.z()** - The *ret z* opcode
      * **ret.nz()** - The *ret nz* opcode

## NOTES:
  * The same context is used for all source files, so all globally named variables will be accessible in all files
  * If **Options.Global** input agument is `true`:
    * All **RAM** identifiers will be accessible at the top-level of the **ROM** code
    * All top-level **ROM** identifiers will be accessible at the **&lt;Routine&gt;** level code
  * A **&lt;Bit&gt;** of **ROM** and **RAM** **&lt;Data&gt;** idenfitiers can be accessed through parenthesis notation, where the argument is the index of the bit