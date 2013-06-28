/*! Backbone.Rpc - v0.1.2b
------------------------------
Build @ 2013-05-24
Documentation and Full License Available at:
http://asciidisco.github.com/Backbone.Rpc/index.html
git://github.com/asciidisco/Backbone.Rpc.git
Copyright (c) 2013 Kal Sze <swordangel@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a
copy of this software and associated documentation files (the "Software"),
to deal in the Software without restriction, including without limitation
the rights to use, copy, modify, merge, publish, distribute, sublicense,
and/or sell copies of the Software, and to permit persons to whom the

Software is furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
IN THE SOFTWARE.*/

// Backbone.Rpc
// Plugin for using the backbone js library with a remote json-rpc handler
// instead of the default REST one
(function (root, define, require, exports, module, factory, undef) {
    'use strict';
    if (typeof exports === 'object') {
        // Node. Does not work with strict CommonJS, but
        // only CommonJS-like enviroments that support module.exports,
        // like Node.
        module.exports = factory(require('underscore'), require('backbone'), require('jquery'));
    } else if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['underscore', 'backbone', 'jquery'], function (_, Backbone, $) {
            // Check if
            _ = _ === undef ? root._ : _;
            Backbone = Backbone === undef ? root.Backbone : Backbone;
            $ = $ === undef ? root.$ : $;
            return (root.Backbone = factory(_, Backbone, $));
        });
    } else {
        // Browser globals
        root.returnExportsGlobal = factory(root._, root.Backbone, root.$);
    }
}(this, this.define, this.require, this.exports, this.module, function (_, Backbone, $, undef) {
    'use strict';
    var Rpc = function (options) {
            // merge the users options
            this.options = options !== undef ? options : {};
            // check if we have a non std. namespace delimter
            this.namespaceDelimiter = options !== undef && options.namespaceDelimiter !== undef ? options.namespaceDelimiter : this.namespaceDelimiter;
            // check if we have a non std. content-type
            this.contentType = options !== undef && options.contentType !== undef ? options.contentType : this.contentType;
            // fix issue with the loss of this
            _.bindAll(this);
        },
        // store the old Backbone.Model constructor for later use
        oldConst = Backbone.Model.prototype.constructor,
        // store the old Backbone.sync method for later use
        oldSync = Backbone.sync,
        // storage object to keep track of changes from the loaded objects
        storage = {};

    // TODO: Document
    Rpc.prototype = {
        // User defined options placeholder
        options: {},

        // Default charset
        charset: 'iso-8859-1',

        // Default namespace
        namespace: '',

        // Default namespace delimiter
        namespaceDelimiter: '/',

        // Default content type
        contentType: 'application/json',

        // User set url placeholder
        url: null,

        // Server response id
        responseID: null,

        // TODO: Document
        exceptions: {
            typeMissmatch: {code: -3, message: 'Type missmatch'},
            badResponseId: {code: -4, message: 'Bad response ID'},
            noResponse: {code: -5, message: 'No response'},
            noDefError: {code: -6, message: 'No error defined'},
            renderError: function (message, code) {
                return {code: (code !== undef ? -7 : code), message: (message ? 'No error defined' : message)};
            }
        },

        // TODO: Document
        onSuccess: function (success_callback, id, data, textStatus, jqXHR) {
            // check if callback variable is a function
            if (_.isFunction(success_callback) === true) {
                // check if we have valid response data
                if (data === undef || data === null || data.result === undef || data.result === null) {
                    this.handleExceptions(this.exceptions.noResponse);
                    return this;
                }

                if (id !== String(data.id)) {
                    this.handleExceptions(this.exceptions.badResponseId);
                }

                // call the callback function with the result data
                success_callback.apply(this, [data.result, data.error]);
            }
        },

        // TODO: Document
        // 'data' could be the response object or a jqXHR object
        onError: function (callback, error, textStatus, errorThrown) {
            if (!_.isFunction(callback)) {
                // check if we have valid response data
                if (error === null || error === undef) {
                    this.handleExceptions(this.exceptions.noResponse);
                    return this;
                }

                // check if we have an error object
                if (null !== error && undef !== error) {
                    this.handleExceptions(error);
                } else {
                    this.handleExceptions(this.exceptions.noDefError);
                }
            } else {
                // Check if `error` is a jqXHR object
                if (typeof error.readyState !== 'undefined' && _.isFunction(error.promise)) {
                    // Parse the responseText from the jqXHR object first; hopefully it's a JSON-RPC error response
                    if (_.isString(error.responseText)) {
                        try {
                            error = JSON.parse(error.responseText);
                        } catch (e) {
                            this.handleExceptions(this.exceptions.renderError('Invalid response'));
                            return this;
                        }
                    }
                }
                callback.call(this, error);
            }
        },

        // TODO: Document
        query: function (fn, params, success_callback, error_callback) {
            var id = String((new Date()).getTime()),
                ret = null;
            this.responseID = id;
            // generate unique request id (timestamp)
            // check if params and the function name are ok, then...
            if (_.isArray(params) && _.isString(fn)) {
                // send query
                ret = $.ajax({
                    contentType : this.contentType + '; charset=' + this.charset,
                    type        : 'POST',
                    dataType    : 'json',
                    url         : this.url,
                    data        : JSON.stringify({
                        jsonrpc : '2.0',
                        method  : this.namespace + this.namespaceDelimiter + fn,
                        id      : id,
                        params  : params
                    }),
                    statusCode  : {
                    },
                    success: _.bind(function (data, textStatus, jqXHR) {
                        if (data !== null && data.error !== undef) {
                            this.onError(error_callback, data.error, textStatus);
                        } else {
                            this.onSuccess(success_callback, id, data, textStatus, jqXHR);
                        }
                    }, this),
                    error: _.bind(function (jqXHR, textStatus, errorThrown) {
                        this.onError(error_callback, jqXHR, textStatus, errorThrown);
                    }, this)
                });
            } else {
                ret = this.handleExceptions(this.exceptions.typeMissmatch);
            }

            return ret;
        },

        // TODO: Document
        checkMethods: function (cb, params, model, method, options, scb, ecb) {
            var definition          = null,
                deeperNested        = false,
                exec                = null,
                valuableDefinition  = [],
                changedAttributes   = {},
                def                 = null;

            // rewrite method if name is delete
            method = method === 'delete' ? 'remove' : method;

            // check if we have a proper method for the model
            if (!_.isArray(model.methods[method]) && !_.isFunction(model.methods[method])) {
                return this.handleExceptions(this.exceptions.typeMissmatch);
            }

            // execute function if it´s one, else, assign array
            if (_.isFunction(model.methods[method])) {
                if (!_.isString(storage[model.get('_rpcId')])) {
                    _.each(storage[model.get('_rpcId')], function (value, key) {
                        if (model.get(key) !== value) {
                            changedAttributes[key] = true;
                        }
                    });
                }
                storage[model.get('_rpcId')] = model.toJSON();
                definition = _.bind(model.methods[method], model)(changedAttributes, options);
            } else {
                definition = model.methods[method];
            }

            // check if array is deeper nested
            if (_.isArray(definition[0])) {
                deeperNested = true;
            }

            // execute a single call
            if (deeperNested !== true) {
                def = _.clone(definition);
                exec = def.shift();
                if (def.length > 0) {
                    _.each(def, function (param) {
                        if (param === '') {
                            valuableDefinition.push('');
                        } else {
                            if (model instanceof Backbone.Collection) {
                                if (model[param] !== undef) {
                                    if (_.isFunction(model[param])) {
                                        valuableDefinition.push(model[param]());
                                    } else {
                                        valuableDefinition.push(model[param]);
                                    }
                                } else {
                                    if (options[param] !== undef) {
                                        valuableDefinition.push(options[param]);
                                    }
                                }
                            } else {
                                if (model.get(param) !== undef) {
                                    valuableDefinition.push(model.get(param));
                                } else {
                                    if (options[param] !== undef) {
                                        valuableDefinition.push(options[param]);
                                    }
                                }
                            }
                        }
                    });
                } else {
                    valuableDefinition = [];
                }

                return cb(exec, valuableDefinition, scb, ecb);
            }

            // execute nested calls
            _.each(definition, function (localdef) {
                var def = _.clone(localdef);
                exec = null;
                valuableDefinition = [];
                exec = def.shift();
                _.each(def, function (param) {
                    valuableDefinition.push(model.get(param));
                });
                return cb(exec, valuableDefinition, scb, ecb);
            });

            return null;
        },

        // TODO: Document
        invoke: function (method, model, options) {
            var defOpts = {
                success: function (result) {
                    model.trigger('called:' + method, model, result);
                    // check for a manually success callback
                    if (options !== undef && _.isFunction(options.success)) {
                        options.success(model, result);
                    }
                },
                error: function (model, jsonError) {
                    model.trigger('error', model, jsonError);
                    model.trigger('error:' + method, model, jsonError);
                    // check for a manually success callback
                    if (options !== undef && _.isFunction(options.error)) {
                        options.error(model, jsonError);
                    }
                }
            };

            // sync the model
            return Backbone.sync(method, model, defOpts);
            //return this;
        },

        // Default exception handler
        defaultExceptionHandler: function (exception) {
            throw 'Error code: ' + exception.code + ' - message: ' + exception.message;
        },

        // Exception handler
        handleExceptions: function (exception) {
            var exceptionHandler = _.isFunction(this.options.exceptionHandler) ? this.options.exceptionHandler : this.defaultExceptionHandler;
            exceptionHandler.call(this, exception);
            return this;
        }
    };

    // assign rpc to backbone itself
    Backbone.Rpc = Rpc;

    // overwrite backbones model constructor
    Backbone.Model = Backbone.Model.extend({
        // TODO: Document
        constructor: function (model) {
            // check if the model has the rpc property and methods defined
            if (this.rpc !== undef && _.isFunction(this.rpc.invoke) === true && this.methods !== undef) {
                // walk through the methods
                _.each(this.methods, _.bind(function (method, signature) {
                    // check if we have a 'non standard' signature
                    if ({'read': 1, 'create': 1, 'remove': 1, 'update': 1}[signature] !== 1) {
                        // generate the method for the signature
                        this[signature] = _.bind(function (options) {
                            // invoke the dynamicly created method
                            return this.rpc.invoke(signature, this, options);
                            //return this;
                        }, this);
                    }
                }, this));
            }

            // call the original constructor
            oldConst.apply(this, arguments);
        }
    });

    // overwrite backbones sync
    Backbone.sync = (function (Rpc) {
        // Generate a new Sync Method for JSON RPC Queuing
        var rpc = null,
            sync = function (method, model, options) {
                // Default success model callback
                var successCb = function (result, error) {
                    // check if we have an error object
                    if (error !== null && error !== undef) {
                        options.error(model, error);
                        return this;
                    }

                    // check if the rpc is used in a Backbone.Collection instance
                    if (model instanceof Backbone.Collection) {
                        // check if we have valid response result
                        if (result !== undef && result !== null) {
                            // clone the result and tag it to track changes
                            if (typeof result[0] === 'object') {
                                _.each(result, function (item, key) {
                                    item._rpcId = _.uniqueId('rpc_');
                                    result[key] = item;
                                    storage[item._rpcId] = item;
                                });
                            } else {
                                _.each(result, function (item, key) {
                                    storage[key] = item;
                                });
                            }
                        }
                    }

                    // clone and tag the result to track changes if we have a Backbone.Model instance
                    if (model instanceof Backbone.Model && result !== undef && result !== null) {
                        result._rpcId = _.uniqueId('rpc_');
                        storage[result._rpcId] = result;
                    }

                    // change result attr to be an empty array, if it´s null or undefined
                    if (result === undef || result === null) {
                        result = [];
                    }

                    // invoke special return callback parser if defined
                    if (model.parsers !== undef && model.parsers[method] !== undef && _.isFunction(model.parsers[method])) {
                        model.parsers[method].apply(model, [result]);
                    }

                    // fire the 'real' backbone success callback
                    options.success(result);
                };

                // define a local error callback that will hand over the data to the backbone error handler
                var errorCb = function (error) {
                    options.error(model, error);
                };

                // check if we have a correct (e.g. Backbone.Rpc) model instance
                if (model.rpc instanceof Rpc) {
                    // assign the models JsonRpc instance locally
                    rpc = model.rpc;

                    // First, set the api url
                    rpc.url = _.isFunction(model.url) ? model.url() : model.url;

                    // Second, set the namespace
                    if (_.isString(model.namespace) === true) {
                        rpc.namespace = model.namespace;
                    }

                    // Third, check the remote method parameter
                    if (model.methods === undef) {
                        throw 'Backbone.Rpc Error: No Method(s) given!';
                    } else {
                        // If we have a proper method
                        // assign the given paramters (if exist)
                        // else an empty object
                        if (typeof model.params !== 'object') {
                            model.params = {};
                        }
                    }

                    // go on and check the rpc methods
                    return rpc.checkMethods(rpc.query, model.params, model, method, options, successCb, errorCb);
                } else {
                    return sync.previous.apply(model, arguments);
                }

                return null;
            };

         // Expose the previous Backbone.sync as Backbone.sync.previous in case
         // the caller wishes to switch provider
        sync.previous = oldSync;

        return sync;
    }(Rpc));

    return Backbone;
}));
