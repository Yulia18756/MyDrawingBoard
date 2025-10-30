
const WebSocket = require('ws');
const express = require('express');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app); 
const wss = new WebSocket.Server({ server }); 

let drawingHistory = [];
const PORT = 8080;

console.log('Сервер WebSocket v10 (Webserver + Resize) запущено на порту 8080');


app.use(express.static(path.join(__dirname)));


app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});


function broadcastToOthers(data, sender) {
    wss.clients.forEach(client => {
        if (client !== sender && client.readyState === WebSocket.OPEN) {
            client.send(data.toString());
        }
    });
}

wss.on('connection', ws => {
    console.log(`Новий клієнт підключився`);
    ws.send(JSON.stringify({ type: 'history', data: drawingHistory }));

    ws.on('message', message => {
        const messageString = message.toString();
        let dataObject;

        try { dataObject = JSON.parse(messageString); }
        catch (e) { console.error("Помилка парсингу JSON:", e); return; }

        if (['draw', 'erase', 'rect', 'text', 'line', 'arrow'].includes(dataObject.type)) {
            drawingHistory.push(dataObject);
            broadcastToOthers(messageString, ws);
        } else if (dataObject.type === 'move') {
            let objToMove = drawingHistory.find(item => item.id === dataObject.id);
            if (objToMove) { Object.assign(objToMove, dataObject.newCoords); }
            broadcastToOthers(messageString, ws);
        } else if (dataObject.type === 'resize') {
            let objToResize = drawingHistory.find(item => item.id === dataObject.id);
            if (objToResize) { Object.assign(objToResize, dataObject.newDimensions); }
            broadcastToOthers(messageString, ws);
        } else if (dataObject.type === 'cursor') {
            if (!ws.id) { ws.id = dataObject.id; }
            const cursorUpdate = { type: 'cursor_update', id: ws.id, x: dataObject.x, y: dataObject.y, tool: dataObject.tool };
            broadcastToOthers(JSON.stringify(cursorUpdate), ws);
        }
    });

    ws.on('close', () => {
        if (ws.id) {
            console.log(`Клієнт ${ws.id} відключився`);
            const disconnectMessage = { type: 'user_disconnect', id: ws.id };
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(disconnectMessage));
                }
            });
        }
    });
});


server.listen(PORT, () => {
    console.log(`HTTP-сервер слухає на http://localhost:${PORT}`);
});