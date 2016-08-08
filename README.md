# transformap-viewer

This is a Web-Map plugin that aims at displaying data from the [TransforMap API](https://github.com/TransforMap/data.transformap.co). It offers dynamic filters, which are built from a Wikibase graph hosted on [base.transformap.co](https://base.transformap.co).

## Features

* Displays geoJSON Points
* Clustering via [PruneCluster](https://github.com/SINTEF-9012/PruneCluster)
* Popup with image display, special support for Mediawiki storage
* Filtering system, builds filter menu out of RDF graph provided by Wikibase


## CSS

Is created via [less](http://lesscss.org/).

Do not edit the CSS file in styles/css/style.css, edit styles/less/style.less and compile to css.

Install node *less* compiler to convert the stylesheet to less css:

* Debian: `aptitude install node-less`

Compile it via :

    lessc -x styles/less/style.less styles/css/style.css

## Dependencies

Install *bower* from npm:

    [sudo] npm install -g bower

Debian: install npm:

    [sudo] aptitude install npm nodejs-legacy

Fetch external dependencies:

    bower install

## Deployment

The site http://viewer.transformap.co/ is actually hosted at github.io. Just push the branch gh-pages to update the site.

Notes: for libraries used with bower, add a static copy of the files to the gh-pages branch to its location in bower_components/ (and add an exception to the .gitignore-file).

## Style guide

We use spaces (2) instead of tabs, please also use this convention.
