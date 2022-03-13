# Inputs

These are the keys for the **js2gb** constructor argument **&lt;dict&gt;**:

  * **Source** | **&lt;dict&gt;** - Source locations
    * **ROM** | **&lt;string&gt;** - The path to the ROM source
    * **RAM** | **&lt;string&gt;** - The path to the RAM source
  
  * **Header** | **&lt;dict&gt;** - The properties to populate the Cartridge Header (see [Header.md](/docs/Header.md) for specifics)
  
  * **CharMap** | **&lt;dict&gt;** - The map of **&lt;char|string&gt;** to a **&lt;!-int&gt;**
    * Can also be **&lt;string&gt;** as the path to a **CharMap** JSON file
  
  * **Structure** | **&lt;dict&gt;** - The structure of the cartridge
    * **ROM** | **&lt;array|dict&gt;** -  The order in which the **ROM** is compiled
      * If **&lt;array&gt;**, the elements must be **&lt;Section&gt;** names
      * If **&lt;dict&gt;**, the key must be a bank index, and the value must be an **&lt;array&gt;** of **&lt;Section&gt;** names
      * If **&lt;undefined&gt;**, the **ROM** will be compiled in the order of which each **&lt;Section&gt;** is defined
  
  * **Output** | **&lt;dict&gt;** - Output locations
    * **ROM** | **&lt;string&gt;** - The path to write the compiled **ROM** file
    * **SYM** | **&lt;string&gt;** - The path to write the compiled symbols (symfile)
  
  * **Base** | **&lt;dict&gt;** - Used for new disassemblies
    * **ROM** | **&lt;string&gt;** - The path to the base **ROM** file
      * All compiled bytes will be compared to the base **ROM**
      * All undefined bytes will be pulled from the base **ROM** (instead of filling with `0x00`)
    * **SYM** | **&lt;string&gt;** - The path to the symbols (symfile)
      * Used to refer to **&lt;Routine|Data&gt;** which have not been disassembled yet
  
  * **Options** | **&lt;dict&gt;** - Compilation options
    * **Strict** | **&lt;bool&gt;** - Whether built in OpCode macros should be permitted
      * *Default:*  `true`
      * When not in **Strict** mode, additional opcode inputs will be permitted
      * See **Opcodes** page for more details
    * **BigEndian** | **&lt;bool&gt;** - Whether **&lt;Pointers&gt;** should be copmiled in big-endian order vs little-endian order
      * *Default:* `true`
    * **Global** | **&lt;bool&gt;** - Whether **RAM** and **ROM** identifiers should be globally accessible
      * *Default:* `true`
  
  * **Suppress** - Whether or not to suppress Tips/Warnings/Errors
      * **&lt;bool&gt;** - To designate the same value to all Tips/Warnings/Errors
        * *Default:* `false`
      * **&lt;dict&gt;** - To designate separate values for each:
          * **Tips** | **&lt;bool&gt;** - Whether or not to suppress Tips
          * **Warnings** | **&lt;bool&gt;** - Whether or not to suppress Warnings
          * **Errors** | **&lt;bool&gt;** - Whether or not to suppress Errors, wherever possible

# Outputs

The output is a **js2gb** instance with the following properties:
  * **Binary** | **&lt;array&gt;** - The compiled **ROM** as a **&lt;byte&gt;** **&lt;array&gt;**
  
  * **Symbols** | **&lt;array&gt;** - Contains all identnfiers for each **ROM** address

If **Output** is defined in the above input arguments, it will also write the Binary (**ROM**) and Symbols (**SYM**) to the specified files
