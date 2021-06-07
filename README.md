
# Virtual Maschine for Aarch64

This repository contains my own little VM, which emulates and displays the mechanisms in a matrix multiplication for the Aarch64 instruction set architecture. I created this VM for my master course "High Performance Computing" to simplify debugging.

## Links for the running examples

- [16 x 12 x 4 Kernel](https://phychi.com/asm/aarch64/16x12x4.html)
- [19 x 4 x 4 Kernel](https://phychi.com/asm/aarch64/19x4x4.html)
- [32 x 32 x 32 Kernel](https://phychi.com/asm/aarch64/32x32x32.html)

## Execution of other matrix multiplication kernels

- clone one of the html files
- remove the assembly code from the "code" section and paste your own
- change the data inside the "mkn" element to match your matrix dimensions
- change the default delay in the element "delay", if the given value is too fast or slow for your liking
- I only implemented what was necessary for my own kernels to run, so please see the next chapter

## Limitations

I only implemented what was required for my own kernels. Therefore, this visualisation has many limitations:
- there is no NZCV (negative, zero, carry, overflow) register
- there are no cmp and branching instructions, except cbnz
- calculations are only supported on 32 bit floating point numbers
- only 32 bit floating point numbers can be loaded and stored from memory
- there is no stack
- you cannot define your own memory
- you cannot add different memory addresses, because most likely that would be an error
- etc.

## Used libraries

- [highlight.js](https://highlightjs.org/) for syntax highlighting
