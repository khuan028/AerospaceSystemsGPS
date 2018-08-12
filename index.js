if (process.argv.length < 3) {
    console.error("The format is 'node index.js {port_id}'. Usually, the port_id is COM3, COM4, or COM5.");
    process.exit(1);
}

let express = require('express')
let app = express();                        //Import Express.js
let http = require('http').Server(app);     //Import http and start a web server
let io = require('socket.io')(http);        //Import socket.io and link it with the web server
let serveStatic = require('serve-static')   //Enable static file lookup
let SerialPort = require('serialport')      //Enable communication with serial ports (like USB)
let opn = require('opn');                   //Automatically open the web browser

let XBeePort = new SerialPort(process.argv[2], (error) => {
    console.log(error);
    console.log("Program will continue without serial port connection.");
});
let XBeeParser = new SerialPort.parsers.Readline();

XBeePort.pipe(XBeeParser);
app.use(serveStatic(__dirname));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {
    console.log('user connected');

    socket.on('XBeeWrite', (msg) => {
        console.log("Sending ... " + msg);
        XBeePort.write(msg + "\n");
    });

    XBeeParser.on('data', (data) => {
        console.log("Receiving ... " + data);
        socket.emit('XBeeRead', data);
    }); 

    socket.on('disconnect', () => {
        console.log('user disconnected');
        XBeeParser.removeListener('data', XBeeToSocket);    //removes the listener from the XBeeParser (IMPORTANT!)
    });
});

http.listen(3000, () => {
    console.log('listening on 3000');
    opn('http://localhost:3000');
});



