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

var map = L.map('map-tiles').setView ([51.1657, 10.4515], 5);
L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
  attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>',
}).addTo(map);
var pruneClusterLayer = new PruneClusterForLeaflet(60,20);
map.addLayer(pruneClusterLayer);

/* Creates map and popup template */
var MapView = Backbone.View.extend({
    el: '#map-template',
    templatePopUp: _.template($('#popUpTemplate').html()),
    initialize: function(){

        this.listenTo(this.collection, 'reset add change remove', this.renderItem);
        this.collection.fetch();
    },
    renderItem: function (model) {
        var feature = model.toJSON();

        var pdata = {
          icon:  new L.divIcon({className: 'my-div-icon',iconSize:30}),
          popup: this.templatePopUp(feature),
          tags: feature.properties
        }
        var pmarker = new PruneCluster.Marker(feature.geometry.coordinates[1], feature.geometry.coordinates[0], pdata);
        pruneClusterLayer.RegisterMarker(pmarker);
        pruneClusterLayer.ProcessView();
    },
});

/* Initialises map */
var mapData = new MapData();
var mapView = new MapView({ collection: mapData });


function convert_tax_to_tree(flatjson) {
  var treejson = {
    "xml:lang": "en",
    "elements": []
  };

  var flat_elements = flatjson.results.bindings;

  var flat_category_entries = []; //cats and subcats
  var flat_type_of_initiatives = [];

  var cats_that_hold_type_of_initiatives = [];

  var root_id = "";

  //sort entries into 2 arrays for faster search
  flat_elements.forEach(function(entry){
    if(entry["instance_of"]) {
      if (entry["instance_of"].value == "https://base.transformap.co/entity/Q6") {
        flat_type_of_initiatives.push(entry);
      } else if (entry["instance_of"].value == "https://base.transformap.co/entity/Q5") {
        flat_category_entries.push(entry);
      } else if(entry["instance_of"].value == "https://base.transformap.co/entity/Q3") {
        root_id = entry.item.value;
      }
    }
  });

  // get all 'childs' for this root (main categories)
  flat_category_entries.forEach(function(entry){
    if(entry["subclass_of"]) {
      if(entry["subclass_of"].value == root_id) {
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
  });

  // get all child categories for the main categories
  treejson.elements.forEach(function(category_item){ //iterate over categories

    var uuid_of_category = category_item.UUID;
    //console.log(uuid_of_category);

    flat_category_entries.forEach(function(entry){
      if(entry["subclass_of"]) {

        if(entry["subclass_of"].value == uuid_of_category) {
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
    });

    if(category_item.elements.length == 0) {
      cats_that_hold_type_of_initiatives.push(category_item);
    }
  });

  // get all type of initiatives and hang them to their parent category
  // remember: objects are called by reference, so this updates the whole treejson structure!
  flat_type_of_initiatives.forEach(function(flat_type_of_initiative) {
    var parent_uuid = flat_type_of_initiative.subclass_of.value;

    cats_that_hold_type_of_initiatives.forEach(function(cat){
      if(cat.UUID == parent_uuid) {
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
          appendCategory(entry, $('#' + cat_data.id + ' > ul.subcategories'));
        }
        if(entry.type == "type_of_initiative") {
          appendTypeOfInitiative(entry, $('#' + cat_data.id + ' > ul.type-of-initiative'));
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

  //close all other cats on the same level
  $("#" + id).parent("ul").children("li").children("ul").hide();
  $("ul.type-of-initiative").hide();

  //toggle "selected" on the current level
  $("#" + id).parent("ul").children("li").children("span").removeClass("selected");

  //remove all "selected" on all child levels
  $("#" + id + " .selected").removeClass("selected");

  //remove "selected" on the parent level
  $("#" + id).parent("ul").parent("li").children("span").removeClass("selected");

  $("#" + id + " > span").addClass("selected");

  $("#" + id + " > ul").show();
  trigger_Filter(id);
}


function clickOnInitiative(id) {
  console.log("clickOnInitiative: "+ id);
  $("#" + id).parent("ul").children("li").removeClass("selected");
  $("#" + id).addClass("selected");
  trigger_Filter(id);
}

var flat_taxonomy_array;

$.getJSON(taxonomy_url, function(returned_data){

  flat_taxonomy_array = returned_data.results.bindings;

  var tree_menu_json = convert_tax_to_tree(returned_data);

  fill_tax_hashtable();
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

}

function filterMatches(attributes,filter_UUID) {
  if(!attributes) {
    console.log("error in filter, no attributes");
    return false;
  }
  if(!attributes.type_of_initiative) {
    console.log("error in filter, no type_of_initiative attribute");
    return false;
  }

  //console.log("filter called with filter: " + filter_UUID + " and toi: " + attributes.type_of_initiative);


  //attributes.type_of_initiative can be ;-separated...
  var toi_array = attributes.type_of_initiative.split(';');
  for(var i=0;i<toi_array.length;i++){
    toi_array[i] = toi_array[i].trim();
  }
  //console.log(toi_array);

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
      parent_cat_qnr = getQNR(tax_hashtable.all_qindex[to_check_qnr].subclass_of.value);

      if(parent_cat_qnr == filter_UUID)
        return true;
      to_check_qnr = parent_cat_qnr;
    }

  }

  //return (Math.random() > 0.5);


  return false;
}

var tax_hashtable = {
  toistr_to_qnr: {},
  qnr_to_toistr: {},
  toi_qindex: {},
  cat_qindex: {},
  all_qindex: {},
  root_qnr: undefined
}

function fill_tax_hashtable() {
  flat_taxonomy_array.forEach(function(entry){

    var qnr = getQNR(entry.item.value);

    if (entry["instance_of"].value == "https://base.transformap.co/entity/Q6") {
      tax_hashtable.toistr_to_qnr[entry.type_of_initiative_tag.value] = qnr;
      tax_hashtable.qnr_to_toistr[qnr] = entry.type_of_initiative_tag.value;
      tax_hashtable.toi_qindex[qnr] = entry;
      tax_hashtable.all_qindex[qnr] = entry;

    } else if (entry["instance_of"].value == "https://base.transformap.co/entity/Q5") {
      tax_hashtable.all_qindex[qnr] = entry;
      tax_hashtable.cat_qindex[qnr] = entry;

    } else if(entry["instance_of"].value == "https://base.transformap.co/entity/Q3") {
      tax_hashtable.root_qnr = qnr;
    }
  })
}
