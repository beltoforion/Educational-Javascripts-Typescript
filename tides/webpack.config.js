const path = require('path');
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = {
  entry: './src/index.ts',
    module: {
        rules: [
          {
            test: /\.tsx?$/,
            use: 'ts-loader',
            exclude: /node_modules/
          }
        ]
    },
    resolve: {
        extensions: [ '.tsx', '.ts', '.js' ]
    },
    output: {
        path: path.resolve(__dirname, 'dist'), // Output directory
        library: 'TidalSimulationLibrary',
        filename: 'tides-bundle.js',
        libraryTarget: 'umd', // Universal Module Definition
        globalObject: 'this', // Ensure compatibility
    },
    devtool: 'source-map'
}