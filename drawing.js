
// it would be nice to show all number registers
// it would be nice to show the current code position

// todo show number registers
// show vector register values maybe: inside the cell; maybe explicitely
// todo show log

// millis for a step
var redrawDelay0 = 120
var delayDiv = document.getElementById('delay')
if(delayDiv && (delayDiv=delayDiv.innerText*1)){
	redrawDelay0 = delayDiv
}

var redrawDelay = redrawDelay0

var drawnScale = 1
var drawChangeIndex = 1000000
var drawnMatrices = [{
	x: 2.0+n,   y: 1, data: A, ptr: ptrA, m, n: k, offset: 0
},{
	x: 3.0+k+n, y: 1, data: B, ptr: ptrB, m: k, n, offset: maxOffset
},{
	x: 0.5,     y: 1, data: C, ptr: ptrC, m, n, offset: maxOffset*2
}]

var matrixMapping = {}
for(var i=0;i<drawnMatrices.length;i++){
	var matrix = drawnMatrices[i].ptr
	matrixMapping[matrix.name] = i
}

function log(msg){
	var p = document.createElement('p')
	p.innerText = Array.from(arguments).join(', ')
	document.body.appendChild(p)
	console.log(msg)
}

var dstCells = []
var src0Cells = []
var src1Cells = []

var ctx
var size = 1
var zoom = 1
var defaultFont, smallFont, boldFont
var ptrCtr = new Int32Array(maxOffset*3)

function zoomIn(scale=1){
	zoom *= Math.pow(1.2, scale)
	prepareDrawing()
	redraw()
}

function zoomOut(scale=1){
	zoomIn(-scale)
}

function runFaster(scale=1){
	// das Delay halbiert sich alle zwei Schritte
	redrawDelay0 *= Math.pow(0.5, 0.5 * scale)
	if(redrawDelay < 1e9) redrawDelay = redrawDelay0
}

function runSlower(scale=1){
	runFaster(-scale)
}

function prepareDrawing(){
	
	var availableWidth = innerWidth
	var availableHeight = innerHeight * 0.7 // ein bisschen Platz für anderes
	var requiredWidth = k+n+n+3.3
	var requiredHeight = Math.max(m,k)+0.5
	drawnScale = Math.max(zoom * Math.min(
		availableWidth/requiredWidth,
		availableHeight/requiredHeight
	)|0, 1)
	canvas.width = drawnScale * requiredWidth
	canvas.height = drawnScale * requiredHeight
	ctx = canvas.getContext('2d')
	
	var fontFamily = 'Monospace'
	var scale = drawnScale * 1.2
	size = Math.max(1, (drawnScale*0.9)|0)
	defaultFont = ((scale*0.25)|0)+'px '+fontFamily
	smallFont = ((scale*0.15)|0)+'px '+fontFamily
	boldFont = 'bold '+((scale*0.35)|0)+'px '+fontFamily
	
}

function getCellDrawIndex(cell){
	var offset = drawnMatrices[matrixMapping[cell.name]].offset
	return offset + cell.offset/4
}

function onChange(cell,read){
	var index = getCellDrawIndex(cell)
	if(index == undefined) return
	recentUsage[index*2+0] = drawChangeIndex++
	recentUsage[index*2+1] = read ? 2 : 1
}

function onRead(cell){
	onChange(cell,1)
}

function onWrite(cell){
	onChange(cell,0)
}

function onCalculate2(dst,src0,src1){
	dstCells.push(vectorRegisterSources[dst])
	src0Cells.push(vectorRegisterSources[src0])
	src1Cells.push(vectorRegisterSources[src1])
}

function onCalculate(dst,src0,src1){
	dstCells.push(dst)
	src0Cells.push(src0)
	src1Cells.push(src1)
}

function drawMatrix(matrix){
	
	var m = matrix.m
	var n = matrix.n
	var dx = matrix.x
	var dy = matrix.y
	var offset = matrix.offset
	var data = matrix.data
	
	ctx.textBaseline = 'middle'
	ctx.textAlign = 'center'
	
	// draw matrix name
	ctx.font = boldFont
	ctx.fillStyle = '#555'
	ctx.fillText(matrix.ptr.name, ((n-1)/2+dx)*drawnScale, dy*drawnScale-size*0.72)
	
	for(var y=0;y<m;y++){
		for(var x=0;x<n;x++){
			
			var index = y+x*m
			
			// draw background
			var value = data[index]
			var usageIndex = (index+offset)*2
			var age = drawChangeIndex - recentUsage[usageIndex]
			r = clamp(age*4, 0, 255)*200/255
			r2 = r/2+128
			r3 = r*0.6+80
			var ru = recentUsage[usageIndex+1]
			ctx.fillStyle = ru == 0 ? '#ccc' : ru == 2 ? 'rgb('+r+','+r2+','+r2+')' : 'rgb('+r3+',220,'+r3+')'
			var px = (x+dx)*drawnScale, py = (y+dy)*drawnScale
			ctx.fillRect(px-size/2, py-size/2, size, size)
			
			// draw value
			ctx.font = defaultFont
			ctx.fillStyle = 'black'
			ctx.fillText(value, px, py)
			
			// draw address
			ctx.fillStyle = '#0003'
			ctx.font = smallFont
			ctx.fillText('#'+(index)+'*4', px, py-size*0.3)
		}
	}
}

