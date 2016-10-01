/* This program is free software. It comes without any warranty, to
     * the extent permitted by applicable law. You can redistribute it
     * and/or modify it under the terms of the Do What The Fuck You Want
     * To Public License, Version 2, as published by Sam Hocevar. See
     * http://www.wtfpl.net/ for more details. */

var data_url = "https://data.transformap.co/raw/5d6b9d3d32097fd6832200874402cfc3";
var fallback_data_url = "susydata-fallback.json";

/* fix for leaflet scroll on devices that fire scroll too fast, e.g. Macs
   see https://github.com/Leaflet/Leaflet/issues/4410#issuecomment-234133427

   */

var lastScroll = new Date().getTime();
L.Map.ScrollWheelZoom.prototype._onWheelScroll = function (e) {
  if (new Date().getTime() - lastScroll < 400) {
    e.preventDefault();
    return;
  }
  var delta = L.DomEvent.getWheelDelta(e);
  var debounce = this._map.options.wheelDebounceTime;

  if (delta >= -0.15 && delta <= 0.15) {
    e.preventDefault();
    return;
  }
  if (delta <= -0.25) delta = -0.25;
  if (delta >= 0.25) delta = 0.25;
  this._delta += delta;
  this._lastMousePos = this._map.mouseEventToContainerPoint(e);

  if (!this._startTime) {
      this._startTime = +new Date();
  }

  var left = Math.max(debounce - (+new Date() - this._startTime), 0);

  clearTimeout(this._timer);
  lastScroll = new Date().getTime();
  this._timer = setTimeout(L.bind(this._performZoom, this), left);

  L.DomEvent.stop(e);
}



var map,
    center,
    zoom,
    defaultlayer,
    base_maps,
    pruneClusterLayer;
function initMap() {
  var attr_osm = 'Map data by <a href="https://openstreetmap.org">OpenStreetMap</a> contributors, under <a href="https://www.openstreetmap.org/copyright">ODbL</a>. ',
      attr_pois = 'POIs by <a href="http://solidariteconomy.eu">SUSY</a>, <a href="https://creativecommons.org/publicdomain/zero/1.0/">CC-0</a>. '

  osm = new L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: attr_osm + attr_pois,
      maxZoom : 19,
      noWrap: true
  });
  terrain = new L.tileLayer('https://stamen-tiles-{s}.a.ssl.fastly.net/terrain/{z}/{x}/{y}.png', {
      attribution: 'Map tiles by <a href="http://stamen.com/">Stamen Design</a>, '+
        'under <a href="https://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>. '+
        attr_osm  + attr_pois
  });
  terrain_bg = new L.tileLayer('https://stamen-tiles-{s}.a.ssl.fastly.net/terrain-background/{z}/{x}/{y}.png', {
      attribution: 'Map tiles by <a href="http://stamen.com/">Stamen Design</a>, '+
        'under <a href="https://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>. '+
        attr_osm + attr_pois
  });
  hot = new L.tileLayer('http://tile-{s}.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution: 'Tiles courtesy of <a href="http://hot.openstreetmap.org/">Humanitarian OpenStreetMap Team</a>. '+
        attr_osm + attr_pois
  });

  if(!base_maps)
    base_maps = {
      'Stamen - Terrain': terrain,
      'Stamen - Terrain Background': terrain_bg,
      'OpenStreetMap - Mapnik': osm,
      'Humanitarian OpenStreetMap ': hot
    };
  if(!defaultlayer)
    defaultlayer = terrain_bg;

  if(!center)
    center = new L.LatLng(51.1657, 10.4515);

  map = L.map('map-tiles', {
    zoomControl: false,
    center: center,
    zoom: zoom ? zoom : 5,
    layers: defaultlayer,
  });

  new L.Control.Zoom({ position: 'topright' }).addTo(map);

  pruneClusterLayer = new PruneClusterForLeaflet(60,20);

  /* overwrite function to create popup on the fly */
  pruneClusterLayer.PrepareLeafletMarker = function(leafletMarker, data) {
    leafletMarker.setIcon(data.icon);
    //listeners can be applied to markers in this function
    leafletMarker.on('click', function(e){
      // bind popup and open immediately
      if (!leafletMarker.getPopup()) {
        leafletMarker.bindPopup(data.popup(data));
        leafletMarker.openPopup();
      }
    });
  };

  map.addLayer(pruneClusterLayer);

  var ctrl = new L.Control.Layers(base_maps);
  map.addControl(ctrl);

  var hash = new L.Hash(map); // Leaflet persistent Url Hash function

  $('#map-tiles').append('<a href="https://github.com/TransforMap/transformap-viewer" title="Fork me on GitHub" id=forkme target=_blank><img src="assets/forkme-on-github.png" alt="Fork me on GitHub" /></a>');

  $("#map-menu-container .top").prepend(
      "<div id=mobileShowMap><div onClick='switchToMap();' trn=show_map>"+T("show_map")+"</div></div>"
      );

  $("#map-menu-container .top").append(
      "<div id=resetfilters onClick='resetFilter();' trn=reset_filters>"+T("reset_filters")+"</div>"
      );

  $("#map-menu-container .top").append(
      "<div id=toggleAdvancedFilters onClick='toggleAdvancedFilterMode();' mode='simple' trn=en_adv_filters>"+T("en_adv_filters")+"</div>"
      );

  $("#map-menu-container .top").append(
      "<div id=activefilters>" +
        "<h2 class='expert_mode off' trn=active_filters>" + T("active_filters") + "</h2>" +
        "<ul class='expert_mode off'></ul>" +
      "</div>"
      );

}

