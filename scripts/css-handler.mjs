// @see https://playcanvas.com/project/354600/overview/htmlcss--live-updates

import * as pc from 'playcanvas';

// this script can reference html asset as an attribute
// and will live update dom and reattach events to it on html changes
// so that launcher don't need to be refreshed during development
var CssHandler = pc.createScript('cssHandler');

CssHandler.attributes.add('css', { type: 'asset', assetType:'css', title: 'CSS Asset' });

CssHandler.prototype.initialize = function () {
    // create STYLE element
    this.element = document.createElement('style');

    // append to head
    document.head.appendChild(this.element);

    // asset
    this.asset = null;
    this.assetId = 0;
};


CssHandler.prototype.attachAsset = function(assetId, fn) {
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
};


CssHandler.prototype.template = function(asset, css) {
    // unsubscribe from old asset load event if required
    if (this.asset && this.asset !== asset)
        this.asset.off('load', this.asset._onLoad);

    // remember current asset
    this.asset = asset;

    // template element
    // you can use templating languages with renderers here
    // such as hogan, mustache, handlebars or any other
    this.element.innerHTML = css || '';
};


CssHandler.prototype.update = function (dt) {
    // check for swapped asset
    // if so, then start asset loading and templating
    if (this.css !== null && this.assetId !== this.css.id)
        this.attachAsset(this.css.id, this.template);
};

export { CssHandler };