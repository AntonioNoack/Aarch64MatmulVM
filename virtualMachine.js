
// aarch64 virtual machine,
// currently very limited:
// only float (32 bit) calculations supported,
// only float array access implemented

var assembly
var jumpMap

var lineNumber = 0
var instrCounter = 0

var hasReturned = false

function loadAssemblyCode(code){
	// prepare the assembly by splitting lines, and arguments inside, plus removing comments
	assembly = code
		.split('\n')
		.map(x => x.split('//')[0].trim())
		.filter(line => line.length > 0 && line[0] != '.')
		.map(x => x.split(/[ ,{}]/).map(par => par.trim()).filter(par => par.length > 0))
	findAllLabels()
}

function clamp(v,min,max){
	return v<min ? min : v<max ? v : max
}

function restart(){
	
	hasReturned = false
	
	for(var i=0;i<A.length;i++) A[i] = i;
	for(var i=0;i<B.length;i++) B[i] = i;
	for(var i=0;i<C.length;i++) C[i] = 0;

	matrices = [ptrA, ptrB, ptrC]
	registers = []
	for(var i=0;i<matrices.length;i++) registers[i] = matrices[i]
	for(var i=0;i<vectorRegisters.length;i++) vectorRegisters[i] = 0
	vectorRegisterSources = []
	
	lineNumber = 0
	instrCounter = 0
	
	dstCells = []
	src0Cells = []
	src1Cells = []
	
	for(var i=0;i<recentUsage.length;i++) recentUsage[i] = 0
	
}

function ArrayIndexOutOfBoundsException(index,data){
	this.index = index
	this.length = data.data.length
	this.name = data.name
}

function getArrayEntry(value){
	if(!value || !value.data) throw value
	var index = value.offset/4
	if(index < 0 || index >= value.length) throw new ArrayIndexOutOfBoundsException(index, value)
	var value2 = value.data[index]
	if(Number.isNaN(value2) || value2 == undefined) throw 'Value has become NaN '+index+" / "+value.name
	return value2
}

function setArrayEntry(newValue, address){
	var index = address.offset/4
	if(index < 0 || index >= address.length) throw new ArrayIndexOutOfBoundsException(index, address)
	address.data[index] = newValue
}

function createPointer(data, name){
	return { data, name, offset: 0 }
}

function getValue(src, registers){
	if(src[0] == 'x'){
		return registers[src.substr(1)*1]
	} else if(src[0] == '#'){
		return evaluate(src)
	} else throw src;
}

function getRegister(name,firstChar='x'){
	var dst = name
	if(dst[0] != firstChar) throw dst;
	return dst.substr(1)*1
}

function add(src0,src1){
	if(src1 == 0) return src0;
	if(src0 && src0.data){
		if(src0 && src0.data && src1 && src1.data) throw 'Should not add pointers';
		if(src1 % 4 != 0) throw src0+' += '+src1
		return { data: src0.data, offset: src0.offset + src1, name: src0.name }
	} else return src0 + src1
}

function fmla(instruction, vectorRegisters){
	var dst = instruction[1]
	switch(dst[0]){
		case 'v': fmlaSIMD(instruction, vectorRegisters); break;
		case 's': fmlaSingle(instruction, vectorRegisters); break;
		default: throw dst;
	}
}

function getVectorRegister(name){
	if(name.endsWith(']')) return name.substr(1,name.indexOf('.'))*4 + name[name.length-2]*1
	return name.substr(1)*4
}

function fmlaSingle(instruction, vectorRegisters){
	// fmla s7,    s22,    v19.s[0]
	var dst  = getVectorRegister(instruction[1])
	var src0 = getVectorRegister(instruction[2])
	var src1 = getVectorRegister(instruction[3])
	vectorRegisters[dst] +=vectorRegisters[src0] * vectorRegisters[src1]
	onCalculate2(dst, src0, src1)
}

