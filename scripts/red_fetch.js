/*
 * This library provides a 'fetch', where you can use fallback URIs, to build on redundant servers.
 *
 * Mon  3 Oct 15:07:12 CEST 2016
 * Michael Maier (species@github), WTFPL
 *
 * Give it an array of resources, that can be fetched from different urls.
 * Will try to fetch them in the provided order.
 * Execute successFunction on the first successful fetch, and errorFunction only if all resources fail to fetch.
 */

/* This program is free software. It comes without any warranty, to
     * the extent permitted by applicable law. You can redistribute it
     * and/or modify it under the terms of the Do What The Fuck You Want
     * To Public License, Version 2, as published by Sam Hocevar. See
     * http://www.wtfpl.net/ for more details. */

/* new version of getting map data with promises

  taken from https://blog.hospodarets.com/fetch_in_action
*/

var processStatus = function (response) {
  // status '0' to handle local files fetching (e.g. Cordova/Phonegap etc.)
  if (response.status === 200 || response.status === 0) {
    return Promise.resolve(response)
  } else {
    return Promise.reject(new Error(response.statusText))
  }
};

var parseJson = function (response) {
  return response.json();
}

/* @returns {wrapped Promise} with .resolve/.reject/.catch methods */
// It goes against Promise concept to not have external access to .resolve/.reject methods, but provides more flexibility
var getWrappedPromise = function () {
  var wrappedPromise = {}
  var promise = new Promise(function (resolve, reject) {
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
*/var MAX_WAITING_TIME = 5000;// in ms

var getJSON = function (params) {
  var wrappedFetch = getWrappedFetch(
    params.cacheBusting ? params.url + '?' + new Date().getTime() : params.url,
    {
      method: 'get', // optional, 'GET' is default value
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

function myGetJSON(url, successFunction, errorFunction) {
  var getJSONparams = { url: url, cacheBusting: true };

  getJSON(getJSONparams).then(
    function (data) { successFunction(data) },
    function (error) { errorFunction(error) }
  );
}

function redundantFetch (data_url_array, successFunction, errorFunction, params) {
  if( ! (!!data_url_array && Array === data_url_array.constructor ) ) {
    console.error('redundantFetch: argument is no array');
    console.error(data_url_array);
    return false;
  }
  var current_url = data_url_array[0];
  if(typeof(current_url) !== 'string') {
    console.error('redundantFetch: url is no string');
    return false;
  }

  console.log('redundantFetch called, urls:');
  console.log(data_url_array);

  data_url_array.shift();

  var localErrorFunction;
  var localSuccessFunction;
  if(data_url_array.length == 0) { //last iteration
    localSuccessFunction = successFunction;
    localErrorFunction = errorFunction;
  } else {
    localSuccessFunction = successFunction;
    localErrorFunction = function (error) {
      redundantFetch(data_url_array, successFunction, errorFunction, params);
    }
  }
  
  var getJSONparams = { url: current_url, cacheBusting: ((params && params.cacheBusting === false) ? false : true) };
  getJSON(getJSONparams).then( 
    function (data) { localSuccessFunction(data); console.log('rfetch: success on '); console.log(data) },
    function (error) { localErrorFunction(error); console.log('rfetch: fail on '); console.log(error) }
  )
}