function addPOIsToMap(geoJSONfeatureCollection) {
  if(geoJSONfeatureCollection.type != "FeatureCollection") {
    console.error("not a featureCollection");
    return false;
  }

  var POIcollection = geoJSONfeatureCollection.features;
  for(var i=0; i < POIcollection.length; i++) {
    var feature = POIcollection[i];

    var livePopup = function(data) { // gets popup content for a marker
      var templatePopUpFunction = _.template($('#popUpTemplate').html());
      return templatePopUpFunction(data);
    }

    var pdata = {
      icon:  new L.divIcon({
        className: 'my-div-icon',
        iconSize:30,
        html:"<div><div>" + feature.properties.name + "</div></div>"
      }),
      popup: livePopup,
      tags: feature.properties,
      properties: feature.properties // is used by _ template
    }

    var pmarker = new PruneCluster.Marker(feature.geometry.coordinates[1], feature.geometry.coordinates[0], pdata);
    pruneClusterLayer.RegisterMarker(pmarker);
  }

  pruneClusterLayer.ProcessView();
  return true;
}

/* new version of getting map data with promises 
  should fetch data_url, and in case it doesn't respond in a timeout, fetch fallback_data_url

  taken from https://blog.hospodarets.com/fetch_in_action
*/

var processStatus = function (response) {
    // status "0" to handle local files fetching (e.g. Cordova/Phonegap etc.)
    if (response.status === 200 || response.status === 0) {
        return Promise.resolve(response)
    } else {
        return Promise.reject(new Error(response.statusText))
    }
};

var parseJson = function (response) {
    return response.json();
};

/* @returns {wrapped Promise} with .resolve/.reject/.catch methods */
// It goes against Promise concept to not have external access to .resolve/.reject methods, but provides more flexibility
var getWrappedPromise = function () {
    var wrappedPromise = {},
            promise = new Promise(function (resolve, reject) {
                wrappedPromise.resolve = resolve;
                wrappedPromise.reject = reject;
            });
    wrappedPromise.then = promise.then.bind(promise);
    wrappedPromise.catch = promise.catch.bind(promise);
    wrappedPromise.promise = promise;// e.g. if you want to provide somewhere only promise, without .resolve/.reject/.catch methods
    return wrappedPromise;
};

/* @returns {wrapped Promise} with .resolve/.reject/.catch methods */
var getWrappedFetch = function () {
    var wrappedPromise = getWrappedPromise();
    var args = Array.prototype.slice.call(arguments);// arguments to Array

    fetch.apply(null, args)// calling original fetch() method
        .then(function (response) {
            wrappedPromise.resolve(response);
        }, function (error) {
            wrappedPromise.reject(error);
        })
        .catch(function (error) {
            wrappedPromise.catch(error);
        });
    return wrappedPromise;
};

/**
 * Fetch JSON by url
 * @param { {
 *  url: {String},
 *  [cacheBusting]: {Boolean}
 * } } params
 * @returns {Promise}
 */

var MAX_WAITING_TIME = 5000;// in ms

var getJSON = function (params) {
    var wrappedFetch = getWrappedFetch(
        params.cacheBusting ? params.url + '?' + new Date().getTime() : params.url,
        {
            method: 'get',// optional, "GET" is default value
            headers: {
                'Accept': 'application/json'
            }
        });

    var timeoutId = setTimeout(function () {
        wrappedFetch.reject(new Error('Load timeout for resource: ' + params.url));// reject on timeout
    }, MAX_WAITING_TIME);

    return wrappedFetch.promise// getting clear promise from wrapped
        .then(function (response) {
            clearTimeout(timeoutId);
            return response;
        })
        .then(processStatus)
        .then(parseJson);
};

/*--- TEST  --*/
var onComplete = function () {
    console.log('I\'m invoked in any case after success/error');
};

/*
getJSON({
    url: data_url,
    cacheBusting: true
}).then(function (data) {// on success
    console.log('JSON parsed successfully!');
    console.log(data);
    addPOIsToMap(data);
//    onComplete(data);
}, function (error) {// on reject
    console.error('An error occured!');
    console.error(error.message ? error.message : error);
//    onComplete(error);
});*/

function myGetJSON(url,success_function,error_function) {
  var getJSONparams = { url: url, cacheBusting: true };

  getJSON(getJSONparams).then( 
    function (data) { success_function(data) },
    function (error) { error_function(error) }
  );
}

myGetJSON( data_url, 
  function(data) { 
    var adding_pois_successful = addPOIsToMap(data);
    if(adding_pois_successful) {
      console.log("1st try to fetch POI data from API ("+data_url+") was successful");
      return;
    }
    console.log("API didn't return useful data from "+data_url+", try static file");
    myGetJSON( fallback_data_url,
      function(data) {
        if(!addPOIsToMap(data))
          console.error("2nd try to fetch POI data from " + fallback_data_url + " failed too");
      },
      function (error) { 
        console.error("2nd try to fetch POI data from " + fallback_data_url + " failed too"); 
        console.error(error.message ? error.message : error);
      });
    },
  function(error) {
    console.log("1st try to fetch POI data from API ("+data_url+") failed, try fallback");
    myGetJSON( fallback_data_url,
      function(data) {
        var adding_pois_successful = addPOIsToMap(data);
        if(adding_pois_successful)
          console.log("2nd try to fetch POI data from " + fallback_data_url + " successful.");
        else
          console.error("2nd try to fetch POI data from " + fallback_data_url + " failed too");
      },
      function (error) { 
        console.error("2nd try to fetch POI data from " + fallback_data_url + " failed too");
        console.error(error.message ? error.message : error);
      });
  });
    