function fmlaSIMD(instruction, vectorRegisters){
	var dst = instruction[1]
	var dstType = dst.split('.')[1]
	var baseCount
	switch(dstType){
		case '1s': baseCount = 1; break;
		case '2s': baseCount = 2; break;
		case '3s': baseCount = 3; break;
		case '4s': baseCount = 4; break;
		default: throw 'Unknown type '+dstType;
	}
	dst = dst.substr(1).split('.')[0]*4
	var src0 = instruction[2]
	if(src0[0] != 'v' || !src0.endsWith(dstType)) throw src0;
	src0 = src0.substr(1).split('.')[0]*4
	var src1 = instruction[3]
	if(src1[0] != 'v' || src1.indexOf('s') < 1) throw src1;
	src1 = src1.substr(1).split('.')
	var src1i = src1[0]*4
	var src1c = src1[1]
	switch(src1c){
		case 's[0]':
		case 's[1]':
		case 's[2]':
		case 's[3]':
			src1i += src1c[2]*1
			var s0 = vectorRegisters[src1i];
			for(var i=0;i<baseCount;i++){
				var a0 = vectorRegisters[src0+i]
				// var d0 = vectorRegisters[dst+i]
				// console.log(dst+i, src0+i, src1i, d0+' += '+a0+' * '+s0)
				vectorRegisters[dst+i] += a0 * s0
				var result = vectorRegisters[dst+i]
				if(Number.isNaN(result) || result == undefined) throw result
				onCalculate2(dst+i, src0+i, src1i)
			}
			break;
		case '4s':
			for(var i=0;i<4;i++){
				var s0 = vectorRegisters[src1i+i];
				var a0 = vectorRegisters[src0+i]
				// var d0 = vectorRegisters[dst+i]
				// console.log(dst+i, src0+i, src1i, d0+' += '+a0+' * '+s0)
				vectorRegisters[dst+i] += a0 * s0
				var result = vectorRegisters[dst+i]
				if(Number.isNaN(result) || result == undefined) throw result
				onCalculate2(dst+i, src0+i, src1i)
			}
			break;
		default:
		throw src1;
	}
}

function ld1(instruction, registers, vectorRegisters){
	var dst = instruction[1]
	if(dst[0] != 'v' || !dst.endsWith('.4s')) throw dst;
	dst = dst.substr(1).split('.')[0]*4
	switch(instruction.length){
		case 3:
			var src = instruction[2]
			if(src[0] != '[' || src[1] != 'x') throw src;
			src = src.substr(2).split(']')[0]*1;
			src = registers[src]
			for(var i=0;i<4;i++) loadFloat(dst+i, add(src, 4*i), vectorRegisters, vectorRegisterSources)
			break;
		case 6:
			var src = instruction[5]
			if(src[0] != '[' || src[1] != 'x') throw src;
			src = src.substr(2).split(']')[0]*1;
			src = registers[src]
			for(var i=0;i<16;i++) loadFloat(dst+i, add(src, 4*i), vectorRegisters, vectorRegisterSources)
			break;
		default: throw instruction
	}
}

function st1(instruction, registers, vectorRegisters){
	var dst = instruction[1]
	if(dst[0] != 'v' || !dst.endsWith('.4s')) throw dst;
	dst = dst.substr(1).split('.')[0]*4
	switch(instruction.length){
		case 3:
			var src = instruction[2]
			if(src[0] != '[' || src[1] != 'x') throw src;
			src = src.substr(2).split(']')[0]*1;
			src = registers[src]
			for(var i=0;i<4;i++) storeFloat(dst+i, add(src,4*i), vectorRegisters)
			break;
		case 6:
			var src = instruction[5]
			if(src[0] != '[' || src[1] != 'x') throw src;
			src = src.substr(2).split(']')[0]*1;
			src = registers[src]
			for(var i=0;i<4*4;i++) storeFloat(dst+i, add(src,4*i), vectorRegisters)
			break;
		default: throw instruction
	}
}

function addI(instruction, registers){
	if(instruction.length != 4) throw instruction;
	var dst = getRegister(instruction[1])
	var src0 = registers[getRegister(instruction[2])]
	var src1 = getValue(instruction[3], registers)
	registers[dst] = add(src0,src1)
	// console.log('added', dst, src0, src1)
}

function subI(instruction, registers){
	if(instruction.length != 4) throw instruction;
	var dst = getRegister(instruction[1])
	var src0 = registers[getRegister(instruction[2])]
	var src1 = getValue(instruction[3], registers)
	if(src1 && src1.data) throw 'Should not negate pointer';
	registers[dst] = add(src0,-src1)
}

function findAllLabels(){
	jumpMap = {}
	for(var i=0;i<assembly.length;i++){
		var instruction = assembly[i]
		if(instruction.length == 1){
			var type = instruction[0]
			if(type[type.length-1] == ':'){
				// label
				jumpMap[type.substr(0,type.length-1)] = i+1;
			}
		}
	}
}

