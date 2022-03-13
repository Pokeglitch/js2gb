# js2gb Registers

These registers are static instances accessible throughout the **ROM** **Source**

## 8-bit Registers

### Simple 8-bit Registers (s8)

  * **$bc** - To represent the register pointed to by the address stored in **bc**
  * **$de** - To represent the register pointed to by the address stored in **de**
  * **$FF+c** - To represent the register at address 0xFF00 + **c**
  * **$FF+_** - To represent the register at address 0xFF00 + an offset
    * `$ff.plus(offset)`
      * ***offset*** | **&lt;!-int&gt;** **&lt;byte&gt;**

#### Members

  * **ld(*other*)** - To load a value into this register
    * ***other*** | **&lt;a&gt;** - Only the **a** register can be loaded into these Registers

### Main 8-bit Registers (m8)

  * **b** - The **b** register
  * **c** - The **c** register
  * **d** - The **d** register
  * **e** - The **e** register
  * **h** - The **h** register
  * **l** - The **l** register

#### Members

  * **ld(*other*)** - To load a value into this register
    * ***other*** | **&lt;m8|byte&gt;**
  * **inc()** - To increment the value of this register
  * **dec()** - To decrement the value of this register
  * **swap()** - To swap the nybbles of the value of this register
  * **rl()** - To rotate left the bits of the this register
  * **rlc()** - To rotate left + carry the bits of the this register
  * **rr()** - To rotate right the bits of the this register
  * **rrc()** - To rotate right + carry the bits of the this register
  * **sla()** - To shift left the bits of the this register (zeroing bit 0)
  * **sra()** - To shift right the bits of the this register (maintaining bit 7 value)
  * **srl()** - To shift right the bits of the this register (zeroing bit 7)

### $hl (m8)

To represent the register pointed to by the address stored in **hl**

This is an extension of **&lt;m8&gt;**, so it includes all of the same members as above as well as the following

#### Members

  * **ldi(*other*)** - To load a value into this register and increment the pointer address stored in **hl**
    * ***other*** | **&lt;a&gt;** - Only the **a** register can be used in this opcode
  * **ldd(*other*)** - To load a value into this register and decrement the pointer address stored in **hl**
    * ***other*** | **&lt;a&gt;** - Only the **a** register can be used in this opcode

### a (m8)

The **a** Register.
 
This is an extension of **&lt;m8&gt;**, so it includes all of the same members as above as well as the following

#### Members

  * **ld(*other*)** - To load a value into this register
    * ***other*** | **&lt;s8|Data&gt;**
      * **Data** includes both **RAM** and **ROM** Data (and must be refering to a single **&lt;byte&gt;** within that **Data**)
  * **ldi(*other*)** - To load a value into this register and increment the pointer address stored in **hl**
    * ***other*** | **&lt;hl|$hl&gt;** - Only the **hl/$hl** registers can be used in this opcode
  * **ldd(*other*)** - To load a value into this register and decrement the pointer address stored in **hl**
    * ***other*** | **&lt;hl|$hl&gt;** - Only the **hl/$hl** registers can be used in this opcode
  * **add(*other*)** - To add a value to this register
    * ***other*** | **&lt;m8|byte&gt;**
  * **adc(*other*)** - To add a value to this register & add the carry flag value
    * ***other*** | **&lt;m8|byte&gt;**
  * **sub(*other*)** - To subtract a value from this register
    * ***other*** | **&lt;m8|byte&gt;**
  * **sbc(*other*)** - To subtract a value from this register & subtract the carry flag value
    * ***other*** | **&lt;m8|byte&gt;**
  * **and(*other*)** - To bitwise AND a value with this register's value
    * ***other*** | **&lt;m8|byte&gt;**
  * **or(*other*)** - To bitwise OR a value with this register's value
    * ***other*** | **&lt;m8|byte&gt;**
  * **xor(*other*)** - To bitwise XOR a value with this register's value
    * ***other*** | **&lt;m8|byte&gt;**
  * **cp(*other*)** - To compare a value with this register's value
    * ***other*** | **&lt;m8|byte&gt;**
  * **da()** - To perform the *daa** opcode
  * **cpl()** - To complement the bits of this register
  * **rl()** - Will use the 1 byte **rla** opcode
    * **rlCB()** - Will use the 2 byte **rl a** opcode
  * **rlc()** - Will use the 1 byte **rlca** opcode
    * **rlcCB()** - Will use the 2 byte **rlc a** opcode
  * **rr()** - Will use the 1 byte **rra** opcode
    * **rrCB()** - Will use the 2 byte **rr a** opcode
  * **rrc()** - Will use the 1 byte **rrca** opcode
    * **rrcCB()** - Will use the 2 byte **rrc a** opcode