function redraw(){
	
	ctx.setTransform(1, 0, 0, 1, 0, 0)
	ctx.fillStyle = 'white'
	ctx.fillRect(0,0,canvas.width,canvas.height)
	
	for(var i=0;i<drawnMatrices.length;i++){
		var matrix = drawnMatrices[i]
		drawMatrix(matrix)
	}
	
	ctx.font = smallFont
	
	// todo draw all int registers (in some kind of list)
	
	// todo draw all vector registers
	
	drawVectorRegisterBorders()
	
	drawRegistersWithPointers()
	
	// draw calculations
	drawCalculationCells(dstCells,  '#333', size)
	drawCalculationCells(src0Cells, '#333', size)
	drawCalculationCells(src1Cells, '#333', size)
	
}

function clearCalculationCache(){
	if(dstCells.length){
		dstCells = []
		src0Cells = []
		src1Cells = []
	}
}

function drawRegistersWithPointers(){
	
	ctx.font = boldFont
	var size = Math.max(1, (drawnScale*0.9)|0)
	for(var i=0;i<registers.length;i++){
		var cell = registers[i]
		if(cell && cell.data){
			var cellIndex = getCellDrawIndex(cell)
			var matrix = drawnMatrices[matrixMapping[cell.name]]
			var offset = cell.offset/4
			var dx = matrix.x
			var dy = matrix.y
			var x = (offset/matrix.m)|0
			var y = offset % matrix.m
			var px = (x+dx)*drawnScale, py = (y+dy)*drawnScale
			ctx.fillStyle = '#553333'
			ctx.fillText('R'+i, px, py-size*0.42+ptrCtr[cellIndex]*size*0.34)
			ptrCtr[cellIndex]++
		}
	}
	
	for(var i=0;i<registers.length;i++){
		var cell = registers[i]
		if(cell && cell.data){
			var cellIndex = getCellDrawIndex(cell)
			ptrCtr[cellIndex] = 0
		}
	}
	
}

function drawVectorRegisterBorders(){
	
	// wenn die Werte sehr groß sind, müssten wir den Text eigentlich ein bisschen kleiner skalieren
	// oder zweizeilig machen... das hat aber denke eher geringe Priorität
	// draw used vector registers with direct data contact
	for(var i=0;i<32*4;i++){
		var cell = vectorRegisterSources[i]
		if(cell && cell.data){
			var cellIndex = getCellDrawIndex(cell)
			var matrixIndex = matrixMapping[cell.name]
			var matrix = drawnMatrices[matrixIndex]
			var offset = cell.offset/4
			var dx = matrix.x
			var dy = matrix.y
			var x = (offset/matrix.m)|0
			var y = offset % matrix.m
			var px = (x+dx)*drawnScale, py = (y+dy)*drawnScale
			ctx.fillStyle = '#000'
			var text = 'v'+(i>>2)+'['+(i&3)+']'
			ctx.fillText(text, px+ptrCtr[cellIndex]*size*0.27, py+size*0.25)
			if(vectorRegisters[i] != matrices[matrixIndex].data[offset]){
				text = '*'+vectorRegisters[i]
				ctx.fillStyle = '#131'
				ctx.fillText(text, px+ptrCtr[cellIndex]*size*0.27, py+size*0.45)
			}
		}
	}
	
}

function drawCalculationCells(cells,color){
	ctx.strokeStyle = color
	ctx.lineWidth = Math.max(2, size/15)+''
	for(var i=0;i<cells.length;i++) drawCalculationCell(cells[i])
}

function drawCalculationCell(cell){
	var cellIndex = getCellDrawIndex(cell)
	var matrix = drawnMatrices[matrixMapping[cell.name]]
	var offset = cell.offset/4
	var dx = matrix.x
	var dy = matrix.y
	var x = (offset/matrix.m)|0
	var y = offset % matrix.m
	var px = (x+dx)*drawnScale, py = (y+dy)*drawnScale
	ctx.beginPath()
	ctx.rect(px-size/2, py-size/2, size, size)
	ctx.stroke()
}

window.addEventListener('resize', () => {
	prepareDrawing()
	redraw()
});