function evaluate(value){
	if(value[0] == '#') value = value.substr(1)
	if(value.endsWith('!')) value = value.substr(0, value.length-1)
	if(value.endsWith(']')) value = value.substr(0, value.length-1)
	return eval(value)
}

function parseLoadStoreInfo(instruction){
	if(!instruction.length) return instruction
	// ldr d0 [x2] #2*4
	// ldr s0 [x2, #15]
	// ldr s9 [x2, #5*3]!
	var dst = instruction[1]
	var dstType = dst[0]
	var dstIndex = dst.substr(1)*1
	var src0 = instruction[2]
	var src1 = instruction[3]
	return parseLoadStoreInfo2(dstType, dstIndex, -1, src0, src1)
}

function parseLoadStoreInfoPair(instruction){
	if(!instruction.length) return instruction
	// ldp d0,d5 [x2] #2*4
	// ldp s0,s1 [x2, #15]
	// ldp s9,s10 [x2, #5*3]!
	var dst = instruction[1]
	var dstType = dst[0]
	var dstIndex0 = dst.substr(1)*1
	var dstIndex1 = instruction[2].substr(1)*1
	var src0 = instruction[3]
	var src1 = instruction[4]
	return parseLoadStoreInfo2(dstType, dstIndex0, dstIndex1, src0, src1)
}

function parseLoadStoreInfo2(dstType, dstIndex0, dstIndex1, src0, src1){
	if(!src0.startsWith('[x')) throw src0
	var srcIndex = src0.substring(2)
	if(srcIndex.endsWith(']')) srcIndex = srcIndex.substr(0, srcIndex.length-1)
	srcIndex = srcIndex*1
	var preIncrement = src1 && !src0.endsWith(']') && evaluate(src1)
	var postIncrement = !preIncrement && src1 && evaluate(src1)
	var saveIncrement = postIncrement || (preIncrement && src1.endsWith('!'))
	return {
		dstType, dstIndex0, dstIndex1, srcIndex,
		preIncrement, postIncrement,
		saveIncrement
	}
}

function loadFloat(index, address, vectorRegisters, vectorRegisterSources){
	index = index & (32*4-1)
	vectorRegisters[index] = getArrayEntry(address)
	vectorRegisterSources[index] = address				
	onRead(address)
}

function storeFloat(index, address, vectorRegisters, vectorRegisterSources){
	index = index & (32*4-1)
	setArrayEntry(vectorRegisters[index], address)		
	onWrite(address)
}

function ldrStr(instruction, registers, isPairInstruction, mainOperation){
	
	var info = isPairInstruction ? 
		parseLoadStoreInfoPair(instruction) :
		parseLoadStoreInfo(instruction)
		
	var src = registers[info.srcIndex]
	if(info.preIncrement) src = add(src, info.preIncrement)
		
	mainOperation(src, info)

	if(info.postIncrement) src = add(src, info.postIncrement)
	if(info.saveIncrement) registers[info.srcIndex] = src

}

function ldr(instruction, registers, vectorRegisters, vectorRegisterSources){
	ldrStr(instruction, registers, false, (src, info) => {
		var dx1 = info.dstIndex0
		var dx4 = dx1 * 4
		switch(info.dstType){
			case 'q': // 4 float values
				loadFloat(dx4+0, src,  vectorRegisters, vectorRegisterSources); src1 = add(src,  4)
				loadFloat(dx4+1, src1, vectorRegisters, vectorRegisterSources); src1 = add(src1, 4)
				loadFloat(dx4+2, src1, vectorRegisters, vectorRegisterSources); src1 = add(src1, 4)
				loadFloat(dx4+3, src1, vectorRegisters, vectorRegisterSources)
				break;
			case 'd': // 2 float values
				loadFloat(dx4+0, src,  vectorRegisters, vectorRegisterSources); src1 = add(src, 4)
				loadFloat(dx4+1, src1, vectorRegisters, vectorRegisterSources)
				break;
			case 's': // 1 float value
				loadFloat(dx4, src, vectorRegisters, vectorRegisterSources)
				break;
			case 'x': // 32 bit value
				registers[dx1] = getArrayEntry(src, 4)
				break;
			case 'w': // 64 bit value
				registers[dx1] = getArrayEntry(src, 8)
				break;
			default: throw info.dstType;
		}
	})
}

