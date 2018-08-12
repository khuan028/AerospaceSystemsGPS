(function () {
    "use strict";

    // Cesium.BingMapsApi.defaultKey = 'Ar9n20kTp-N8tEg3Dpx-Pgocmx3W0-GUnD_Bgt3h8g6pSeDL8yxByTVGHyMyjI2p'; // Generate a new Bing Key for your app at https://msdn.microsoft.com/en-us/library/ff428642.aspx
    Cesium.BingMapsApi.defaultKey = 'AiM1wFAFOGtVDOWpKnfiMd2ghg1xA3j5Ujku7oq95mfyI_TGRpbFmcULhJq1ONpx';

    //////////////////////////////////////////////////////////////////////////
    // Creating the Viewer
    //////////////////////////////////////////////////////////////////////////
    var viewer = new Cesium.Viewer('cesiumContainer', {
        scene3DOnly: true,
        selectionIndicator: false,
        baseLayerPicker: false,
        timeline: false,
        animation: false
    });

    //////////////////////////////////////////////////////////////////////////
    // Loading Imagery
    //////////////////////////////////////////////////////////////////////////

    // Add Bing imagery
    viewer.imageryLayers.addImageryProvider(new Cesium.BingMapsImageryProvider({
        url: 'https://dev.virtualearth.net',
        mapStyle: Cesium.BingMapsStyle.AERIAL // Can also use Cesium.BingMapsStyle.ROAD
    }));

    //////////////////////////////////////////////////////////////////////////
    // Loading Terrain
    //////////////////////////////////////////////////////////////////////////

    // // Load STK World Terrain
    viewer.terrainProvider = Cesium.createWorldTerrain();
    // // Enable depth testing so things behind the terrain disappear.
    viewer.scene.globe.depthTestAgainstTerrain = true;

    //////////////////////////////////////////////////////////////////////////
    // Configuring the Scene
    //////////////////////////////////////////////////////////////////////////

    // // Disable lighting based on sun/moon positions
    viewer.scene.globe.enableLighting = true;

    //////////////////////////////////////////////////////////////////////////
    // Adding icons to the scene
    //////////////////////////////////////////////////////////////////////////
    var rocket_marker = null;
    var rocket_altitude_line = null;

    function setRocketMarker(lon, lat, alt) {
        var promise = Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, [Cesium.Cartographic.fromDegrees(lon, lat)]);
        Cesium.when(promise, function (updatedPositions) {
            var alt = updatedPositions[0].height;
            var startPosition = Cesium.Cartesian3.fromDegrees(lon, lat, alt);
            var endPosition = Cesium.Cartesian3.fromDegrees(lon, lat, 0);

            //If markers do not exist, create them.
            if (rocket_marker == null) {
                rocket_marker = viewer.entities.add({
                    billboard: {
                        image: 'Assets/rocket.png'
                    },
                    position: startPosition
                })
            }
            if (rocket_altitude_line == null) {
                rocket_altitude_line = viewer.entities.add({
                    polyline: {
                        positions: [startPosition, endPosition],
                        width: 5,
                        material: Cesium.Color.SPRINGGREEN
                    }
                });
            }

            //Update the markers
            rocket_marker.position = startPosition;
            rocket_altitude_line.polyline.positions = [startPosition, endPosition];
        });
    }








    //////////////////////////////////////////////////////////////////////////
    // XBee communication code
    //////////////////////////////////////////////////////////////////////////
    let socket = io();
    let gps_info = null;                    //Current GPS information (longitude, latitude, etc.)         
    let start_time = new Date() / 1000;     //Start time of recording (in seconds since the epoch)
    let start_date = new Date();            //Datetime used for naming the output file
    let recorded_data = [];                 //List of GPS messages
    let recording = false;                  //True if recording is on. False if not recording.

    function appendMsg(cl, msg) {
        let MAX_LENGTH = 200;
        $('#messages').append($('<li>', { class: cl }).text(msg));
        if ($('#messages li').length > MAX_LENGTH) {
            $('#messages li').first().remove();
        }
    }

    function scrollToBottom() {
        $('#messages-container').animate({ scrollTop: $('#messages').prop("scrollHeight") }, 300);
    }

    function create_GPS_info(tokens) {
        var gps_in = {
            latitude: parseFloat(tokens[1]),
            longitude: parseFloat(tokens[2]),
            altitude: parseFloat(tokens[3]),
            time: tokens[4],
            timer: new Date() / 1000 - start_time,
            satellites: parseFloat(tokens[5]),
            precision: parseFloat(tokens[6])
        };

        //Prevent further manipulation of gps information
        Object.freeze(gps_in);

        return gps_in;
    }

    function display_GPS_info(gin) {
        $('#gps-lat').text(gin.latitude.toFixed(6) + "°");
        $('#gps-lon').text(gin.longitude.toFixed(6) + "°");
        $('#gps-alt').text(gin.altitude.toFixed(3) + " m");
        $('#gps-time').text(gin.time + " (UTC)");
        $('#gps-sat').text(gin.satellites);
        $('#gps-prec').text(gin.precision);
    }

    function downloadFile(filename, options, contents) {
        let element = document.createElement('a');
        element.setAttribute('href', options + encodeURIComponent(contents));
        element.setAttribute('download', filename);

        element.style.display = 'none';
        document.body.appendChild(element);

        element.click();

        document.body.removeChild(element);
    }

    function downloadCSV(filename, text) {
        downloadFile(filename, 'data:text/csv;charset=utf-8,', text);
    }

    function downloadKML(filename, text) {
        downloadFile(filename, 'data:text/kml;charset=utf-8,', text);
    }

    function saveRecording() {
        //Define variables
        let outArr = [];
        let outArr2 = [];
        let outStr = "";
        let outStr2 = "";
        let inital_view = "";

        //Define constants
        const template_piece1 = 
`<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
<Style id="yellowPoly">
<LineStyle>
<color>7f00ffff</color>
<width>4</width>
</LineStyle>
<PolyStyle>
<color>7f00ff00</color>
</PolyStyle>
</Style>
<Placemark><styleUrl>#yellowPoly</styleUrl>
<LookAt>`;

        const template_piece2 = 
`   <heading>-0.23</heading>
<tilt>47.81</tilt>
<range>300</range>
<gx:altitudeMode>relativeToSeaFloor</gx:altitudeMode>
</LookAt>
<LineString>
<extrude>1</extrude>
<tesselate>1</tesselate>
<altitudeMode>absolute</altitudeMode>
<coordinates>`;

        const template_piece3 = 
`</coordinates>
</LineString></Placemark>

</Document></kml>`;

        

        //Convert GPS messages into CSV file
        outArr.push("Latitude,Longitude,Altitude,Time(GMT),Time(seconds since recording started),Satellites,Precision");
        for(var i = 0; i < recorded_data.length; i++) {
            var gin = recorded_data[i];
            outArr.push("" + gin.latitude + "," + gin.longitude + "," + gin.altitude + "," + gin.time + "," + gin.timer + "," +  gin.satellites + "," + gin.precision);
        }
        outStr = outArr.join('\n');
        downloadCSV("GPS Recording " + start_date.toUTCString() + ".csv", outStr);


        //Convert GPS messages into KML file
        for(var i = 0; i < recorded_data.length; i++) {
            var gin = recorded_data[i];
            outArr2.push("" + gin.longitude + "," + gin.latitude + "," + gin.altitude);
        }
        if(recorded_data.length > 0) {
            inital_view = 
                "<longitude>" + recorded_data[0].longitude + "</longitude>" 
                + "<latitude>" + recorded_data[0].latitude + "</latitude>"
                + "<altitude>" + recorded_data[0].altitude + "</altitude>";
        }
        outStr2 = 
            template_piece1 
            + inital_view
            + template_piece2
            + outArr2.join("\n") 
            + template_piece3;
        downloadKML("GPS Recording " + start_date.toUTCString() + ".kml", outStr2);

    }

    socket.on('XBeeRead', (msg) => {
        var tokens = msg.split(' ');
        if (tokens.length >= 7 && tokens[0] == "GPS") {

            var failed = false;

            //Check if the tokens are in the correct format
            for (var i = 0; i < 7; i++) {
                if (i != 4 && parseFloat(tokens[i]) == NaN) {
                    console.log("Could not convert token");
                    failed = true;
                }
            }

            //If tokens are in the correct format, process the tokens
            if (!failed) {
                gps_info = create_GPS_info(tokens);     //Generate GPS info object
                display_GPS_info(gps_info);             //Display GPS info in webpage
                setRocketMarker(gps_info.longitude, gps_info.latitude, gps_info.altitude);  //Update rocket position in 3D map

                //Save the GPS message in an array
                if(recording) {
                    recorded_data.push(gps_info);
                    console.log(gps_info.latitude);
                    $('#gps-frames').text(recorded_data.length);
                }
            }

        }
        else if (tokens.length >= 1 && tokens[0] == "INFO") {
            appendMsg('incomingMsg', msg);
            scrollToBottom();
        }

    });


    $('form').submit( () => {
        var msg = $('#m').val();
        socket.emit('XBeeWrite', msg);
        appendMsg('outgoingMsg', msg);
        $('#m').val('');
        scrollToBottom();
        return false;
    });


    $('#map-center-button').click( () => {
        if (gps_info != null) {
            //Assumes that Source/App.js was loaded
            var initialPosition = new Cesium.Cartesian3.fromDegrees(gps_info.longitude, gps_info.latitude - 0.0010, gps_info.altitude + 50.0);
            var initialOrientation = new Cesium.HeadingPitchRoll.fromDegrees(0, -30, 0);
            var homeCameraView = {
                destination: initialPosition,
                orientation: {
                    heading: initialOrientation.heading,
                    pitch: initialOrientation.pitch,
                    roll: initialOrientation.roll
                },
                easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT
            };
            viewer.scene.camera.flyTo(homeCameraView);
        }
    });

    const copyToClipboard = (str) => {
        const el = document.createElement('textarea');
        el.value = str;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
    };

    $('#copy-button').click( () => {
        if(gps_info != null) {
            console.log("Yea");
            copyToClipboard(gps_info.latitude + ", " + gps_info.longitude);
        }
    });


    $('#record-button').click( () => {
        if(recording) {
            recording = false;
            $('#gps-frames-container').css("color","#646464");
            $('#record-button').text("Record");
            saveRecording();
        }
        else {
            recording = true;
            recorded_data.length = 0;
            start_time = new Date() / 1000;
            $('#gps-frames').text(0);
            $('#gps-frames-container').css("color","red");
            $('#record-button').text("Stop Recording");
        }
    });


}());

