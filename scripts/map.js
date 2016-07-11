var map;
var theme_colors = ["#fcec74", "#f7df05", "#f2bd0b", "#fff030", "#95D5D2", "#1F3050"];

var MapModel = Backbone.Model.extend({});

var MapData = Backbone.Collection.extend({
    url:"http://transformap.co/json/sample-data.json", // //data.transformap.co/raw/5d6b9d3d32097fd68322008744001eec",
    parse: function(response){
        return response.features;
    },
    toJSON : function() {
      return this.map(function(model){ return model.toJSON(); });
    }
 });

var MapView = Backbone.View.extend({
    el: '#map-template',
    template: _.template($('#mapTemplate').html()),
    templatePopUp: _.template($('#popUpTemplate').html()),
    initialize: function(){
        this.$el.html(this.template());
        this.listenTo(this.collection, 'reset add change remove', this.render);
        this.collection.fetch();
    },
    render: function () {
        map = L.map(this.$('#map-tiles')[0], { scrollWheelZoom: false }).setView ([51.1657, 10.4515], 6);
        L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
          attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>',
        }).addTo(map);

        this.collection.each(function(model){
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
        }, this); 
        
        return this;
    },
});

var mapData = new MapData();
var mapView = new MapView({ collection: mapData });
var baseTaxonomyUrl = 'https://base.transformap.co/entity/';

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

var FilterView = Backbone.View.extend({
    el: '#map-filters',
    template: _.template($('#mapFiltersTemplate').html()),
    initialize: function(){
        this.listenTo(this.collection,"add", this.renderItem);
        this.collection.fetch();   
    },
    render: function () {
        this.collection.each(function(model){
            var filter = model.toJSON();
            if(filter.subclass_of.value == 'https://base.transformap.co/entity/Q1234#SSEDAS_TAX_UUID') {
                this.$el.append(this.template(filter));
            }
        }, this);        
        return this;
    },
    events: {
        "click .category": "clicked",
        "click .subcategory": "clickedLevel"
    },
    clicked: function(e){
        e.preventDefault();
        $(e.currentTarget).find('ul.subcategories').show(400);
    },
    clickedLevel: function(e){
        e.preventDefault();
        $(e.currentTarget).find('ul.type-of-initiative').slideToggle(400);
    },
    renderItem: function(model) {
        var filter = model.toJSON();
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
        for(i = 0; i < categories.length; i++) {
            if(filter.subclass_of.value == baseTaxonomyUrl + categories[i]) {
                var catId = '#' + categories[i];
                var str = filter.item.value;
                var subcategory = str.split('/');
                subcategory = subcategory[subcategory.length - 1];
                subcategories.push(subcategory);
                $(catId).append('<li class="subcategory list-group-item">' + filter.itemLabel.value + '<ul id="' + subcategory + '" class="type-of-initiative"></ul></li>');
            }
        }
        for(i = 0; i < subcategories.length; i++) {
            if(filter.subclass_of.value == baseTaxonomyUrl + subcategories[i]) {
                var catId = '#' + subcategories[i];
                var str = filter.item.value;
                var typeOfInitiative = str.split('/');
                typeOfInitiative = typeOfInitiative[typeOfInitiative.length - 1];
                subcategories.push(typeOfInitiative);
                $(catId).append('<li>' + filter.itemLabel.value + '</li>');
            }
        }
    }
});

var filterData = new FilterData();
var filterView = new FilterView({ collection: filterData });
filterView.render();