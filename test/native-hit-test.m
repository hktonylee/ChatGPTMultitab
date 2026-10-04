#import <Cocoa/Cocoa.h>
#include <node_api.h>
#include <string.h>

static NSWindow *readPoint(napi_env env, napi_callback_info info, NSPoint *point) {
  size_t argc = 3;
  napi_value args[3];
  napi_get_cb_info(env, info, &argc, args, NULL, NULL);
  void *data = NULL;
  size_t size = 0;
  double x = 0, y = 0;
  if (argc != 3 || napi_get_buffer_info(env, args[0], &data, &size) != napi_ok ||
      size != sizeof(void *) ||
      napi_get_value_double(env, args[1], &x) != napi_ok ||
      napi_get_value_double(env, args[2], &y) != napi_ok) {
    napi_throw_error(env, NULL, "Expected native window handle and x/y coordinates");
    return nil;
  }
  void *pointer = NULL;
  memcpy(&pointer, data, sizeof(pointer));
  NSWindow *window = ((__bridge NSView *)pointer).window;
  *point = NSMakePoint(x, window.frame.size.height - y);
  return window;
}

static NSView *target(NSWindow *window, NSPoint point) {
  NSView *root = window.contentView;
  while (root.superview) root = root.superview;
  return [root hitTest:point];
}

static napi_value hitTest(napi_env env, napi_callback_info info) {
  NSPoint point;
  NSWindow *window = readPoint(env, info, &point);
  if (!window) return NULL;
  NSString *name = NSStringFromClass([target(window, point) class]) ?: @"nil";
  napi_value value;
  napi_create_string_utf8(env, name.UTF8String, NAPI_AUTO_LENGTH, &value);
  return value;
}

static napi_value click(napi_env env, napi_callback_info info) {
  NSPoint point;
  NSWindow *window = readPoint(env, info, &point);
  if (!window) return NULL;
  // A caption click can enter AppKit's blocking window-drag loop. Tests must
  // establish that the point reaches Chromium before sending mouse events.
  if (![NSStringFromClass([target(window, point) class])
          isEqualToString:@"RenderWidgetHostViewCocoa"]) {
    napi_throw_error(env, NULL, "Native click target is not web content");
    return NULL;
  }
  for (NSNumber *type in @[@(NSEventTypeLeftMouseDown), @(NSEventTypeLeftMouseUp)]) {
    NSEvent *event = [NSEvent mouseEventWithType:type.unsignedIntegerValue
        location:point modifierFlags:0 timestamp:NSProcessInfo.processInfo.systemUptime
        windowNumber:window.windowNumber context:nil eventNumber:0 clickCount:1 pressure:1];
    // Synthetic NSEvents do not perform NSApplication's OS input routing.
    // Dispatch to the view found by the full native window hit-test above.
    NSView *hit = target(window, point);
    if (type.unsignedIntegerValue == NSEventTypeLeftMouseDown) {
      [hit mouseDown:event];
    } else {
      [hit mouseUp:event];
    }
  }
  napi_value value;
  napi_get_undefined(env, &value);
  return value;
}

NAPI_MODULE_INIT() {
  napi_value fn;
  napi_create_function(env, "hitTest", NAPI_AUTO_LENGTH, hitTest, NULL, &fn);
  napi_set_named_property(env, exports, "hitTest", fn);
  napi_create_function(env, "click", NAPI_AUTO_LENGTH, click, NULL, &fn);
  napi_set_named_property(env, exports, "click", fn);
  return exports;
}
