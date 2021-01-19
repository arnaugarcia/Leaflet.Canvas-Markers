'use strict';

function layerFactory(L) {

    const CanvasIconLayer = (L.Layer ? L.Layer : L.Class).extend({

        //Add event listeners to initialized section.
        initialize: function (options) {

            L.setOptions(this, options);
            this._onClickListeners = [];
            this._processAllOnClickListeners = true;
            this._onHoverListeners = [];

            // Spider
            this.twoPi = Math.PI * 2;
            this._markersArray = [];
            this.listeners = {};
            this.circleFootSeparation = 25
            this.keepSpiderfied = false;        // yes -> don't unspiderfy when a marker is selected
            this.nearbyDistance = 20;           // spiderfy markers within this range of the one clicked, in px

            this.circleSpiralSwitchover = 9;    // show spiral instead of circle from this marker count upwards
            // 0 -> always spiral; Infinity -> always circle
            this.circleFootSeparation = 25;     // related to circumference of circle
            this.circleStartAngle = this.twoPi / 12;
            this.spiralFootSeparation = 28;     // related to size of spiral (experiment!)
            this.spiralLengthStart = 11;        // ditto
            this.spiralLengthFactor = 5;        // ditto

            this.legWeight = 1.5;
            this.legColors = {
                'usual': '#222',
                'highlighted': '#f00'
            };
        },

        setOptions: function (options) {

            L.setOptions(this, options);
            return this.redraw();
        },

        redraw: function () {

            this._redraw(true);
        },

        //Multiple layers at a time for rBush performance
        addMarkers: function (markers) {

            var self = this;
            var tmpMark = [];
            var tmpLatLng = [];

            markers.forEach(function (marker) {

                if (!((marker.options.pane == 'markerPane') && marker.options.icon)) {
                    console.error('Layer isn\'t a marker');
                    return;
                }

                var latlng = marker.getLatLng();
                var isDisplaying = self._map.getBounds().contains(latlng);
                var s = self._addMarker(marker, latlng, isDisplaying);

                //Only add to Point Lookup if we are on map
                if (isDisplaying === true) tmpMark.push(s[0]);

                tmpLatLng.push(s[1]);
            });

            self._markers.load(tmpMark);
            self._latlngMarkers.load(tmpLatLng);
        },

        //Adds single layer at a time. Less efficient for rBush
        addMarker: function (marker) {

            var self = this;
            var latlng = marker.getLatLng();
            var isDisplaying = self._map.getBounds().contains(latlng);
            var dat = self._addMarker(marker, latlng, isDisplaying);

            self._markersArray.push(marker);

            //Only add to Point Lookup if we are on map
            if (isDisplaying === true) self._markers.insert(dat[0]);

            self._latlngMarkers.insert(dat[1]);
        },

        addLayer: function (layer) {
            if ((layer.options.pane !== 'markerPane')) {
                console.log(layer);
            }
            if ((layer.options.pane === 'markerPane') && layer.options.icon) this.addMarker(layer);
            else console.error('Layer isn\'t a marker');
        },

        addLayers: function (layers) {

            this.addMarkers(layers);
        },

        removeLayer: function (layer) {

            this.removeMarker(layer, true);
        },

        removeMarker: function (marker, redraw) {

            var self = this;

            //If we are removed point
            if (marker["minX"]) marker = marker.data;

            var latlng = marker.getLatLng();
            var isDisplaying = self._map.getBounds().contains(latlng);

            var markerData = {

                minX: latlng.lng,
                minY: latlng.lat,
                maxX: latlng.lng,
                maxY: latlng.lat,
                data: marker
            };

            self._latlngMarkers.remove(markerData, function (a, b) {

                return a.data._leaflet_id === b.data._leaflet_id;
            });

            const index = this._markersArray.indexOf(marker);

            if (index > -1) {
                this._markersArray.splice(index, 1);
            }

            self._latlngMarkers.total--;
            self._latlngMarkers.dirty++;

            if (isDisplaying === true && redraw === true) {

                self._redraw(true);
            }
        },

        onAdd: function (map) {

            this._map = map;

            if (!this._canvas) this._initCanvas();

            if (this.options.pane) this.getPane().appendChild(this._canvas);
            else map._panes.overlayPane.appendChild(this._canvas);

            map.on('moveend', this._reset, this);
            map.on('resize', this._reset, this);

            map.on('click', this._executeListeners, this);
            map.on('mousemove', this._executeListeners, this);
        },

        onRemove: function (map) {

            if (this.options.pane) this.getPane().removeChild(this._canvas);
            else map.getPanes().overlayPane.removeChild(this._canvas);

            map.off('click', this._executeListeners, this);
            map.off('mousemove', this._executeListeners, this);

            map.off('moveend', this._reset, this);
            map.off('resize', this._reset, this);
        },

        addTo: function (map) {

            map.addLayer(this);
            return this;
        },

        clearLayers: function () {
            this._latlngMarkers = null;
            this._markers = null;
            this._redraw(true);
        },

        spiderfy: function (marker) {
            const nearbyMarkerData = [];
            const nonNearbyMarkers = [];
            const nearbyDistance = 20;
            const pxSq = nearbyDistance * nearbyDistance;

            const markerPt = map.latLngToLayerPoint(marker.latlng);

            for (let m of this._markersArray) {
                /*if (!map.hasLayer(m)) {
                    console.log('No layer');
                    continue;
                }*/
                const mPt = map.latLngToLayerPoint(m.getLatLng());

                if (ciLayer.ptDistanceSq(mPt, markerPt) < pxSq) {
                    nearbyMarkerData.push({marker: m, markerPt: mPt});
                } else {
                    nonNearbyMarkers.push(m);
                }
            }
            if (nearbyMarkerData.length === 1) {  // 1 => the one clicked => none nearby
                console.log('Marker alone');
                //return this.trigger('click', marker);
            } else {
                return this._spiderfy(nearbyMarkerData, nonNearbyMarkers);

            }
        },

        _spiderfy: function (markerData, nonNearbyMarkers) {
            let md;
            console.log('Spiderfing', markerData);
            this.spiderfying = true;
            const numFeet = markerData.length;
            const bodyPt = this.ptAverage((() => {
                const result = [];
                for (md of Array.from(markerData)) {
                    result.push(md.markerPt);
                }
                return result;
            })());
            const footPts = numFeet >= this.circleSpiralSwitchover ?
                this._generatePtsSpiral(numFeet, bodyPt).reverse()  // match from outside in => less cross-crossing
                :
                this._generatePtsCircle(numFeet, bodyPt);
            const spiderfiedMarkers = (() => {
                const result = [];
                for (var footPt of Array.from(footPts)) {
                    const footLl = map.layerPointToLatLng(footPt);
                    const nearestMarkerDatum = this._minExtract(markerData, md => this._ptDistanceSq(md.markerPt, footPt));
                    const {marker} = nearestMarkerDatum;
                    const leg = new L.Polyline([marker.getLatLng(), footLl], {
                        color: this.legColors.usual,
                        weight: this.legWeight,
                        clickable: false
                    });
                    //map.addLayer(leg);
                    marker.omsData = {usualPosition: marker.getLatLng(), leg};
                    if (this.legColors.highlighted !== this.legColors.usual) {
                        const mhl = this._makeHighlightListeners(marker);
                        marker.omsData.highlightListeners = mhl;
                        marker.addEventListener('mouseover', mhl.highlight);
                        marker.addEventListener('mouseout', mhl.unhighlight);
                    }
                    this.removeLayer(marker);
                    marker.setLatLng(footLl);
                    //marker.setZIndexOffset(1000000);
                    this.addMarker(marker);
                    result.push(marker);
                }
                return result;
            })();
            delete this.spiderfying;
            this.spiderfied = true;
            return this._trigger('spiderfy', spiderfiedMarkers, nonNearbyMarkers);
        },

        unspiderfy: function (markerNotToMove = null) {
            console.log('Unspiderfy');
            if (this.spiderfied == null) {
                return this;
            }
            this.unspiderfying = true;
            //const unspiderfiedMarkers = [];
            //const nonNearbyMarkers = [];
            for (let marker of Array.from(this._markersArray)) {
                if (marker.omsData != null) {
                    map.removeLayer(marker.omsData.leg);
                    if (marker !== markerNotToMove) {
                        this.removeLayer(marker);
                        marker.setLatLng(marker.omsData.usualPosition);
                        this.addMarker(marker);
                    }
                    marker.setZIndexOffset(0);
                    const mhl = marker.omsData.highlightListeners;
                    if (mhl != null) {
                        marker.removeEventListener('mouseover', mhl.highlight);
                        marker.removeEventListener('mouseout', mhl.unhighlight);
                    }
                    delete marker.omsData;
                    //unspiderfiedMarkers.push(marker);
                } else {
                    //nonNearbyMarkers.push(marker);
                }
            }
            delete this.unspiderfying;
            delete this.spiderfied;
            //this.trigger('unspiderfy', unspiderfiedMarkers, nonNearbyMarkers);
            return this;  // return self, for chaining
        },


        spiderListener: function (marker) {
            const markerSpiderfied = (marker._omsData != null);
            if (!markerSpiderfied || !this.keepSpiderfied) {
                this.unspiderfy()
            }
            if (markerSpiderfied) {
                return this._trigger('click', marker);
            } else {
                const nearbyMarkerData = [];
                const nonNearbyMarkers = [];
                const pxSq = this.nearbyDistance * this.nearbyDistance;
                const markerPt = map.latLngToLayerPoint(marker.latlng);
                console.log(markerPt);
                for (let m of Array.from(this._markersArray)) {
                    /*if (!map.hasLayer(m)) {
                        continue;
                    }*/
                    const mPt = map.latLngToLayerPoint(m.getLatLng());
                    if (this.ptDistanceSq(mPt, markerPt) < pxSq) {
                        nearbyMarkerData.push({marker: m, markerPt: mPt});
                    } else {
                        nonNearbyMarkers.push(m);
                    }
                }
                if (nearbyMarkerData.length === 0) {  // 0 => one spidered marker clicked => none nearby
                    return this._trigger('click', marker);
                } else if (nearbyMarkerData.length === 1) {  // 1 => the one clicked => none nearby
                    return this._trigger('click', marker);
                } else {
                    this._cancelClick();
                    return this._spiderfy(nearbyMarkerData, nonNearbyMarkers);
                }
            }
        },

        _generatePtsSpiral: function (count, centerPt) {
            let legLength = this.spiralLengthStart;
            let angle = 0;
            return (() => {
                const result = [];
                for (let i = 0, end = count, asc = 0 <= end; asc ? i < end : i > end; asc ? i++ : i--) {
                    angle += (this.spiralFootSeparation / legLength) + (i * 0.0005);
                    const pt = new L.Point(centerPt.x + (legLength * Math.cos(angle)),
                        centerPt.y + (legLength * Math.sin(angle)));
                    legLength += (this.twoPi * this.spiralLengthFactor) / angle;
                    result.push(pt);
                }
                return result;
            })();
        },

        _makeHighlightListeners: function (marker) {
            return {
                highlight: () => marker.omsData.leg.setStyle({color: this.legColors.highlighted}).bringToBack(),
                unhighlight: () => marker.omsData.leg.setStyle({color: this.legColors.usual}).bringToBack()
            };
        },

        _generatePtsCircle: function (count, centerPt) {
            const twoPi = Math.PI * 2;
            const circumference = this.circleFootSeparation * (2 + count);
            const legLength = circumference / twoPi;  // = radius from circumference
            const angleStep = twoPi / count;
            return (() => {
                const result = [];
                for (let i = 0, end = count, asc = 0 <= end; asc ? i < end : i > end; asc ? i++ : i--) {
                    const angle = this.circleStartAngle + (i * angleStep);
                    result.push(new L.Point(centerPt.x + (legLength * Math.cos(angle)),
                        centerPt.y + (legLength * Math.sin(angle))));
                }
                return result;
            })();
        },

        _ptDistanceSq: function (pt1, pt2) {
            const dx = pt1.x - pt2.x;
            const dy = pt1.y - pt2.y;
            return (dx * dx) + (dy * dy);
        },

        _ptAverage: function (pts) {
            let sumY;
            let sumX = (sumY = 0);
            for (let pt of Array.from(pts)) {
                sumX += pt.x;
                sumY += pt.y;
            }
            const numPts = pts.length;
            return new L.Point(sumX / numPts, sumY / numPts);
        },

        _minExtract: function (set, func) {  // destructive! returns minimum, and also removes it from the set
            let bestIndex;
            for (let index = 0; index < set.length; index++) {
                const item = set[index];
                const val = func(item);
                if ((bestIndex == null) || (val < bestVal)) {
                    var bestVal = val;
                    bestIndex = index;
                }
            }
            return set.splice(bestIndex, 1)[0];
        },

        _addMarker: function (marker, latlng, isDisplaying) {

            var self = this;
            //Needed for pop-up & tooltip to work.
            marker._map = self._map;

            //_markers contains Points of markers currently displaying on map
            if (!self._markers) self._markers = new rbush();

            //_latlngMarkers contains Lat\Long coordinates of all markers in layer.
            if (!self._latlngMarkers) {
                self._latlngMarkers = new rbush();
                self._latlngMarkers.dirty = 0;
                self._latlngMarkers.total = 0;
            }

            L.Util.stamp(marker);

            var pointPos = self._map.latLngToContainerPoint(latlng);
            var iconSize = marker.options.icon.options.iconSize;

            var adj_x = iconSize[0] / 2;
            var adj_y = iconSize[1] / 2;
            var ret = [({
                minX: (pointPos.x - adj_x),
                minY: (pointPos.y - adj_y),
                maxX: (pointPos.x + adj_x),
                maxY: (pointPos.y + adj_y),
                data: marker
            }), ({
                minX: latlng.lng,
                minY: latlng.lat,
                maxX: latlng.lng,
                maxY: latlng.lat,
                data: marker
            })];

            self._latlngMarkers.dirty++;
            self._latlngMarkers.total++;

            //Only draw if we are on map
            if (isDisplaying === true) self._drawMarker(marker, pointPos);

            return ret;
        },

        _drawMarker: function (marker, pointPos) {

            var self = this;

            if (!this._imageLookup) this._imageLookup = {};
            if (!pointPos) {

                pointPos = self._map.latLngToContainerPoint(marker.getLatLng());
            }

            var iconUrl = marker.options.icon.options.iconUrl;

            if (marker.canvas_img) {

                self._drawImage(marker, pointPos);
            } else {

                if (self._imageLookup[iconUrl]) {

                    marker.canvas_img = self._imageLookup[iconUrl][0];

                    if (self._imageLookup[iconUrl][1] === false) {

                        self._imageLookup[iconUrl][2].push([marker, pointPos]);
                    } else {

                        self._drawImage(marker, pointPos);
                    }
                } else {

                    var i = new Image();
                    i.src = iconUrl;
                    marker.canvas_img = i;

                    //Image,isLoaded,marker\pointPos ref
                    self._imageLookup[iconUrl] = [i, false, [[marker, pointPos]]];

                    i.onload = function () {

                        self._imageLookup[iconUrl][1] = true;
                        self._imageLookup[iconUrl][2].forEach(function (e) {

                            self._drawImage(e[0], e[1]);
                        });
                    }
                }
            }
        },

        _trigger: function (event, ...args) {
            // return (Array.from(this.listeners[event] != null ? this.listeners[event] : [])).map((func) => func(...Array.from(args || [])));
        },

        _cancelClick: function (event, ...args) {
            this._processAllOnClickListeners = false;
        },

        _drawImage: function (marker, pointPos) {

            const options = marker.options.icon.options;

            this._context.drawImage(
                marker.canvas_img,
                pointPos.x - options.iconAnchor[0],
                pointPos.y - options.iconAnchor[1],
                options.iconSize[0],
                options.iconSize[1]
            );
        },

        _reset: function () {

            var topLeft = this._map.containerPointToLayerPoint([0, 0]);
            L.DomUtil.setPosition(this._canvas, topLeft);

            var size = this._map.getSize();

            this._canvas.width = size.x;
            this._canvas.height = size.y;

            this._redraw();
        },

        _redraw: function (clear) {

            var self = this;

            if (clear) this._context.clearRect(0, 0, this._canvas.width, this._canvas.height);
            if (!this._map || !this._latlngMarkers) return;

            var tmp = [];

            //If we are 10% individual inserts\removals, reconstruct lookup for efficiency
            if (self._latlngMarkers.dirty / self._latlngMarkers.total >= .1) {

                self._latlngMarkers.all().forEach(function (e) {

                    tmp.push(e);
                });

                self._latlngMarkers.clear();
                self._latlngMarkers.load(tmp);
                self._latlngMarkers.dirty = 0;
                tmp = [];
            }

            var mapBounds = self._map.getBounds();

            //Only re-draw what we are showing on the map.

            var mapBoxCoords = {
                minX: mapBounds.getWest(),
                minY: mapBounds.getSouth(),
                maxX: mapBounds.getEast(),
                maxY: mapBounds.getNorth(),
            };

            self._latlngMarkers.search(mapBoxCoords).forEach(function (e) {

                //Readjust Point Map
                var pointPos = self._map.latLngToContainerPoint(e.data.getLatLng());

                var iconSize = e.data.options.icon.options.iconSize;
                var adj_x = iconSize[0] / 2;
                var adj_y = iconSize[1] / 2;

                var newCoords = {
                    minX: (pointPos.x - adj_x),
                    minY: (pointPos.y - adj_y),
                    maxX: (pointPos.x + adj_x),
                    maxY: (pointPos.y + adj_y),
                    data: e.data
                }

                tmp.push(newCoords);

                //Redraw points
                self._drawMarker(e.data, pointPos);
            });

            //Clear rBush & Bulk Load for performance
            this._markers.clear();
            this._markers.load(tmp);
        },

        _initCanvas: function () {

            this._canvas = L.DomUtil.create('canvas', 'leaflet-canvas-icon-layer leaflet-layer');
            var originProp = L.DomUtil.testProp(['transformOrigin', 'WebkitTransformOrigin', 'msTransformOrigin']);
            this._canvas.style[originProp] = '50% 50%';

            var size = this._map.getSize();
            this._canvas.width = size.x;
            this._canvas.height = size.y;

            this._context = this._canvas.getContext('2d');

            var animated = this._map.options.zoomAnimation && L.Browser.any3d;
            L.DomUtil.addClass(this._canvas, 'leaflet-zoom-' + (animated ? 'animated' : 'hide'));
        },

        addOnClickListener: function (listener) {
            this._onClickListeners.push(listener);
        },

        addOnHoverListener: function (listener) {
            this._onHoverListeners.push(listener);
        },

        _executeListeners: function (event) {

            if (!this._markers) return;

            var me = this;
            var x = event.containerPoint.x;
            var y = event.containerPoint.y;

            if (me._openToolTip) {

                me._openToolTip.closeTooltip();
                delete me._openToolTip;
            }

            var ret = this._markers.search({minX: x, minY: y, maxX: x, maxY: y});

            if (ret && ret.length > 0) {

                me._map._container.style.cursor = "pointer";

                if (event.type === "click") {

                    var hasPopup = ret[0].data.getPopup();
                    if (hasPopup) ret[0].data.openPopup();

                    me._onClickListeners.forEach(function (listener) {
                        if (me._processAllOnClickListeners) listener(event, ret);
                    });
                    me._processAllOnClickListeners = true;
                }

                if (event.type === "mousemove") {
                    var hasTooltip = ret[0].data.getTooltip();
                    if (hasTooltip) {
                        me._openToolTip = ret[0].data;
                        ret[0].data.openTooltip();
                    }

                    me._onHoverListeners.forEach(function (listener) {
                        listener(event, ret);
                    });
                }
            } else {

                me._map._container.style.cursor = "";
            }
        },

        ptAverage: function (pts) {
            let sumY;
            let sumX = (sumY = 0);
            for (let pt of Array.from(pts)) {
                sumX += pt.x;
                sumY += pt.y;
            }
            const numPts = pts.length;
            return new L.Point(sumX / numPts, sumY / numPts);
        },

        ptDistanceSq: function (pt1, pt2) {
            const dx = pt1.x - pt2.x;
            const dy = pt1.y - pt2.y;
            return (dx * dx) + (dy * dy);
        }
    });

    L.canvasIconLayer = function (options) {
        return new CanvasIconLayer(options);
    };
};

module.exports = layerFactory;
