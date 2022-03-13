# Header

These are the inputs arguments used to build the **ROM** **Header**

## Notes
  * All **&lt;byte&gt;** inputs are the explicit values that are written directly to the header
  * If no _Default_ is listed, then the default is `0x00` (or an array of `0x00`s)

## Inputs
The following are properties to the **js2gb** input **Header** **&lt;dict&gt;**:

  * **Title** | **&lt;ascii(16)&gt;** - The Title of the cartridge
    * If the length &gt; 15, it will conflict with the **ColorByte** byte
    * If the length &gt; 11, it will conflict the **Manufacturer** bytes
  
  * **Manufacturer** | **&lt;ascii(4)&gt;** - The Manufacturer of the cartridge
  
  * **OriginalGB** | **&lt;bool&gt;** - Whether or not the cartridge supports the Original Gameboy
    * *Default:* `true` 
  
  * **ColorGB** | **&lt;bool&gt;** - Whether or not the cartridge supports the Color Gameboy
    * *Default:* `false` 
  
  * **ColorByte** | **&lt;byte&gt;** - The explicit byte value to represent the color compatability
    * Can be used instead of **OriginalGB** and **ColorGB**
  
  * **NewLicensee** | **&lt;ascii(2)&gt;** - The company/publisher of the cartridge (used in newer releases)
  
  * **SuperGB** | **&lt;bool|byte&gt;** - Whether or not the cartridge supports the Super Gameboy
    * *Default:* `false`
  
  * **Type** | **&lt;byte&gt;** - The MBC & external hardware the cartride uses
  
  * **ROMBanks** | **&lt;+int&gt;** - The number of ROM banks in the cartridge
    * *Default:* `2`
    * Value must be one of: `[2, 4, 8, 16, 32, 64, 72, 80, 96, 128, 256, 512]`
  
  * **ROMByte** | **&lt;byte&gt;** - The explicit byte value to represent the number of ROM banks
    * Can be used instead of **ROMBanks**
  
  * **RAMBanks** | **&lt;!-int&gt;** - The number of RAM banks in the cartridge
    * *Default:* `0`
    * Value must be one of: `[0, .25, 1, 4, 16, 8]`
  
  * **RAMByte** | **&lt;byte&gt;** - The explicit byte value to represent the number of RAM banks
    * Can be used instead of **RAMBanks**
  
  * **ForJapan** | **&lt;bool|byte&gt;** - Whether or not the cartridge is made for Japan
    * *Default:* `true`
  
  * **OldLicensee** | **&lt;byte&gt;** - The company/publisher of the cartridge (used in older releases)
    * _Default:_ `0x33` if **SuperGB** is `true` or **NewLicensee** is provided, otherwise `0x00`

  * **Version** | **&lt;byte&gt;** - The version of the cartridge
