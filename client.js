
const socket = new WebSocket('ws://localhost:8080');

const colorPicker = document.getElementById('colorPicker');
const lineWidthInput = document.getElementById('lineWidth');
const canvas = document.getElementById('drawingBoard');
const ctx = canvas.getContext('2d');

let viewState = { scale: 1.0, offsetX: 0, offsetY: 0 };
let isDrawing = false;
let isPanning = false;
let isDragging = false;
let isResizing = false; 
let activeHandle = null; 

let lastX = 0, lastY = 0, startX = 0, startY = 0;
let lastPanX = 0, lastPanY = 0;
let currentTool = 'select';
let localDrawingHistory = [];
let previewObject = null;
let myId = crypto.randomUUID();
let otherCursors = {};
let selectedObjectId = null;
let dragOffsetX = 0, dragOffsetY = 0;

const HANDLE_SIZE = 8; 


function screenToWorld(screenX, screenY) {
    return { x: (screenX - viewState.offsetX) / viewState.scale, y: (screenY - viewState.offsetY) / viewState.scale };
}


function redrawCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(viewState.offsetX, viewState.offsetY);
    ctx.scale(viewState.scale, viewState.scale);

    localDrawingHistory.forEach(item => {
        
        if (item.type === 'draw') _drawLine(item.x1, item.y1, item.x2, item.y2, item.color, item.width);
        else if (item.type === 'erase') _erase(item.x1, item.y1, item.x2, item.y2, item.width);
        else if (item.type === 'rect') _drawRect(item.x, item.y, item.width, item.height, item.color, item.lineWidth);
        else if (item.type === 'text') _drawText(item.text, item.x, item.y, item.color, item.size);
        else if (item.type === 'line') _drawStraightLine(item.x1, item.y1, item.x2, item.y2, item.color, item.width);
        else if (item.type === 'arrow') _drawArrow(item.x1, item.y1, item.x2, item.y2, item.color, item.width);

        
        if (item.id === selectedObjectId) {
            _drawSelectionBox(item);
        }
    });

    if (previewObject) {
        if (previewObject.type === 'rect') _drawRect(previewObject.x, previewObject.y, previewObject.width, previewObject.height, previewObject.color, previewObject.lineWidth);
        else if (previewObject.type === 'line') _drawStraightLine(previewObject.x1, previewObject.y1, previewObject.x2, previewObject.y2, previewObject.color, previewObject.width);
        else if (previewObject.type === 'arrow') _drawArrow(previewObject.x1, previewObject.y1, previewObject.x2, previewObject.y2, previewObject.color, previewObject.width);
    }

    for (const id in otherCursors) {
        _drawCursor(otherCursors[id].x, otherCursors[id].y, otherCursors[id].tool);
    }
    ctx.restore();
}


socket.onopen = () => console.log('Підключено до WebSocket сервера');
socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    switch (data.type) {
        case 'history':
            localDrawingHistory = data.data;
            redrawCanvas();
            break;
        case 'draw': case 'erase': case 'rect': case 'text': case 'line': case 'arrow':
            localDrawingHistory.push(data);
            redrawCanvas();
            break;
        case 'move':
            let objToMove = localDrawingHistory.find(item => item.id === data.id);
            if (objToMove) { Object.assign(objToMove, data.newCoords); }
            redrawCanvas();
            break;

        
        case 'resize':
            let objToResize = localDrawingHistory.find(item => item.id === data.id);
            if (objToResize) { Object.assign(objToResize, data.newDimensions); }
            redrawCanvas();
            break;

        case 'cursor_update':
            if (data.id !== myId) {
                otherCursors[data.id] = { x: data.x, y: data.y, tool: data.tool };
                redrawCanvas();
            }
            break;
        case 'user_disconnect':
            delete otherCursors[data.id];
            redrawCanvas();
            break;
    }
};
socket.onclose = () => console.log('Відключено від WebSocket сервера');


