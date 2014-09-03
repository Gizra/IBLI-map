'use strict';
angular.module('ibliApp', ['leaflet-directive']).constant('BACKEND_URL', 'http://127.0.0.1:9000').factory('ibliHttpInterceptor', [
  '$q',
  'BACKEND_URL',
  function ($q, BACKEND_URL) {
    // Public API here
    return {
      'request': function (config) {
        // Validate if use the server url defined in the constant.
        if (config.serverPredefined) {
          config._url = BACKEND_URL;
          // Have the condition to work with the module angular-apimock
          // https://github.com/seriema/angular-apimock
          config.url = angular.isDefined(config.apiMock) && config.apiMock ? config.url : config._url + config.url;
        }
        return config || $q.when(config);
      }
    };
  }
]).factory('ibliData', [
  '$http',
  '$q',
  '$log',
  function ($http, $q, $log) {
    var divIdToIndex = [];
    /**
     * Get current season.
     *
     * @return
     *    In March-September returns "LRLD", otherwise "SRSD".
     */
    function _getSeason() {
      // Get current month from 1 to 12.
      var date = new Date();
      var currentMonth = date.getMonth() + 1;
      // Get current season, in March-September it is "LRLD", otherwise "SRSD".
      var currentSeason = currentMonth >= 3 && currentMonth <= 9 ? 'LRLD' : 'SRSD';
      return currentSeason;
    }
    /**
     * Get HEX codes for colors we use in the map.
     *
     * @return
     *    Array of HEX colors, keyed by the color's name.
     */
    function _getColors() {
      return [
        '#000000',
        '#AA0000',
        '#BB5500',
        '#DDDD00',
        '#00AA00'
      ];
    }
    /**
     * Get style to apply when hovering a division.
     *
     * @return
     *    Object with style settings.
     */
    function _getHoverStyle() {
      return {
        weight: 2,
        fillOpacity: 0.2
      };
    }
    /**
     * Get map options.
     *
     * @return
     *    Object of map-related options, used for extending the scope.
     */
    function _getMapOptions() {
      return {
        center: {
          lat: 1.1864,
          lng: 37.925,
          zoom: 6
        },
        defaults: {
          minZoom: 6,
          maxZoom: 9
        },
        tiles: {
          url: 'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          options: { id: 'v3/examples.map-20v6611k' }
        },
        maxbounds: {
          southWest: {
            lat: -9.282399,
            lng: 31.662597
          },
          northEast: {
            lat: 10.268303,
            lng: 44.703369
          }
        }
      };
    }
    /**
     * Get indexes keyed by division ID.
     *
     * @return
     *    Array of indexes keyed by division ID.
     */
    function _getDivIdToIndex(period) {
      var deferred = $q.defer();
      $http({
        method: 'GET',
        url: 'sites/default/files/data/zCumNDVI_Percentile.csv',
        serverPredefined: true
      }).success(function (response) {
        var csv = response;
        var rows = csv.split('\n');
        for (var i in rows) {
          if (!rows[i]) {
            continue;
          }
          rows[i] = rows[i].split(',');
        }
        var headers = rows.shift();
        var periods = [];
        var indices = [];
        // Add each column as an array.
        for (var column in headers) {
          // Match the index columns (Like "2013S").
          if (!headers[column].match(/\d{4}[L|S]/)) {
            continue;
          }
          // Create the period label.
          var year = headers[column].match(/\d{4}/)[0];
          var season = headers[column].match(/S/) ? 'Short season' : 'Long season';
          periods.unshift({
            value: headers[column],
            label: year + ', ' + season
          });
          indices[headers[column]] = [];
          // Add the values from all rows to each index.
          rows.forEach(function (row) {
            var unitId = parseInt(row[0]);
            var index = parseInt(row[column]);
            indices[headers[column]][unitId] = index;
          });
        }
        // Show by default the latest period.
        if (!period) {
          period = periods[0];
        }
        divIdToIndex = indices[period.value];
        deferred.resolve(periods);
      });
      return deferred.promise;
    }
    /**
     * Get geoJson object.
     *
     * @return
     *    Object of geoJson data, used for extending the scope.
     */
    function _getGeoJson() {
      // Get divisions data from geoJSON file.
      var deferred = $q.defer();
      $http({
        method: 'GET',
        url: 'sites/default/files/data/KenyaEthiopia_IBLIunits_July2014.geojson',
        serverPredefined: true
      }).success(function (divisions) {
        // Prepare geoJson object with the division data.
        var geojsonObject = {
            data: divisions,
            style: style,
            resetStyleOnMouseout: true
          };
        deferred.resolve(geojsonObject);
      });
      return deferred.promise;
    }
    /**
     * Get premium rates keyed by division ID.
     *
     * @return
     *    Int of premium rate.
     */
    function _getPremiumRates() {
      // Get divisions data from geoJSON file.
      var deferred = $q.defer();
      $http({
        method: 'GET',
        url: 'sites/default/files/data/rates.json',
        serverPredefined: true
      }).success(function (rates) {
        // Prepare geoJson object with the division data.
        var ratesObject = { data: rates };
        deferred.resolve(ratesObject);
      });
      return deferred.promise;
    }
    /**
     * Returns style settings for a given geoJson feature.
     *
     * @param feature
     *    GeoJson feature.
     *
     * @return
     *    Style settings for the feature.
     */
    function style(feature) {
      return {
        fillColor: getColor(feature.properties.IBLI_ID),
        weight: 2,
        opacity: 1,
        color: 'white',
        dashArray: '3',
        fillOpacity: 0.6
      };
    }
    /**
     * Returns color for a given division ID.
     *
     * @param divId
     *    Division ID.
     *
     * @return
     *    The HEX color for the division ID.
     */
    function getColor(divId) {
      // Get index for the given division ID.
      var index = divIdToIndex[divId];
      var colors = _getColors();
      return colors[index - 1];
    }
    // Public API here
    return {
      getMapOptions: function () {
        return _getMapOptions();
      },
      getHoverStyle: function () {
        return _getHoverStyle();
      },
      getDivIdToIndex: function (period) {
        return _getDivIdToIndex(period);
      },
      getGeoJson: function () {
        return _getGeoJson();
      },
      getSeason: function () {
        return _getSeason();
      },
      getPremiumRates: function () {
        return _getPremiumRates();
      }
    };
  }
]).controller('MainCtrl', [
  '$scope',
  '$http',
  '$compile',
  'ibliData',
  '$timeout',
  '$log',
  function ($scope, $http, $compile, ibliData, $timeout, $log) {
    // Custom control for displaying name of division and percent on hover.
    $scope.controls = { custom: [] };
    // Set marker potions.
    angular.extend($scope, {
      markers: {
        kenya: {
          lat: 1.1864,
          lng: 37.925,
          message: '',
          focus: false,
          draggable: false
        }
      },
      defaults: { scrollWheelZoom: false }
    }, ibliData.getMapOptions());
    // Get divIdToIndex data.
    ibliData.getDivIdToIndex().then(function (data) {
      $scope.periods = data;
      // Set default period to the latest one.
      if ($scope.period == undefined) {
        $scope.period = $scope.periods[0];
      }
      // Get geoJson data. We do this here because we need the divIdToIndex
      // data to be available for the geoJson to work properly.
      ibliData.getGeoJson().then(function (data) {
        $scope.geojson = data;
      });
    });
    $scope.nextSalesWindow = ibliData.getSeason() == 'LRLD' ? 'Aug/Sept' : 'Jan/Feb';
    $scope.nextPayout = ibliData.getSeason() == 'LRLD' ? 'March' : 'October';
    // Get divIdToIndex data.
    ibliData.getPremiumRates().then(function (data) {
      $scope.rates = data;
    });
    var periodSelect = L.control();
    periodSelect.setPosition('topright');
    periodSelect.onAdd = function () {
      return $compile(angular.element('<select ng-model="period" ng-options="period.label for period in periods track by period.value"></select>'))($scope)[0];
    };
    $scope.controls.custom.push(periodSelect);
    // When hovering a division.
    $scope.$on('leafletDirectiveMap.geojsonMouseover', function (ev, leafletEvent) {
      var layer = leafletEvent.target;
      layer.setStyle(ibliData.getHoverStyle());
      layer.bringToFront();
      var district = '';
      var latLng = leafletEvent.latlng;
      var properties = layer.feature.properties;
      var marker = $scope.markers.kenya;
      // Display the premium rate.
      var rateHTML = '';
      var season = $scope.period.value.match(/S/) ? 'Aug/Sep' : 'Jan/Feb';
      var year = $scope.period.value.match(/\d{4}/)[0];
      var premiumRate = ($scope.rates.data[properties.IBLI_ID][season + year] * 100).toFixed(2);
      if (premiumRate && premiumRate != 'NaN') {
        var rateHTML = '<div>' + 'Premium Rate: <strong>' + premiumRate + '%</strong>' + '</div>';
      }
      // End of Calculating the premium rate.
      marker.focus = false;
      switch (properties.DISTRICT) {
      case 'WAJIR':
      case 'MANDERA':
      case 'GARISSA':
        district = '<a href="http://www.takafulafrica.com/">Takaful</a>';
        break;
      case 'ISIOLO':
        district = '<a href="http://www.takafulafrica.com/">Takaful</a> | <a href="http://www.apainsurance.org/">APA</a>';
        break;
      case 'MARSABIT':
        district = '<a href="http://www.apainsurance.org/">APA</a>';
        break;
      case 'MOYALE':
      case 'IJARA':
      case 'TANA RIVER':
      case 'SAMBURU':
      case 'BARINGO':
      case 'TURKANA':
        district = 'TBD';
        break;
      }
      marker.lat = latLng.lat;
      marker.lng = latLng.lng;
      marker.message = '<div>' + '<div>' + '<strong>' + properties.DIVI_WOR + '</strong>' + '</div>' + rateHTML + '<dl>' + '<dt>Next Sales Window:</dt>' + '<dd>' + $scope.nextSalesWindow + '</dd>' + '<dt>Next Potential Payout:</dt>' + '<dd>' + $scope.nextPayout + '</dd>' + '<dt>Insurer:</dt>' + '<dd class="insurers">' + district + '</dd>' + '</dl>' + '</div>';
      $timeout(function () {
        marker.focus = true;
      }, 350);
    });
    // Reload the map when the period is changed.
    // TODO: Update the map without reloading the geoJson file.
    $scope.$watch('period', function () {
      ibliData.getDivIdToIndex($scope.period).then(function (data) {
        ibliData.getGeoJson().then(function (data) {
          $scope.geojson = data;
        });
      });
    });
  }
]);