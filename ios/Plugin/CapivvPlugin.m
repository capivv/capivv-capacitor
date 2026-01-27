#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

// Define the plugin using the CAP_PLUGIN Macro, and
// each method the plugin supports using the CAP_PLUGIN_METHOD macro.
CAP_PLUGIN(CapivvPlugin, "Capivv",
           CAP_PLUGIN_METHOD(configure, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(identify, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(logout, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(getUserInfo, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(isBillingSupported, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(getOfferings, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(getProduct, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(getProducts, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(purchase, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(restorePurchases, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(checkEntitlement, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(getEntitlements, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(syncPurchases, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(manageSubscriptions, CAPPluginReturnPromise);
)