function _drawLine(x1, y1, x2, y2, color, width) { 
    ctx.globalCompositeOperation = 'source-over'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.strokeStyle = color; ctx.lineWidth = width / viewState.scale; ctx.lineCap = 'round'; ctx.stroke();
}
function _erase(x1, y1, x2, y2, width) { 
    ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.lineWidth = width / viewState.scale; ctx.lineCap = 'round'; ctx.stroke(); ctx.globalCompositeOperation = 'source-over';
}
function _drawRect(x, y, width, height, color, lineWidth) { 
    ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = color; ctx.lineWidth = lineWidth / viewState.scale;
    ctx.strokeRect(x, y, width, height);
}
function _drawText(text, x, y, color, size) { 
    ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = color;
    const fontSize = (size * 3); 
    ctx.font = `${fontSize / viewState.scale}px sans-serif`; 
    ctx.fillText(text, x, y);
}
function _drawStraightLine(x1, y1, x2, y2, color, width) { 
    ctx.globalCompositeOperation = 'source-over'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.strokeStyle = color; ctx.lineWidth = width / viewState.scale; ctx.lineCap = 'round'; ctx.stroke();
}
function _drawArrow(x1, y1, x2, y2, color, width) { 
    ctx.globalCompositeOperation = 'source-over'; const headSize = (width * 2 + 10) / viewState.scale;
    const dx = x2 - x1, dy = y2 - y1; const angle = Math.atan2(dy, dx);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.strokeStyle = color;
    ctx.lineWidth = width / viewState.scale; ctx.lineCap = 'round'; ctx.stroke();
    ctx.beginPath(); ctx.fillStyle = color; ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headSize * Math.cos(angle - Math.PI / 6), y2 - headSize * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x2 - headSize * Math.cos(angle + Math.PI / 6), y2 - headSize * Math.sin(angle + Math.PI / 6));
    ctx.closePath(); ctx.fill();
}
function _drawCursor(x, y, tool) { 
    ctx.globalCompositeOperation = 'source-over'; ctx.beginPath();
    ctx.arc(x, y, 5 / viewState.scale, 0, 2 * Math.PI); ctx.fillStyle = 'blue'; ctx.fill();
    ctx.font = `${10 / viewState.scale}px sans-serif`; ctx.fillStyle = 'black';
    ctx.fillText(tool, x + 8 / viewState.scale, y + 8 / viewState.scale);
}


function _drawSelectionBox(item) {
    ctx.setLineDash([5 / viewState.scale, 5 / viewState.scale]); 

    const handles = getHandles(item); 
    let box = handles.box; 

    
    if (box) {
        ctx.strokeStyle = 'rgba(0, 0, 255, 0.7)';
        ctx.lineWidth = 1 / viewState.scale;
        ctx.strokeRect(box.x, box.y, box.w, box.h);
    }

    
    ctx.setLineDash([]);
    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'blue';
    ctx.lineWidth = 1 / viewState.scale;

    const handleSizeWorld = HANDLE_SIZE / viewState.scale; 

    handles.points.forEach(handle => {
        ctx.fillRect(handle.x - handleSizeWorld / 2, handle.y - handleSizeWorld / 2, handleSizeWorld, handleSizeWorld);
        ctx.strokeRect(handle.x - handleSizeWorld / 2, handle.y - handleSizeWorld / 2, handleSizeWorld, handleSizeWorld);
    });
}


function sendData(data) { socket.send(JSON.stringify(data)); }
function sendCursor(x, y, tool) {
    if (socket.readyState === WebSocket.OPEN) {
        const data = { type: 'cursor', id: myId, x: x, y: y, tool: tool };
        socket.send(JSON.stringify(data));
    }
}

function sendResize(obj) {
    let newDimensions = {};
    if (obj.type === 'rect') newDimensions = { x: obj.x, y: obj.y, width: obj.width, height: obj.height };
    else if (obj.type === 'text') newDimensions = { x: obj.x, y: obj.y, size: obj.size }; 
    else if (obj.type === 'line' || obj.type === 'arrow') newDimensions = { x1: obj.x1, y1: obj.y1, x2: obj.x2, y2: obj.y2 };

    sendData({ type: 'resize', id: obj.id, newDimensions: newDimensions });
}
function sendMove(obj) { 
    let newCoords = {};
    if (obj.type === 'rect' || obj.type === 'text') newCoords = { x: obj.x, y: obj.y };
    else if (obj.type === 'line' || obj.type === 'arrow') newCoords = { x1: obj.x1, y1: obj.y1, x2: obj.x2, y2: obj.y2 };
    sendData({ type: 'move', id: obj.id, newCoords: newCoords });
}