function str(instruction, registers, vectorRegisters, vectorRegisterSources){
	ldrStr(instruction, registers, false, (src, info) => {
		var dx1 = info.dstIndex0
		var dx4 = dx1 * 4
		switch(info.dstType){
			case 'q': // 4 float values
				storeFloat(dx4+0, src,  vectorRegisters, vectorRegisterSources); src1 = add(src,  4)
				storeFloat(dx4+1, src1, vectorRegisters, vectorRegisterSources); src1 = add(src1, 4)
				storeFloat(dx4+2, src1, vectorRegisters, vectorRegisterSources); src1 = add(src1, 4)
				storeFloat(dx4+3, src1, vectorRegisters, vectorRegisterSources)
				break;
			case 'd': // 2 float values
				storeFloat(dx4+0, src,  vectorRegisters); src1 = add(src, 4)
				storeFloat(dx4+1, src1, vectorRegisters)
				break;
			case 's': // 1 float value
				storeFloat(dx4, src, vectorRegisters)
				break;
			case 'x': // 32 bit value
				setArrayEntry(registers[dx1], src, 4)
				break;
			case 'w': // 64 bit value
				setArrayEntry(registers[dx1], src, 8)
				break;
			default: throw info.dstType;
		}
	})
}

function ldp(instruction, registers, vectorRegisters, vectorRegisterSources){
	ldrStr(instruction, registers, true, (src, info) => {
		var dx1 = info.dstIndex0
		var dx4 = dx1 * 4
		var dy1 = info.dstIndex1
		var dy4 = dy1 * 4
		switch(info.dstType){
			case 'q': // 2x 4 float values
				loadFloat(dx4+0, src,  vectorRegisters, vectorRegisterSources); src1 = add(src,  4)
				loadFloat(dx4+1, src1, vectorRegisters, vectorRegisterSources); src1 = add(src1, 4)
				loadFloat(dx4+2, src1, vectorRegisters, vectorRegisterSources); src1 = add(src1, 4)
				loadFloat(dx4+3, src1, vectorRegisters, vectorRegisterSources); src1 = add(src1, 4)
				loadFloat(dy4+0, src1, vectorRegisters, vectorRegisterSources); src1 = add(src1, 4)
				loadFloat(dy4+1, src1, vectorRegisters, vectorRegisterSources); src1 = add(src1, 4)
				loadFloat(dy4+2, src1, vectorRegisters, vectorRegisterSources); src1 = add(src1, 4)
				loadFloat(dy4+3, src1, vectorRegisters, vectorRegisterSources)
				break;
			case 'd': // 2x 2 float values
				loadFloat(dx4+0, src,  vectorRegisters, vectorRegisterSources); src1 = add(src, 4)
				loadFloat(dx4+1, src1, vectorRegisters, vectorRegisterSources); src1 = add(src, 4)
				loadFloat(dy4+0, src1, vectorRegisters, vectorRegisterSources); src1 = add(src, 4)
				loadFloat(dy4+1, src1, vectorRegisters, vectorRegisterSources)
				break;
			case 's': // 2x 1 float value
				loadFloat(dx4, src,        vectorRegisters, vectorRegisterSources)
				loadFloat(dy4, add(src,4), vectorRegisters, vectorRegisterSources)
				break;
			case 'x': // 2x 32 bit value
				registers[dx1] = getArrayEntry(src, 4)
				registers[dy1] = getArrayEntry(add(src,4), 4)
				break;
			case 'w': // 2x 64 bit value
				registers[dx1] = getArrayEntry(src, 8)
				registers[dy1] = getArrayEntry(add(src,8), 8)
				break;
			default: throw info.dstType;
		}
	})
}

