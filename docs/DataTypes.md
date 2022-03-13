# Data Types

There are a nuber of different data types and classes that will be referenced in this documentation

##  Javascript Types
Since the compiler runs in a Javascript engine, all basic Javascript types and classes are available.

The source code is free to use all of them in whatever manner of their choosing.

However, only a subset are actually used in the **js2gb** interface:

  * **&lt;bool&gt;**
  * **&lt;number&gt;**
  * **&lt;string&gt;**
  * **&lt;array&gt;**
  * **&lt;dict&gt;** (a Simple Javascript Object consisting of key/value pairs)

## js2gb Types

In certain scenarios, **js2gb** requires specific sub-types of the above Javascript types:

  * **&lt;int&gt;** - Any whole number
    * **&lt;+int&gt;** - Positive integer values only (not including `0`)
    * **&lt;!-int&gt;** - Non-negatives integer values only (including `0`)
  * **&lt;byte&gt;** - **&lt;int&gt;** in range: `[-255 , 255]`
  * **&lt;word&gt;** - **&lt;int&gt;** in range: `[-65535 , 65535]`
  * **&lt;char&gt;** - Single string character where corresponding `charCode` is a valid **&lt;byte&gt;**
  * **&lt;ascii&gt;** - **&lt;char&gt;** or the corresponding **&lt;byte&gt;** with value in range: `[0, 127]`
    * **&lt;ascii(x)&gt;** - **&lt;string|array&gt;** of maximum length `x` with each element being an **&lt;ascii&gt;**

## js2gb Registers

The hardware registers are abstracted into various static classes:

Details about the specific attributes for each register can be found in [Registers.md](/docs/Registers.md)

## js2gb Classes

Finally, **js2gb** introduces a number of classes which get created during compilation:

  * **&lt;Routine&gt;** - A function in the **ROM** context
  * **&lt;Data&gt;** - A set of values in the **ROM** or **RAM** context
  * **&lt;Pointer&gt;** - The bank and address of a **&lt;Routine&gt;** or **&lt;Data&gt;**
  * **&lt;Bit&gt;** - A specific bit of a **&lt;byte&gt;** belonging to **&lt;Data&gt;**
  * **&lt;Section&gt;** - A collection of **&lt;Routine&gt;** and **&lt;Data&gt;**

Details about the specific attributes for each class can be found in [Classes.md](/docs/Classes.md)
