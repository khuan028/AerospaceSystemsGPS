/* Title: XBee_Two_way_2.ino 
 * --------
 * Connections: 
 * XBee TX --> Ard TX
 * XBee RX --> Ard RX
 * 
 * GPS TX --> Ard 2
 * GPS RX --> Ard 3
 */

#include <SoftwareSerial.h>
#include <TinyGPS.h>
#define XBee Serial

const int LEDPin = 8;
const int GPS_MSG_DELAY = 400;

//XBee
String inputMsg;
//XBee will use the TX/RX pins for serial communication

//GPS
TinyGPS gps;
SoftwareSerial GPS(2, 3);
bool newData = false;
int lastMsgTime;

void setup() {
  //Begin serial connections
  XBee.begin(9600);
  GPS.begin(9600);

  //Set pin mode
  pinMode(LEDPin, OUTPUT);

  //Initialize pin value
  digitalWrite(LEDPin, LOW);
}

void loop() {
  ReceiveXBeeData();  //Receive commands from XBee
  ProcessData();      //Execute commands
  GPSData();
}

void print_date(TinyGPS &gps)
{
  int year;
  byte month, day, hour, minute, second, hundredths;
  unsigned long age;
  gps.crack_datetime(&year, &month, &day, &hour, &minute, &second, &hundredths, &age);
  if (age != TinyGPS::GPS_INVALID_AGE) {
    char sz[32];
    sprintf(sz, "%02d:%02d:%02d",
            hour, minute, second);
    XBee.print(sz);
  }
}

void GPSData() {
  int chars = 0;
  
  //Parse GPS data
  while(GPS.available()) {
    char c = GPS.read();
    if(gps.encode(c)) {
      newData = true;
    }
    chars++;
  }

  //If GPS delay has passed, then print the data to XBee
  if((int)millis() - lastMsgTime > GPS_MSG_DELAY) {
    if(newData) {
      float flat, flon;
      unsigned long age;
      unsigned long time;
      unsigned long date;
      String output;
      gps.f_get_position(&flat, &flon, &age);
      gps.get_datetime(&date, &time, &age);
      XBee.print("GPS ");
      XBee.print(flat == TinyGPS::GPS_INVALID_F_ANGLE ? 0.0 : flat, 6); //latitude
      XBee.print(" ");
      XBee.print(flon == TinyGPS::GPS_INVALID_F_ANGLE ? 0.0 : flon, 6); //longitude
      XBee.print(" ");
      XBee.print(gps.f_altitude(), 6);  //altitude
      XBee.print(" ");
      print_date(gps);
      XBee.print(" ");
      XBee.print(gps.satellites() == TinyGPS::GPS_INVALID_SATELLITES ? 0 : gps.satellites()); //satellites
      XBee.print(" ");
      XBee.print(gps.hdop() == TinyGPS::GPS_INVALID_HDOP ? 0 : gps.hdop()); //precision
      XBee.println();
      newData = false;
    }

    lastMsgTime = millis();
  }

  
}

void ReceiveXBeeData() {
  while (XBee.available()) {
    char incoming = XBee.read();

    //Converts carriage returns into newlines (communication w/ XCTU)
    if (incoming == '\r' || incoming == '\n') {
      inputMsg += '\n';
    }
    else {
      inputMsg += incoming;
    }
  }
}

void ProcessData() {
  unsigned int L = inputMsg.length();
  if (L > 0 && inputMsg.charAt(L - 1) == '\n') {
    inputMsg.trim();  //get rid of leading whitespace
    ProcessMsg(inputMsg);
    inputMsg = "";
    
  }
}

void XBeeSendINFO(const String &content) {
  XBee.println("INFO " + content);
}

void ProcessMsg(const String &msg) {

  //Extract the message type and content
  int sp = msg.indexOf(' ');
  if (sp < 0) {
    return;
  }
  String mt = msg.substring(0, sp);   //Message Type (i.e, NONE, CMD, INFO, GPS)
  String ct = msg.substring(sp + 1);  //Message Content (everything after the Message Type)
  ct.trim();  //Remove outer whitespace

  //Execute commands
  if (mt == "CMD") {
    if (ct == "hello") {
      XBeeSendINFO("Hello! This is the Aerospace Systems rocket speaking to you!");
    }
    else if (ct == "ping") {
      XBeeSendINFO("pong");
    }
    else if (ct == "light toggle") {
      if(digitalRead(LEDPin) == LOW) {
        digitalWrite(LEDPin, HIGH);
        XBeeSendINFO("The light has turned on.");
      }
      else {
        digitalWrite(LEDPin, LOW);
        XBeeSendINFO("The light has turned off.");
      }
    }
    else if (ct == "light on") {
      digitalWrite(LEDPin, HIGH);
      XBeeSendINFO("The light has turned on.");
    }
    else if (ct == "light off") {
      digitalWrite(LEDPin, LOW);
      XBeeSendINFO("The light has turned off.");
    }
    else if (ct == "light status") {
      if (digitalRead(LEDPin) == HIGH) {
        XBeeSendINFO("The light is currently on.");
      }
      else {
        XBeeSendINFO("The light is currently off.");
      }
    }
    else {
      XBeeSendINFO("There is no command: \"" + ct + "\"");
    }
  }
}