/* get taxonomy stuff */
var taxonomy_url = "http://viewer.transformap.co/taxonomy.json";
var taxonomy_url = "taxonomy.de.json";

var multilang_taxonomies = {};

//current ones
var flat_taxonomy_array,
    tree_menu_json;

function setTaxonomy(rdf_data) {

  flat_taxonomy_array = rdf_data.results.bindings;

  fill_tax_hashtable();
  tree_menu_json = convertFlattaxToTree();

  buildTreeMenu(tree_menu_json);
}

function getLangTaxURL(lang) {
  if(!lang) {
    console.error("setFilterLang: no lang given");
    return false;
  }
  
  var tax_query =
    'prefix bd: <http://www.bigdata.com/rdf#> ' +
    'prefix wikibase: <http://wikiba.se/ontology#> ' +
    'prefix wdt: <http://base.transformap.co/prop/direct/>' +
    'prefix wd: <http://base.transformap.co/entity/>' +
    'SELECT ?item ?itemLabel ?instance_of ?subclass_of ?type_of_initiative_tag ' +
    'WHERE {' +
      '?item wdt:P8* wd:Q8 .' +
      '?item wdt:P8 ?subclass_of .' +
      'OPTIONAL { ?item wdt:P4 ?instance_of . }' +
      'OPTIONAL { ?item wdt:P15 ?type_of_initiative_tag }' +
      'SERVICE wikibase:label {bd:serviceParam wikibase:language "'+lang+'" }' +
    '}';

//   return 'https://query.base.transformap.co/bigdata/namespace/transformap/sparql?query=' +encodeURIComponent(tax_query) + "&format=json"; // server not CORS ready yet
  return "https://raw.githubusercontent.com/TransforMap/transformap-viewer-translations/master/taxonomy-backup/susy/taxonomy."+lang+".json";
}

function setFilterLang(lang) {
  if(!lang) {
    console.error("setFilterLang: no lang given");
    return false;
  }

  if(multilang_taxonomies[lang]) {
    setTaxonomy(multilang_taxonomies[lang]);
  } else {
    $.ajax({
      url: getLangTaxURL(lang),
      dataType: "json",
      success: applyOrAddTaxonomyLang,
    });
  }
}

function applyOrAddTaxonomyLang(returned_data) {
  //console.log("callback for tax called");
  //console.log(returned_data);
  var lang = returned_data.results.bindings[0].itemLabel["xml:lang"];
  multilang_taxonomies[lang] = returned_data;

  if(multilang_taxonomies[current_lang])
    setTaxonomy(multilang_taxonomies[current_lang]);
  else {
    for(var i=0; i < fallback_langs.length; i++) {
      var fb_tax = multilang_taxonomies[fallback_langs[i]];
      if(fb_tax) {
        setTaxonomy(fb_tax);
        return;
      }
    }
    console.error("applyOrAddTaxonomyLang: no taxonomy in any of the user's langs available");
  }
}

// note: can only handle 3 tiers (cats, subcats, toi) at the moment.
function convertFlattaxToTree() {
  var treejson = {
    "xml:lang": "en",
    "elements": []
  };

  var cats_that_hold_type_of_initiatives = [];

  // get all 'childs' for this root (main categories)
  for( i in tax_hashtable.cat_qindex) {
    var entry = tax_hashtable.cat_qindex[i];
    if(entry["subclass_of"]) {
      if(getQNR(entry["subclass_of"].value) == tax_hashtable.root_qnr) {
        treejson.elements.push(
            {
              "type": "category",
              "UUID": entry.item.value,
              "itemLabel": entry.itemLabel.value,
              "elements" : []
            }
        );
      }
    }
  }

  // get all child categories for the main categories
  treejson.elements.forEach(function(category_item){ //iterate over categories to attach subcats

    var uuid_of_category = category_item.UUID;
    //console.log(uuid_of_category);

    for( i in tax_hashtable.cat_qindex) {
      var entry = tax_hashtable.cat_qindex[i];

      if(entry["subclass_of"]) {
        if(-1 < $.inArray( uuid_of_category, entry["subclass_of"].value.split(";") ) ) {
          //console.log("add subcat " + entry.itemLabel.value + " to category " + category_item.itemLabel );
          var new_subcat =
            {
              "type": "subcategory",
              "UUID": entry.item.value,
              "itemLabel": entry.itemLabel.value,
              "elements" : []
            }
          category_item.elements.push(new_subcat);
          cats_that_hold_type_of_initiatives.push(new_subcat);
        }
      }
    }

    if(category_item.elements.length == 0) {
      cats_that_hold_type_of_initiatives.push(category_item);
    }
  });

  // get all type of initiatives and hang them to their parent category
  // remember: objects are called by reference, so this updates the whole treejson structure!
  for( i in tax_hashtable.toi_qindex) {
    var flat_type_of_initiative = tax_hashtable.toi_qindex[i];

    var parent_uuids = flat_type_of_initiative.subclass_of.value.split(";");

    parent_uuids.forEach(function(single_toi_uuid) { //they may be subclass of more than one cat
      cats_that_hold_type_of_initiatives.forEach(function(cat){
        if(cat.UUID == single_toi_uuid) {
          var type_of_initiative =
            {
              "type": "type_of_initiative",
              "UUID": flat_type_of_initiative.item.value,
              "itemLabel": flat_type_of_initiative.itemLabel.value,
              "type_of_initiative_tag": flat_type_of_initiative.type_of_initiative_tag.value
            }
          cat.elements.push(type_of_initiative);
        }
      });
    });
  };

  return treejson;
}

