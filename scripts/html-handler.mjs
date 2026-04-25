// @see https://playcanvas.com/project/354600/overview/htmlcss--live-updates

import * as pc from 'playcanvas';

// this script can reference html asset as an attribute
// and will live update dom and reattach events to it on html changes
// so that launcher don't need to be refreshed during development
var HtmlHandler = pc.createScript('htmlHandler');

HtmlHandler.attributes.add('html', { type: 'asset', assetType:'html', title: 'HTML Asset' });

HtmlHandler.prototype.initialize = function() {
    console.log('initialize');

    // create DIV element
    this.element = document.createElement('div');
    this.element.classList.add('container');

    // append to body
    // can be appended somewhere else
    // it is recommended to have some container element
    // to prevent iOS problems of overfloating elements off the screen
    document.body.appendChild(this.element);

    // asset
    this.asset = null;
    this.assetId = 0;

    this.counter = 0;
};


HtmlHandler.prototype.attachAsset = function(assetId, fn) {
    // remember current assetId
    this.assetId = assetId;

    // might be no asset provided
    if (! this.assetId)
        return fn.call(this);

    // get asset from registry
    var asset = this.app.assets.get(this.assetId);

    // store callback of an asset load event
    var self = this;
    asset._onLoad = function(asset) {
        fn.call(self, asset, asset.resource);
    };

    // subscribe to changes on resource
    asset.on('load', asset._onLoad);
    // callback
    fn.call(this, asset, asset.resource);
    // load asset if not loaded
    this.app.assets.load(asset);

    console.log('attachAsset', assetId);
};


HtmlHandler.prototype.template = function(asset, html) {
    // unsubscribe from old asset load event if required
    if (this.asset && this.asset !== asset)
        this.asset.off('load', this.asset._onLoad);

    // remember current asset
    this.asset = asset;

    // template element
    // you can use templating languages with renderers here
    // such as hogan, mustache, handlebars or any other
    this.element.innerHTML = html || '';

    // bind some events to dom of an element
    // it has to be done on each retemplate
    if (html)
        this.bindEvents();
};


HtmlHandler.prototype.bindEvents = function() {
    var self = this;
    // example
    //
    // get button element by class
    var button = this.element.querySelector('.button');
    var counter = this.element.querySelector('.counter');
    // if found
    if (button) {
        // add event listener on `click`
        button.addEventListener('click', function() {
            ++self.counter;
            if (counter)
                counter.textContent = self.counter;
            
            console.log('button clicked');

            // try to find object and change its material diffuse color
            // just for fun purposes
            var obj = pc.app.root.findByName('box');
            if (obj && obj.render) {
                var material = obj.render.meshInstances[0].material;
                if (material) {
                    material.diffuse.set(Math.random(), Math.random(), Math.random());
                    material.update();
                }
            }
        }, false);
    }

    if (counter)
        counter.textContent = self.counter;
};

HtmlHandler.prototype.update = function (dt) {
    console.log('update', dt);
    console.log('this.html', this.html);
    // check for swapped asset
    // if so, then start asset loading and templating
    if (this.html !== null && this.assetId !== this.html.id)
        this.attachAsset(this.html.id, this.template);
};

export { HtmlHandler };