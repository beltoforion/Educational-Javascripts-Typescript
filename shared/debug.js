var Debug = /** @class */ (function () {
    function Debug() {
    }
    Debug.assert = function (condition, message) {
        if (message === void 0) { message = "Assertion failed"; }
        if (!condition) {
            if (typeof Error !== "undefined") {
                throw new Error(message);
            }
            throw message;
        }
    };
    return Debug;
}());
