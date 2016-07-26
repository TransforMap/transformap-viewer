var map;
var theme_colors = ["#fcec74", "#f7df05", "#f2bd0b", "#fff030", "#95D5D2", "#1F3050"];

var MapModel = Backbone.Model.extend({});

var MapData = Backbone.Collection.extend({
    url:"http://transformap.co/json/sample-data.json",
    parse: function(response){
        return response.features;
    },
    toJSON : function() {
      return this.map(function(model){ return model.toJSON(); });
    }
 });

var map = L.map('map-tiles').setView ([51.1657, 10.4515], 6);
L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
  attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>',
}).addTo(map);

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

        var marker = L.circleMarker(new L.LatLng(feature.geometry.coordinates[1],feature.geometry.coordinates[0]), {
            color: theme_colors[(Math.floor(Math.random() * 6) + 1)],
            radius: 8,
            weight: 7,
            opacity: .5,
            fillOpacity: 1,
        });

        model.marker = marker;

        marker.bindPopup(this.templatePopUp(feature));

        map.addLayer(marker);
    },
});

/* Initialises map */
var mapData = new MapData();
var mapView = new MapView({ collection: mapData });
var baseTaxonomyUrl = 'https://base.transformap.co/entity/';

// Collects taxonomy data
var FilterData = Backbone.Collection.extend({
    url:"http://transformap.co/json/susy-taxonomy.json",
    parse: function(response){
        return response.results.bindings;
    },
    toJSON : function() {
      return this.map(function(model){ return model.toJSON(); });
    }
 });

var categories = [];
var subcategories = [];

var MenuView = Backbone.View.extend({
    el: '#map-menu',
    template: _.template($('#mapMenuTemplate').html()),
    initialize: function(){
        this.listenTo(this.collection,"add", this.renderItem);
        this.collection.fetch();
    },
    events: {
        "click .toggle": "clicked",
        "click .subcategory": "displayTypes"
    },
    clicked: function(e){
        // Shows subcategories
        e.preventDefault();
        $(e.currentTarget).parent().find('ul.subcategories').slideToggle(400);
    },
    displayTypes: function(e){
        // Hides previously open types of initiatives
        e.preventDefault();
        $( "ul.type-of-initiative" ).each(function() {
          $( this ).hide( );
        });
        $( ".subcategory" ).each(function() {
          $( this ).removeClass("active-filter");
        });
        // Shows type of intiatives below this subcategory
        $(e.currentTarget).addClass("active-filter");
        $(e.currentTarget).find('ul.type-of-initiative').slideToggle(400).addClass("active-filter");
    },
    renderItem: function(model) {
        var filter = model.toJSON();
        // Finds categories
        if(filter.subclass_of) {
            if(filter.subclass_of.value == 'https://base.transformap.co/entity/Q1234#SSEDAS_TAX_UUID') {
                var str = filter.item.value;
                var category = str.split('/');
                category = category[category.length - 1].split('#');
                categories.push(category[0]);
                filter.id = category[0];
                this.$el.append(this.template(filter));
            }
        }
        // Finds categories' subcategories
        for(i = 0; i < categories.length; i++) {
            if(filter.subclass_of.value == baseTaxonomyUrl + categories[i]) {
                var catId = '#' + categories[i];
                var str = filter.item.value;
                var subcategory = str.split('/');
                subcategory = subcategory[subcategory.length - 1];
                subcategories.push(subcategory);
                $(catId).append('<li class="subcategory list-group-item"><span class="toggle-subcategories">' + filter.itemLabel.value + '</span><ul id="' + subcategory + '" class="type-of-initiative"></ul></li>');
            }
        }
        // Finds subcategories' types of initiatives
        for(i = 0; i < subcategories.length; i++) {
            if(filter.subclass_of.value == baseTaxonomyUrl + subcategories[i]) {
                var catId = '#' + subcategories[i];
                var str = filter.item.value;
                var typeOfInitiative = str.split('/');
                typeOfInitiative = typeOfInitiative[typeOfInitiative.length - 1];
                $(catId).append('<li class="list-group-item">' + filter.itemLabel.value + '</li>');
            }
        }
    }
});

// Initializes templates and fetches data
//var filterData = new FilterData();
//var filterView = new MenuView({ collection: filterData });


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

  //console.log("flat_category_entries");
  //console.log(flat_category_entries);
  //console.log("flat_type_of_initiatives");
  //console.log(flat_type_of_initiatives);

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
  //console.log("main cats");
  //console.log(treejson.elements);

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
  //console.log("cats_that_hold_type_of_initiatives");
  //console.log(cats_that_hold_type_of_initiatives);

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

// fetch JSON

var taxonomy_url = "http://transformap.co/transformap-viewer/taxonomy.json"

function buildTreeMenu(tree_json) {
  // returns "Q12" of https://base.transformap.co/entity/Q12#taxonomy
  function getQNR(uri_string) {
    var slashsplit_array = uri_string.split('/');
    var after_last_slash = slashsplit_array[slashsplit_array.length -1];
    var before_hash = after_last_slash.split('#')[0];
    return before_hash;
  }

  function appendTypeOfInitiative(toi,parent_element) {
    var toi_data = 
        {
          id: getQNR(toi.UUID),
          itemLabel: toi.itemLabel
        }
    parent_element.append( toiTemplate( toi_data  ) );
  }

  function appendCategory(cat, parent_element) {
    //console.log(cat);
    //console.log(parent_element);

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
  //close all parent->li->ul's
  $("#" + id).parent().children().children("ul").hide();
  $("ul.type-of-initiative").hide();


  $("#" + id + " > ul").show();
}


function clickOnInitiative(id) {
  console.log("clickOnInitiative: "+ id);
}

$.getJSON(taxonomy_url, function(returned_data){

  var tree_menu_json = convert_tax_to_tree(returned_data);

  buildTreeMenu(tree_menu_json);

});

// create tree-tax
// walk the tree, create menue
