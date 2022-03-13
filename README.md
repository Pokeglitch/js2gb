# js2gb

A Javascript based Gameboy ASM compiler

# Instructions

First, import into your module:

`let js2gb = require('js2gb');`

The **js2gb** class will compile the ROM.

`let rom = new js2gb({ inputs });`

The inputs are a **&lt;dict&gt;** with specific attributes, and is detailed at [Inputs.md](/docs/Inputs.md)

The output contained the binary **ROM** information, as well as a Symbol map.

Based on certain input parameters, it can also write both of those to specific **ROM** and **SYM** files

# Documentation

  * [Data Types](/docs/DataTypes.md) - The specific data types and classes utilized by **js2gb**
  * [js2gb Inputs](/docs/Inputs.md) - The input arguments for the **js2gb** constructor
  * [Header Inputs](/docs/Header.md) -  The input arguments for the **js2gb** **Header**
  * [Source Context](/docs/Context.md) - The global context members acessible to the **Source** code
  * [Class Members](/docs/Classes.md) - The class members details for all **js2gb** classes

# Final Word

I tried to keep the code as clean and straightforward as possible, undoubtedly at the cost of efficiency.

Once some projects start being build around this, efficiency will become a higher priority

There are no unit tests at this time.

Since it is being built alongside my [pokeredjs decompilation](https://github.com/Pokeglitch/pokeredjs), that is used for testing and can be used for code reference