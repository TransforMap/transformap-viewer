var theme_colors = ["#fcec74", "#f7df05", "#f2bd0b", "#fff030", "#95D5D2", "#1F3050"];

var MapModel = Backbone.Model.extend({});

var MapData = Backbone.Collection.extend({
    url:"https://data.transformap.co/raw/5d6b9d3d32097fd6832200874402cfc3",
    parse: function(response){
        return response.features;
    },
    toJSON : function() {
      return this.map(function(model){ return model.toJSON(); });
    }
 });

var map = L.map('map-tiles',{ zoomControl: false }).setView ([51.1657, 10.4515], 5);
L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
  attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>',
}).addTo(map);
new L.Control.Zoom({ position: 'topright' }).addTo(map);
var pruneClusterLayer = new PruneClusterForLeaflet(60,20);
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
var hash = new L.Hash(map); // Leaflet persistent Url Hash function

/* Creates map and popup template */
var MapView = Backbone.View.extend({
    el: '#map-template',
    livePopup: function(data) { // gets popup content for a marker
      var templatePopUpFunction = _.template($('#popUpTemplate').html());
      return templatePopUpFunction(data);
    },
    initialize: function(){

        this.listenTo(this.collection, 'reset add change remove', this.renderItem);
        this.collection.fetch();
    },
    renderItem: function (model) {
        var feature = model.toJSON();

        var pdata = {
          icon:  new L.divIcon({
            className: 'my-div-icon',
            iconSize:30,
            html:"<div><div>" + feature.properties.name + "</div></div>"
          }),
          popup: this.livePopup,
          tags: feature.properties,
          properties: feature.properties // is used by _ template
        }
        var pmarker = new PruneCluster.Marker(feature.geometry.coordinates[1], feature.geometry.coordinates[0], pdata);
        pruneClusterLayer.RegisterMarker(pmarker);
        pruneClusterLayer.ProcessView();
    },
});

/* Initialises map */
var mapData = new MapData();
var mapView = new MapView({ collection: mapData });

