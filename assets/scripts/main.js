
function indexBtns () {
    $("#displayNetwork").on("click", function(e) {
        window.location.href = "display-network.html";
    });
    $("#displayRoute").on("click", function(e) {
        window.location.href = "display-route.html";
    });
};


function networkMap () {
    var zoom = 10;
    if ($(window).height() > 800) {
        zoom = 11;
    }
    map = new L.Map("map", {
        center: [-36.845794, 174.764378],
        zoom: zoom,
        zoomControl: false
    });
    L.tileLayer('http://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="http://cartodb.com/attributions">CartoDB</a>',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map);


    var pts;

    function loadData () {
      protobuf.load("assets/protobuf/gtfs-realtime.proto", function(err, root) {
          if (err)
              throw err;
          var f = root.lookupType("transit_realtime.FeedMessage");

          var xhr = new XMLHttpRequest();
          var vp = "https://dl.dropboxusercontent.com/s/z1nqu2xu9nhfjbk/vehicle_locations.pb?dl=1";
          xhr.open("GET", vp, true);
          xhr.responseType = "arraybuffer";
          xhr.onload = function(evt) {
              var m = f.decode (new Uint8Array(xhr.response));
              addPositions(m.entity);
          }
          xhr.send(null);
      });
    };
    function addPositions (feed) {
    //   console.log(feed);
      var data = {
          "type": "FeatureCollection",
          "features": []
      };
      for (var i=0; i<feed.length; i++) {
        if (feed[i].vehicle) {
          if (feed[i].vehicle.position) {
            data.features.push({
              "type": "Feature",
              "geometry": {
                "type": "Point",
                "coordinates": [
                  feed[i].vehicle.position.longitude,
                  feed[i].vehicle.position.latitude
                ]
              },
              "properties": {
                "delay": 0,
                "delaytype": "arrival"
              }
            });
          }
        }
        // console.log(feed[i]);
      }
    //   console.log(data);
      if (pts != undefined) pts.clearLayers();
      pts = L.geoJSON(data, {
          pointToLayer: function(feature, latlng) {
              return L.circleMarker(latlng, {
                  radius: 2,
                  fillColor: "#990000",
                  weight: 0,
                  fillOpacity: 0.8
              });
          }
      }).addTo(map);
    };

    loadData();
    setInterval(loadData, 10000);
};

function networkStatus () {
    fetchNetworkData();
    setInterval(fetchNetworkData, 10000);
};

function networkRegions () {
    getRegions();
    // var regions = [
    //     {"name": "West", "status": 82},
    //     {"name": "North", "status": 78},
    //     {"name": "Central", "status": 55},
    //     // {"name": "Isthmus", "status": 61},
    //     {"name": "South", "status": 55},
    //     // {"name": "East", "status": 42},
    //     {"name": "Waiheke", "status": 34},
    // ];
    // initRegions(regions);
    // setInterval(setRegions, 10000, regions);
};

function initRegions () {
    for (var i=0;i<data.regions.features.length;i++) {
        $("#networkRegions").append("<div id=\"region" +
        data.regions.features[i].properties.name +
        "\" class=\"region-status stateOK\"><h1 class=\"state\"><span id=\"regionCity\">?</span>%</h1><h4 class=\"name\">" +
        data.regions.features[i].properties.name + "</h4></div>");
    }
};

function setRegions() {
    // use window.data.stops
    for (var i=0;i<data.regions.features.length;i++) {
        data.regions.features[i].properties.status =
            Math.round(100 * data.regions.features[i].properties.ontime /
                       data.regions.features[i].properties.count);
        setTimeout(function(ri) {
            // var err = Math.floor(Math.random() * 5) - 2;
            if (ri.status == parseInt($("#region" + ri.name + " .state span").html())) {
                return;
            }
            $("#region" + ri.name + " .state").removeClass("isset");
            setTimeout(function() {
                $("#networkRegions #region" + ri.name + " .state span")
                    .html(ri.status);
                $("#region" + ri.name)
                    .removeClass("stateOK stateModerate stateHeavy stateBad");
                if (ri.status < 50) {
                    $("#region" + ri.name).addClass("stateBad");
                } else if (ri.status < 60) {
                    $("#region" + ri.name).addClass("stateHeavy");
                } else if (ri.status < 80) {
                    $("#region" + ri.name).addClass("stateModerate");
                } else {
                    $("#region" + ri.name).addClass("stateOK");
                }
                $("#region" + ri.name + " .state").addClass("isset");
            }, 1000);
        }, i*100, data.regions.features[i].properties);
    }
};

function fetchNetworkData () {
    protobuf.load("assets/protobuf/gtfs-realtime.proto", function(err, root) {
        if (err)
            throw err;
        var f = root.lookupType("transit_realtime.FeedMessage");

        var xhr = new XMLHttpRequest();

        var tu = "https://dl.dropboxusercontent.com/s/4dodhqmz8vsi9vx/trip_updates.pb?dl=1";
        xhr.open("GET", tu, true);
        xhr.responseType = "arraybuffer";
        xhr.onload = function(evt) {
            var m = f.decode (new Uint8Array(xhr.response));
            setStatus(m.entity);
        }
        xhr.send(null);
    });
};