function buildTreeMenu(tree_json) {

  function appendTypeOfInitiative(toi,parent_element) {
    var toi_data =
        {
          id: getQNR(toi.UUID),
          itemLabel: toi.itemLabel
        }
    parent_element.append( toiTemplate( toi_data  ) );
  }

  function appendCategory(cat, parent_element) {

    var cat_data =
        {
          id: getQNR(cat.UUID),
          itemLabel: cat.itemLabel
        }
    parent_element.append( catTemplate( cat_data  ) );

    if(cat.elements.length != 0) {
      cat.elements.forEach(function(entry) {
        if(entry.type == "subcategory") {
          appendCategory(entry, $('#map-menu .' + cat_data.id + ' > ul.subcategories'));
        }
        if(entry.type == "type_of_initiative") {
          appendTypeOfInitiative(entry, $('#map-menu .' + cat_data.id + ' > ul.type-of-initiative'));
        }
      });
    }
  }

  var menu_root = $('#map-menu');
  menu_root.empty();

  var catTemplate = _.template($('#menuCategoryTemplate').html());
  var toiTemplate = _.template($('#menuTypeOfInitiativeTemplate').html());

  tree_json.elements.forEach(function(cat){
    appendCategory(cat,menu_root);
  });
}

var toi_count_out_of_date = 1;
function updateToiEmptyStatusInFilterMenu () {
  if(! toi_count_out_of_date)
    return;

  var marker_array = pruneClusterLayer.GetMarkers();
  for(var i = 0; i < marker_array.length; i++) {
    var marker = marker_array[i];

    var toi_array = createToiArray(marker.data.tags.type_of_initiative);
    toi_array.forEach(function(e) {
      if(! tax_hashtable.toi_count[e]) {
        tax_hashtable.toi_count[e]=1;
        var qnr = tax_hashtable.toistr_to_qnr[e];
        if(qnr) // only works lateron when menu is loaded
          $('#map-menu .' + qnr).removeClass('empty');
      } else {
        tax_hashtable.toi_count[e]++
      }
    });
  }
  toi_count_out_of_date = 0;
}

function clickOnCat(id) {
  console.log("clickOnCat: "+ id);

  //if is already selected AND no sub-catd/tois are selected
  if($("#map-menu ." + id + " > span").hasClass("selected")
      && $("#map-menu ." + id + " ul .selected").length == 0) {
    if(onMobile())
      switchToMap()
    return;
  }

  //close all other cats on the same level
  $("#map-menu ." + id).parent("ul").children("li").children("ul").hide();
  $("#map-menu ul.type-of-initiative li.selected").removeClass("selected");
  $("ul.type-of-initiative").hide();

  //toggle "selected" on the current level
  $("#map-menu ." + id).parent("ul").children("li").children("span").removeClass("selected");

  //remove all "selected" on all child levels
  $("#map-menu ." + id + " .selected").removeClass("selected");

  $("#map-menu ." + id + " > span").addClass("selected");

  $("#map-menu ." + id + " > ul").show();

  if(getFilterMode() == "simple") {
    removeFromFilter("*");
    addToFilter(id);
    trigger_Filter();
  }

  updateToiEmptyStatusInFilterMenu(); // has internal check to only execute when needed
}

function clickOnInitiative(id) {
  console.log("clickOnInitiative: "+ id);
  if($("#map-menu ." + id).hasClass("selected")) {
    if(onMobile())
      switchToMap()
    return;
  }

  if(getFilterMode() == "simple") {
    $("#map-menu ul.type-of-initiative li.selected").removeClass("selected");
    $("#map-menu ." + id).addClass("selected");
    removeFromFilter("*");
    addToFilter(id);
    trigger_Filter();
  } else {
    if( $("#activefilters ul ."+id).length == 0 ) {
      addToFilter(id)
    } else {
      removeFromFilter(id)
    }
    trigger_Filter();
  }
   

}

/*
 * helper functions
 */

/* delete an object from an array.
 * Returns true if object found and deleted
 * only the first object is deleted
 */
Array.prototype.deleteInArray = function (deletion_canditate) {
  var position = this.indexOf(deletion_canditate);
  if(position > -1) {
    this.splice(position,1);
    return true;
  } else {
    return false;
  }
}

// returns "Q12" of https://base.transformap.co/entity/Q12#taxonomy
function getQNR(uri_string) {
  if(typeof(uri_string) !== 'string')
    return false;
  var slashsplit_array = uri_string.split('/');
  var after_last_slash = slashsplit_array[slashsplit_array.length -1];
  var before_hash = after_last_slash.split('#')[0];
  return before_hash;
}