// note: can only handle 3 tiers (cats, subcats, toi) at the moment.
function convert_tax_to_tree() {
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


var taxonomy_url = "http://transformap.co/transformap-viewer/taxonomy.json"

// returns "Q12" of https://base.transformap.co/entity/Q12#taxonomy
function getQNR(uri_string) {
  if(typeof(uri_string) !== 'string')
    return false;
  var slashsplit_array = uri_string.split('/');
  var after_last_slash = slashsplit_array[slashsplit_array.length -1];
  var before_hash = after_last_slash.split('#')[0];
  return before_hash;
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
  var catTemplate = _.template($('#menuCategoryTemplate').html());
  var toiTemplate = _.template($('#menuTypeOfInitiativeTemplate').html());

  tree_json.elements.forEach(function(cat){
    appendCategory(cat,menu_root);

  });

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
  trigger_Filter(id);

  updateToiEmptyStatusInFilterMenu();
}

function resetFilter() {
  $("#map-menu li").removeClass("selected");
  $("#map-menu li > span").removeClass("selected");
  $("ul.type-of-initiative").hide();
  $("ul.subcategories").hide();
  trigger_Filter("*");
  $('#resetfilters').hide();
}

function clickOnInitiative(id) {
  console.log("clickOnInitiative: "+ id);
  if($("#map-menu ." + id).hasClass("selected")) {
    if(onMobile())
      switchToMap()
    return;
  }

  $("#map-menu ul.type-of-initiative li.selected").removeClass("selected");
  $("#map-menu ." + id).addClass("selected");
  trigger_Filter(id);
}


/* get taxonomy stuff */
var flat_taxonomy_array,
    tree_menu_json;
$.getJSON(taxonomy_url, function(returned_data){

  flat_taxonomy_array = returned_data.results.bindings;

  fill_tax_hashtable();
  tree_menu_json = convert_tax_to_tree();

  buildTreeMenu(tree_menu_json);

});

/*
 * filters
 *
 * user clicks on a cat/subcat/toi - all others not matching should be hidden.
 * @param filter_UUID  string  "Q-Nr" of filter object, e.g. a cat or type of initative.
 */

function trigger_Filter(filter_UUID) {

  var marker_array = pruneClusterLayer.GetMarkers();
  for(var i = 0; i < marker_array.length; i++) {
    var marker = marker_array[i];
    var attributes = marker.data.tags;
    marker.filtered = ! filterMatches(attributes,filter_UUID);
  }
  pruneClusterLayer.ProcessView();
  $('#resetfilters').show();
}

function toggleAdvancedFilterMode() {
  var current_mode = $("#toggleAdvancedFilters").attr('mode');
  if(current_mode == "off") {
    $("#toggleAdvancedFilters").attr('mode',"on");
    $('.expert_mode').removeClass('off')
      .addClass('on');
  } else {
    $("#toggleAdvancedFilters").attr('mode',"off");
    $('.expert_mode').removeClass('on')
      .addClass('off');
  }
}

function addToAdvFilter(id) {
  if(tax_hashtable.toi_qindex[id]) { // is a toi
    if($("#activefilters ul ."+id).length == 0) { // not already there
      var name = tax_hashtable.toi_qindex[id].itemLabel.value;
      $("#activefilters ul").append("<li class="+id+" >"+name+"<div class=close onClick=\"removeFromAdvFilter('"+id+"')\">×</div></li>");
      $("#map-menu li."+id+" span.expert_mode .add").addClass("inactive");
      $("#map-menu li."+id+" span.expert_mode .remove").removeClass("inactive");
    }
    return;
  }
  //if is a cat, add all TOIs
  if(tax_hashtable.cat_qindex[id]) {
    var array = getTOIsOfCat(id);
    array.forEach(function(toi) {
      addToAdvFilter(toi);
    });
  }
}

function removeFromAdvFilter(id) {
  if(tax_hashtable.toi_qindex[id]) { // is a toi
    $("#activefilters ul ."+id).remove();
    $("#map-menu li."+id+" span.expert_mode .add").removeClass("inactive");
    $("#map-menu li."+id+" span.expert_mode .remove").addClass("inactive");
    return;
  }
  //if is a cat, remove all TOIs
  if(tax_hashtable.cat_qindex[id]) {
    var array = getTOIsOfCat(id);
    array.forEach(function(toi) {
      removeFromAdvFilter(toi);
    });
  }
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
  if(filter_UUID == "*")
    return true;

  //console.log("filter called with filter: " + filter_UUID + " and toi: " + attributes.type_of_initiative);

  //attributes.type_of_initiative can be ;-separated...
  var toi_array = createToiArray(attributes.type_of_initiative);

  for(var i=0;i<toi_array.length;i++){
    var type_of_initiative_QNR = tax_hashtable.toistr_to_qnr[toi_array[i]];

    if(type_of_initiative_QNR == filter_UUID)
      return true;

    //if attribute == subclass of (and subclass of...) true
    //get next higher element

    //recursive!!
    var parent_cat_qnr = false;
    var to_check_qnr = type_of_initiative_QNR;
    while(tax_hashtable.all_qindex[to_check_qnr] && tax_hashtable.all_qindex[to_check_qnr].subclass_of) {
      var parent_cat_qnrs = tax_hashtable.all_qindex[to_check_qnr].subclass_of.value.split(";");

      for(var j=0; j < parent_cat_qnrs.length; j++) {
        parent_cat_qnr = getQNR(parent_cat_qnrs[j]);
        if(parent_cat_qnr == filter_UUID)
          return true;
        to_check_qnr = parent_cat_qnr;
      }
    }

  }

  return false;
}

var tax_hashtable = {
  toistr_to_qnr: {},
  qnr_to_toistr: {},
  toi_qindex: {},
  cat_qindex: {},
  all_qindex: {},
  toi_count: {},
  root_qnr: undefined
}

var tax_elements = {
  type_of_initiative: "https://base.transformap.co/entity/Q6",
  category: "https://base.transformap.co/entity/Q5",
  taxonomy: "https://base.transformap.co/entity/Q3"
}

function fill_tax_hashtable() {
  flat_taxonomy_array.forEach(function(entry){

    var qnr = getQNR(entry.item.value);

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
    }
  })
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

/* translation stuff */

function getLangs () {
  var language = window.navigator.languages ? window.navigator.languages[0] : (window.navigator.language || window.navigator.userLanguage);

  if(typeof language === 'string')
      language = [ language ];

  // we need to have the following languages:
  // browserlang
  // a short one (de instead of de-AT) if not present
  // en as fallback if not present

  if(language.indexOf("en") == -1)
      language.push("en");

  for(var i = 0; i < language.length; i++) {
      if(language[i].match(/-/)) {
          var short_lang = language[i].match(/^([a-zA-Z]*)-/)[1];
          if(language.indexOf(short_lang) == -1) {
              language.push(short_lang);
              continue;
          }
      }
  }
  //console.log(language);
  return language;
}

var languages = getLangs();


