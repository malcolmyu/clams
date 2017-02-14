export default function createEventManager(ctx) {
  let events = {};

  function $on(name, listener) {
    (events[name] || (events[name] = [])).push(listener);
    return ctx;
  }

  function $emit(name, ...args) {
    const listeners = events[name];
    if (listeners) {
      listeners.forEach(listener => listener.apply(ctx, args));
    }
    return ctx;
  }

  function $off(name, callback) {
    // all
    if (!arguments.length) {
      events = Object.create(null);
      return ctx;
    }
    // 特定事件
    const listeners = events[name];
    if (!listeners) {
      return ctx;
    }
    if (arguments.length === 1) {
      events[name] = null;
      return ctx;
    }
    // 特定回调
    listeners.some((listener, i) => {
      if (listener === callback) {
        listeners.splice(i, 1);
        return true;
      }
    });
    return ctx;
  }

  function $once(name, listener) {
    function on() {
      $off(name, on);
      listener.apply(ctx, arguments);
    }

    $on(name, on);
    return ctx;
  }

  return {
    $on,
    $emit,
    $off,
    $once
  }
};