/*
 * returns array of all tois (Q-Nrs) a cat or subcat has
 */
function getTOIsOfCat(id) {
  var array = [];

  //recursive function
  function dig_deeper_into_taxtree(array_position_object,do_output) {

    if(array_position_object.type != "type_of_initiative" && array_position_object.elements && array_position_object.elements.length) {
      for(var i=0;i<array_position_object.elements.length;i++) {
        if(getQNR(array_position_object.elements[i].UUID) == id || do_output) {
          dig_deeper_into_taxtree(array_position_object.elements[i],true);
        }
        else {
          dig_deeper_into_taxtree(array_position_object.elements[i],false);
        }
      }
    }
    else
      if(do_output) {
        array.push(getQNR(array_position_object.UUID));
      }
  }
  dig_deeper_into_taxtree(tree_menu_json,false);

  return array;
}

function createToiArray(toi_string) {
  if(typeof(toi_string) !== 'string')
    return [];
  var toi_array = toi_string.split(';');
  for(var i=0;i<toi_array.length;i++){
    toi_array[i] = toi_array[i].trim();
  }
  return toi_array;
}

var tax_hashtable = {
  toistr_to_qnr: {},
  qnr_to_toistr: {},
  toi_qindex: {},
  cat_qindex: {},
  all_qindex: {},
  toi_count: {},
  root_qnr: "Q8"
}

var item_domain = "http://base.transformap.co" //http for now, because SPARQL doesn't know about https
var tax_elements = {
  type_of_initiative: item_domain + "/entity/Q6",
  category: item_domain + "/entity/Q5",
  taxonomy: item_domain + "/entity/Q3"
}

function fill_tax_hashtable() {
  tax_hashtable.toi_qindex = {};
  tax_hashtable.cat_qindex = {};
  tax_hashtable.all_qindex = {};

  flat_taxonomy_array.forEach(function(entry){

    var qnr = getQNR(entry.item.value);
    var root_qnr = "";

    if(!entry["instance_of"])
      return; //continue: ignore erroneous entries

    if (entry["instance_of"].value == tax_elements.type_of_initiative ) {
      tax_hashtable.toistr_to_qnr[entry.type_of_initiative_tag.value] = qnr;
      tax_hashtable.qnr_to_toistr[qnr] = entry.type_of_initiative_tag.value;
      if(!tax_hashtable.toi_qindex[qnr]) {
        tax_hashtable.toi_qindex[qnr] = entry;
        tax_hashtable.all_qindex[qnr] = entry;
      } else { // being a member of multiple categories is represented by multiple identical objects being subclass of different categories
        if(-1 == $.inArray( entry.subclass_of.value, tax_hashtable.toi_qindex[qnr].subclass_of.value.split(";") ) ) { //just a precaution to have no dups

          //if it is the original, make a deep copy we can alter
          if( ! tax_hashtable.toi_qindex[qnr].subclass_of.value.match(/;/)) {
            var copy = JSON.parse(JSON.stringify(tax_hashtable.toi_qindex[qnr]));
            tax_hashtable.toi_qindex[qnr] = copy;
            tax_hashtable.all_qindex[qnr] = copy;
          }

          tax_hashtable.all_qindex[qnr].subclass_of.value += ";" + entry.subclass_of.value;
        }
      }

    } else if (entry["instance_of"].value == tax_elements.category ) {
      tax_hashtable.all_qindex[qnr] = entry;
      tax_hashtable.cat_qindex[qnr] = entry;

    } else if(entry["instance_of"].value == tax_elements.taxonomy) {
      tax_hashtable.root_qnr = qnr;
      root_qnr = qnr;
    }

    // add root entry, if not delivered in RDF file
    if(!root_qnr) {
        var root = {
        "item": {
          "type": "uri",
          "value": "http://base.transformap.co/entity/Q8"
        },
        "itemLabel": {
          "xml:lang": "en",
          "type": "literal",
          "value": "SSEDAS Taxonomy"
        },
        "instance_of": {
          "type": "uri",
          "value": "http://base.transformap.co/entity/Q3"
        }
      }
      flat_taxonomy_array.push(root);
      tax_hashtable.all_qindex["Q8"] = root
    }

  })
  //console.log("tax_hashtable after fill: ");
  //console.log(tax_hashtable);
}

/*
 * filters
 */

var current_filter_tois = []; // array of q-nrs

function trigger_Filter() {
  //console.log(current_filter_tois);

  var marker_array = pruneClusterLayer.GetMarkers();
  for(var i = 0; i < marker_array.length; i++) {
    var marker = marker_array[i];
    var attributes = marker.data.tags;
    marker.filtered = ! filterMatches(attributes);
  }
  pruneClusterLayer.ProcessView();

  if(current_filter_tois.length)
    $('#resetfilters').show();
  else
    $('#resetfilters').hide();
}

function resetFilter() {
  $("#map-menu li").removeClass("selected");
  $("#map-menu li > span").removeClass("selected");
  $("ul.type-of-initiative").hide();
  $("ul.subcategories").hide();
  removeFromFilter("*");
  trigger_Filter();
  $("#activefilters ul").append("<li class=hint><span trn=clickanyfilterhint>"+T("clickanyfilterhint")+"</span><div class=close onClick=\"clickMinus('hint')\">×</div></li>");
  $('#resetfilters').hide();
}

