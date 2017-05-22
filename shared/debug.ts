class Debug {
    public static assert(condition : boolean, message : string = "Assertion failed") : void {
        if (!condition) {
            if (typeof Error !== "undefined") {
                throw new Error(message);
            }

            throw message;
        }
    }
}