### f

The **f** register

#### Members
  * **Zero** - The Zero flag class
    * The **Zero** flag class is only used for reference at this time
  * **Carry** - The Carry flag class

### Carry flag

The **Carry** flag of the **f** register

#### Members
  * **set()** - To set this flag
  * **cpl()** - To complement the value of this flag

### m8 Bits

Specific bits of all **m8** registers can be accessed using parenthesis notation, where the argument is the index of the bit

#### Members
  * **set()** - To set this bit
  * **res()** - To reset this bit
  * **bit()** - To read the value of this bit

## 16-bit Registers

### Main 16-bit Registers (m16)

  * **bc** - The **bc** Registers
  * **de** - The **de** Registers

#### Members
  * **hi** - The **8-bit Register** corresponding to the high byte
  * **lo** - The **8-bit Register** corresponding to the lo byte
  * **$** - The **8-bit Register** corresponding to the registered pointed to by the address stored in this register
  * **ld(*other*)** - To load a value into this register
    * ***other*** | **&lt;word|Pointer&gt;**
  * **inc()** - To increment the value in this register
  * **dec()** - To decrement the value in this register
  * **push()** - To push this register to the stack
  * **pop()** - To pop this register from the stack

### hl (m16)

The **hl** Register

This register extends the **m16** class, so it includes the above members as well as the following

#### Members

  * **ld(*other*)** - To load a value into this register
    * ***other*** | **&lt;word|Pointer|SP+_&gt;**
  * **ldi(*other*)** - To load a value into **$hl** and increment the pointer address stored in this register
    * ***other*** | **&lt;a&gt;** - Only the **a** register can be used in this opcode
  * **ldd(*other*)** - To load a value into **$hl** and decrement the pointer address stored in this register
    * ***other*** | **&lt;a&gt;** - Only the **a** register can be used in this opcode
  * **add(*other*)** - To add a value to this register's value
    * ***other*** | **&lt;m16&gt;**
  * **jp()** - To jump to the address pointed to by the value of this register

### af

The **af** register

#### Members
  * **hi** - The **8-bit Register** corresponding to the high byte (**a**)
  * **lo** - The **8-bit Register** corresponding to the lo byte (**f**)
  * **push()** - To push this register to the stack
  * **pop()** - To pop this register from the stack

### sp

The **sp** (Stack Pointer) register

#### Members
  * **ld(*other*)** - To load a value into this register
    * ***other*** | **&lt;hl|word|Pointer&gt;**
  * **add(*other*)** - To add a value into this register
    * ***other*** | **&lt;byte&gt;**
  * **inc()** - To increment the value in this register
  * **dec()** - To decrement the value in this register
  * **plus(*offset*)** - To create a reference to an **SP+_** (Stack Pointer plus an offset)
    * ***offset*** | **&lt;byte&gt;**
    * This reference can only be used as an argument for **hl.ld(...)**

# Interrupt

An abstraction of the **Interrupt**

#### Members
  * **disable()** - The *di* opcode 
  * **enable()** - The *ei* opcode 
  * **ret()** - The *reti* opcode 