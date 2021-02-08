const path = require("path");
const TerserPlugin = require("terser-webpack-plugin");

const environment = process.env.NODE_ENV || "prod";
const isProd = environment === "prod";

const optimization = {
    minimize: isProd,
    minimizer: [new TerserPlugin()]
};

const webpackConfig = {
    mode: "none",
    entry: {
        "leaflet.canvas-markers": "./src/_full.js",
        "leaflet.canvas-markers.standalone": "./src/_standalone.js",
    },
    devtool: isProd ? false : "source-map",
    output: {
        path: path.join(__dirname, "dist"),
        filename: "[name].js",
    },
    resolve: {
        extensions: [".js"]
    },
    module: {
        rules: [
            {
                test: /rbush.js/,
                use: "script-loader"
            }
        ]
    },
    optimization: optimization
};

module.exports = webpackConfig;