-
function findClickedObject(worldX, worldY) { 
    for (const item of [...localDrawingHistory].reverse()) {
        let x, y, w, h;
        if (item.type === 'rect') {
            [x, y, w, h] = [item.x, item.y, item.width, item.height];
            if (w < 0) { x = x + w; w = -w; }
            if (h < 0) { y = y + h; h = -h; }
            if (worldX > x && worldX < x + w && worldY > y && worldY < y + h) return item;
        } else if (item.type === 'line' || item.type === 'arrow') {
            x = Math.min(item.x1, item.x2); y = Math.min(item.y1, item.y2);
            w = Math.abs(item.x1 - item.x2); h = Math.abs(item.y1 - item.y2);
            const buffer = 5 / viewState.scale;
            if (worldX > x - buffer && worldX < x + w + buffer && worldY > y - buffer && worldY < y + h + buffer) return item;
        } else if (item.type === 'text') {
            const fontSize = (item.size * 3);
            const textWidth = fontSize * item.text.length * 0.5;
            [x, y, w, h] = [item.x, item.y - fontSize, textWidth, fontSize];
            if (worldX > x && worldX < x + w && worldY > y && worldY < y + h) return item;
        }
    }
    return null;
}
function moveObject(obj, dx, dy) { 
    if (obj.type === 'rect' || obj.type === 'text') { obj.x += dx; obj.y += dy; }
    else if (obj.type === 'line' || obj.type === 'arrow') { obj.x1 += dx; obj.y1 += dy; obj.x2 += dx; obj.y2 += dy; }
}


function getHandles(item) {
    let points = [];
    let box = null;
    const padding = 5 / viewState.scale;

    if (item.type === 'rect') {
        const x1 = item.x, y1 = item.y;
        const x2 = item.x + item.width, y2 = item.y + item.height;
        points = [
            { name: 'nw', x: x1, y: y1 }, { name: 'ne', x: x2, y: y1 },
            { name: 'sw', x: x1, y: y2 }, { name: 'se', x: x2, y: y2 }
        ];
        box = { x: Math.min(x1, x2) - padding, y: Math.min(y1, y2) - padding, w: Math.abs(item.width) + 2 * padding, h: Math.abs(item.height) + 2 * padding };
    } else if (item.type === 'line' || item.type === 'arrow') {
        points = [{ name: 'start', x: item.x1, y: item.y1 }, { name: 'end', x: item.x2, y: item.y2 }];
        box = {
            x: Math.min(item.x1, item.x2) - padding, y: Math.min(item.y1, item.y2) - padding,
            w: Math.abs(item.x1 - item.x2) + 2 * padding, h: Math.abs(item.y1 - item.y2) + 2 * padding
        };
    } else if (item.type === 'text') {
        const fontSize = (item.size * 3);
        const textWidth = fontSize * item.text.length * 0.6; 
        const x1 = item.x, y1 = item.y - fontSize;
        const x2 = item.x + textWidth, y2 = item.y;
        points = [{ name: 'se', x: x2, y: y2 }]; 
        box = { x: x1 - padding, y: y1 - padding, w: textWidth + 2 * padding, h: fontSize + 2 * padding };
    }
    return { points, box };
}


function findClickedHandle(worldX, worldY) {
    if (!selectedObjectId) return null;
    const obj = localDrawingHistory.find(item => item.id === selectedObjectId);
    if (!obj) return null;

    const handles = getHandles(obj);
    const handleSizeWorld = HANDLE_SIZE / viewState.scale;

    for (const handle of handles.points) {
        if (worldX > handle.x - handleSizeWorld / 2 && worldX < handle.x + handleSizeWorld / 2 &&
            worldY > handle.y - handleSizeWorld / 2 && worldY < handle.y + handleSizeWorld / 2) {
            return handle.name;
        }
    }
    return null;
}


function resizeObject(obj, handle, worldX, worldY) {
    if (obj.type === 'rect') {
        if (handle === 'se') {
            obj.width = worldX - obj.x;
            obj.height = worldY - obj.y;
        } else if (handle === 'nw') {
            obj.width = (obj.x + obj.width) - worldX;
            obj.height = (obj.y + obj.height) - worldY;
            obj.x = worldX;
            obj.y = worldY;
        } else if (handle === 'ne') {
            obj.width = worldX - obj.x;
            obj.height = (obj.y + obj.height) - worldY;
            obj.y = worldY;
        } else if (handle === 'sw') {
            obj.width = (obj.x + obj.width) - worldX;
            obj.height = worldY - obj.y;
            obj.x = worldX;
        }
    } else if (obj.type === 'line' || obj.type === 'arrow') {
        if (handle === 'start') {
            obj.x1 = worldX; obj.y1 = worldY;
        } else if (handle === 'end') {
            obj.x2 = worldX; obj.y2 = worldY;
        }
    } else if (obj.type === 'text') {
        if (handle === 'se') {
            
            const dist = Math.max(Math.abs(worldX - obj.x), Math.abs(worldY - obj.y));
            obj.size = Math.max(1, Math.round(dist / 5)); 
        }
    }
}


