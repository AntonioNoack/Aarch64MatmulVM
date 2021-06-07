
loadAssemblyCode(code.innerHTML)
// if(code.tag == 'textarea') codeText.value = code.innerHTML; else
codeText.innerHTML = code.innerHTML

// syntax highlighting
// the original arm-asm isn't perfect,
// but I've extended it a little, and now it's better
// still not perfect, but much better than no syntax highlighting
hljs.highlightAll()

var m = 16, k = 12, n = 4
mkn = document.getElementById('mkn')
if(mkn && mkn.innerText.length>4){
	mkn = mkn.innerText.split(',')
	if(mkn.length == 3){
		m = mkn[0]*1 || m
		k = mkn[1]*1 || k
		n = mkn[2]*1 || n
	}
}

var h1 = document.getElementsByTagName('h1')[0]
h1.innerText = 'AARCH64, '+m+' x '+k+' x '+n+' Matrix-Multiplication'

var A = new Float32Array(m*k)
var B = new Float32Array(k*n)
var C = new Float32Array(m*n)

var ldA = m, ldB = k, ldC = m

var ptrA = createPointer(A, 'A')
var ptrB = createPointer(B, 'B')
var ptrC = createPointer(C, 'C')

var matrices, registers
var vectorRegisters = new Float32Array(32 * 4)
var vectorRegisterSources

var maxOffset = Math.max(m,k)*Math.max(k,n)
var recentUsage = new Int32Array(maxOffset * 3 * 2)

restart()

onReturn = () => {

	var C2 = new Float32Array(m*n)
	for(var j=0;j<C2.length;j++) C2[j] = 0;

	for(var mi=0;mi<m;mi++){
		for(var ni=0;ni<n;ni++){
			for(var ki=0;ki<k;ki++){
				C2[mi+ni*ldC] += A[mi+ki*ldA] * B[ki+ni*ldB]
			}
		}
	}

	var error = 0
	for(var mi=0;mi<m;mi++){
		for(var ni=0;ni<n;ni++){
			var i = mi+ni*ldC;
			var diff = C[i]-C2[i]
			if(diff) console.log(mi,ni,C[i],C2[i])
			error += diff*diff;
		}
	}

	log('done, error: ' + error)
	
	// wenn die Geschwindigkeit sehr hoch ist,
	// kann die letzte Operation mehrere Rechnungen enthalten
	// das ist als Bild nicht unbedingt ideal, also leeren wir den Cache,
	// und malen neu
	
	clearCalculationCache()
	redraw()

}

 