function getFilterMode() {
  return $("#toggleAdvancedFilters").attr('mode');
}

function toggleAdvancedFilterMode() {
  resetFilter();
  if(getFilterMode() == "simple") {
    $("#toggleAdvancedFilters").attr('mode',"advanced");
    $("#toggleAdvancedFilters").text(T('dis_adv_filters'));
    $("#toggleAdvancedFilters").attr('trn',"dis_adv_filters");

    $('.expert_mode').removeClass('off')
      .addClass('on');
  } else {
    $("#toggleAdvancedFilters").attr('mode',"simple");
    $("#toggleAdvancedFilters").text(T('en_adv_filters'));
    $("#toggleAdvancedFilters").attr('trn',"en_adv_filters");

    $('.expert_mode').removeClass('on')
      .addClass('off');
  }
}

function addToFilter(id) {
  $("#activefilters ul .hint").remove();

  if(tax_hashtable.toi_qindex[id]) { // is a toi
    if($("#activefilters ul ."+id).length == 0) { // not already there
      current_filter_tois.push(id);
      var item = tax_hashtable.toi_qindex[id];
      var name = item.itemLabel.value;
      $("#activefilters ul").append("<li class="+id+">"+name+"<div class=close onClick=\"clickMinus('"+id+"')\">×</div></li>");

      $("#map-menu li."+id+" form.expert_mode input").each(function(){ this.checked = true; });

      //for parent cats, checked state
      //recursive!
      function checkStateOfParents(parents_string) {
        var parent_cats = parents_string.split(";");
        parent_cats.forEach(function (parent_cat) {
          var parent_qnr = getQNR(parent_cat);

          //[-] has to be active, as we just added an item...
          $("#map-menu li."+parent_qnr+" > span.toggle > span.expert_mode .remove").removeClass("inactive");

          //if all sub-items are in filter list, we can set the 'full' checked state
          var siblings = getTOIsOfCat(parent_qnr);
          var a_toi_missing = false;
          for(var i=0; i < siblings.length; i++) {
            if(current_filter_tois.indexOf(siblings[i]) == -1) {
              a_toi_missing = true;
              break;
            }
          }
          if(a_toi_missing == false) {
            $("#map-menu li."+parent_qnr+" > span.toggle > form.expert_mode input")[0].checked = true;
            $("#map-menu li."+parent_qnr+" > span.toggle > form.expert_mode input")[0].indeterminate = false;
          }
          else
            $("#map-menu li."+parent_qnr+" > span.toggle > form.expert_mode input")[0].indeterminate = true;


          var new_parent = tax_hashtable.cat_qindex[parent_qnr];
          //we hope categories have only 1 parent
          if(new_parent //it could be that this is the highest cat, which's parent is not in cat_qindex
            && new_parent.subclass_of.value
            && tax_hashtable.cat_qindex[getQNR(new_parent.subclass_of.value)]){
              checkStateOfParents(new_parent.subclass_of.value);
          }
        });
      }
      checkStateOfParents(item.subclass_of.value);
      return;
    }
  }
  //if is a cat, add all TOIs
  if(tax_hashtable.cat_qindex[id]) {
    var array = getTOIsOfCat(id);
    array.forEach(function(toi) {
      addToFilter(toi);
    });
  }
}

function clickPlus(item) {
  addToFilter(item);
  trigger_Filter();
}
function clickMinus(item) {
  removeFromFilter(item);
  trigger_Filter();
}
function toggleFilterItem(item,e) {
  console.log(e);
  if(e.indeterminate === true) {
    console.log("indet");
    removeFromFilter(item);
  }
  else if(e.checked === false) { // changed state after click!
    console.log("was checked");
    removeFromFilter(item);
  }
  else if(e.checked) {
    console.log("was unchecked");
    addToFilter(item);
  }
  trigger_Filter();
}

function removeFromFilter(id) {
  if(id == "hint") {
    $("#activefilters ul .hint").remove();
    return;
  }

  if(tax_hashtable.toi_qindex[id]) { // is a toi
    $("#activefilters ul ."+id).remove();
    $("#map-menu li."+id+" form.expert_mode input").removeAttr("checked");
    current_filter_tois.deleteInArray(id);

    //for parent cats, set -/+ button color:
    var item = tax_hashtable.toi_qindex[id];

    //recursive!
    function checkStateOfParents(parents_string) {
      var parent_cats = parents_string.split(";");
      parent_cats.forEach(function (parent_cat) {
        var parent_qnr = getQNR(parent_cat);

        // //[+] has to be active, as we just removed an item...
        // $("#map-menu li."+parent_qnr+" > span.toggle > span.expert_mode .add").removeClass("inactive");

        //muss mindestens 'indefinite' sein

        //if none of the sub-items are in filter list, we can uncheck the box
        var siblings = getTOIsOfCat(parent_qnr);
        var tois_active = false;
        for(var i=0; i < siblings.length; i++) {
          if(current_filter_tois.indexOf(siblings[i]) > -1) {
            var tois_active = true;
            break;
          }
        }
        if(tois_active == false) {
          $("#map-menu li."+parent_qnr+" > span.toggle > form.expert_mode input")[0].checked = false;
          $("#map-menu li."+parent_qnr+" > span.toggle > form.expert_mode input")[0].indeterminate = false;
        }
        else // has to be at least "indeterminate", because we removed one and it cannot be fully checked
          $("#map-menu li."+parent_qnr+" > span.toggle > form.expert_mode input")[0].indeterminate = true;

        var new_parent = tax_hashtable.cat_qindex[parent_qnr];
        //we hope categories have only 1 parent
        if(new_parent //it could be that this is the highest cat, which's parent is not in cat_qindex
          && new_parent.subclass_of.value
          && tax_hashtable.cat_qindex[getQNR(new_parent.subclass_of.value)]){
            console.log("new parent: " + getQNR(new_parent.subclass_of.value) + "for " + id);
            checkStateOfParents(new_parent.subclass_of.value);
        }
      });
    }
    checkStateOfParents(item.subclass_of.value);
    return;
  }
  //if is a cat, remove all TOIs
  if(tax_hashtable.cat_qindex[id]) {
    var array = getTOIsOfCat(id);
    array.forEach(function(toi) {
      removeFromFilter(toi);
    });
  }
  if(id == "*") {
    $("#activefilters ul li").remove();
    $("#map-menu li form.expert_mode input").removeAttr("checked");
    current_filter_tois = [];
  }
}

