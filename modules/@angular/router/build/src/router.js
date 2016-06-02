"use strict";
var core_1 = require('@angular/core');
var router_outlet_map_1 = require('./router_outlet_map');
var recognize_1 = require('./recognize');
var tree_1 = require('./utils/tree');
var url_tree_1 = require('./url_tree');
var shared_1 = require('./shared');
var router_state_1 = require('./router_state');
var create_url_tree_1 = require('./create_url_tree');
var collection_1 = require('./utils/collection');
require('rxjs/add/operator/map');
require('rxjs/add/operator/mergeMap');
require('rxjs/add/operator/toPromise');
var fromPromise_1 = require('rxjs/observable/fromPromise');
var forkJoin_1 = require('rxjs/observable/forkJoin');
var Router = (function () {
    function Router(rootComponent, resolver, urlSerializer, outletMap, location) {
        this.rootComponent = rootComponent;
        this.resolver = resolver;
        this.urlSerializer = urlSerializer;
        this.outletMap = outletMap;
        this.location = location;
        this.currentUrlTree = url_tree_1.createEmptyUrlTree();
        this.currentRouterState = router_state_1.createEmptyState(rootComponent.constructor);
        this.setUpLocationChangeListener();
        this.navigateByUrl(this.location.path());
    }
    Object.defineProperty(Router.prototype, "routerState", {
        get: function () {
            return this.currentRouterState;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Router.prototype, "urlTree", {
        get: function () {
            return this.currentUrlTree;
        },
        enumerable: true,
        configurable: true
    });
    Router.prototype.navigateByUrl = function (url) {
        var urlTree = this.urlSerializer.parse(url);
        return this.runNavigate(urlTree, false);
    };
    Router.prototype.resetConfig = function (config) {
        this.config = config;
    };
    Router.prototype.dispose = function () { this.locationSubscription.unsubscribe(); };
    Router.prototype.createUrlTree = function (commands, _a) {
        var _b = _a === void 0 ? {} : _a, relativeTo = _b.relativeTo, queryParameters = _b.queryParameters, fragment = _b.fragment;
        var a = relativeTo ? relativeTo : this.routerState.root;
        return create_url_tree_1.createUrlTree(a, this.currentUrlTree, commands, queryParameters, fragment);
    };
    Router.prototype.navigate = function (commands, extras) {
        if (extras === void 0) { extras = {}; }
        return this.runNavigate(this.createUrlTree(commands, extras));
    };
    Router.prototype.serializeUrl = function (url) { return this.urlSerializer.serialize(url); };
    Router.prototype.parseUrl = function (url) { return this.urlSerializer.parse(url); };
    Router.prototype.setUpLocationChangeListener = function () {
        var _this = this;
        this.locationSubscription = this.location.subscribe(function (change) {
            _this.runNavigate(_this.urlSerializer.parse(change['url']), change['pop']);
        });
    };
    Router.prototype.runNavigate = function (url, pop) {
        var _this = this;
        var r = recognize_1.recognize(this.config, url, this.currentRouterState).mergeMap(function (newState) {
            return new ActivateRoutes(_this.resolver, newState, _this.currentRouterState).activate(_this.outletMap).map(function () {
                _this.currentUrlTree = url;
                _this.currentRouterState = newState;
                if (!pop) {
                    _this.location.go(_this.urlSerializer.serialize(url));
                }
            });
        });
        r.subscribe(function (a) { }, function (e) { }, function () { });
        return r;
    };
    return Router;
}());
exports.Router = Router;
var ActivateRoutes = (function () {
    function ActivateRoutes(resolver, futureState, currState) {
        this.resolver = resolver;
        this.futureState = futureState;
        this.currState = currState;
    }
    ActivateRoutes.prototype.activate = function (parentOutletMap) {
        var currRoot = this.currState ? tree_1.rootNode(this.currState) : null;
        var futureRoot = tree_1.rootNode(this.futureState);
        return this.activateChildRoutes(futureRoot, currRoot, parentOutletMap);
    };
    ActivateRoutes.prototype.activateChildRoutes = function (futureNode, currNode, outletMap) {
        var _this = this;
        var prevChildren = nodeChildrenAsMap(currNode);
        var observables = [];
        futureNode.children.forEach(function (c) {
            observables.push(_this.activateRoutes(c, prevChildren[c.value.outlet], outletMap).toPromise());
            delete prevChildren[c.value.outlet];
        });
        collection_1.forEach(prevChildren, function (v, k) { return _this.deactivateOutletAndItChildren(outletMap._outlets[k]); });
        return forkJoin_1.forkJoin(observables);
    };
    ActivateRoutes.prototype.activateRoutes = function (futureNode, currNode, parentOutletMap) {
        var _this = this;
        var future = futureNode.value;
        var curr = currNode ? currNode.value : null;
        var outlet = getOutlet(parentOutletMap, futureNode.value);
        if (future === curr) {
            return this.activateChildRoutes(futureNode, currNode, outlet.outletMap);
        }
        else {
            this.deactivateOutletAndItChildren(outlet);
            var outletMap_1 = new router_outlet_map_1.RouterOutletMap();
            return this.activateNewRoutes(outletMap_1, future, outlet).mergeMap(function () {
                return _this.activateChildRoutes(futureNode, currNode, outletMap_1);
            });
        }
    };
    ActivateRoutes.prototype.activateNewRoutes = function (outletMap, future, outlet) {
        var resolved = core_1.ReflectiveInjector.resolve([
            { provide: router_state_1.ActivatedRoute, useValue: future },
            { provide: router_outlet_map_1.RouterOutletMap, useValue: outletMap }
        ]);
        return fromPromise_1.fromPromise(this.resolver.resolveComponent(future.component)).
            map(function (factory) { return outlet.activate(factory, resolved, outletMap); });
    };
    ActivateRoutes.prototype.deactivateOutletAndItChildren = function (outlet) {
        var _this = this;
        if (outlet && outlet.isActivated) {
            collection_1.forEach(outlet.outletMap._outlets, function (v, k) { return _this.deactivateOutletAndItChildren(v); });
            outlet.deactivate();
        }
    };
    return ActivateRoutes;
}());
function nodeChildrenAsMap(node) {
    return node ?
        node.children.reduce(function (m, c) {
            m[c.value.outlet] = c;
            return m;
        }, {}) :
        {};
}
function getOutlet(outletMap, route) {
    var outlet = outletMap._outlets[route.outlet];
    if (!outlet) {
        if (route.outlet === shared_1.PRIMARY_OUTLET) {
            throw new Error("Cannot find primary outlet");
        }
        else {
            throw new Error("Cannot find the outlet " + route.outlet);
        }
    }
    return outlet;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3JvdXRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEscUJBQXNELGVBQWUsQ0FBQyxDQUFBO0FBR3RFLGtDQUFnQyxxQkFBcUIsQ0FBQyxDQUFBO0FBQ3RELDBCQUEwQixhQUFhLENBQUMsQ0FBQTtBQUN4QyxxQkFBbUMsY0FBYyxDQUFDLENBQUE7QUFDbEQseUJBQTRDLFlBQVksQ0FBQyxDQUFBO0FBQ3pELHVCQUF1QyxVQUFVLENBQUMsQ0FBQTtBQUNsRCw2QkFBNkQsZ0JBQWdCLENBQUMsQ0FBQTtBQUc5RSxnQ0FBOEIsbUJBQW1CLENBQUMsQ0FBQTtBQUNsRCwyQkFBd0Isb0JBQW9CLENBQUMsQ0FBQTtBQUc3QyxRQUFPLHVCQUF1QixDQUFDLENBQUE7QUFDL0IsUUFBTyw0QkFBNEIsQ0FBQyxDQUFBO0FBQ3BDLFFBQU8sNkJBQTZCLENBQUMsQ0FBQTtBQUNyQyw0QkFBMEIsNkJBQTZCLENBQUMsQ0FBQTtBQUN4RCx5QkFBdUIsMEJBQTBCLENBQUMsQ0FBQTtBQU9sRDtJQVNFLGdCQUFvQixhQUFvQixFQUFVLFFBQTJCLEVBQVUsYUFBNEIsRUFBVSxTQUEwQixFQUFVLFFBQWtCO1FBQS9KLGtCQUFhLEdBQWIsYUFBYSxDQUFPO1FBQVUsYUFBUSxHQUFSLFFBQVEsQ0FBbUI7UUFBVSxrQkFBYSxHQUFiLGFBQWEsQ0FBZTtRQUFVLGNBQVMsR0FBVCxTQUFTLENBQWlCO1FBQVUsYUFBUSxHQUFSLFFBQVEsQ0FBVTtRQUNqTCxJQUFJLENBQUMsY0FBYyxHQUFHLDZCQUFrQixFQUFFLENBQUM7UUFDM0MsSUFBSSxDQUFDLGtCQUFrQixHQUFHLCtCQUFnQixDQUFNLGFBQWEsQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUMzRSxJQUFJLENBQUMsMkJBQTJCLEVBQUUsQ0FBQztRQUNuQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxF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UUFDVCxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FDbEIsVUFBQyxDQUFDLEVBQUUsQ0FBQztZQUNILENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUN0QixNQUFNLENBQUMsQ0FBQyxDQUFDO1FBQ1gsQ0FBQyxFQUNELEVBQUUsQ0FBQztRQUNQLEVBQUUsQ0FBQztBQUNMLENBQUM7QUFFRCxtQkFBbUIsU0FBMEIsRUFBRSxLQUFxQjtJQUNsRSxJQUFJLE1BQU0sR0FBRyxTQUFTLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUM5QyxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7UUFDWixFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsTUFBTSxLQUFLLHVCQUFjLENBQUMsQ0FBQyxDQUFDO1lBQ3BDLE1BQU0sSUFBSSxLQUFLLENBQUMsNEJBQTRCLENBQUMsQ0FBQztRQUNoRCxDQUFDO1FBQUMsSUFBSSxDQUFDLENBQUM7WUFDTixNQUFNLElBQUksS0FBSyxDQUFDLDRCQUEwQixLQUFLLENBQUMsTUFBUSxDQUFDLENBQUM7UUFDNUQsQ0FBQztJQUNILENBQUM7SUFDRCxNQUFNLENBQUMsTUFBTSxDQUFDO0FBQ2hCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBDb21wb25lbnRSZXNvbHZlciwgUmVmbGVjdGl2ZUluamVjdG9yIH0gZnJvbSAnQGFuZ3VsYXIvY29yZSc7XG5pbXBvcnQgeyBMb2NhdGlvbiB9IGZyb20gJ0Bhbmd1bGFyL2NvbW1vbic7XG5pbXBvcnQgeyBVcmxTZXJpYWxpemVyIH0gZnJvbSAnLi91cmxfc2VyaWFsaXplcic7XG5pbXBvcnQgeyBSb3V0ZXJPdXRsZXRNYXAgfSBmcm9tICcuL3JvdXRlcl9vdXRsZXRfbWFwJztcbmltcG9ydCB7IHJlY29nbml6ZSB9IGZyb20gJy4vcmVjb2duaXplJztcbmltcG9ydCB7IHJvb3ROb2RlLCBUcmVlTm9kZSB9IGZyb20gJy4vdXRpbHMvdHJlZSc7XG5pbXBvcnQgeyBVcmxUcmVlLCBjcmVhdGVFbXB0eVVybFRyZWUgfSBmcm9tICcuL3VybF90cmVlJztcbmltcG9ydCB7IFBSSU1BUllfT1VUTEVULCBQYXJhbXMgfSBmcm9tICcuL3NoYXJlZCc7XG5pbXBvcnQgeyBjcmVhdGVFbXB0eVN0YXRlLCBSb3V0ZXJTdGF0ZSwgQWN0aXZhdGVkUm91dGV9IGZyb20gJy4vcm91dGVyX3N0YXRlJztcbmltcG9ydCB7IFJvdXRlckNvbmZpZyB9IGZyb20gJy4vY29uZmlnJztcbmltcG9ydCB7IFJvdXRlck91dGxldCB9IGZyb20gJy4vZGlyZWN0aXZlcy9yb3V0ZXJfb3V0bGV0JztcbmltcG9ydCB7IGNyZWF0ZVVybFRyZWUgfSBmcm9tICcuL2NyZWF0ZV91cmxfdHJlZSc7XG5pbXBvcnQgeyBmb3JFYWNoIH0gZnJvbSAnLi91dGlscy9jb2xsZWN0aW9uJztcbmltcG9ydCB7IE9ic2VydmFibGUgfSBmcm9tICdyeGpzL09ic2VydmFibGUnO1xuaW1wb3J0IHsgU3Vic2NyaXB0aW9uIH0gZnJvbSAncnhqcy9TdWJzY3JpcHRpb24nO1xuaW1wb3J0ICdyeGpzL2FkZC9vcGVyYXRvci9tYXAnO1xuaW1wb3J0ICdyeGpzL2FkZC9vcGVyYXRvci9tZXJnZU1hcCc7XG5pbXBvcnQgJ3J4anMvYWRkL29wZXJhdG9yL3RvUHJvbWlzZSc7XG5pbXBvcnQge2Zyb21Qcm9taXNlfSBmcm9tICdyeGpzL29ic2VydmFibGUvZnJvbVByb21pc2UnO1xuaW1wb3J0IHtmb3JrSm9pbn0gZnJvbSAncnhqcy9vYnNlcnZhYmxlL2ZvcmtKb2luJztcblxuZXhwb3J0IGludGVyZmFjZSBOYXZpZ2F0aW9uRXh0cmFzIHsgcmVsYXRpdmVUbz86IEFjdGl2YXRlZFJvdXRlOyBxdWVyeVBhcmFtZXRlcnM/OiBQYXJhbXM7IGZyYWdtZW50Pzogc3RyaW5nOyB9XG5cbi8qKlxuICogVGhlIGBSb3V0ZXJgIGlzIHJlc3BvbnNpYmxlIGZvciBtYXBwaW5nIFVSTHMgdG8gY29tcG9uZW50cy5cbiAqL1xuZXhwb3J0IGNsYXNzIFJvdXRlciB7XG4gIHByaXZhdGUgY3VycmVudFVybFRyZWU6IFVybFRyZWU7XG4gIHByaXZhdGUgY3VycmVudFJvdXRlclN0YXRlOiBSb3V0ZXJTdGF0ZTtcbiAgcHJpdmF0ZSBjb25maWc6IFJvdXRlckNvbmZpZztcbiAgcHJpdmF0ZSBsb2NhdGlvblN1YnNjcmlwdGlvbjogU3Vic2NyaXB0aW9uO1xuXG4gIC8qKlxuICAgKiBAaW50ZXJuYWxcbiAgICovXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgcm9vdENvbXBvbmVudDpPYmplY3QsIHByaXZhdGUgcmVzb2x2ZXI6IENvbXBvbmVudFJlc29sdmVyLCBwcml2YXRlIHVybFNlcmlhbGl6ZXI6IFVybFNlcmlhbGl6ZXIsIHByaXZhdGUgb3V0bGV0TWFwOiBSb3V0ZXJPdXRsZXRNYXAsIHByaXZhdGUgbG9jYXRpb246IExvY2F0aW9uKSB7XG4gICAgdGhpcy5jdXJyZW50VXJsVHJlZSA9IGNyZWF0ZUVtcHR5VXJsVHJlZSgpO1xuICAgIHRoaXMuY3VycmVudFJvdXRlclN0YXRlID0gY3JlYXRlRW1wdHlTdGF0ZSg8YW55PnJvb3RDb21wb25lbnQuY29uc3RydWN0b3IpO1xuICAgIHRoaXMuc2V0VXBMb2NhdGlvbkNoYW5nZUxpc3RlbmVyKCk7XG4gICAgdGhpcy5uYXZpZ2F0ZUJ5VXJsKHRoaXMubG9jYXRpb24ucGF0aCgpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRoZSBjdXJyZW50IHJvdXRlIHN0YXRlLlxuICAgKi9cbiAgZ2V0IHJvdXRlclN0YXRlKCk6IFJvdXRlclN0YXRlIHtcbiAgICByZXR1cm4gdGhpcy5jdXJyZW50Um91dGVyU3RhdGU7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyB0aGUgY3VycmVudCB1cmwgdHJlZS5cbiAgICovXG4gIGdldCB1cmxUcmVlKCk6IFVybFRyZWUge1xuICAgIHJldHVybiB0aGlzLmN1cnJlbnRVcmxUcmVlO1xuICB9XG5cbiAgLyoqXG4gICAqIE5hdmlnYXRlIGJhc2VkIG9uIHRoZSBwcm92aWRlZCB1cmwuIFRoaXMgbmF2aWdhdGlvbiBpcyBhbHdheXMgYWJzb2x1dGUuXG4gICAqXG4gICAqICMjIyBVc2FnZVxuICAgKlxuICAgKiBgYGBcbiAgICogcm91dGVyLm5hdmlnYXRlQnlVcmwoXCIvdGVhbS8zMy91c2VyLzExXCIpO1xuICAgKiBgYGBcbiAgICovXG4gIG5hdmlnYXRlQnlVcmwodXJsOiBzdHJpbmcpOiBPYnNlcnZhYmxlPHZvaWQ+IHtcbiAgICBjb25zdCB1cmxUcmVlID0gdGhpcy51cmxTZXJpYWxpemVyLnBhcnNlKHVybCk7XG4gICAgcmV0dXJuIHRoaXMucnVuTmF2aWdhdGUodXJsVHJlZSwgZmFsc2UpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlc2V0cyB0aGUgY29uZmlndXJhdGlvbiB1c2VkIGZvciBuYXZpZ2F0aW9uIGFuZCBnZW5lcmF0aW5nIGxpbmtzLlxuICAgKlxuICAgKiAjIyMgVXNhZ2VcbiAgICpcbiAgICogYGBgXG4gICAqIHJvdXRlci5yZXNldENvbmZpZyhbXG4gICAqICB7IHBhdGg6ICd0ZWFtLzppZCcsIGNvbXBvbmVudDogVGVhbUNtcCwgY2hpbGRyZW46IFtcbiAgICogICAgeyBwYXRoOiAnc2ltcGxlJywgY29tcG9uZW50OiBTaW1wbGVDbXAgfSxcbiAgICogICAgeyBwYXRoOiAndXNlci86bmFtZScsIGNvbXBvbmVudDogVXNlckNtcCB9XG4gICAqICBdIH1cbiAgICogXSk7XG4gICAqIGBgYFxuICAgKi9cbiAgcmVzZXRDb25maWcoY29uZmlnOiBSb3V0ZXJDb25maWcpOiB2b2lkIHtcbiAgICB0aGlzLmNvbmZpZyA9IGNvbmZpZztcbiAgfVxuXG4gIC8qKlxuICAgKiBAaW50ZXJuYWxcbiAgICovXG4gIGRpc3Bvc2UoKTogdm9pZCB7IHRoaXMubG9jYXRpb25TdWJzY3JpcHRpb24udW5zdWJzY3JpYmUoKTsgfVxuXG4gIC8qKlxuICAgKiBBcHBsaWVzIGFuIGFycmF5IG9mIGNvbW1hbmRzIHRvIHRoZSBjdXJyZW50IHVybCB0cmVlIGFuZCBjcmVhdGVzXG4gICAqIGEgbmV3IHVybCB0cmVlLlxuICAgKlxuICAgKiBXaGVuIGdpdmVuIGFuIGFjdGl2YXRlIHJvdXRlLCBhcHBsaWVzIHRoZSBnaXZlbiBjb21tYW5kcyBzdGFydGluZyBmcm9tIHRoZSByb3V0ZS5cbiAgICogV2hlbiBub3QgZ2l2ZW4gYSByb3V0ZSwgYXBwbGllcyB0aGUgZ2l2ZW4gY29tbWFuZCBzdGFydGluZyBmcm9tIHRoZSByb290LlxuICAgKlxuICAgKiAjIyMgVXNhZ2VcbiAgICpcbiAgICogYGBgXG4gICAqIC8vIGNyZWF0ZSAvdGVhbS8zMy91c2VyLzExXG4gICAqIHJvdXRlci5jcmVhdGVVcmxUcmVlKFsnL3RlYW0nLCAzMywgJ3VzZXInLCAxMV0pO1xuICAgKlxuICAgKiAvLyBjcmVhdGUgL3RlYW0vMzM7ZXhwYW5kPXRydWUvdXNlci8xMVxuICAgKiByb3V0ZXIuY3JlYXRlVXJsVHJlZShbJy90ZWFtJywgMzMsIHtleHBhbmQ6IHRydWV9LCAndXNlcicsIDExXSk7XG4gICAqXG4gICAqIC8vIHlvdSBjYW4gY29sbGFwc2Ugc3RhdGljIGZyYWdtZW50cyBsaWtlIHRoaXNcbiAgICogcm91dGVyLmNyZWF0ZVVybFRyZWUoWycvdGVhbS8zMy91c2VyJywgdXNlcklkXSk7XG4gICAqXG4gICAqIC8vIGFzc3VtaW5nIHRoZSBjdXJyZW50IHVybCBpcyBgL3RlYW0vMzMvdXNlci8xMWAgYW5kIHRoZSByb3V0ZSBwb2ludHMgdG8gYHVzZXIvMTFgXG4gICAqXG4gICAqIC8vIG5hdmlnYXRlIHRvIC90ZWFtLzMzL3VzZXIvMTEvZGV0YWlsc1xuICAgKiByb3V0ZXIuY3JlYXRlVXJsVHJlZShbJ2RldGFpbHMnXSwge3JlbGF0aXZlVG86IHJvdXRlfSk7XG4gICAqXG4gICAqIC8vIG5hdmlnYXRlIHRvIC90ZWFtLzMzL3VzZXIvMjJcbiAgICogcm91dGVyLmNyZWF0ZVVybFRyZWUoWycuLi8yMiddLCB7cmVsYXRpdmVUbzogcm91dGV9KTtcbiAgICpcbiAgICogLy8gbmF2aWdhdGUgdG8gL3RlYW0vNDQvdXNlci8yMlxuICAgKiByb3V0ZXIuY3JlYXRlVXJsVHJlZShbJy4uLy4uL3RlYW0vNDQvdXNlci8yMiddLCB7cmVsYXRpdmVUbzogcm91dGV9KTtcbiAgICogYGBgXG4gICAqL1xuICBjcmVhdGVVcmxUcmVlKGNvbW1hbmRzOiBhbnlbXSwge3JlbGF0aXZlVG8sIHF1ZXJ5UGFyYW1ldGVycywgZnJhZ21lbnR9OiBOYXZpZ2F0aW9uRXh0cmFzID0ge30pOiBVcmxUcmVlIHtcbiAgICBjb25zdCBhID0gcmVsYXRpdmVUbyA/IHJlbGF0aXZlVG8gOiB0aGlzLnJvdXRlclN0YXRlLnJvb3Q7XG4gICAgcmV0dXJuIGNyZWF0ZVVybFRyZWUoYSwgdGhpcy5jdXJyZW50VXJsVHJlZSwgY29tbWFuZHMsIHF1ZXJ5UGFyYW1ldGVycywgZnJhZ21lbnQpO1xuICB9XG5cblxuICAvKipcbiAgICogTmF2aWdhdGUgYmFzZWQgb24gdGhlIHByb3ZpZGVkIGFycmF5IG9mIGNvbW1hbmRzIGFuZCBhIHN0YXJ0aW5nIHBvaW50LlxuICAgKiBJZiBubyBzdGFydGluZyByb3V0ZSBpcyBwcm92aWRlZCwgdGhlIG5hdmlnYXRpb24gaXMgYWJzb2x1dGUuXG4gICAqXG4gICAqICMjIyBVc2FnZVxuICAgKlxuICAgKiBgYGBcbiAgICogcm91dGVyLm5hdmlnYXRlKFsndGVhbScsIDMzLCAndGVhbScsICcxMV0sIHtyZWxhdGl2ZVRvOiByb3V0ZX0pO1xuICAgKiBgYGBcbiAgICovXG4gIG5hdmlnYXRlKGNvbW1hbmRzOiBhbnlbXSwgZXh0cmFzOiBOYXZpZ2F0aW9uRXh0cmFzID0ge30pOiBPYnNlcnZhYmxlPHZvaWQ+IHtcbiAgICByZXR1cm4gdGhpcy5ydW5OYXZpZ2F0ZSh0aGlzLmNyZWF0ZVVybFRyZWUoY29tbWFuZHMsIGV4dHJhcykpO1xuICB9XG5cbiAgLyoqXG4gICAqIFNlcmlhbGl6ZXMgYSB7QGxpbmsgVXJsVHJlZX0gaW50byBhIHN0cmluZy5cbiAgICovXG4gIHNlcmlhbGl6ZVVybCh1cmw6IFVybFRyZWUpOiBzdHJpbmcgeyByZXR1cm4gdGhpcy51cmxTZXJpYWxpemVyLnNlcmlhbGl6ZSh1cmwpOyB9XG5cbiAgLyoqXG4gICAqIFBhcnNlIGEgc3RyaW5nIGludG8gYSB7QGxpbmsgVXJsVHJlZX0uXG4gICAqL1xuICBwYXJzZVVybCh1cmw6IHN0cmluZyk6IFVybFRyZWUgeyByZXR1cm4gdGhpcy51cmxTZXJpYWxpemVyLnBhcnNlKHVybCk7IH1cblxuICBwcml2YXRlIHNldFVwTG9jYXRpb25DaGFuZ2VMaXN0ZW5lcigpOiB2b2lkIHtcbiAgICB0aGlzLmxvY2F0aW9uU3Vic2NyaXB0aW9uID0gPGFueT50aGlzLmxvY2F0aW9uLnN1YnNjcmliZSgoY2hhbmdlKSA9PiB7XG4gICAgICB0aGlzLnJ1bk5hdmlnYXRlKHRoaXMudXJsU2VyaWFsaXplci5wYXJzZShjaGFuZ2VbJ3VybCddKSwgY2hhbmdlWydwb3AnXSlcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgcnVuTmF2aWdhdGUodXJsOlVybFRyZWUsIHBvcD86Ym9vbGVhbik6T2JzZXJ2YWJsZTx2b2lkPiB7XG4gICAgY29uc3QgciA9IHJlY29nbml6ZSh0aGlzLmNvbmZpZywgdXJsLCB0aGlzLmN1cnJlbnRSb3V0ZXJTdGF0ZSkubWVyZ2VNYXAoKG5ld1N0YXRlOlJvdXRlclN0YXRlKSA9PiB7XG4gICAgICByZXR1cm4gbmV3IEFjdGl2YXRlUm91dGVzKHRoaXMucmVzb2x2ZXIsIG5ld1N0YXRlLCB0aGlzLmN1cnJlbnRSb3V0ZXJTdGF0ZSkuYWN0aXZhdGUodGhpcy5vdXRsZXRNYXApLm1hcCgoKSA9PiB7XG4gICAgICAgIHRoaXMuY3VycmVudFVybFRyZWUgPSB1cmw7XG4gICAgICAgIHRoaXMuY3VycmVudFJvdXRlclN0YXRlID0gbmV3U3RhdGU7XG4gICAgICAgIGlmICghcG9wKSB7XG4gICAgICAgICAgdGhpcy5sb2NhdGlvbi5nbyh0aGlzLnVybFNlcmlhbGl6ZXIuc2VyaWFsaXplKHVybCkpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcbiAgICByLnN1YnNjcmliZSgoYSkgPT4ge30sIChlKSA9PiB7fSwgKCkgPT4ge30pOyAvLyBmb3JjZSBleGVjdXRpb25cbiAgICByZXR1cm4gcjtcbiAgfVxufVxuXG5jbGFzcyBBY3RpdmF0ZVJvdXRlcyB7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgcmVzb2x2ZXI6IENvbXBvbmVudFJlc29sdmVyLCBwcml2YXRlIGZ1dHVyZVN0YXRlOiBSb3V0ZXJTdGF0ZSwgcHJpdmF0ZSBjdXJyU3RhdGU6IFJvdXRlclN0YXRlKSB7fVxuXG4gIGFjdGl2YXRlKHBhcmVudE91dGxldE1hcDogUm91dGVyT3V0bGV0TWFwKTogT2JzZXJ2YWJsZTx2b2lkPiB7XG4gICAgY29uc3QgY3VyclJvb3QgPSB0aGlzLmN1cnJTdGF0ZSA/IHJvb3ROb2RlKHRoaXMuY3VyclN0YXRlKSA6IG51bGw7XG4gICAgY29uc3QgZnV0dXJlUm9vdCA9IHJvb3ROb2RlKHRoaXMuZnV0dXJlU3RhdGUpO1xuICAgIHJldHVybiB0aGlzLmFjdGl2YXRlQ2hpbGRSb3V0ZXMoZnV0dXJlUm9vdCwgY3VyclJvb3QsIHBhcmVudE91dGxldE1hcCk7XG4gIH1cblxuICBwcml2YXRlIGFjdGl2YXRlQ2hpbGRSb3V0ZXMoZnV0dXJlTm9kZTogVHJlZU5vZGU8QWN0aXZhdGVkUm91dGU+LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY3Vyck5vZGU6IFRyZWVOb2RlPEFjdGl2YXRlZFJvdXRlPiB8IG51bGwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvdXRsZXRNYXA6IFJvdXRlck91dGxldE1hcCk6IE9ic2VydmFibGU8YW55PiB7XG4gICAgY29uc3QgcHJldkNoaWxkcmVuID0gbm9kZUNoaWxkcmVuQXNNYXAoY3Vyck5vZGUpO1xuICAgIGNvbnN0IG9ic2VydmFibGVzID0gW107XG4gICAgZnV0dXJlTm9kZS5jaGlsZHJlbi5mb3JFYWNoKGMgPT4ge1xuICAgICAgb2JzZXJ2YWJsZXMucHVzaCh0aGlzLmFjdGl2YXRlUm91dGVzKGMsIHByZXZDaGlsZHJlbltjLnZhbHVlLm91dGxldF0sIG91dGxldE1hcCkudG9Qcm9taXNlKCkpO1xuICAgICAgZGVsZXRlIHByZXZDaGlsZHJlbltjLnZhbHVlLm91dGxldF07XG4gICAgfSk7XG4gICAgZm9yRWFjaChwcmV2Q2hpbGRyZW4sICh2LCBrKSA9PiB0aGlzLmRlYWN0aXZhdGVPdXRsZXRBbmRJdENoaWxkcmVuKG91dGxldE1hcC5fb3V0bGV0c1trXSkpO1xuICAgIHJldHVybiBmb3JrSm9pbihvYnNlcnZhYmxlcyk7XG4gIH1cblxuXG4gIGFjdGl2YXRlUm91dGVzKGZ1dHVyZU5vZGU6IFRyZWVOb2RlPEFjdGl2YXRlZFJvdXRlPiwgY3Vyck5vZGU6IFRyZWVOb2RlPEFjdGl2YXRlZFJvdXRlPixcbiAgICAgICAgICAgICAgICAgcGFyZW50T3V0bGV0TWFwOiBSb3V0ZXJPdXRsZXRNYXApOiBPYnNlcnZhYmxlPHZvaWQ+IHtcbiAgICBjb25zdCBmdXR1cmUgPSBmdXR1cmVOb2RlLnZhbHVlO1xuICAgIGNvbnN0IGN1cnIgPSBjdXJyTm9kZSA/IGN1cnJOb2RlLnZhbHVlIDogbnVsbDtcbiAgICBjb25zdCBvdXRsZXQgPSBnZXRPdXRsZXQocGFyZW50T3V0bGV0TWFwLCBmdXR1cmVOb2RlLnZhbHVlKTtcblxuICAgIGlmIChmdXR1cmUgPT09IGN1cnIpIHtcbiAgICAgIHJldHVybiB0aGlzLmFjdGl2YXRlQ2hpbGRSb3V0ZXMoZnV0dXJlTm9kZSwgY3Vyck5vZGUsIG91dGxldC5vdXRsZXRNYXApO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmRlYWN0aXZhdGVPdXRsZXRBbmRJdENoaWxkcmVuKG91dGxldCk7XG4gICAgICBjb25zdCBvdXRsZXRNYXAgPSBuZXcgUm91dGVyT3V0bGV0TWFwKCk7XG4gICAgICByZXR1cm4gdGhpcy5hY3RpdmF0ZU5ld1JvdXRlcyhvdXRsZXRNYXAsIGZ1dHVyZSwgb3V0bGV0KS5tZXJnZU1hcCgoKSA9PlxuICAgICAgICB0aGlzLmFjdGl2YXRlQ2hpbGRSb3V0ZXMoZnV0dXJlTm9kZSwgY3Vyck5vZGUsIG91dGxldE1hcCkpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgYWN0aXZhdGVOZXdSb3V0ZXMob3V0bGV0TWFwOiBSb3V0ZXJPdXRsZXRNYXAsIGZ1dHVyZTogQWN0aXZhdGVkUm91dGUsIG91dGxldDogUm91dGVyT3V0bGV0KTogT2JzZXJ2YWJsZTx2b2lkPiB7XG4gICAgY29uc3QgcmVzb2x2ZWQgPSBSZWZsZWN0aXZlSW5qZWN0b3IucmVzb2x2ZShbXG4gICAgICB7cHJvdmlkZTogQWN0aXZhdGVkUm91dGUsIHVzZVZhbHVlOiBmdXR1cmV9LFxuICAgICAge3Byb3ZpZGU6IFJvdXRlck91dGxldE1hcCwgdXNlVmFsdWU6IG91dGxldE1hcH1cbiAgICBdKTtcbiAgICByZXR1cm4gZnJvbVByb21pc2UodGhpcy5yZXNvbHZlci5yZXNvbHZlQ29tcG9uZW50KDxhbnk+ZnV0dXJlLmNvbXBvbmVudCkpLlxuICAgICAgbWFwKGZhY3RvcnkgPT4gb3V0bGV0LmFjdGl2YXRlKGZhY3RvcnksIHJlc29sdmVkLCBvdXRsZXRNYXApKTtcbiAgfVxuXG4gIHByaXZhdGUgZGVhY3RpdmF0ZU91dGxldEFuZEl0Q2hpbGRyZW4ob3V0bGV0OiBSb3V0ZXJPdXRsZXQpOiB2b2lkIHtcbiAgICBpZiAob3V0bGV0ICYmIG91dGxldC5pc0FjdGl2YXRlZCkge1xuICAgICAgZm9yRWFjaChvdXRsZXQub3V0bGV0TWFwLl9vdXRsZXRzLCAodiwgaykgPT4gdGhpcy5kZWFjdGl2YXRlT3V0bGV0QW5kSXRDaGlsZHJlbih2KSk7XG4gICAgICBvdXRsZXQuZGVhY3RpdmF0ZSgpO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBub2RlQ2hpbGRyZW5Bc01hcChub2RlOiBUcmVlTm9kZTxBY3RpdmF0ZWRSb3V0ZT58bnVsbCkge1xuICByZXR1cm4gbm9kZSA/XG4gICAgbm9kZS5jaGlsZHJlbi5yZWR1Y2UoXG4gICAgICAobSwgYykgPT4ge1xuICAgICAgICBtW2MudmFsdWUub3V0bGV0XSA9IGM7XG4gICAgICAgIHJldHVybiBtO1xuICAgICAgfSxcbiAgICAgIHt9KSA6XG4gIHt9O1xufVxuXG5mdW5jdGlvbiBnZXRPdXRsZXQob3V0bGV0TWFwOiBSb3V0ZXJPdXRsZXRNYXAsIHJvdXRlOiBBY3RpdmF0ZWRSb3V0ZSk6IFJvdXRlck91dGxldCB7XG4gIGxldCBvdXRsZXQgPSBvdXRsZXRNYXAuX291dGxldHNbcm91dGUub3V0bGV0XTtcbiAgaWYgKCFvdXRsZXQpIHtcbiAgICBpZiAocm91dGUub3V0bGV0ID09PSBQUklNQVJZX09VVExFVCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBDYW5ub3QgZmluZCBwcmltYXJ5IG91dGxldGApO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENhbm5vdCBmaW5kIHRoZSBvdXRsZXQgJHtyb3V0ZS5vdXRsZXR9YCk7XG4gICAgfVxuICB9XG4gIHJldHVybiBvdXRsZXQ7XG59XG4iXX0=