canvas.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const worldPos = screenToWorld(e.offsetX, e.offsetY);
    [lastX, lastY] = [worldPos.x, worldPos.y];

    if (e.button === 1) { 
        isPanning = true;[lastPanX, lastPanY] = [e.offsetX, e.offsetY];
        canvas.style.cursor = 'grabbing'; return;
    }

    if (e.button === 0) { 
        if (currentTool === 'select') {
            
            activeHandle = findClickedHandle(worldPos.x, worldPos.y);
            if (activeHandle) {
                isResizing = true;
                canvas.style.cursor = 'crosshair'; 
            }
            
            else {
                const clickedObject = findClickedObject(worldPos.x, worldPos.y);
                if (clickedObject) {
                    selectedObjectId = clickedObject.id;
                    isDragging = true;
                    const startKeyX = clickedObject.type === 'rect' || clickedObject.type === 'text' ? 'x' : 'x1';
                    const startKeyY = clickedObject.type === 'rect' || clickedObject.type === 'text' ? 'y' : 'y1';
                    dragOffsetX = worldPos.x - clickedObject[startKeyX];
                    dragOffsetY = worldPos.y - clickedObject[startKeyY];
                    canvas.style.cursor = 'move';
                } else {
                    selectedObjectId = null; 
                }
            }
        } else if (currentTool === 'text') {
            createTextEntry(e); return;
        } else {
            isDrawing = true; 
            [startX, startY] = [worldPos.x, worldPos.y];
        }
        redrawCanvas();
    }
});

canvas.addEventListener('mousemove', (e) => {
    e.preventDefault();
    const worldPos = screenToWorld(e.offsetX, e.offsetY);
    const dx = worldPos.x - lastX;
    const dy = worldPos.y - lastY;

   
    if (isPanning) {
        viewState.offsetX += (e.offsetX - lastPanX);
        viewState.offsetY += (e.offsetY - lastPanY);
        [lastPanX, lastPanY] = [e.offsetX, e.offsetY];
        redrawCanvas(); return;
    }

    
    if (!isDragging && !isResizing) {
        sendCursor(worldPos.x, worldPos.y, currentTool);
    }

    
    if (isResizing && selectedObjectId) {
        let obj = localDrawingHistory.find(item => item.id === selectedObjectId);
        if (obj) {
            resizeObject(obj, activeHandle, worldPos.x, worldPos.y);
            redrawCanvas();
        }
    }
    
    else if (isDragging && selectedObjectId) {
        let obj = localDrawingHistory.find(item => item.id === selectedObjectId);
        if (obj) {
            moveObject(obj, dx, dy);
            redrawCanvas();
        }
    }
    
    else if (isDrawing) {
       
        const currentColor = colorPicker.value;
        const currentSize = parseInt(lineWidthInput.value);
        if (currentTool === 'pencil' || currentTool === 'eraser') {
            const type = currentTool === 'pencil' ? 'draw' : 'erase';
            const data = { type: type, x1: lastX, y1: lastY, x2: worldPos.x, y2: worldPos.y, color: currentColor, width: currentSize };
            localDrawingHistory.push(data); sendData(data);
            if (type === 'draw') _drawLine(data.x1, data.y1, data.x2, data.y2, data.color, data.width);
            else _erase(data.x1, data.y1, data.x2, data.y2, data.width);
        }
        else if (['rect', 'line', 'arrow'].includes(currentTool)) {
            if (currentTool === 'rect') previewObject = { type: 'rect', x: startX, y: startY, width: worldPos.x - startX, height: worldPos.y - startY, color: currentColor, lineWidth: currentSize };
            else if (currentTool === 'line') previewObject = { type: 'line', x1: startX, y1: startY, x2: worldPos.x, y2: worldPos.y, color: currentColor, width: currentSize };
            else if (currentTool === 'arrow') previewObject = { type: 'arrow', x1: startX, y1: startY, x2: worldPos.x, y2: worldPos.y, color: currentColor, width: currentSize };
            redrawCanvas();
        }
    }

    [lastX, lastY] = [worldPos.x, worldPos.y];
});