/**
  * attributes:  ;-separated toi-attributes of POI
  * filter_UUID: Q-Nr of filter that should be matched against
  *
  * checks if any attribute in attributes (=TOI) is either the filter_UUID or the TOI is any subclass of the filter_UUID
  */
function filterMatches(attributes, filter_UUID) {
  if(!attributes) {
    console.log("error in filter, no attributes");
    return false;
  }
  if(!attributes.type_of_initiative) {
    console.log("error in filter, no type_of_initiative attribute");
    return false;
  }
  if(current_filter_tois.length == 0)
    return true;

  //console.log("filter called with filter: " + filter_UUID + " and toi: " + attributes.type_of_initiative);

  //attributes.type_of_initiative can be ;-separated...
  var toi_array = createToiArray(attributes.type_of_initiative);

  for(var i=0;i<toi_array.length;i++){
    var type_of_initiative_QNR = tax_hashtable.toistr_to_qnr[toi_array[i]];

    if(current_filter_tois.indexOf(type_of_initiative_QNR) > -1)
      return true;
  }

  return false;
}

var popup_image_width = "270px";
/*
 * checks if a image link points to a Mediawiki and if, returns link to thumbnail version of image
 */
function checkForMWimages(image_uri) {
  var retval = image_uri;
  if(image_uri.match(/\/wiki\/File:/)) { // guess it is any Mediawiki instance
    retval = image_uri.replace(/ /,"_")
      .replace(/\/File:/,'/Special:Redirect/file/')
      + "?width=" + popup_image_width;
  } else if (image_uri.match(/^File:/)) { // take File: for hosted at Wikimedia Commons
    retval = image_uri.replace(/ /,"_")
      .replace(/^File:/,'https://commons.wikimedia.org/wiki/Special:Redirect/file/')
      + "?width=" + popup_image_width;
  }

  return retval;
}
/*
 * returns the description text (attributes[description:*]) in the users lang or a fallback
 * description:$lang -> description:$fallbacks -> description -> description:$?
 */
function getDescriptionText(attributes) {
  var best_hit = attributes["description:" + current_lang];
  if(best_hit)
    return best_hit;

  for(var i=0; i < fallback_langs.length; i++) {
    var fallback_desc = attributes["description:" + fallback_langs[i]];
    if(fallback_desc)
      return fallback_desc;
  }

  var standard_descr = attributes["description"];
  if(standard_descr)
    return standard_descr;

  for (attr_key in attributes) {
    if(attr_key.match(/^description:/))
      return attributes[attr_key];
  }

  return "";
}

