# js2gb Classes

These classes are created during compilation

## Routine

A **Routine** is a sequence of op-codes that can be called from other **Routines**

### Constructor

#### Routine( *(name,) (macro, ) code* )

  * ***name*** | **&lt;string&gt;** - An optional name for the **&lt;Routine&gt;** for external reference
  * ***macro*** | **&lt;function&gt;** - An optional macro to handle input arguments when this **&lt;Routine&gt;** is called
  * ***code*** | **&lt;function&gt;** - The function containing the opcodes to be compiled to the **ROM**

A **Routine** will auto-return after the last statement, unless the last statement is already an exit *(jp/jr/ret)*

If the last statements are **Blocks**, it will auto-return from each block.  Again, unless the last statement in each **Block** is an exist statement

### Members

  * **Pointer** - The **&lt;Pointer&gt;** to the start of this **&lt;Routine&gt;**

  * **call(...)** - To create the opcode to call this **&lt;Routine&gt;**
    * Optional input arguments will be passed to the **&lt;Routine&gt;** macro
    * Conditional calls are also available as child members:
      * **call.c(...)**
      * **call.nc(...)**
      * **call.z(...)**
      * **call.nz(...)**

  * **jp(...)** - To create the opcode to jump to this **&lt;Routine&gt;**
    * Optional input arguments will be passed to the **&lt;Routine&gt;** macro
    * Conditional jumps are also avilable as child members:
      * **jp.c(...)**
      * **jp.nc(...)**
      * **jp.z(...)**
      * **jp.nz(...)**

  * **jr(...)** - To create the opcode to relative jump to this **&lt;Routine&gt;**
    * Optional input arguments will be passed to the **&lt;Routine&gt;** macro
    * Conditional relative jumps are also avilable as child members:
      * **jr.c(...)**
      * **jr.nc(...)**
      * **jr.z(...)**
      * **jr.nz(...)**
    * An error will be thrown if this **&lt;Routine&gt;** is out of range from where this **.jr** is called

  * **rst(...)** - To create an *rst* opcode to call this **&lt;Routine&gt;**
    * Optional input arguments will be passed to the **&lt;Routine&gt;** macros
    * An error will be thrown if this **&lt;Routine&gt;** is not placed at an *rst* address

## Block

A **Block** is a sequence of op-codes within a **Routine**

### Constructor

#### Block( *(name,) code* )

  * ***name*** | **&lt;string&gt;** - An optional name for the block for external reference
  * ***code*** | **&lt;function&gt;** - The function containing the opcodes to be compiled to the **&lt;Routine&gt;**

### Members
  * **Pointer** - The **&lt;Pointer&gt;** to the start of this **&lt;Block&gt;**

  * **jp()** - To create the opcode to jump to this **&lt;Block&gt;**
    * Conditional jumps are also avilable as child members:
      * **jp.c()**
      * **jp.nc()**
      * **jp.z()**
      * **jp.nz()**

  * **jr()** - To create the opcode to relative jump to this **&lt;Block&gt;**
    * Conditional relative jumps are also avilable as child members:
      * **jr.c()**
      * **jr.nc()**
      * **jr.z()**
      * **jr.nz()**
    * An error will be thrown if this **&lt;Block&gt;** is out of range from where this **.jr** is called

## ROM Data

**ROM** **Data** is a collection of data types to be written to the **ROM**

### Constructor

#### Data( *(name, ) content* )

  * ***name*** | **&lt;string&gt;** - An optional name for the **&lt;Data&gt;** for external reference
  * ***content*** | **&lt;array&gt;** - To define the content of the **&lt;Data&gt;** to write to the **ROM**, where each element in the array is **&lt;byte|array|dict&gt;**
    * Each child member can be accessed by its index via dot or bracket notation
  * ***content*** | **&lt;dict&gt;** - To define the content of the **&lt;Data&gt;** to write to the **ROM**, where each **key** is the name of the child member and each **value** is **&lt;byte|array|dict&gt;**
    * Each child member can be accessed by its name via dot or bracket notation

## RAM Data

**RAM** **Data** gets defined in the **RAM** **Source**, but can be accessed in the **ROM** **Source** by name

### Members
  * **Pointer** - The **&lt;Pointer&gt;** to the start of this **&lt;Data&gt;**

  * **Parent** - The parent **&lt;Data&gt;** or **&lt;null&gt;**

  * **Size** - The **&lt;byte&gt;** size of this **&lt;Data&gt;**

    * If the **&lt;Data&gt;** content is is an **&lt;array&gt;** or **&lt;dict&gt;**, it will include the size of all of its children

  * **Length** - The number of children of this **&lt;Data&gt;**

  * **ld(...)**, **load(...)** - To load data into this **RAM** location
    * TODO

## Pointer

A **Pointer** gets created for each **Routine**, **Block**, and **Data**

### Members
  * **Reference** - The corresponding **&lt;Routine&gt;**, **&lt;Block&gt;**, or **RAM/ROM** **&lt;Data&gt;** instance

  * **BigEndian** - The address as a 2 **&lt;byte&gt;** array in *BigEndian* format

  * **LittleEndian** - The address as a 2 **&lt;byte&gt;** array in *LittleEndian* format

  * **0** - The low **&lt;byte&gt;** of the address, where the endianness comes from the input **Options.BigEndian**

  * **1** - The high **&lt;byte&gt;** of the address, where the endianness comes from the input **Options.BigEndian**

  * **Bank** - The bank this **&lt;Pointer&gt;** is allocated to

## Bit

A **Bit** is an abstraction of a single bit of data within a **RAM** **Data** **&lt;byte&gt;**

It can be accessed using parenthesis notation on a **RAM** **Data** instance, where the input argument is the index of the bit `0-7`

### Members

  * **RAM** - The corresponding **RAM** **Data** instance that this bit belongs to
  
  * **Index** - The index of this bit `0-7`

  * **Mask** - a **&lt;dict&gt;** to create a mask **&lt;byte&gt;** for this index
    * **on** - A **&lt;byte&gt;** value where only this bit is set
    * **off** - A **&lt;byte&gt;** value where all bits except this one is set

## Section

A **Section** is a sequence of **Routines** and **Data** that can be defined and allocated at any location throughout the **Source**
