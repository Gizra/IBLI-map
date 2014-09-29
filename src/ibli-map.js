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
          options: {
            id: 'v3/examples.map-20v6611k'
          }
        },
        maxbounds: {
          southWest:{
            lat: -9.282399,
            lng: 31.662597
          },
          northEast:{
            lat: 10.368303,
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
          periods.unshift({value: headers[column], label: year + ', ' + season});

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
      }).success(function(divisions) {
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
      }).success(function(rates) {
        // Prepare geoJson object with the division data.
        var ratesObject = {
          data: rates
        };
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
  })
  .controller('MainCtrl', function ($scope, $attrs, $http, $compile, $timeout, ibliData, leafletData, $window) {

    // Set marker potions.
    angular.extend($scope, {
      markers: {
        province: {
          lat: 1.1864,
          lng: 37.925,
          message: '',
          focus: false,
          draggable: false
        }
      },
      defaults: {
        scrollWheelZoom: false
      },
      latLng: {
        lat: 1.1864,
        lng: 37.925
      },
      message: '',
      images_path: $window.Drupal.settings.ibli_general.iblimap_images_path,
      // Custom control for displaying name of division and percent on hover.
      controls: {
        custom: []
      },
      // Params for the rate calculator.
      premiumRate: 0,
      calculatedSum: {},
      calculator: false,
      insurers: [],
      calculatorData: {},
      // This will help us determine if the big marker is open or not.
      markerOpen: false,
      calculationRates: {
        camels: {
          APA: 28000,
          TIA:35000,
          OIC:10000
        },
        cows: {
          APA: 20000,
          TIA:25000,
          OIC:6000
        },
        goats: {
          APA: 2000,
          TIA:2500,
          OIC:8000
        }
      }
    },
    ibliData.getMapOptions()
    );

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

    // Get divIdToIndex data.
    ibliData.getPremiumRates().then(function (data) {
      $scope.rates = data;
    });

    // Legend index in the bottom-left corner of the map.
    var legend = L.control();
    legend.setPosition('bottomleft');
    legend.onAdd = function () {
      return $compile(angular.element('<img ng-src="' + $scope.images_path + '/legend.png"/>'))($scope)[0];
    };
    $scope.controls.custom.push(legend);

    if ($attrs.periodList == "true") {
      // Create an Image from the map and send it to the server to save as PDF.
      $scope.savePDF = function() {
        $scope.loader = 1;
        // Get the map data.
        leafletData.getMap().then(function(map) {
          // Call leafletImage library and it will return the PNG image.
          leafletImage(map, function(err, canvas) {
            var img = document.createElement('img');
            var dimensions = map.getSize();
            img.width = dimensions.x;
            img.height = dimensions.y;
            img.src = canvas.toDataURL();

            var data = {
              map: img.src,
              period: $scope.period.value,
              map_width: img.width,
              map_height: img.height
            };
            // Send the image to drupal for saving as PDF.
            $http({
              method: 'POST',
              url: 'pim/save-pdf',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
              },
              data: jQuery.param(data)
            }).success(function(pdf_path) {
              // Upon success Hide the Spinner GIF and show the link to download the PDF.
              $scope.loader = 0;
              $scope.pdf_path = pdf_path;
            });
          });
        });
      };
    }

    // Next potential payouts and sales.
    if ($attrs.periodList == "false") {
      var now = new Date();
      var month = now.getMonth();
      var year = now.getFullYear();
      var next_year = now.getFullYear()+1;
      $scope.payouts_sales  = {};
      switch (true) {
        case (month < 3):
          $scope.payouts_sales.new_payout = 'October ' + year;
          $scope.payouts_sales.cur_payout = 'March ' + year;
          $scope.payouts_sales.sales_date = 'Jan/Feb ' + year;
          break;
        case (month == 3):
          $scope.payouts_sales.new_payout = 'October ' + year;
          $scope.payouts_sales.cur_payout = 'March ' + year;
          $scope.payouts_sales.sales_date = 'Aug/Sep ' + year;
          break;
        case (month > 3 && month < 10):
          $scope.payouts_sales.new_payout = 'March ' + next_year;
          $scope.payouts_sales.cur_payout = 'October ' + year;
          $scope.payouts_sales.sales_date = 'Aug/Sep ' + year;
          break;
        case (month >= 10):
          $scope.payouts_sales.new_payout = 'October ' + next_year;
          $scope.payouts_sales.cur_payout = 'March ' + next_year;
          $scope.payouts_sales.sales_date = 'Jan/Feb ' + next_year;
          break;
      }
      var payouts = L.control();
      payouts.setPosition('bottomright');
      payouts.onAdd = function () {
        return $compile(angular.element('<payouts></payouts>'))($scope)[0];
      };
      $scope.controls.custom.push(payouts);
    }

    // When hovering a division.
    $scope.$on("leafletDirectiveMap.geojsonMouseover", function(ev, leafletEvent) {
      var layer = leafletEvent.target;
      layer.setStyle(ibliData.getHoverStyle());
      layer.bringToFront();
      // Get the properties of the layer for the popup.
      var properties = layer.feature.properties;
      // Get the location of the layer for the popup.
      $scope.latLng = leafletEvent.latlng;

      // If the Calculator popup is not open, Don't open the hover marker/Update insurer.
      if (!$scope.markerOpen) {
        var marker = $scope.markers.province;
        marker.focus = false;
        marker.lat = $scope.latLng.lat;
        marker.lng = $scope.latLng.lng;
        marker.message = '<strong>' + properties.IBLI_UNIT + '</strong>';
        $timeout(function () {
          marker.focus = true;
        }, 500);
      }
    });

    // When clicking on a division.
    $scope.$on("leafletDirectiveMap.geojsonClick", function(ev, leafletEvent) {
      // Get the properties of the layer for the popup.
      var properties = leafletEvent.properties;
      // Display the premium rate.
      var season = $scope.period.value.match(/L/) ? 'Aug/Sep' : 'Jan/Feb';
      var year = $scope.period.value.match(/\d{4}/)[0];
      // Check if Division is in the csv file.
      if ($scope.rates.data[properties.IBLI_ID]) {
        $scope.premiumRate = ($scope.rates.data[properties.IBLI_ID][season + year] * 100).toFixed(2);
      }
      // Define empty html for PIM.
      var rateHTML = '';
      var rate_calculator = '';
      // End of Calculating the premium rate.
      // Display the insurer according to the district.
      var insurer;
      switch (properties.DISTRICT) {
        case 'WAJIR':
        case 'MANDERA':
        case 'GARISSA':
          insurer = '<a href="http://www.takafulafrica.com/">Takaful</a>';
          $scope.insurers = ['TIA'];
          break;
        case 'ISIOLO':
          insurer = '<a href="http://www.takafulafrica.com/">Takaful</a> | <a href="http://www.apainsurance.org/">APA</a>';
          $scope.insurers = ['TIA','APA'];
          break;
        case 'MARSABIT':
          insurer = '<a href="http://www.apainsurance.org/">APA</a>';
          $scope.insurers = ['APA'];
          break;
        case 'MOYALE':
        case 'IJARA':
        case 'TANA RIVER':
        case 'SAMBURU':
        case 'BARINGO':
        case 'TURKANA':
          insurer = 'TBD';
          break;
        default:
          // Where there's no known insurer, display TBD.
          insurer = 'TBD';

      }
      // Insurer is OIC in Ethiopia, Regardless of the district.
      if (properties.COUNTRY == "ETHIOPIA") {
        insurer = 'OIC';
        $scope.insurers = ['OIC'];
      }
      // If no division, just hide the premium rate.
      if ($scope.premiumRate && $scope.premiumRate != 'NaN') {
        rateHTML =
          '<div>'+
          'Premium Rate: <strong>' + $scope.premiumRate + '%</strong>'+
          '</div>';
      }
      // If no division, no insurer, Hide the rate_calculator.
      if ($scope.premiumRate && $scope.premiumRate != 'NaN' && insurer != 'TBD') {
        rate_calculator = $compile(angular.element('<rate-calculator></rate-calculator>'))($scope)[0];
      }
      var message =
        '<div id="popuop-data">' +
        '<div>'+
        '<strong>' + properties.IBLI_UNIT + '</strong>'+
        '</div>'+
        rateHTML;

      // Show the payout / sales window / insurer information only if the year is current.
      if (new Date().getFullYear() > year) {
        message += '</div>';
      }
      else {
        message +=
          '<dl>' +
          '<dt>Insurer:</dt>' +
          '<dd class="insurers">' +
          insurer +
          '</dd>' +
          '</dl>' +
          '</div>';
      }
      $scope.message = document.createElement('div');
      $scope.message.innerHTML = message;
      // Compile the calculator directive.
      if (rate_calculator) {
        $scope.message.appendChild(rate_calculator);
      }

      // Mark this new popup as open.
      $scope.markerOpen = L.popup();
      // Hide hovering marker.
      var marker = $scope.markers.province;
      marker.focus = false;
      leafletData.getMap().then(function (map) {
        $timeout(function () {
          $scope.markerOpen
            .setLatLng([$scope.latLng.lat, $scope.latLng.lng])
            .setContent($scope.message)
            .addTo(map)
        }, 550);
      });
    });

    // This will allow the the hover markups to be opened again when Data popup is closed.
    $scope.$on('leafletDirectiveMap.popupclose', function() {
      $scope.markerOpen = false;
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
  .directive('payouts', function () {
    var path = Drupal.settings.ibli_general.iblimap_library_path;
    return {
      templateUrl: path + '/templates/payouts.html',
      restrict: 'EA',
      scope: true
    };
  })
  .directive('rateCalculator', function () {
    var path = Drupal.settings.ibli_general.iblimap_library_path;
    return {
      templateUrl: path + '/templates/rate-calculator.html',
      restrict: 'EA',
      scope: true,
      link: function postLink(scope) {
        scope.toggleData = function() {
          // Reset form.
          scope.calculatorData = {
            cows: null,
            camels: null,
            goats: null
          };
          scope.calculatedSum = {};

          // Show/hide the popup data.
          angular.element('#popuop-data').toggle();

          // Show/hide the calculator form.
          scope.calculator = !scope.calculator;

          // Update popup for map moving and size change.
          setTimeout(function () {
            scope.markerOpen.update();
          }, 5);
        };

        scope.calculateRate = function(elementId) {
          // Get the input values.
          var data = scope.calculatorData;

          // Put 0 if one of the inputs is empty.
          var cows = data.cows ? data.cows : 0;
          var camels = data.camels ? data.camels : 0;
          var goats = data.goats ? data.goats : 0;

          // Calculate the rate.
          angular.forEach(scope.insurers, function(insurer) {
            scope.calculatedSum[insurer] = (cows * scope.calculationRates.cows[insurer] + camels * scope.calculationRates.camels[insurer] + goats * scope.calculationRates.goats[insurer]) * (scope.premiumRate / 100);
          });

          // Update popup for map moving and size change.
          setTimeout(function () {
            scope.markerOpen.update();
            angular.element(elementId).trigger('focus');
          }, 5);
        };
      }
    };
  });
