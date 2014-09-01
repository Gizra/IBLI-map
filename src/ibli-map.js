'use strict';

angular
  .module('ibliApp', [
    'leaflet-directive'
  ])
  .constant('BACKEND_URL', 'http://127.0.0.1:9000')
  .factory('ibliHttpInterceptor', function ($q, BACKEND_URL) {
    // Public API here
    return {
      /**
       * This interceptor construct the path to get the data translated,
       * check the config and according this generated the new path in relation
       * the language selected by the user.
       *
       * @param config
       *   In the $http config add two new variables:
       *
       *   - serverPredefined: true|false if the value is true take the constant
       *     WEB_URL defined in the config.js to set the server URI. Otherwise
       *     keep the original config.url.       *
       *   - apiMock: true|false indicate if use the interceptor angular-apimock.
       *     to maintain compatibility.
       *
       * @returns {*}
       */
      'request': function(config) {
        // Validate if use the server url defined in the constant.
        if (config.serverPredefined) {
          config._url = BACKEND_URL;

          // Have the condition to work with the module angular-apimock
          // https://github.com/seriema/angular-apimock
          config.url = (angular.isDefined(config.apiMock) && config.apiMock) ? config.url : config._url + config.url;
        }

        return config || $q.when(config);
      }
    };
  })
  .factory('ibliData', function ($http, $q) {

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
      var currentSeason = currentMonth >=3 && currentMonth <= 9 ? 'LRLD' : 'SRSD';

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
        '#00AA00',
        '#DDDD00',
        '#BB5500',
        '#AA0000',
        '#000000'
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
        kenya: {
          lat: 1.1864,
          lng: 37.925,
          zoom: 7
        },
        defaults: {
          minZoom: 6,
          maxZoom: 9
        },
        tiles: {
          url: 'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          options: {
            id: 'v3/examples.map-20v6611k'
          }
        },
        maxbounds: {
          southWest:{
            lat: -2.3613917533090936,
            lng: 31.662597656249996
          },
          northEast:{
            lat: 3.984820817420321,
            lng: 44.703369140625
          }
        },
        legend: {
          position: 'bottomleft',
          colors: _getColors(),
          labels: [
            '0%-6%',
            '6%-8%',
            '8%-10%',
            '10%-15%',
            '15%-100%'
          ]
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

          periods.push(headers[column]);

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
          period = periods[periods.length - 1];
        }

        divIdToIndex = indices[period];

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
      var path = Drupal.settings.ibli_general.iblimap_library_path;
      // Get divisions data from geoJSON file.
      var deferred = $q.defer();
      $http({
        method: 'GET',
        url: path + '/json/kenya.json',
        serverPredefined: true
      }).success(function(kenyaDivisions) {
          // Prepare geoJson object with the division data.
          var geojsonObject = {
            data: kenyaDivisions,
            style: style,
            resetStyleOnMouseout: true
          };
          deferred.resolve(geojsonObject);
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
        fillColor: getColor(feature.properties.DIV_ID),
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
      }
    };
  })
  .controller('MainCtrl', function ($scope, $http, $compile, ibliData, $log) {

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
      defaults: {
        scrollWheelZoom: false
      }
    },
    ibliData.getMapOptions()
    );

    // Get divIdToIndex data.
    ibliData.getDivIdToIndex().then(function (data) {

      $scope.periods = data;

      // Set default period to the latest one.
      if ($scope.period == undefined) {
        $scope.period = $scope.periods[$scope.periods.length - 1];
      }

      // Get geoJson data. We do this here because we need the divIdToIndex
      // data to be available for the geoJson to work properly.
      ibliData.getGeoJson().then(function (data) {
        $scope.geojson = data;
      });
    });

    $scope.nextSalesWindow = ibliData.getSeason() == 'LRLD' ? 'Aug/Sept' : 'Jan/Feb';
    $scope.nextPayout = ibliData.getSeason() == 'LRLD' ? 'March' : 'October';

    var periodSelect = L.control();
    periodSelect.setPosition('topright');
    periodSelect.onAdd = function () {
      return $compile(angular.element('<select ng-model="period" ng-options="period for period in periods"></select>'))($scope)[0];
    };
    $scope.controls.custom.push(periodSelect);

    // When hovering a division.
    $scope.$on("leafletDirectiveMap.geojsonMouseover", function(ev, leafletEvent) {
      var layer = leafletEvent.target;
      layer.setStyle(ibliData.getHoverStyle());
      layer.bringToFront();
      var latLng = layer.feature.properties;
      var marker = $scope.markers.kenya;
      marker.lat = latLng.Y;
      marker.lng = latLng.X;
      marker.focus = true;
    });

    // When exiting hovering a division.
    $scope.$on("leafletDirectiveMap.geojsonMouseout", function(ev, leafletEvent) {
      //$scope.markers.kenya.focus = false;
    });


    // Reload the map when the period is changed.
    // TODO: Update the map without reloading the geoJson file.
    $scope.$watch('period', function() {
      ibliData.getDivIdToIndex($scope.period).then(function (data) {
        ibliData.getGeoJson().then(function (data) {
          $scope.geojson = data;
        });
      });
    });
  })
  .directive('hoverInfo',  function ($compile) {
    var path = Drupal.settings.ibli_general.iblimap_library_path;
    return {
      scope: {
        markers: '='
      },
      templateUrl: path + '/templates/hover-info.html',
      restrict: 'AEC',
      link: function(scope, element, attrs) {
        element.append("<hover-info></hover-info>");
        $compile(element.contents())(scope.markers.kenya.message);
      }
    };
  });