function setStatus (data) {
    var ontime = 0, n = 0;
    $(window.data.regions.features).each(function(key, val) {
        val.properties.status = 0;
        val.properties.ontime = 0;
        val.properties.count = 0;
    });
    var tab = [0, 0, 0, 0, 0, 0, 0]; // [<-5, -5--1, -1-5, 5-10, 10-20, 20-30, 30+]
    for (i=0; i<data.length; i++) {
        if (data[i].tripUpdate) {
            var stu = data[i].tripUpdate.stopTimeUpdate[0];
            var del;
            if (stu.arrival) {
                del = stu.arrival.delay;
            } else if (stu.departure) {
                del = stu.departure.delay;
            }
            n++;
            if (del > -60 && del < 60*5) ontime++;

            if (del < -5*60) tab[0]++
            else if (del < -60) tab[1]++;
            else if (del < 60*5) tab[2]++;
            else if (del < 60*10) tab[3]++;
            else if (del < 60*20) tab[4]++;
            else if (del < 60*30) tab[5]++;
            else tab[6]++;

            // now find stop and add to that region ...
            if (window.data.stops != null) {
                var stureg = window.data.stops.features.filter(function(s) {
                    return s.properties.stop_id == stu.stopId;
                })[0].properties.region;
                for (var j=0;j<window.data.regions.features.length;j++) {
                    if (stureg == window.data.regions.features[j].properties.name) {
                        window.data.regions.features[j].properties.count += 1;
                        if (del > -60 && del < 60*5)
                            window.data.regions.features[j].properties.ontime += 1;
                        break;
                    }
                }
            }
        }
    }
    // console.log(data);
    $("#nwPerc").html(Math.round(ontime/n*100));
    for (i=0;i<tab.length; i++) {
        $("#deltab" + i).html(tab[i]);
    }
    if (window.data.stops != null) setRegions();
};


function projectPoint(x, y) {
    var point = map.latLngToLayerPoint(new L.LatLng(y, x));
    this.stream.point(point.x, point.y);
};


function loadQR() {
    setQR();
    setInterval(setQR, 1000 * 60 * 10); // reload QR-code every 10 minutes
};

function setQR() {
    $("#qrcode").html("");
    var hash = generateHash(6);
    $("#qrcode").qrcode({
        render: 'canvas',
        size: 300,
        text: 'tomelliott.co.nz/realtimebuses/choose_a_route.html?h='+hash,
        radius: 0,
        quiet: 2
    });
};

function getHash() {
    $("#hash").html(GetURLParameter("h"));
};

function GetURLParameter(sParam) {
    var sPageURL = window.location.search.substring(1);
    var sURLVariables = sPageURL.split('&');
    for (var i=0; i<sURLVariables.length; i++) {
        var sParameterName = sURLVariables[i].split('=');
        if (sParameterName[0] == sParam) {
            return sParameterName[1];
        }
    }
    return '';
}

function generateHash(len) {
    var hash = "";
    var chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    for (var i=0; i<len; i++) {
        hash += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return hash;
}


// /**
//  * Flatten a bunch of points around a center
//  * @param  array pts    array of points, [[lng,lat],...]
//  * @param  point center a single point [lng,lat]]
//  * @return array        cartesian points [[x,y],...] centered on [0,0]
//  */
function flatten(pts, center) {
    // var R = 6371000.0;
    var flat = [];
    var phi0 = center[1],
        lam0 = center[0];
    for (var i=0; i<pts.length; i++) {
        if (pts[i][0] == lam0 && pts[i][1] == phi0) {
            flat.push([0,0]);
        } else {
            flat.push([
                (pts[i][0] - lam0) * Math.cos(phi0 * Math.PI / 180),
                (pts[i][1] - phi0)
            ]);
        }
    }
    return flat;
}


/** taken from https://github.com/substack/point-in-polygon */
function inpoly (pt, shape) {
    // poly is CENTERED on the point, so point always (0,0)
    var x = 0, y = 0;

    var vs = flatten(shape, pt);

    var inside = false;
    for (var i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        var xi = vs[i][0], yi = vs[i][1];
        var xj = vs[j][0], yj = vs[j][1];

        var intersect = ((yi > y) != (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }

    return inside;
}




function getRegions() {
    // var regions = new L.geoJson();
    // regions.addTo(map);
    $.ajax({
        dataType: "json",
        url: "https://dl.dropboxusercontent.com/s/8dmzuev9xgy8sdt/boundaries.geojson?dl=1",
        success: function(data) {
            $(data.features).each(function(key, d) {
                // var poly = [];
                $(d.geometry.coordinates[0]).each(function(k,c) {
                    c[0] = (c[0] + 540) % 360 - 180;
                });
                // regions.addData(d);
            });
            window.data.regions = data;
            initRegions();
            getStops();
        }
    });
}

function getStops() {
    $.ajax({
        dataType: "json",
        url: "https://dl.dropboxusercontent.com/s/e1untr6qygzr2gr/stops.geojson?dl=1",
        success: function(data) {
            window.data.stops = data;
            setStopRegions();
        }
    });
}


function setStopRegions() {
    $(data.stops.features).each(function(key, d) {
        for (var i=0; i<data.regions.features.length; i++) {
            if (inpoly(d.geometry.coordinates, data.regions.features[i].geometry.coordinates[0])) {
                d.properties.region = data.regions.features[i].properties.name;
                break;
            }
        }
    });
}
