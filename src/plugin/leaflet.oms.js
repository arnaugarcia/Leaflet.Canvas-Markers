/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS202: Simplify dynamic range loops
 * DS203: Remove `|| {}` from converted for-own loops
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * DS208: Avoid top-level this
 * DS209: Avoid top-level return
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
/** @preserve OverlappingMarkerSpiderfier
 https://github.com/jawj/OverlappingMarkerSpiderfier-Leaflet
 Copyright (c) 2011 - 2012 George MacKerron
 Released under the MIT licence: http://opensource.org/licenses/mit-license
 Note: The Leaflet maps API must be included *before* this code
 */

// NB. string literal properties -- object['key'] -- are for Closure Compiler ADVANCED_OPTIMIZATION

(function () {
    let p = undefined;
    let twoPi = undefined;
    const Cls = (this['OverlappingMarkerSpiderfier'] = class {
        static initClass() {
            p = this.prototype;  // this saves a lot of repetition of .prototype that isn't optimized away
            p.VERSION = '0.2.6';

            twoPi = Math.PI * 2;

            p.keepSpiderfied = false;           // yes -> don't unspiderfy when a marker is selected
            p.nearbyDistance = 20;           // spiderfy markers within this range of the one clicked, in px

            p.circleSpiralSwitchover = 9;    // show spiral instead of circle from this marker count upwards
            // 0 -> always spiral; Infinity -> always circle
            p.circleFootSeparation = 25;     // related to circumference of circle
            p.circleStartAngle = twoPi / 12;
            p.spiralFootSeparation = 28;     // related to size of spiral (experiment!)
            p.spiralLengthStart = 11;        // ditto
            p.spiralLengthFactor = 5;        // ditto

            p.legWeight = 1.5;
            p.legColors = {
                'usual': '#222',
                'highlighted': '#f00'
            };

            p.initMarkerArrays = function () {
                this.markers = [];
                return this.markerListeners = [];
            };

            p.addMarker = function (marker) {
                if (marker['_oms'] != null) {
                    return this;
                }
                marker['_oms'] = true;
                const markerListener = () => {
                    this.spiderListener(marker);
                }
                marker.addEventListener('click', markerListener);
                this.markerListeners.push(markerListener);
                this.markers.push(marker);
                return this;  // return self, for chaining
            };

            p.getMarkers = function () {
                return this.markers.slice(0);
            };  // returns a copy, so no funny business

            p.removeMarker = function (marker) {
                if (marker['_omsData'] != null) {
                    this['unspiderfy']();
                }  // otherwise it'll be stuck there forever!
                const i = this.arrIndexOf(this.markers, marker);
                if (i < 0) {
                    return this;
                }
                const markerListener = this.markerListeners.splice(i, 1)[0];
                marker.removeEventListener('click', markerListener);
                delete marker['_oms'];
                this.markers.splice(i, 1);
                return this;  // return self, for chaining
            };

            p['clearMarkers'] = function clearMarkers() {
                this['unspiderfy']();
                for (let i = 0; i < this.markers.length; i++) {
                    const marker = this.markers[i];
                    const markerListener = this.markerListeners[i];
                    marker.removeEventListener('click', markerListener);
                    delete marker['_oms'];
                }
                this.initMarkerArrays();
                return this;  // return self, for chaining
            };

            // available listeners: click(marker), spiderfy(markers), unspiderfy(markers)
            p['addListener'] = function (event, func) {
                (this.listeners[event] != null ? this.listeners[event] : (this.listeners[event] = [])).push(func);
                return this;  // return self, for chaining
            };

            p['removeListener'] = function (event, func) {
                const i = this.arrIndexOf(this.listeners[event], func);
                if (!(i < 0)) {
                    this.listeners[event].splice(i, 1);
                }
                return this;  // return self, for chaining
            };

            p['clearListeners'] = function (event) {
                this.listeners[event] = [];
                return this;  // return self, for chaining
            };

            p.trigger = function (event, ...args) {
                return (Array.from(this.listeners[event] != null ? this.listeners[event] : [])).map((func) => func(...Array.from(args || [])));
            };

            p.generatePtsCircle = function (count, centerPt) {
                const circumference = this['circleFootSeparation'] * (2 + count);
                const legLength = circumference / twoPi;  // = radius from circumference
                const angleStep = twoPi / count;
                return (() => {
                    const result = [];
                    for (let i = 0, end = count, asc = 0 <= end; asc ? i < end : i > end; asc ? i++ : i--) {
                        const angle = this['circleStartAngle'] + (i * angleStep);
                        result.push(new L.Point(centerPt.x + (legLength * Math.cos(angle)),
                            centerPt.y + (legLength * Math.sin(angle))));
                    }
                    return result;
                })();
            };

            p.generatePtsSpiral = function (count, centerPt) {
                let legLength = this['spiralLengthStart'];
                let angle = 0;
                return (() => {
                    const result = [];
                    for (let i = 0, end = count, asc = 0 <= end; asc ? i < end : i > end; asc ? i++ : i--) {
                        angle += (this['spiralFootSeparation'] / legLength) + (i * 0.0005);
                        const pt = new L.Point(centerPt.x + (legLength * Math.cos(angle)),
                            centerPt.y + (legLength * Math.sin(angle)));
                        legLength += (twoPi * this['spiralLengthFactor']) / angle;
                        result.push(pt);
                    }
                    return result;
                })();
            };

            p.spiderListener = function (marker) {
                const markerSpiderfied = (marker['_omsData'] != null);
                if (!markerSpiderfied || !this['keepSpiderfied']) {
                    this['unspiderfy']();
                }
                if (markerSpiderfied) {
                    return this.trigger('click', marker);
                } else {
                    const nearbyMarkerData = [];
                    const nonNearbyMarkers = [];
                    const pxSq = this['nearbyDistance'] * this['nearbyDistance'];
                    const markerPt = this.map.latLngToLayerPoint(marker.getLatLng());
                    for (let m of Array.from(this.markers)) {
                        if (!this.map.hasLayer(m)) {
                            continue;
                        }
                        const mPt = this.map.latLngToLayerPoint(m.getLatLng());
                        if (this.ptDistanceSq(mPt, markerPt) < pxSq) {
                            nearbyMarkerData.push({marker: m, markerPt: mPt});
                        } else {
                            nonNearbyMarkers.push(m);
                        }
                    }
                    if (nearbyMarkerData.length === 1) {  // 1 => the one clicked => none nearby
                        return this.trigger('click', marker);
                    } else {
                        return this.spiderfy(nearbyMarkerData, nonNearbyMarkers);
                    }
                }
            };

            p.makeHighlightListeners = function (marker) {
                return {
                    highlight: () => marker['_omsData'].leg.setStyle({color: this['legColors']['highlighted']}),
                    unhighlight: () => marker['_omsData'].leg.setStyle({color: this['legColors']['usual']})
                };
            };

            p.spiderfy = function (markerData, nonNearbyMarkers) {
                let md;
                this.spiderfying = true;
                const numFeet = markerData.length;
                const bodyPt = this.ptAverage((() => {
                    const result = [];
                    for (md of Array.from(markerData)) {
                        result.push(md.markerPt);
                    }
                    return result;
                })());
                const footPts = numFeet >= this['circleSpiralSwitchover'] ?
                    this.generatePtsSpiral(numFeet, bodyPt).reverse()  // match from outside in => less criss-crossing
                    :
                    this.generatePtsCircle(numFeet, bodyPt);
                const spiderfiedMarkers = (() => {
                    const result1 = [];
                    for (var footPt of Array.from(footPts)) {
                        const footLl = this.map.layerPointToLatLng(footPt);
                        const nearestMarkerDatum = this.minExtract(markerData, md => this.ptDistanceSq(md.markerPt, footPt));
                        const {marker} = nearestMarkerDatum;
                        const leg = new L.Polyline([marker.getLatLng(), footLl], {
                            color: this['legColors']['usual'],
                            weight: this['legWeight'],
                            clickable: false
                        });
                        this.map.addLayer(leg);
                        marker['_omsData'] = {usualPosition: marker.getLatLng(), leg};
                        if (this['legColors']['highlighted'] !== this['legColors']['usual']) {
                            const mhl = this.makeHighlightListeners(marker);
                            marker['_omsData'].highlightListeners = mhl;
                            marker.addEventListener('mouseover', mhl.highlight);
                            marker.addEventListener('mouseout', mhl.unhighlight);
                        }
                        marker.setLatLng(footLl);
                        marker.setZIndexOffset(1000000);
                        result1.push(marker);
                    }
                    return result1;
                })();
                delete this.spiderfying;
                this.spiderfied = true;
                return this.trigger('spiderfy', spiderfiedMarkers, nonNearbyMarkers);
            };

            p['unspiderfy'] = function (markerNotToMove = null) {
                if (this.spiderfied == null) {
                    return this;
                }
                this.unspiderfying = true;
                const unspiderfiedMarkers = [];
                const nonNearbyMarkers = [];
                for (let marker of Array.from(this.markers)) {
                    if (marker['_omsData'] != null) {
                        this.map.removeLayer(marker['_omsData'].leg);
                        if (marker !== markerNotToMove) {
                            marker.setLatLng(marker['_omsData'].usualPosition);
                        }
                        marker.setZIndexOffset(0);
                        const mhl = marker['_omsData'].highlightListeners;
                        if (mhl != null) {
                            marker.removeEventListener('mouseover', mhl.highlight);
                            marker.removeEventListener('mouseout', mhl.unhighlight);
                        }
                        delete marker['_omsData'];
                        unspiderfiedMarkers.push(marker);
                    } else {
                        nonNearbyMarkers.push(marker);
                    }
                }
                delete this.unspiderfying;
                delete this.spiderfied;
                this.trigger('unspiderfy', unspiderfiedMarkers, nonNearbyMarkers);
                return this;  // return self, for chaining
            };

            p.ptDistanceSq = function (pt1, pt2) {
                const dx = pt1.x - pt2.x;
                const dy = pt1.y - pt2.y;
                return (dx * dx) + (dy * dy);
            };

            p.ptAverage = function (pts) {
                let sumY;
                let sumX = (sumY = 0);
                for (let pt of Array.from(pts)) {
                    sumX += pt.x;
                    sumY += pt.y;
                }
                const numPts = pts.length;
                return new L.Point(sumX / numPts, sumY / numPts);
            };

            p.minExtract = function (set, func) {  // destructive! returns minimum, and also removes it from the set
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
            };

            p.arrIndexOf = function (arr, obj) {
                if (arr.indexOf != null) {
                    return arr.indexOf(obj);
                }
                for (let i = 0; i < arr.length; i++) {
                    const o = arr[i];
                    if (o === obj) {
                        return i;
                    }
                }
                return -1;
            };
        }

        // Note: it's OK that this constructor comes after the properties, because of function hoisting
        constructor(map, opts) {
            this.map = map;
            if (opts == null) {
                opts = {};
            }
            for (let k of Object.keys(opts || {})) {
                this[k] = opts[k];
            }
            this.initMarkerArrays();
            this.listeners = {};
            for (let e of ['click', 'zoomend']) {
                this.map.addEventListener(e, () => this['unspiderfy']());
            }
        }
    });
    Cls.initClass();
    return Cls;
})();