function stp(instruction, registers, vectorRegisters, vectorRegisterSources){
	ldrStr(instruction, registers, true, (src, info) => {
		var dx1 = info.dstIndex0
		var dx4 = dx1 * 4
		var dy1 = info.dstIndex1
		var dy4 = dy1 * 4
		switch(info.dstType){
			case 'q': // 2x 4 float values
				storeFloat(dx4+0, src,  vectorRegisters, vectorRegisterSources); src1 = add(src,  4)
				storeFloat(dx4+1, src1, vectorRegisters, vectorRegisterSources); src1 = add(src1, 4)
				storeFloat(dx4+2, src1, vectorRegisters, vectorRegisterSources); src1 = add(src1, 4)
				storeFloat(dx4+3, src1, vectorRegisters, vectorRegisterSources); src1 = add(src1, 4)
				storeFloat(dy4+0, src1, vectorRegisters, vectorRegisterSources); src1 = add(src1, 4)
				storeFloat(dy4+1, src1, vectorRegisters, vectorRegisterSources); src1 = add(src1, 4)
				storeFloat(dy4+2, src1, vectorRegisters, vectorRegisterSources); src1 = add(src1, 4)
				storeFloat(dy4+3, src1, vectorRegisters, vectorRegisterSources)
				break;
			case 'd': // 2x 2 float values
				storeFloat(dx4+0, src,  vectorRegisters); src1 = add(src, 4)
				storeFloat(dx4+1, src1, vectorRegisters); src1 = add(src, 4)
				storeFloat(dy4+0, src1, vectorRegisters); src1 = add(src, 4)
				storeFloat(dy4+1, src1, vectorRegisters)
				break;
			case 's': // 2x 1 float value
				storeFloat(dx4, src, vectorRegisters)
				storeFloat(dy4, add(src,4), vectorRegisters)
				break;
			case 'x': // 2x 32 bit value
				setArrayEntry(registers[dx1], src, 4)
				setArrayEntry(registers[dy1], add(src,4), 4)
				break;
			case 'w': // 2x 64 bit value
				setArrayEntry(registers[dx1], src, 8)
				setArrayEntry(registers[dy1], add(src,8), 8)
				break;
			default: throw info.dstType;
		}
	})
}

function executeInstruction(instructionType, instruction){
	
	switch(instructionType){
			
		// data movement
		case 'mov':
			var dst = getRegister(instruction[1])
			registers[dst] = getValue(instruction[2], registers)
			break;
		
		case 'ldr': ldr(instruction, registers, vectorRegisters, vectorRegisterSources); break;
		case 'str': str(instruction, registers, vectorRegisters, vectorRegisterSources); break;
		
		case 'ldp': ldp(instruction, registers, vectorRegisters, vectorRegisterSources); break;
		case 'stp': stp(instruction, registers, vectorRegisters, vectorRegisterSources); break;
		
		case 'ld1': ld1(instruction, registers, vectorRegisters, vectorRegisterSources); break;
		case 'st1': st1(instruction, registers, vectorRegisters, vectorRegisterSources); break;
		
		// integer calculations
		case 'add':
			addI(instruction, registers)
			break;
		case 'sub':
			subI(instruction, registers)
			break;
		case 'neg':
			if(instruction.length != 3) throw instruction;
			var dst = getRegister(instruction[1])
			var src0 = registers[getRegister(instruction[2])]
			if(src0 && src0.data) throw 'Should not negate pointer';
			registers[dst] = -src0
			break;
			
		// floating point calculations
		case 'fmla': fmla(instruction, vectorRegisters); break;
		
		// branching
		case 'cbnz':
			if(instruction.length != 3) throw instruction;
			var src = getRegister(instruction[1]);
			src = registers[src]
			// console.log(src)
			if(src != 0){
				var label = instruction[2]
				var found = jumpMap[label]
				if(!found) throw 'label not found: '+label
				log('jump to line', label, src)
				lineNumber = found
			}
			break;
		case 'ret':
			if(instruction.length != 1) throw instruction;
			onReturn()
			stop(true)
			return 1
		
		// unknown instruction
		default:
			log('Unknown instruction', instruction)
			log(registers)
			stop(false)
			return 1;
	}
	
}

function stop(isFinal){
	redrawDelay = 1e9 // stopped
	if(isFinal){
		cont.innerText = 'Restart'
		hasReturned = true
	}
}

function step(skippedDelay=0){
	
	instrCounter++
	
	if(hasReturned) restart()
	if(lineNumber >= assembly.length) throw 'Reached end of assembly without return', lineNumber
	
	// if(instrCounter % 1000 == 0) console.log(instrCounter)
	var instruction = assembly[lineNumber++]
	var instructionType = instruction[0]
	if(instructionType[instructionType.length-1] == ':'){
		
		// just a label: jump over it
		step(skippedDelay)
		
	} else {
		
		skippedDelay = skippedDelay*1 || 0
		var delta = skippedDelay + redrawDelay
		
		if(redrawDelay >= 1e6 || skippedDelay == 0){
			clearCalculationCache()
		}
		
		executeInstruction(instructionType, instruction)
		
		if(redrawDelay < 1e6){
			if(delta >= 1){
				// führe den nächsten Schritt demnächst aus
				redraw()
				setTimeout(() => step(), redrawDelay)
			} else step(delta)	
		} else redraw()
		
	}
	
}
