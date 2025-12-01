(function (factory) {
  if (typeof define === 'function' && define.amd) {
    define(['leaflet'], factory);
  } else if (typeof module !== 'undefined') {
    module.exports = factory(require('leaflet'));
  } else {
    factory(L);
  }
}(function (L) {
  L = L && L.hasOwnProperty('default') ? L['default'] : L;

  // Minimal WMTS tile layer implementation inspired by https://github.com/mylen/leaflet.TileLayer.WMTS
  L.TileLayer.WMTS = L.TileLayer.extend({
    defaultWmtsParams: {
      service: 'WMTS',
      request: 'GetTile',
      version: '1.0.0',
      layer: '',
      style: 'default',
      tilematrixSet: '',
      format: 'image/jpeg'
    },

    initialize: function (url, options) {
      options = options || {};
      const wmtsParams = L.extend({}, this.defaultWmtsParams);
      const tileSize = options.tileSize || this.options.tileSize;
      const pickedOptions = {};

      for (const opt in options) {
        if (!Object.prototype.hasOwnProperty.call(this.options, opt)) {
          wmtsParams[opt] = options[opt];
        } else {
          pickedOptions[opt] = options[opt];
        }
      }

      wmtsParams.width = wmtsParams.height = tileSize instanceof L.Point ? tileSize.x : tileSize;
      L.setOptions(this, pickedOptions);
      this.wmtsParams = wmtsParams;
      L.TileLayer.prototype.initialize.call(this, url, pickedOptions);
    },

    getTileUrl: function (coords) {
      const tileMatrix = `${this.wmtsParams.tilematrixSet}:${coords.z}`;
      const urlParams = L.extend({}, this.wmtsParams, {
        tilematrix: tileMatrix,
        tilerow: coords.y,
        tilecol: coords.x
      });
      return this._url + L.Util.getParamString(urlParams, this._url);
    },

    setParams: function (params, noRedraw) {
      L.extend(this.wmtsParams, params);
      if (!noRedraw) {
        this.redraw();
      }
      return this;
    }
  });

  L.tileLayer.wmts = function (url, options) {
    return new L.TileLayer.WMTS(url, options);
  };

  return L.TileLayer.WMTS;
}));