/* for nicer display of website links, shorten long uris */
function trimWebsiteUri(uri,maxlength) {
  var length = (maxlength) ? maxlength : 30;
  var retval = uri.replace(/^http[s]?:\/\//,"");

  if(retval.length < length)
    return retval
  else
    return retval.substr(0,length) + "...";
}

/* intended for mobile view */
function onMobile() {
  return (window.innerWidth <= 768);
}
function switchToMap() {
  $('#map-menu-container').hide();
  $('#map-template').show();
}
function switchToMenu() {
  $('#map-menu-container').show();
  $('#map-template').hide();
}

/*
 * translation stuff
 *
 * On load, everything is in English. When dictionaries are fetched, everything is translated into user's language.
 */

function getLangs () {
  var language = window.navigator.languages ? window.navigator.languages[0] : (window.navigator.language || window.navigator.userLanguage);

  if(typeof language === 'string')
      language = [ language ];

  // we need to have the following languages:
  // browserlang
  // a short one (de instead of de-AT) if not present
  // en as fallback if not present

  for(var i = 0; i < language.length; i++) {
      if(language[i].match(/-/)) {
          var short_lang = language[i].match(/^([a-zA-Z]*)-/)[1];
          if(language.indexOf(short_lang) == -1) {
              language.push(short_lang);
              continue;
          }
      }
  }

  if(language.indexOf("en") == -1)
      language.push("en");

  //console.log(language);
  return language;
}

var browser_languages = getLangs(),
    current_lang = browser_languages[0],
    fallback_langs = [];

var supported_languages = [],
    langnames = [],
    abbr_langnames = {},
    langnames_abbr = {};

function resetLang() {
  current_lang = "en";
  for(var i=0; i < browser_languages.length; i++) {
    var abbr = browser_languages[i];
    if(abbr_langnames[abbr]) {
      current_lang = abbr;
      break;
    }
  }
  switchToLang(current_lang);
}

function setFallbackLangs() {
  fallback_langs = [];
  if(current_lang != "en") {
    for(var i=0; i < browser_languages.length; i++) {
      var abbr = browser_languages[i];
      if(current_lang != abbr)
        fallback_langs.push(abbr);
    }
  }
  console.log("new fallback langs: " + fallback_langs.join(",") + ".");
}
setFallbackLangs();


/* get languages for UI from our Wikibase, and pick languages that are translated there */
$.getJSON("https://base.transformap.co/wiki/Special:EntityData/Q5.json", function (returned_data){
  for(lang in returned_data.entities.Q5.labels) { //Q5 is arbitrary. Choose one that gets translated for sure.
    supported_languages.push(lang);
  }
  var langstr = supported_languages.join("|");

  var langstr_query =
    'SELECT ?lang ?langLabel ?abbr ' +
    'WHERE' +
    '{' +
      '?lang wdt:P218 ?abbr;' +
      'FILTER regex (?abbr, "^('+langstr+')$").' +
      'SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }' +
    '}';

  langstr_query = 'https://query.wikidata.org/bigdata/namespace/wdq/sparql?query=' +encodeURIComponent(langstr_query) + "&format=json";
  $.getJSON(langstr_query, function (langstrings){

    langstrings.results.bindings.forEach(function (item) {
      abbr_langnames[item.abbr.value] = item.langLabel.value;
      langnames_abbr[item.langLabel.value] = item.abbr.value;
      langnames.push(item.langLabel.value);
    });
    langnames.sort();

    resetLang();
    setFallbackLangs();

    $("#map-menu-container .top").append(
        "<div id=languageSelector onClick=\"$('#languageSelector ul').toggleClass('open');\">" +
          "<span lang=en>Choose Language:</span>" +
          "<ul></ul>" +
        "</div>");

    langnames.forEach(function (item) {
      var langcode = langnames_abbr[item];
      var is_default = (langcode == current_lang) ? " class=default" : "";
      console.log("adding lang '" + langcode + "' (" + item + ")");
      $("#languageSelector ul").append("<li targetlang=" + langcode + is_default + " onClick='switchToLang(\""+langcode+"\");'>"+item+"</li>");
    });
  });
});

function switchToLang(lang) {
  $("#languageSelector li.default").removeClass("default");
  $("#languageSelector li[targetlang="+lang+"]").addClass("default");
  current_lang = lang;
  setFallbackLangs();

  updateTranslatedTexts();

  if(! dictionary[lang]) {
    var dict_uri = "https://raw.githubusercontent.com/TransforMap/transformap-viewer-translations/master/json/"+lang+".json";

    $.ajax({
      url: dict_uri,
      context: { lang: current_lang },
      success: function(returned_data) {
        var trans_jsonobj = JSON.parse(returned_data);

        if(! dictionary[this.lang])
          dictionary[this.lang] = {};
        for (item in trans_jsonobj) {
          var index = reverse_dic[item];
          dictionary[this.lang][index] = trans_jsonobj[item];
        }

        console.log("successfully fetched " + this.lang);
        updateTranslatedTexts();

      }
    });

  }
  setFilterLang(lang);

  console.log("new lang:" +lang);
}

function updateTranslatedTexts() {
  $("#map-menu-container [trn]").each(function(){
    var trans_id = $(this).attr("trn");
    $(this).text(T(trans_id));
  });
}

/*
 * The English translations are held here for ease of use and faster loading times
 * all other Translations are managed via Weblate in this repo:
 * https://github.com/TransforMap/transformap-viewer-translations
 */
var dictionary = {
  en: {
    "en_adv_filters" : "Enable Advanced Filter Mode",
    "dis_adv_filters" : "Disable Advanced Filter Mode",
    "address" : "Address",
    "contact" : "Contact",
    "opening_hours" : "Opening hours",
    "type_of_initiative" : "Type of Initiative",
    "reset_filters" : "Reset filters",
    "active_filters" : "Active Filters:",
    "show_map" : "Show map",
    "clickanyfilterhint" : "Click any [+] to add a filter",
    "imprint" : "Imprint",
    "susy_disclaimer" : "This website has been produced with the financial assistance of the European Union. The contents of this website are the sole responsibility of the SUSY initiative and can under no circumstances be regarded as reflecting the position of the European Union.",
    "" : "",
    "LAST:":""
  }
}

var reverse_dic = {}; //needed for faster lookups
for (i in dictionary.en)
  reverse_dic[dictionary.en[i]] = i;

/* returns the string according to id in the following preferred order:
 * 1. current_lang
 * 2-n fallback languages
 */
function T(id) {
  var native_dict = dictionary[current_lang];
  if(native_dict) {
    var retval = native_dict[id];
    if(retval)
      return retval;
  }
  for(var i=0; i < fallback_langs.length; i++) {
    var fb_dict = dictionary[fallback_langs[i]];
    if(fb_dict) {
      var retval = fb_dict[id];
      if(retval)
        return retval;
    }
  }
  return "Translation Missing for: '" + id + "'";
}

initMap();