canvas.addEventListener('mouseup', (e) => {
    e.preventDefault();
    if (e.button === 1) { 
        isPanning = false; setActiveTool(currentTool);
    }
    if (e.button === 0) { 
       
        if (isResizing && selectedObjectId) {
            let obj = localDrawingHistory.find(item => item.id === selectedObjectId);
            if (obj) {
                sendResize(obj); 
            }
            isResizing = false; activeHandle = null;
            setActiveTool(currentTool);
        }
       
        else if (isDragging && selectedObjectId) {
            let obj = localDrawingHistory.find(item => item.id === selectedObjectId);
            if (obj) {
                sendMove(obj); 
            }
            isDragging = false;
            setActiveTool(currentTool);
        }
        
        else if (isDrawing) {
            isDrawing = false;
            const worldPos = screenToWorld(e.offsetX, e.offsetY);
            const currentColor = colorPicker.value;
            const currentSize = parseInt(lineWidthInput.value);
            let finalObject = null;
            
            if (currentTool === 'rect') finalObject = { id: crypto.randomUUID(), type: 'rect', x: startX, y: startY, width: worldPos.x - startX, height: worldPos.y - startY, color: currentColor, lineWidth: currentSize };
            else if (currentTool === 'line') finalObject = { id: crypto.randomUUID(), type: 'line', x1: startX, y1: startY, x2: worldPos.x, y2: worldPos.y, color: currentColor, width: currentSize };
            else if (currentTool === 'arrow') finalObject = { id: crypto.randomUUID(), type: 'arrow', x1: startX, y1: startY, x2: worldPos.x, y2: worldPos.y, color: currentColor, width: currentSize };

            if (finalObject) {
                localDrawingHistory.push(finalObject);
                sendData(finalObject);
            }
            previewObject = null;
            redrawCanvas();
        }
    }
});

canvas.addEventListener('mouseout', () => {
    isDrawing = false; isPanning = false; isDragging = false; isResizing = false;
    setActiveTool(currentTool);
});
canvas.addEventListener('wheel', (e) => { 
    e.preventDefault(); const mouseX = e.offsetX, mouseY = e.offsetY;
    const scaleAmount = 1.1, zoomIn = e.deltaY < 0;
    const oldScale = viewState.scale;
    viewState.scale = zoomIn ? oldScale * scaleAmount : oldScale / scaleAmount;
    viewState.scale = Math.max(0.1, Math.min(10, viewState.scale));
    viewState.offsetX = mouseX - (mouseX - viewState.offsetX) * (viewState.scale / oldScale);
    viewState.offsetY = mouseY - (mouseY - viewState.offsetY) * (viewState.scale / oldScale);
    redrawCanvas();
});


function createTextEntry(e) { 
    const screenX = e.offsetX, screenY = e.offsetY;
    const worldPos = screenToWorld(screenX, screenY);
    const input = document.createElement('input');
    input.type = 'text'; input.className = 'text-input-overlay';
    input.style.left = `${screenX}px`; input.style.top = `${screenY}px`;
    const currentSize = parseInt(lineWidthInput.value);
    const currentColor = colorPicker.value;
    input.style.font = `${currentSize * 2}px sans-serif`;
    input.style.color = currentColor;
    document.body.appendChild(input); input.focus();
    const onTextSubmit = () => {
        const text = input.value;
        if (text) {
            const data = { id: crypto.randomUUID(), type: 'text', text: text, x: worldPos.x, y: worldPos.y + (currentSize * 2), color: currentColor, size: currentSize };
            sendData(data); localDrawingHistory.push(data); redrawCanvas();
        }
        if (document.body.contains(input)) { document.body.removeChild(input); }
    };
    input.addEventListener('blur', onTextSubmit, { once: true });
    input.addEventListener('keydown', (keyEvent) => {
        if (keyEvent.key === 'Enter') { onTextSubmit(); }
    }, { once: true });
}


const allButtons = [
    document.getElementById('selectBtn'), document.getElementById('pencilBtn'),
    document.getElementById('eraserBtn'), document.getElementById('rectBtn'),
    document.getElementById('textBtn'), document.getElementById('lineBtn'),
    document.getElementById('arrowBtn')
];
function setActiveTool(tool) {
    allButtons.forEach(btn => btn.classList.remove('active'));
    let cursorType = 'crosshair';
    if (tool === 'select') { document.getElementById('selectBtn').classList.add('active'); cursorType = 'default'; }
    else if (tool === 'pencil') { document.getElementById('pencilBtn').classList.add('active'); }
    else if (tool === 'eraser') { document.getElementById('eraserBtn').classList.add('active'); }
    else if (tool === 'rect') { document.getElementById('rectBtn').classList.add('active'); }
    else if (tool === 'text') { document.getElementById('textBtn').classList.add('active'); cursorType = 'text'; }
    else if (tool === 'line') { document.getElementById('lineBtn').classList.add('active'); }
    else if (tool === 'arrow') { document.getElementById('arrowBtn').classList.add('active'); }
    canvas.style.cursor = cursorType;
    currentTool = tool;
}
allButtons.forEach(btn => {
    btn.addEventListener('click', () => setActiveTool(btn.id.replace('Btn', '')));
});
setActiveTool('select');